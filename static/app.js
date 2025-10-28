/* Frontend logic for Cafe Scout geolocation search (new geolocation + search UI). */
const DEFAULT_COORDS = { lat: 20, lon: 0 };
const TILE_LAYER_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_LAYER_ATTRIBUTION = "© OpenStreetMap contributors";

const map = L.map("map").setView([DEFAULT_COORDS.lat, DEFAULT_COORDS.lon], 2);
L.tileLayer(TILE_LAYER_URL, { attribution: TILE_LAYER_ATTRIBUTION, maxZoom: 19 }).addTo(map);

const markersLayer = L.layerGroup().addTo(map);

const locateBtn = document.getElementById("btn-locate");
const searchBtn = document.getElementById("btn-search");
const searchInput = document.getElementById("search-input");
const radiusSelect = document.getElementById("radius-select");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

let currentLocation = null;
let isInitialLoad = true;

function setStatus(message, { isError = false } = {}) {
  statusEl.textContent = message || "";
  statusEl.style.color = isError ? "#b00020" : "#555";
}

function clearResults() {
  markersLayer.clearLayers();
  resultsEl.innerHTML = "";
}

function buildResultItem(cafe) {
  const item = document.createElement("div");
  item.className = "result-item";

  const title = document.createElement("h3");
  title.textContent = cafe.name || "Unnamed Cafe";
  item.appendChild(title);

  if (cafe.address) {
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = cafe.address;
    item.appendChild(meta);
  }

  item.addEventListener("click", () => {
    map.setView([cafe.lat, cafe.lon], Math.max(map.getZoom(), 16));
  });

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
    resultsEl.innerHTML = "<div class=\"meta\">No cafés found.</div>";
    return;
  }

  setStatus(`Found ${cafes.length} café${cafes.length === 1 ? "" : "s"}.`);

  cafes.forEach((cafe) => {
    const marker = L.marker([cafe.lat, cafe.lon]).addTo(markersLayer);
    marker.bindPopup(`<strong>${cafe.name || "Cafe"}</strong>${cafe.address ? `<br>${cafe.address}` : ""}`);
    resultsEl.appendChild(buildResultItem(cafe));
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
    renderCafes(cafes);
  } catch (error) {
    console.error(error);
    setStatus("We couldn't load cafés right now. Please try again.", { isError: true });
  }
}

function updateLocation(lat, lon, { recenter = true } = {}) {
  currentLocation = { lat, lon };
  const radius = parseInt(radiusSelect.value, 10);
  loadCafes(lat, lon, radius, { recenter });
}

function requestUserLocation() {
  if (!navigator.geolocation) {
    setStatus("Geolocation isn't supported by this browser.", { isError: true });
    return;
  }

  locateBtn.disabled = true;
  locateBtn.textContent = "Locating…";

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locateBtn.disabled = false;
      locateBtn.textContent = "Use my location";
      updateLocation(pos.coords.latitude, pos.coords.longitude, { recenter: true });
    },
    (err) => {
      locateBtn.disabled = false;
      locateBtn.textContent = "Use my location";
      if (isInitialLoad) {
        setStatus("Allow location access or search for a place to get started.");
      } else {
        setStatus(`Couldn't get your location: ${err.message}`, { isError: true });
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 8000,
    }
  );
}

async function geocode(query) {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1",
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      "Accept-Language": "en",
    },
  });

  if (!response.ok) {
    throw new Error("Geocoding request failed");
  }

  const results = await response.json();
  if (!Array.isArray(results) || !results.length) {
    throw new Error("No results found");
  }

  const first = results[0];
  return { lat: parseFloat(first.lat), lon: parseFloat(first.lon), displayName: first.display_name };
}

async function handleSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    setStatus("Type a city, neighborhood, or landmark to search.", { isError: true });
    return;
  }

  setStatus("Searching for that place…");
  try {
    const location = await geocode(query);
    updateLocation(location.lat, location.lon, { recenter: true });
    map.setView([location.lat, location.lon], zoomForRadius(parseInt(radiusSelect.value, 10)));
    setStatus(`Showing cafés near ${location.displayName.split(",")[0]}.`);
  } catch (error) {
    console.error(error);
    setStatus(error.message || "We couldn't find that place.", { isError: true });
  }
}

radiusSelect.addEventListener("change", () => {
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

(async function init() {
  try {
    requestUserLocation();
  } finally {
    isInitialLoad = false;
  }
})();
