document.addEventListener('DOMContentLoaded', () => {
  // Auth guard
  const passengerRaw = localStorage.getItem('passenger');
  let passenger = null;
  try { passenger = passengerRaw ? JSON.parse(passengerRaw) : null; } catch(e) { passenger = null; }
  if(!passenger){
    window.location.replace('index.html');
    return;
  }

  // Keep a consistent passenger id for other pages (e.g., search.js uses passengerId)
  if (passenger && passenger.id) {
    try { localStorage.setItem('passengerId', String(passenger.id)); } catch(e) {}
  }
  // Personalize header
  const heroTitle = document.querySelector('.hero h1');
  if(heroTitle){ heroTitle.textContent = 'Welcome ' + passenger.full_name + ' 👋'; }

  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      card.classList.add('bounce');
      setTimeout(()=> card.classList.remove('bounce'), 450);
    });
  });

  // Ensure cards navigate even if inline onclick is blocked
  const cards = document.querySelectorAll('.options .card');
  if(cards[0]) cards[0].addEventListener('click', () => setTimeout(openSearch, 120));
  if(cards[1]) cards[1].addEventListener('click', () => setTimeout(openRoute, 120));
  if(cards[2]) cards[2].addEventListener('click', () => setTimeout(openRoutesList, 120));

  // Navbar actions
  const detailsLink = document.getElementById('passengerDetailsLink');
  if(detailsLink){
    detailsLink.addEventListener('click', async (e) => {
      e.preventDefault();
      await openPassengerDetails();
    });
  }
  const logoutLink = document.getElementById('passengerLogoutLink');
  if(logoutLink){
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }

  wirePassengerDetailsModal();

  // Latest booking summary
  loadLatestConfirmedBookingAndTrack().catch(err => console.error(err));
});

function formatDateTime(ts){
  if(!ts) return '—';
  const d = new Date(ts);
  if(isNaN(d.getTime())) return String(ts);
  return d.toLocaleString();
}

function safeText(value){
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

async function loadLatestConfirmedBookingAndTrack(){
  const stored = getStoredPassenger();
  const passengerId = stored && stored.id ? String(stored.id) : (localStorage.getItem('passengerId') || '').trim();
  if(!passengerId) return;

  const panel = document.getElementById('latestBookingPanel');
  const meta = document.getElementById('latestBookingMeta');
  if(!panel || !meta) return;

  // Fetch bookings for this passenger
  let bookings = [];
  try {
    const res = await fetch(`backend/api/bookings.php?passenger_id=${encodeURIComponent(passengerId)}`, { headers: { 'Accept': 'application/json' } });
    if(!res.ok) throw new Error('Bookings HTTP ' + res.status);
    const json = await res.json();
    if(!Array.isArray(json)) throw new Error('Unexpected bookings response');
    bookings = json;
  } catch(err){
    console.error(err);
    panel.hidden = false;
    meta.textContent = 'Could not load bookings right now.';
    return;
  }

  // Always show the panel; fill it based on latest booking.
  panel.hidden = false;

  if(!bookings.length){
    meta.textContent = 'No booking found yet. Please book seats from Search Bus.';
    return;
  }

  // Prefer active booking; otherwise just the most recent booking.
  const latestBooking = bookings.find(b => String(b.booking_status).toLowerCase() === 'active') || bookings[0];

  const routeName = latestBooking.route_name || `${safeText(latestBooking.start_point)} → ${safeText(latestBooking.end_point)}`;
  meta.innerHTML = '';
  const lines = [
    `Route: ${safeText(routeName)}`,
    `Trip ID: ${safeText(latestBooking.trip_id)}`,
    `Seat: ${safeText(latestBooking.seat_number)} (${safeText(latestBooking.seat_class)})`,
    `Departure: ${formatDateTime(latestBooking.departure_datetime)}`,
    `Booking: ${safeText(latestBooking.booking_status)} • Payment: ${safeText(latestBooking.payment_status)}`
  ];
  lines.forEach(t => {
    const div = document.createElement('div');
    div.textContent = t;
    meta.appendChild(div);
  });
}

// Correct unified functions:
function openSearch() {
  document.body.className = document.body.className.replace(/\bbg-\w+\b/g,'').trim();
  document.body.classList.add('bg-search');
  window.location.assign("search.html");
}

function openRoute() {
  document.body.className = document.body.className.replace(/\bbg-\w+\b/g,'').trim();
  document.body.classList.add('bg-route');
  window.location.assign("route.html");
}

function openRoutesList() {
  document.body.className = document.body.className.replace(/\bbg-\w+\b/g,'').trim();
  document.body.classList.add('bg-routes');
  window.location.assign("routes_list.html");
}

// Logout
function logout() {
  localStorage.removeItem('passenger');
  localStorage.removeItem('passengerToken');
  window.location.href = "index.html";
}

function wirePassengerDetailsModal(){
  const modal = document.getElementById('passengerDetailsModal');
  if(!modal) return;

  const closeBtn = document.getElementById('passengerDetailsCloseBtn');
  if(closeBtn){
    closeBtn.addEventListener('click', closePassengerDetails);
  }

  modal.addEventListener('click', (e) => {
    if(e.target === modal) closePassengerDetails();
  });

  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape' && modal.classList.contains('is-open')) closePassengerDetails();
  });
}

