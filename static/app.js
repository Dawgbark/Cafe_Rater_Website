/* Frontend logic for Cafe Scout geolocation search (new geolocation + search UI). */
const DEFAULT_COORDS = { lat: 20, lon: 0 };
const TILE_LAYER_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_LAYER_ATTRIBUTION = "© OpenStreetMap contributors";
const EARTH_RADIUS_METERS = 6371000;

const map = L.map("map").setView([DEFAULT_COORDS.lat, DEFAULT_COORDS.lon], 2);
L.tileLayer(TILE_LAYER_URL, { attribution: TILE_LAYER_ATTRIBUTION, maxZoom: 19 }).addTo(map);

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
  return `${(distanceMeters / 1000).toFixed(distanceMeters < 10000 ? 1 : 0)} km away`;
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
    const distanceEl = document.createElement("span");
    distanceEl.className = "result-distance";
    distanceEl.textContent = distanceLabel;
    header.appendChild(distanceEl);
  }

  item.appendChild(header);

  if (cafe.address) {
    const meta = document.createElement("p");
    meta.className = "result-meta";
    meta.textContent = cafe.address;
    item.appendChild(meta);
  }

  const actions = document.createElement("div");
  actions.className = "result-actions";

  const viewBtn = document.createElement("button");
  viewBtn.type = "button";
  viewBtn.className = "btn-link";
  viewBtn.textContent = "View on map";

  const handleFocus = () => {
    focusCafeOnMap(cafe, marker);
  };

  item.addEventListener("click", handleFocus);
  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleFocus();
    }
  });

  viewBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    handleFocus();
  });

  actions.appendChild(viewBtn);
  item.appendChild(actions);

  return item;
}

function zoomForRadius(radius) {
  if (radius <= 1500) return 15;
  if (radius <= 3000) return 14;
  if (radius <= 5000) return 13;
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
    marker.bindPopup(`<strong>${cafe.name || "Cafe"}</strong>${cafe.address ? `<br>${cafe.address}` : ""}`);
    
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
    const cafes = await fetchCafes(lat, lon, radius);
    if (recenter) {
      map.setView([lat, lon], zoomForRadius(radius));
    }
@@ -191,32 +275,40 @@ radiusSelect.addEventListener("change", () => {
  if (currentLocation) {
    loadCafes(currentLocation.lat, currentLocation.lon, parseInt(radiusSelect.value, 10), {
      recenter: false,
    });
  }
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
