// WikiPrepared Maps — app.js
// MapLibre GL JS initialization, POI categories, search placeholder

(function () {
  'use strict';

  // ── Configuration ──────────────────────────────────────────────────
  const MAP_CONFIG = {
    center: [7.50213, 43.61837], // Monaco
    zoom: 10,
    minZoom: 2,
    maxZoom: 16,
    style: 'style-dark.json',
    pitch: 0,
    bearing: 0,
  };

  // OpenMapTiles source layer names
  const SOURCE_LAYERS = [
    'aeroway', 'boundary', 'building', 'housenumber', 'landcover',
    'landuse', 'mountain_peak', 'park', 'place', 'poi',
    'transportation', 'transportation_name', 'water', 'water_name', 'waterway',
  ];

  // POI preparedness categories
  const POI_CATEGORIES = {
    hospital:  { icon: '🏥', label: 'Hospital',  active: true,  color: '#ef4444', osmFilter: ['==', ['get', 'class'], 'hospital'] },
    shelter:   { icon: '🏕️', label: 'Shelter',   active: true,  color: '#f59e0b', osmFilter: ['==', ['get', 'class'], 'camp_site'] },
    water:     { icon: '💧', label: 'Water',       active: true,  color: '#3b82f6', osmFilter: ['==', ['get', 'class'], 'drinking_water'] },
    fuel:      { icon: '⛽',  label: 'Fuel',        active: true,  color: '#8b5cf6', osmFilter: ['==', ['get', 'class'], 'fuel'] },
    police:    { icon: '🚔', label: 'Police',       active: true,  color: '#06b6d4', osmFilter: ['==', ['get', 'class'], 'police'] },
    pharmacy:  { icon: '💊', label: 'Pharmacy',     active: true,  color: '#10b981', osmFilter: ['==', ['get', 'class'], 'pharmacy'] },
  };

  // ── Initialize Map ────────────────────────────────────────────────
  const map = new maplibregl.Map({
    container: 'map',
    style: MAP_CONFIG.style,
    center: MAP_CONFIG.center,
    zoom: MAP_CONFIG.zoom,
    minZoom: MAP_CONFIG.minZoom,
    maxZoom: MAP_CONFIG.maxZoom,
    pitch: MAP_CONFIG.pitch,
    bearing: MAP_CONFIG.bearing,
    attributionControl: true,
  });

  // ── Controls ──────────────────────────────────────────────────────
  map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

  map.addControl(
    new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
    }),
    'top-right'
  );

  map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');

  // ── POI Category Layers ───────────────────────────────────────────
  // Add circle layers for preparedness POIs after style loads
  map.on('load', () => {
    Object.entries(POI_CATEGORIES).forEach(([key, cat]) => {
      const layerId = `poi-preparedness-${key}`;
      if (map.getLayer(layerId)) return;

      map.addLayer({
        id: layerId,
        type: 'circle',
        source: 'monaco',
        'source-layer': 'poi',
        filter: cat.osmFilter,
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            10, 3,
            14, 6,
            18, 10,
          ],
          'circle-color': cat.color,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
          'circle-opacity': 0.9,
        },
      }, 'place-city'); // Draw under place labels

      // Hide layer if category is toggled off
      if (!cat.active) {
        map.setLayoutProperty(layerId, 'visibility', 'none');
      }
    });
  });

  // ── POI Category Toggles ──────────────────────────────────────────
  const poiButtons = document.querySelectorAll('.poi-btn');

  poiButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const category = btn.dataset.category;
      const cat = POI_CATEGORIES[category];
      if (!cat) return;

      cat.active = !cat.active;
      btn.classList.toggle('active', cat.active);
      btn.classList.toggle('inactive', !cat.active);

      const layerId = `poi-preparedness-${category}`;
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(
          layerId,
          'visibility',
          cat.active ? 'visible' : 'none'
        );
      }
    });
  });

  // ── Search (placeholder — sql.js integration later) ───────────────
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const searchResults = document.getElementById('search-results');

  function handleSearch(query) {
    // Placeholder: will integrate sql.js for offline POI search
    console.log('[WikiPrepared] Search query:', query);
    if (!query.trim()) {
      searchResults.classList.add('hidden');
      searchResults.innerHTML = '';
      return;
    }
    // TODO: sql.js powered search against local MBTiles data
    searchResults.classList.remove('hidden');
    searchResults.innerHTML = `
      <div class="search-result-item" style="color: #888;">
        Search coming soon — sql.js integration pending
      </div>
    `;
  }

  searchBtn?.addEventListener('click', () => handleSearch(searchInput.value));
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch(searchInput.value);
  });

  // ── Mobile Search Toggle ──────────────────────────────────────────
  const searchToggle = document.getElementById('search-toggle');
  const searchContainer = document.getElementById('search-container');

  searchToggle?.addEventListener('click', () => {
    searchContainer.classList.toggle('expanded');
    if (searchContainer.classList.contains('expanded')) {
      searchInput?.focus();
    }
  });

  // Close search on map click (mobile)
  map.on('click', () => {
    if (searchContainer?.classList.contains('expanded')) {
      searchContainer.classList.remove('expanded');
    }
  });

  // ── Legend Toggle ─────────────────────────────────────────────────
  const legendToggle = document.getElementById('legend-toggle');
  const legendContent = document.getElementById('legend-content');

  legendToggle?.addEventListener('click', () => {
    legendContent?.classList.toggle('collapsed');
  });

  // ── Dark / Light Mode Toggle (placeholder) ─────────────────────────
  const themeBtn = document.getElementById('theme-btn');
  let isDark = true;

  themeBtn?.addEventListener('click', () => {
    isDark = !isDark;
    themeBtn.textContent = isDark ? '🌙' : '☀️';
    // TODO: implement light theme style switch
    console.log('[WikiPrepared] Theme toggle pressed — currently:', isDark ? 'dark' : 'light');
    // Future: map.setStyle(isDark ? 'style-dark.json' : 'style-light.json');
  });

  // ── POI Popup on Click ────────────────────────────────────────────
  map.on('click', (e) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: Object.keys(POI_CATEGORIES).map(
        (k) => `poi-preparedness-${k}`
      ),
    });

    if (features.length > 0) {
      const f = features[0];
      const coords = f.geometry.coordinates.slice();
      const name = f.properties.name || f.properties.class || 'POI';
      const cat = f.layer.id.replace('poi-preparedness-', '');

      new maplibregl.Popup({ offset: 8, className: 'poi-popup' })
        .setLngLat(coords)
        .setHTML(`<strong>${name}</strong><br><span style="color:${POI_CATEGORIES[cat]?.color || '#aaa'}">${POI_CATEGORIES[cat]?.label || cat}</span>`)
        .addTo(map);
    }
  });

  // ── Cursor change on POI hover ────────────────────────────────────
  map.on('mousemove', (e) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: Object.keys(POI_CATEGORIES).map(
        (k) => `poi-preparedness-${k}`
      ),
    });
    map.getCanvas().style.cursor = features.length ? 'pointer' : '';
  });

  // ── Expose for debugging ──────────────────────────────────────────
  window.__wikiprepared_map = map;
  window.__wikiprepared_categories = POI_CATEGORIES;

  console.log('[WikiPrepared] Map initialized — Monaco [7.50, 43.62] zoom 10');
})();