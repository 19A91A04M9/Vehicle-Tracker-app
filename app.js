/* eslint-disable no-undef */

const MAP_CONTAINER_ID = 'map';
const ROUTE_URL = 'data/dummy-route.json';

const playPauseBtn = document.getElementById('playPauseBtn');
const resetBtn = document.getElementById('resetBtn');
const speedSelect = document.getElementById('speedSelect');
const latEl = document.getElementById('latVal');
const lngEl = document.getElementById('lngVal');
const tsEl = document.getElementById('tsVal');
const speedEl = document.getElementById('speedVal');
const elapsedEl = document.getElementById('elapsedVal');

let map;
let marker;
let fullPolyline;
let progressPolyline;
let route = [];
let idx = 0;
let animHandle = null;
let playing = false;
let startedAtUnixMs = null; // when simulation started (virtual)
let baseTimestampMs = null; // timestamp of first point

function formatElapsed(ms) {
  if (!ms || ms < 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

function interpolate(a, b, t) {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

function updateStats(point, speedMps, elapsedMs) {
  latEl.textContent = point.lat.toFixed(6);
  lngEl.textContent = point.lng.toFixed(6);
  tsEl.textContent = point.timestamp ? new Date(point.timestamp).toLocaleString() : '–';
  speedEl.textContent = Number.isFinite(speedMps) ? `${speedMps.toFixed(1)} m/s` : '–';
  elapsedEl.textContent = formatElapsed(elapsedMs);
}

async function loadRoute() {
  const res = await fetch(ROUTE_URL);
  const raw = await res.json();
  route = raw.map(p => ({ lat: p.latitude, lng: p.longitude, timestamp: p.timestamp ? Date.parse(p.timestamp) : null }));
}

function initMap() {
  map = L.map(MAP_CONTAINER_ID, { zoomControl: true });
  const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  });
  tiles.addTo(map);

  fullPolyline = L.polyline(route.map(p => [p.lat, p.lng]), { color: '#4f7cff', weight: 4, opacity: 0.35 });
  fullPolyline.addTo(map);

  progressPolyline = L.polyline([], { color: '#4f7cff', weight: 5 });
  progressPolyline.addTo(map);

  const bounds = fullPolyline.getBounds();
  map.fitBounds(bounds, { padding: [20, 20] });

  const start = route[0];
  marker = L.marker([start.lat, start.lng], { title: 'Vehicle' }).addTo(map);
}

function resetSimulation() {
  playing = false;
  cancelAnimationFrame(animHandle);
  playPauseBtn.textContent = 'Play';
  idx = 0;
  startedAtUnixMs = null;
  baseTimestampMs = route[0]?.timestamp ?? null;
  progressPolyline.setLatLngs([[route[0].lat, route[0].lng]]);
  marker.setLatLng([route[0].lat, route[0].lng]);
  updateStats(route[0], NaN, 0);
}

function startPlayback() {
  if (playing) return;
  playing = true;
  playPauseBtn.textContent = 'Pause';

  // Setup virtual clock anchored to first timestamp if present, else use synthetic timing (0.5s per segment at 1x)
  const speedMultiplier = parseFloat(speedSelect.value || '1');
  const now = performance.now();
  if (!startedAtUnixMs) {
    startedAtUnixMs = now;
  }

  function step() {
    if (!playing) return;
    const currentNow = performance.now();
    const elapsedMsReal = (currentNow - startedAtUnixMs) * speedMultiplier;

    // Determine target position along the route according to timestamps (if available) or uniform timing
    let currentPoint, nextPoint, segmentT;
    let accumulatedMs = 0;
    const defaultSegmentMs = 1000; // 1s per segment at 1x

    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i];
      const b = route[i + 1];
      const segMs = (a.timestamp != null && b.timestamp != null)
        ? Math.max(1, b.timestamp - a.timestamp)
        : defaultSegmentMs;
      if (elapsedMsReal <= accumulatedMs + segMs) {
        currentPoint = a;
        nextPoint = b;
        segmentT = (elapsedMsReal - accumulatedMs) / segMs;
        idx = i; // remember index for stats
        break;
      }
      accumulatedMs += segMs;
    }

    if (!currentPoint || !nextPoint) {
      // reached end
      currentPoint = route[route.length - 2];
      nextPoint = route[route.length - 1];
      segmentT = 1;
      playing = false;
      playPauseBtn.textContent = 'Play';
    }

    const pos = interpolate(currentPoint, nextPoint, Math.min(1, Math.max(0, segmentT)));
    marker.setLatLng([pos.lat, pos.lng]);

    // Extend progress polyline up to current index + interpolated point
    const progressed = route.slice(0, idx + 1).map(p => [p.lat, p.lng]);
    progressed.push([pos.lat, pos.lng]);
    progressPolyline.setLatLngs(progressed);

    // Estimate instantaneous speed between segment ends (m/s) using segment duration
    const distM = haversineMeters(currentPoint, nextPoint);
    const segMs = (currentPoint.timestamp != null && nextPoint.timestamp != null) ? (nextPoint.timestamp - currentPoint.timestamp) : defaultSegmentMs;
    const speedMps = distM / (segMs / 1000);

    const elapsedSinceStart = baseTimestampMs && route[idx]?.timestamp
      ? (route[idx].timestamp - baseTimestampMs) + segmentT * segMs
      : accumulatedMs + segmentT * segMs;

    updateStats(pos, speedMps, elapsedSinceStart);

    animHandle = requestAnimationFrame(step);
  }

  animHandle = requestAnimationFrame(step);
}

function togglePlayPause() {
  if (playing) {
    playing = false;
    cancelAnimationFrame(animHandle);
    playPauseBtn.textContent = 'Play';
  } else {
    startPlayback();
  }
}

async function boot() {
  await loadRoute();
  initMap();
  baseTimestampMs = route[0]?.timestamp ?? null;
  progressPolyline.setLatLngs([[route[0].lat, route[0].lng]]);
  updateStats(route[0], NaN, 0);

  playPauseBtn.addEventListener('click', togglePlayPause);
  resetBtn.addEventListener('click', resetSimulation);
  speedSelect.addEventListener('change', () => {
    // Adjust speed immediately; keep current elapsed baseline
    if (playing) {
      // Re-anchor the timing so the visual position stays consistent
      cancelAnimationFrame(animHandle);
      startedAtUnixMs = performance.now();
      startPlayback();
    }
  });
}

boot();


