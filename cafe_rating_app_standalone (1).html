<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cafe Scout — Local Cafe Ratings</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
  <style>
    :root{
      --bg:#f7f6f0; --card:#ffffff; --accent:#2f6f4e; --muted:#6b6b6b;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
    }
    html,body,#app{height:100%; margin:0; background:var(--bg); color:#222}
    .container{max-width:1100px; margin:18px auto; display:grid; grid-template-columns:1fr 380px; gap:16px; padding:16px}
    header{grid-column:1/-1; display:flex; align-items:center; gap:12px}
    h1{margin:0; font-size:20px}
    p.lead{margin:0; color:var(--muted); font-size:13px}
    #map{height:70vh; border-radius:10px; box-shadow:0 6px 20px rgba(0,0,0,0.08)}
    .sidebar{background:var(--card); border-radius:10px; padding:12px; height:70vh; overflow:auto; box-shadow:0 6px 20px rgba(12,12,12,0.06)}
    .search-row{display:flex; gap:8px; margin-bottom:10px}
    input[type=text]{flex:1; padding:8px 10px; border-radius:8px; border:1px solid #e5e5e5}
    button{background:var(--accent); color:white; border:none; padding:8px 10px; border-radius:8px; cursor:pointer}
    .place{padding:8px; border-bottom:1px solid #f0f0f0}
    .place h3{margin:0 0 4px 0; font-size:16px}
    .meta{font-size:13px; color:var(--muted)}
    .rating-row{display:flex; gap:6px; align-items:center; margin-top:8px}
    .rating-row label{font-size:13px; min-width:70px}
    .score{width:120px}
    .btn-small{padding:6px 8px; border-radius:8px; font-size:13px}
    .rating-summary{margin-top:8px; font-size:13px}
    .no-results{color:var(--muted); text-align:center; padding:24px}
    footer{grid-column:1/-1; text-align:center; color:var(--muted); font-size:13px; margin-top:6px}
    @media(max-width:980px){.container{grid-template-columns:1fr;}.sidebar{height:45vh} #map{height:45vh}}
  </style>
</head>
<body>
  <div id="app">
    <div class="container">
      <header>
        <div style="flex:1">
          <h1>Cafe Scout</h1>
          <p class="lead">Find local cafes near you and rate Crowd, Vibe, Cleanliness, Coffee. Ratings are saved locally (no account needed).</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center">
          <button id="btn-locate">Use my location</button>
          <button id="btn-clear">Clear local ratings</button>
        </div>
      </header>

      <div id="map"></div>

      <aside class="sidebar">
        <div class="search-row">
          <input id="q" type="text" placeholder="Search city / neighborhood (optional)" />
          <button id="btn-search">Search</button>
        </div>
        <div id="places-list"> <div class="no-results">Click "Use my location" or search to load nearby cafes.</div></div>
      </aside>

      <footer>Prototype • No server required • Uses OpenStreetMap Overpass API for discovery</footer>
    </div>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script>
    const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
    const RADIUS = 1200;
    const el = id => document.getElementById(id);
    const fmtNum = n => (Math.round(n*10)/10).toFixed(1);

    const map = L.map('map').setView([39.1031, -84.5120], 14); // Default Cincinnati
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    let markers = L.featureGroup().addTo(map);

    function storageKey(osmType, id){ return `cafeRatings:${osmType}:${id}` }
    function saveRating(osmType, id, data){
      const key = storageKey(osmType,id);
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push({...data, ts:Date.now()});
      localStorage.setItem(key, JSON.stringify(existing));
    }
    function loadRatings(osmType,id){
      const key = storageKey(osmType,id);
      return JSON.parse(localStorage.getItem(key) || '[]');
    }
    function clearAllRatings(){
      Object.keys(localStorage).forEach(k=>{ if(k.startsWith('cafeRatings:')) localStorage.removeItem(k)});
      refreshPlacesDisplay(currentPlaces);
      alert('Local ratings cleared.');
    }
    function computeAggregate(osmType,id){
      const arr = loadRatings(osmType,id);
      if(!arr.length) return null;
      const sums = arr.reduce((acc,r)=>{
        acc.crowd += +r.crowd; acc.vibe += +r.vibe; acc.clean += +r.clean; acc.coffee += +r.coffee;
        return acc;}, {crowd:0,vibe:0,clean:0,coffee:0});
      const n = arr.length;
      return {count:n, crowd:sums.crowd/n, vibe:sums.vibe/n, clean:sums.clean/n, coffee:sums.coffee/n};
    }

    const placesList = el('places-list');
    let currentPlaces = [];

    function refreshPlacesDisplay(places){
      currentPlaces = places;
      markers.clearLayers();
      if(!places || !places.length){
        placesList.innerHTML = '<div class="no-results">No cafes found.</div>';
        return;
      }
      placesList.innerHTML = '';
      places.forEach(p => {
        const div = document.createElement('div'); div.className='place';
        const title = document.createElement('h3'); title.textContent = p.tags.name || (p.tags.brand || 'Unnamed Cafe');
        div.appendChild(title);
        const meta = document.createElement('div'); meta.className='meta';
        meta.textContent = `${p.tags.addr_city||''} ${p.tags.addr_housenumber||''}`.trim();
        div.appendChild(meta);

        const agg = computeAggregate(p.type,p.id);
        const summary = document.createElement('div'); summary.className='rating-summary';
        if(agg){
          summary.innerHTML = `Average — Crowd: ${fmtNum(agg.crowd)} · Vibe: ${fmtNum(agg.vibe)} · Clean: ${fmtNum(agg.clean)} · Coffee: ${fmtNum(agg.coffee)} (${agg.count} votes)`;
        } else {
          summary.textContent = 'No ratings yet';
        }
        div.appendChild(summary);

        const form = document.createElement('div'); form.style.marginTop='8px';
        ['crowd','vibe','clean','coffee'].forEach(key=>{
          const row = document.createElement('div'); row.className='rating-row';
          const label = document.createElement('label'); label.textContent = key.charAt(0).toUpperCase()+key.slice(1)+':';
          const input = document.createElement('input'); input.type='range'; input.min=1; input.max=5; input.value=4; input.className='score';
          const val = document.createElement('span'); val.textContent = input.value;
          input.addEventListener('input', ()=> val.textContent = input.value );
          row.appendChild(label); row.appendChild(input); row.appendChild(val);
          form.appendChild(row);
        });
        const btn = document.createElement('button'); btn.className='btn-small'; btn.textContent='Save rating';
        btn.addEventListener('click', ()=>{
          const inputs = form.querySelectorAll('input[type=range]');
          const data = {crowd:inputs[0].value, vibe:inputs[1].value, clean:inputs[2].value, coffee:inputs[3].value};
          saveRating(p.type,p.id,data);
          refreshPlacesDisplay(currentPlaces);
        });
        form.appendChild(btn);
        div.appendChild(form);

        div.addEventListener('click', ()=> map.setView([p.lat,p.lon],17));

        placesList.appendChild(div);

        const m = L.marker([p.lat,p.lon]).addTo(markers).bindPopup(`<strong>${p.tags.name||'Cafe'}</strong><br>${agg?`Avg crowd ${fmtNum(agg.crowd)} (${agg.count})`:'No ratings yet'}`);
      });
      markers.addTo(map);
    }

    async function fetchCafesNear(lat,lon){
      const q = `[
out:json][timeout:25];
node(around:${RADIUS},${lat},${lon})[amenity=cafe];
out body;`;
      try{
        const res = await fetch(OVERPASS_URL, { method:'POST', body:q });
        if(!res.ok) throw new Error('Overpass error');
        const data = await res.json();
        return data.elements;
      }catch(err){ console.error(err); return [] }
    }

    async function useMyLocation(){
      if(!navigator.geolocation) return alert('Geolocation not supported');
      el('btn-locate').disabled = true; el('btn-locate').textContent='Locating...';
      navigator.geolocation.getCurrentPosition(async pos=>{
        const {latitude:lat, longitude:lon} = pos.coords;
        map.setView([lat,lon],15);
        const places = await fetchCafesNear(lat,lon);
        refreshPlacesDisplay(places);
        el('btn-locate').disabled = false; el('btn-locate').textContent='Use my location';
      }, err=>{ alert('Unable to get location: '+err.message); el('btn-locate').disabled=false; el('btn-locate').textContent='Use my location' });
    }

    async function searchByText(text){
      const q = encodeURIComponent(text+' cafe');
      try{
        const res = await fetch(`https://nominatim.openstreetmap.org/search.php?q=${q}&format=jsonv2&limit=1`);
        const arr = await res.json();
        if(!arr.length) return alert('Place not found');
        const lat = parseFloat(arr[0].lat), lon = parseFloat(arr[0].lon);
        map.setView([lat,lon],14);
        const places = await fetchCafesNear(lat,lon);
        refreshPlacesDisplay(places);
      }catch(e){ console.error(e); alert('Search failed'); }
    }

    el('btn-locate').addEventListener('click', useMyLocation);
    el('btn-search').addEventListener('click', ()=>{ const q = el('q').value.trim(); if(q) searchByText(q); else alert('Type a place to search (city, neighborhood)') });
    el('btn-clear').addEventListener('click', ()=>{ if(confirm('Clear all local ratings?')) clearAllRatings() });

    (async ()=>{
      const cincyLat = 39.1031, cincyLon = -84.5120;
      const demo = await fetchCafesNear(cincyLat,cincyLon);
      refreshPlacesDisplay(demo);
      map.setView([cincyLat,cincyLon],14);
    })();
  </script>
</body>
</html>
