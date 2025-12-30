let map;
let busMarker;
let routePolyline;
let animationIndex = 0;
let animationInterval;

// Default mocked GPS data (fallback)
const DEFAULT_ROUTE_TRACK = [
  {lat:23.8103, lng:90.4125, stop:'Dhaka (Gabtoli)'},
  {lat:23.6238, lng:90.5000, stop:'Narayanganj'},
  {lat:23.4607, lng:91.1809, stop:'Cumilla'},
  {lat:23.0161, lng:91.3966, stop:'Feni'},
  {lat:22.3569, lng:91.7832, stop:'Chittagong (Dampara)'}
];

let routeTrack = [...DEFAULT_ROUTE_TRACK];

function normalizePlaceName(raw){
  if(!raw) return '';
  return String(raw)
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function coordForStopName(stopName){
  const n = normalizePlaceName(stopName);
  if(!n) return null;

  // Common Bangladesh cities/stops (approx).
  const coords = {
    'dhaka': [23.8103, 90.4125],
    'chittagong': [22.3569, 91.7832],
    'chattogram': [22.3569, 91.7832],
    'rangpur': [25.7439, 89.2752],
    'bogura': [24.8465, 89.3773],
    'bogra': [24.8465, 89.3773],
    'gaibandha': [25.3290, 89.5429],
    'nilphamari': [25.9318, 88.8560],
    'dimla': [26.1600, 88.9300],
    'domar': [26.0200, 88.8000],
    'sylhet': [24.8949, 91.8687],
    'rajshahi': [24.3636, 88.6241],
    'khulna': [22.8456, 89.5403],
    'barisal': [22.7010, 90.3535],
    'barishal': [22.7010, 90.3535],
    'mymensingh': [24.7471, 90.4203],
    'comilla': [23.4607, 91.1809],
    'cumilla': [23.4607, 91.1809],
    'feni': [23.0161, 91.3966],
    'narayanganj': [23.6238, 90.5000]
  };

  // Direct match
  if(coords[n]) return { lat: coords[n][0], lng: coords[n][1] };

  // Contains match (e.g. "dhaka gabtoli")
  for(const key of Object.keys(coords)){
    if(n.includes(key)) return { lat: coords[key][0], lng: coords[key][1] };
  }

  return null;
}

function parseStopsJson(stopsJson){
  if(!stopsJson) return [];
  if(Array.isArray(stopsJson)) return stopsJson;
  if(typeof stopsJson !== 'string') return [];
  try{
    const parsed = JSON.parse(stopsJson);
    return Array.isArray(parsed) ? parsed : [];
  }catch{
    return [];
  }
}

function buildTrackFromRoute(route){
  if(!route) return null;

  const start = route.start_point || '';
  const end = route.end_point || '';
  const midStopsRaw = parseStopsJson(route.stops_json);

  const normalizeCoord = (obj) => {
    if(!obj || typeof obj !== 'object') return null;
    const lat = obj.lat ?? obj.latitude;
    const lng = obj.lng ?? obj.lon ?? obj.longitude;
    const latN = lat == null ? NaN : parseFloat(lat);
    const lngN = lng == null ? NaN : parseFloat(lng);
    if(Number.isFinite(latN) && Number.isFinite(lngN)) return { lat: latN, lng: lngN };
    return null;
  };

  const points = [];

  // Start point
  if(start){
    const c = coordForStopName(start);
    if(c) points.push({ lat: c.lat, lng: c.lng, stop: start });
  }

  // Middle stops can be strings or objects. If object includes lat/lng, prefer that.
  for(const s of midStopsRaw){
    if(typeof s === 'string'){
      const c = coordForStopName(s);
      if(c) points.push({ lat: c.lat, lng: c.lng, stop: s });
      continue;
    }
    if(s && typeof s === 'object'){
      const name = s.name || s.stop || s.title || '';
      const c2 = normalizeCoord(s) || (name ? coordForStopName(name) : null);
      if(c2 && name) points.push({ lat: c2.lat, lng: c2.lng, stop: name });
    }
  }

  // End point
  if(end){
    const c = coordForStopName(end);
    if(c) points.push({ lat: c.lat, lng: c.lng, stop: end });
  }

  // Need at least two points to draw a route.
  if(points.length >= 2) return points;
  return null;
}

function initLeafletMap(track){
  const mapEl = document.getElementById('map');
  if(!mapEl) return;
  if(typeof L === 'undefined'){
    mapEl.textContent = 'Map library not loaded.';
    return;
  }

  if(animationInterval) clearInterval(animationInterval);
  if(map){
    try{ map.remove(); }catch(e){}
    map = null;
  }

  routeTrack = Array.isArray(track) && track.length ? track : [...DEFAULT_ROUTE_TRACK];

  map = L.map(mapEl, { zoomControl: true }).setView([routeTrack[0].lat, routeTrack[0].lng], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const latlngs = routeTrack.map(p => [p.lat, p.lng]);
  routePolyline = L.polyline(latlngs, { weight: 4, opacity: 0.85 }).addTo(map);
  map.fitBounds(routePolyline.getBounds(), { padding: [16, 16] });

  busMarker = L.marker([routeTrack[0].lat, routeTrack[0].lng]).addTo(map);

  populateStops();
  startAnimation();
}

function populateStops(){
  const stopList = document.getElementById('stop-list');
  if(!stopList) return;
  stopList.innerHTML = '';
  routeTrack.forEach((point, index) => {
    const li = document.createElement('li');
    li.textContent = `${index+1}. ${point.stop}`;
    if(index === 0) li.classList.add('active');
    stopList.appendChild(li);
  });
}

function startAnimation(){
  if(animationInterval) clearInterval(animationInterval);
  animationIndex = 0;
  const lastUpdate = document.getElementById('last-update');
  const speedLabel = document.getElementById('speed');
  const nextStopLabel = document.getElementById('next-stop');

  function tick(){
    const current = routeTrack[animationIndex];
    const next = routeTrack[animationIndex + 1];
    if(busMarker) busMarker.setLatLng([current.lat, current.lng]);
    try { map.panTo([current.lat, current.lng], { animate: true, duration: 0.5 }); } catch(e) {}

    if(speedLabel) speedLabel.textContent = `${(50 + Math.random()*20).toFixed(0)} km/h`;
    if(lastUpdate) lastUpdate.textContent = new Date().toLocaleTimeString();
    if(nextStopLabel) nextStopLabel.textContent = next ? next.stop : 'Destination reached';

    const stopItems = document.querySelectorAll('#stop-list li');
    stopItems.forEach((item, idx) => item.classList.toggle('active', idx === animationIndex));

    animationIndex++;
    if(animationIndex >= routeTrack.length){
      clearInterval(animationInterval);
      if(speedLabel) speedLabel.textContent = '0 km/h';
      if(nextStopLabel) nextStopLabel.textContent = 'Destination reached';
    }
  }

  tick();
  animationInterval = setInterval(tick, 3000);
}

async function loadLatestBookingForGps(){
  // Identify passenger
  let passenger = null;
  try {
    const raw = localStorage.getItem('passenger');
    passenger = raw ? JSON.parse(raw) : null;
  } catch(e) { passenger = null; }
  const passengerId = (passenger && passenger.id) ? String(passenger.id) : (localStorage.getItem('passengerId') || '').trim();
  if(!passengerId) return null;

  const res = await fetch(`backend/api/bookings.php?passenger_id=${encodeURIComponent(passengerId)}`, { headers: { 'Accept': 'application/json' } });
  if(!res.ok) throw new Error('Bookings HTTP ' + res.status);
  const bookings = await res.json();
  if(!Array.isArray(bookings) || bookings.length === 0) return null;

  // Prefer confirmed/paid active booking; otherwise any active booking; otherwise most recent.
  const isActive = (b) => String(b && b.booking_status).toLowerCase() === 'active';
  const isPaid = (b) => String(b && b.payment_status).toLowerCase() === 'paid';
    return bookings.find(b => isActive(b) && isPaid(b))
      || bookings.find(b => isPaid(b))
      || bookings.find(b => isActive(b))
      || bookings[0];
}

document.addEventListener('DOMContentLoaded', async () => {
  const routeLabel = document.getElementById('route-label');
  if(routeLabel) routeLabel.textContent = 'Route: —';

  try{
    const booking = await loadLatestBookingForGps();
    if(booking){
      const paid = String(booking.payment_status || '').toLowerCase() === 'paid';
      const routeText = booking.route_name || `${booking.start_point || ''} → ${booking.end_point || ''}`.trim();
      if(routeLabel) routeLabel.textContent = 'Route: ' + (routeText || '—') + (paid ? '' : ' (not paid)');

      const track = buildTrackFromRoute({
        start_point: booking.start_point,
        end_point: booking.end_point,
        stops_json: booking.stops_json
      });
      // If we can't build a route from booking (missing coordinates), still avoid showing an unrelated default.
      // Fall back to demo only when there is no booking.
      initLeafletMap(track || DEFAULT_ROUTE_TRACK);
      return;
    }
  }catch(err){
    console.error(err);
  }

  // No booking found: show demo route (explicitly labeled)
  if(routeLabel) routeLabel.textContent = 'Route: Demo (Dhaka → Chittagong)';
  initLeafletMap(DEFAULT_ROUTE_TRACK);
});
