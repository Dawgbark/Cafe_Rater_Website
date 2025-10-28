import time
from typing import Any, Dict, List, Optional

import requests
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_HEADERS = {"User-Agent": "CafeScout/1.0 (contact: you@example.com)"}
OVERPASS_TIMEOUT = 25
DEFAULT_RADIUS = 3000
RETRY_DELAY_SECONDS = 2
MAX_RETRIES = 1


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
  node["shop"="coffee"](around:{radius},{lat},{lon});
  way["shop"="coffee"](around:{radius},{lat},{lon});
);
out center tags;
"""


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


def _parse_overpass_elements(elements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    cafes: List[Dict[str, Any]] = []
    for element in elements:
        tags = element.get("tags", {})
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
            "osm_id": element.get("id"),
            "osm_type": element.get("type"),
        }
        cafes.append(cafe)
    return cafes


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

    query = build_overpass_query(lat, lon, radius)

    try:
        payload = _request_overpass(query)
        elements = payload.get("elements", []) if isinstance(payload, dict) else []
        cafes = _parse_overpass_elements(elements)
        return jsonify({"cafes": cafes, "count": len(cafes)})
    except Exception as exc:  # pragma: no cover - defensive for runtime logging
        return (
            jsonify({"error": "Failed to fetch cafes", "details": str(exc)}),
            502,
        )


if __name__ == "__main__":  # pragma: no cover
    app.run(debug=True)
