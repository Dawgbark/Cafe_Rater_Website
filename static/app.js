/* Frontend logic for the Cafe Scout experience.
 *
 * Features:
 *  - Geolocation based "Use my location" discovery.
 *  - Free text search powered by OpenStreetMap's Nominatim service.
 *  - Interactive Leaflet map paired with a modernized list UI.
 */

const DEFAULT_COORDS = { lat: 39.1031, lon: -84.512 }; // Cincinnati demo
const TILE_LAYER_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_LAYER_ATTRIBUTION = "© OpenStreetMap contributors";
const EARTH_RADIUS_METERS = 6_371_000;

const map = L.map("map").setView([DEFAULT_COORDS.lat, DEFAULT_COORDS.lon], 13);
L.tileLayer(TILE_LAYER_URL, {
  attribution: TILE_LAYER_ATTRIBUTION,
  maxZoom: 19,
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);

const locateBtn = document.getElementById("btn-locate");
const searchBtn = document.getElementById("btn-search");
const searchInput = document.getElementById("search-input");
const radiusSelect = document.getElementById("radius-select");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const searchForm = document.getElementById("search-form");

let currentLocation = null;
let isInitialLoad = true;

function setStatus(message, { isError = false } = {}) {
  statusEl.textContent = message || "";
  statusEl.classList.toggle("is-error", Boolean(isError));
}

function setLoading(button, isLoading, idleLabel) {
  if (!button) return;
  if (isLoading) {
    button.dataset.label = button.textContent;
    button.textContent = idleLabel || "Working…";
  } else if (button.dataset.label) {
    button.textContent = button.dataset.label;
    delete button.dataset.label;
  }
  button.disabled = isLoading;
}

function clearResults() {
  markersLayer.clearLayers();
  resultsEl.innerHTML = "";
}

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const originLat = toRad(lat1);
  const targetLat = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(originLat) * Math.cos(targetLat);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

function formatDistance(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) return null;
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m away`;
  }
  const kilometers = distanceMeters / 1000;
  return `${kilometers.toFixed(kilometers < 10 ? 1 : 0)} km away`;
}

function focusCafeOnMap(cafe, marker) {
  const zoom = Math.max(map.getZoom(), 16);
  map.setView([cafe.lat, cafe.lon], zoom);
  if (marker) {
    marker.openPopup();
  }
}

function buildResultItem(cafe, distanceMeters, marker) {
  const item = document.createElement("li");
  item.className = "result-card";
  item.tabIndex = 0;

  const header = document.createElement("div");
  header.className = "result-header";

  const title = document.createElement("h3");
  title.className = "result-title";
  title.textContent = cafe.name || "Unnamed Cafe";
  header.appendChild(title);

  const distanceLabel = formatDistance(distanceMeters);
  if (distanceLabel) {
@@ -128,98 +151,203 @@ function zoomForRadius(radius) {
  if (radius <= 8000) return 12;
  return 11;
}

function renderCafes(cafes) {
  clearResults();

  if (!cafes.length) {
    setStatus("No cafés found nearby. Try widening the search radius.", { isError: true });
    const emptyItem = document.createElement("li");
    emptyItem.className = "result-card";
    const message = document.createElement("p");
    message.className = "result-meta";
    message.textContent = "No cafés found.";
    emptyItem.appendChild(message);
    resultsEl.appendChild(emptyItem);
    return;
  }

  setStatus(`Found ${cafes.length} café${cafes.length === 1 ? "" : "s"}.`);

  const origin = currentLocation;

  cafes.forEach((cafe) => {
    const marker = L.marker([cafe.lat, cafe.lon]).addTo(markersLayer);
    marker.bindPopup(
      `<strong>${cafe.name || "Cafe"}</strong>${cafe.address ? `<br>${cafe.address}` : ""}`
    );

    const distance = origin
      ? calculateDistanceMeters(origin.lat, origin.lon, cafe.lat, cafe.lon)
      : null;

    resultsEl.appendChild(buildResultItem(cafe, distance, marker));
  });
}

async function fetchCafes(lat, lon, radius) {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    radius: radius.toString(),
  });

  const response = await fetch(`/api/cafes?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Cafe API request failed");
  }
  const payload = await response.json();
  return Array.isArray(payload.cafes) ? payload.cafes : [];
}

async function loadCafes(lat, lon, radius, { recenter = true } = {}) {
  setStatus("Searching for cafés…");
  try {
    currentLocation = { lat, lon };
    const cafes = await fetchCafes(lat, lon, radius);
    if (recenter) {
      map.setView([lat, lon], zoomForRadius(radius));
    }
    renderCafes(cafes);
  } catch (error) {
    console.error(error);
    setStatus("Unable to load cafés. Please try again.", { isError: true });
  }
}

async function geocodePlace(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), {
    headers: {
      "Accept-Language": "en",
    },
  });
  if (!response.ok) {
    throw new Error("Geocoding request failed");
  }
  const data = await response.json();
  if (!Array.isArray(data) || !data.length) {
    return null;
  }
  const match = data[0];
  return {
    lat: parseFloat(match.lat),
    lon: parseFloat(match.lon),
    displayName: match.display_name,
  };
}

async function handleSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    setStatus("Type a city, neighborhood, or landmark to search.", { isError: true });
    return;
  }

  setLoading(searchBtn, true, "Searching…");
  setStatus("Locating place…");

  try {
    const location = await geocodePlace(`${query} cafe`);
    if (!location) {
      setStatus("Place not found. Try a different search.", { isError: true });
      return;
    }

    const radius = parseInt(radiusSelect.value, 10) || 3000;
    await loadCafes(location.lat, location.lon, radius, { recenter: true });
  } catch (error) {
    console.error(error);
    setStatus("Search failed. Please try again.", { isError: true });
  } finally {
    setLoading(searchBtn, false);
  }
}

function handleLocationSuccess(position) {
  const { latitude, longitude } = position.coords;
  const radius = parseInt(radiusSelect.value, 10) || 3000;
  loadCafes(latitude, longitude, radius, { recenter: true });
}

function handleLocationError(error) {
  console.error(error);
  if (isInitialLoad) {
    setStatus("Allow location access or search for a place to begin.", { isError: true });
  } else {
    setStatus(error.message || "Unable to access your location.", { isError: true });
  }
}

function requestUserLocation() {
  if (!navigator.geolocation) {
    setStatus("Geolocation isn't supported by your browser.", { isError: true });
    return;
  }

  setLoading(locateBtn, true, "Locating…");
  setStatus("Finding your location…");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      setLoading(locateBtn, false);
      handleLocationSuccess(position);
    },
    (error) => {
      setLoading(locateBtn, false);
      handleLocationError(error);
    },
    {
      enableHighAccuracy: false,
      timeout: 15_000,
      maximumAge: 60_000,
    }
  );
}

radiusSelect.addEventListener("change", () => {
  if (!currentLocation) {
    return;
  }
  const radius = parseInt(radiusSelect.value, 10) || 3000;
  loadCafes(currentLocation.lat, currentLocation.lon, radius, { recenter: false });
});

locateBtn.addEventListener("click", () => {
  isInitialLoad = false;
  requestUserLocation();
});

searchBtn.addEventListener("click", () => {
  isInitialLoad = false;
  handleSearch();
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    isInitialLoad = false;
    handleSearch();
  }
});

if (searchForm) {
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    isInitialLoad = false;
    handleSearch();
  });
}

(async function init() {
  try {
    requestUserLocation();
  } finally {
    isInitialLoad = false;
  }
})();
