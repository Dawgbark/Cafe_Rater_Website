import logging
import re
import time
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_HEADERS = {"User-Agent": "CafeScout/1.0 (contact: you@example.com)"}
OVERPASS_TIMEOUT = 60
DEFAULT_RADIUS = 4000
MIN_RESULTS = 10
MAX_RADIUS = 15000
MAX_EXPANSIONS = 2
RETRY_DELAY_SECONDS = 2
MAX_RETRIES = 1

LIFECYCLE_PREFIXES: Tuple[str, ...] = ("disused:", "abandoned:", "was:")
LIFECYCLE_FLAGS: Tuple[str, ...] = ("disused", "abandoned", "closed")
CLOSED_NAME_PATTERN = re.compile(r"\bclosed\b", re.IGNORECASE)

logger = logging.getLogger(__name__)


@app.route("/")
def index() -> str:
    """Serve the main application shell."""
    return render_template("index.html")


def build_overpass_query(lat: float, lon: float, radius: int) -> str:
    """Construct an Overpass query for cafes near the given coordinates."""
    return f"""
[out:json][timeout:{OVERPASS_TIMEOUT}];
(
  node["amenity"="cafe"](around:{radius},{lat},{lon});
  way["amenity"="cafe"](around:{radius},{lat},{lon});
  relation["amenity"="cafe"](around:{radius},{lat},{lon});

  node["amenity"="coffee_shop"](around:{radius},{lat},{lon});
  way["amenity"="coffee_shop"](around:{radius},{lat},{lon});
  relation["amenity"="coffee_shop"](around:{radius},{lat},{lon});
)
["disused:amenity" !~ "."]
["abandoned:amenity" !~ "."]
["was:amenity" !~ "."]
["end_date" !~ "."]
["disused" != "yes"]
["abandoned" != "yes"]
["closed" != "yes"]
["name" !~ "(?i)closed"]
-> .results;
(.results;);
out center tags;
"""


def is_open_osm_poi(tags: Dict[str, str]) -> bool:
    """Return True if the OSM tags describe an open cafe."""

    if not tags:
        return True

    for key in tags:
        key_lower = key.lower()
        if key_lower.startswith(LIFECYCLE_PREFIXES):
            return False

    for flag in LIFECYCLE_FLAGS:
        if tags.get(flag) == "yes":
            return False

    if tags.get("end_date"):
        return False

    name = tags.get("name") or tags.get("brand") or ""
    if CLOSED_NAME_PATTERN.search(name):
        return False

    return True


def _request_overpass(query: str) -> Dict[str, Any]:
    """Execute an Overpass query with minimal retry handling."""
    last_error: Optional[Exception] = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = requests.post(
                OVERPASS_URL,
                data=query,
                headers=OVERPASS_HEADERS,
                timeout=OVERPASS_TIMEOUT,
            )
            if response.status_code in {429, 504} and attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY_SECONDS)
                continue
            response.raise_for_status()
            return response.json()
        except (requests.Timeout, requests.RequestException) as exc:
            last_error = exc
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY_SECONDS)
                continue
    raise RuntimeError("Overpass request failed") from last_error


def _format_address(tags: Dict[str, str]) -> Optional[str]:
    parts = [
        tags.get("addr:housenumber"),
        tags.get("addr:street"),
        tags.get("addr:city"),
        tags.get("addr:postcode"),
    ]
    filtered = [part for part in parts if part]
    return ", ".join(filtered) if filtered else None


def _parse_overpass_elements(elements: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    cafes: List[Dict[str, Any]] = []
    seen: set = set()
    for element in elements:
        tags = element.get("tags", {})
        if not is_open_osm_poi(tags):
            continue

        osm_id = element.get("id")
        osm_type = element.get("type")
        if osm_id is not None and osm_type is not None:
            key = (osm_type, osm_id)
            if key in seen:
                continue
            seen.add(key)

        lat = element.get("lat")
        lon = element.get("lon")
        if lat is None or lon is None:
            center = element.get("center") or {}
            lat = center.get("lat")
            lon = center.get("lon")
        if lat is None or lon is None:
            continue
        name = tags.get("name") or tags.get("brand") or "Unnamed Cafe"
        cafe: Dict[str, Any] = {
            "name": name,
            "lat": lat,
            "lon": lon,
            "address": _format_address(tags),
            "source": "osm",
            "osm_id": osm_id,
            "osm_type": osm_type,
        }
        cafes.append(cafe)
    return cafes


def _fetch_open_cafes(lat: float, lon: float, initial_radius: int) -> Tuple[List[Dict[str, Any]], int]:
    radius = max(initial_radius, DEFAULT_RADIUS)
    cafes: List[Dict[str, Any]] = []

    for expansion in range(MAX_EXPANSIONS + 1):
        query = build_overpass_query(lat, lon, radius)
        logger.info(
            "Requesting cafes radius=%s lat=%s lon=%s expansion=%s", radius, lat, lon, expansion
        )
        logger.debug("Overpass query:%s%s", "\n", query)

        payload = _request_overpass(query)
        elements = payload.get("elements", []) if isinstance(payload, dict) else []
        raw_count = len(elements)

        cafes = _parse_overpass_elements(elements)
        filtered_count = len(cafes)

        logger.info(
            "Overpass returned %s results (%s open after filtering) for radius=%s",
            raw_count,
            filtered_count,
            radius,
        )

        if filtered_count >= MIN_RESULTS or radius >= MAX_RADIUS or expansion == MAX_EXPANSIONS:
            return cafes, radius

        radius = min(max(int(radius * 2), radius + DEFAULT_RADIUS), MAX_RADIUS)
        time.sleep(RETRY_DELAY_SECONDS)

    return cafes, radius


# Geolocation-powered cafe search endpoint for the frontend map UI.
@app.get("/api/cafes")
def cafes() -> Any:
    """Return cafes around the provided coordinates."""
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    radius = request.args.get("radius", default=DEFAULT_RADIUS, type=int)

    if lat is None or lon is None:
        return jsonify({"error": "lat and lon query parameters are required"}), 400

    if radius is None or radius <= 0:
        radius = DEFAULT_RADIUS

    try:
        cafes, final_radius = _fetch_open_cafes(lat, lon, radius or DEFAULT_RADIUS)
        response: Dict[str, Any] = {"cafes": cafes, "count": len(cafes), "radius": final_radius}
        if not cafes:
            response["message"] = "No open cafes found. Try expanding the search area."
        return jsonify(response)
    except RuntimeError as exc:  # pragma: no cover - defensive for runtime logging
        logger.exception("Overpass lookup failed: %s", exc)
        status = 504 if isinstance(exc.__cause__, requests.Timeout) else 502
        return (
            jsonify(
                {
                    "error": "Overpass request failed",
                    "details": str(exc.__cause__ or exc),
                }
            ),
            status,
        )
    except Exception as exc:  # pragma: no cover - defensive for runtime logging
        logger.exception("Failed to fetch cafes: %s", exc)
        return (
            jsonify({"error": "Failed to fetch cafes", "details": str(exc)}),
            502,
        )


if __name__ == "__main__":  # pragma: no cover
    app.run(debug=True)