function getStoredPassenger(){
  const raw = localStorage.getItem('passenger');
  if(!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function fetchPassengerDetails(id){
  // Hit the backend passenger endpoint (not the front-end folder)
  const res = await fetch(`backend/api/passengers.php?id=${encodeURIComponent(id)}`, { headers:{'Accept':'application/json'} });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  if(!res.ok || !data || data.error){
    throw new Error((data && data.error) || 'Failed to load passenger details');
  }
  return data;
}

function setPassengerDetailsBody(message){
  const body = document.getElementById('passengerDetailsBody');
  if(body){
    body.textContent = message;
  }
}

function renderPassengerDetails(details){
  const body = document.getElementById('passengerDetailsBody');
  if(!body) return;

  body.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'passenger-details';

  const rows = [
    ['Passenger ID', details.id ?? '—'],
    ['Full Name', details.full_name ?? '—'],
    ['Mobile', details.mobile ?? '—'],
    ['Email', details.email ?? '—'],
    ['Status', details.status ?? '—'],
    ['Created At', details.created_at ?? '—'],
    ['Updated At', details.updated_at ?? '—']
  ];

  rows.forEach(([label, value]) => {
    if((label === 'Status' || label === 'Created At' || label === 'Updated At') && (value === '—' || value === undefined || value === null)){
      return;
    }
    const row = document.createElement('div');
    row.className = 'passenger-details-row';

    const keyEl = document.createElement('div');
    keyEl.className = 'passenger-details-key';
    keyEl.textContent = String(label);

    const valEl = document.createElement('div');
    valEl.className = 'passenger-details-value';
    valEl.textContent = String(value);

    row.appendChild(keyEl);
    row.appendChild(valEl);
    wrapper.appendChild(row);
  });

  body.appendChild(wrapper);
}

async function openPassengerDetails(){
  const modal = document.getElementById('passengerDetailsModal');
  if(!modal) return;

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden','false');
  setPassengerDetailsBody('Loading...');

  const stored = getStoredPassenger();
  if(!stored || !stored.id){
    setPassengerDetailsBody('Passenger info not available.');
    return;
  }

  try {
    const details = await fetchPassengerDetails(stored.id);
    renderPassengerDetails(details);
  } catch(err){
    renderPassengerDetails(stored);
  }

  const closeBtn = document.getElementById('passengerDetailsCloseBtn');
  if(closeBtn) closeBtn.focus();
}

function closePassengerDetails(){
  const modal = document.getElementById('passengerDetailsModal');
  if(!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden','true');
}
