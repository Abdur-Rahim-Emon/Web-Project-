document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('searchForm');
  const resultsList = document.getElementById('results-list');
  const resultsCount = document.getElementById('results-count');
  const fromInput = document.getElementById('from');
  const toInput = document.getElementById('to');
  const fromSuggest = document.getElementById('from-suggest');
  const toSuggest = document.getElementById('to-suggest');
  const sortSelect = document.getElementById('sortSelect');
  const seatModal = document.getElementById('seatModal');
  const seatModalClose = document.getElementById('seatModalClose');
  const seatGrid = document.getElementById('seatGrid');
  const seatModalTitle = document.getElementById('seatModalTitle');
  const selectedSeatsDisplay = document.getElementById('selectedSeatsDisplay');
  const totalFareDisplay = document.getElementById('totalFareDisplay');
  const confirmBookingBtn = document.getElementById('confirmBookingBtn');
  const seatError = document.getElementById('seatError');

  const places = ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', 'Barisal', 'Mymensingh', 'Comilla'];

  let trips = [];
  let activeTripId = null;
  let seatData = [];
  let selectedSeats = [];
  // Resolve passenger id from login storage (avoid defaulting to 1 for real users)
  let passengerId = (() => {
    const raw = localStorage.getItem('passenger');
    if (raw) {
      try {
        const p = JSON.parse(raw);
        if (p && p.id) return String(p.id);
      } catch (e) {}
    }
    return localStorage.getItem('passengerId') || '1';
  })();

  // --- AUTOSUGGEST ---
  function attachAutosuggest(inputEl, suggestEl) {
    inputEl.addEventListener('input', () => {
      const val = inputEl.value.trim().toLowerCase();
      suggestEl.innerHTML = '';
      if (!val) return;
      const matches = places.filter(p => p.toLowerCase().startsWith(val)).slice(0, 6);
      matches.forEach(m => {
        const div = document.createElement('div');
        div.className = 'suggest-item';
        div.textContent = m;
        div.addEventListener('click', () => { inputEl.value = m; suggestEl.innerHTML = ''; });
        suggestEl.appendChild(div);
      });
    });
    document.addEventListener('click', e => { if (!inputEl.contains(e.target)) suggestEl.innerHTML = ''; });
  }

  attachAutosuggest(fromInput, fromSuggest);
  attachAutosuggest(toInput, toSuggest);

  // --- SWAP ---
  document.getElementById('swapBtn').addEventListener('click', () => {
    [fromInput.value, toInput.value] = [toInput.value, fromInput.value];
  });

  form.addEventListener('submit', e => { e.preventDefault(); runSearch(); });

  // --- RUN SEARCH ---
  async function runSearch() {
    const from = fromInput.value.trim();
    const to = toInput.value.trim();
    const date = document.getElementById('date').value;
    const pax = Number(document.getElementById('pax').value || 1);

    resultsList.innerHTML = '';
    resultsCount.textContent = '';

    if (!from || !to || !date) { alert('Please fill From, To and Date.'); return; }

    try {
      const params = new URLSearchParams({ from, to, date });
      const res = await fetch(`backend/api/trips.php?${params.toString()}`);
      if (!res.ok) throw new Error('Trips HTTP ' + res.status);
      trips = await res.json();
      if (!Array.isArray(trips)) throw new Error('Unexpected trips response');
    } catch (err) {
      console.error(err);
      resultsList.textContent = 'Error fetching trips. Ensure PHP server running and DB migrated.';
      return;
    }

    // --- FILTER ---
    const checkedOps = Array.from(document.querySelectorAll('.filter-operator:checked')).map(n => n.value.toLowerCase());
    let found = trips.filter(t => checkedOps.includes((t.bus_number || '').toLowerCase()));
    if (found.length === 0) found = trips;

    // --- SORT ---
    const sort = sortSelect.value;
    found.sort((a, b) => {
      const fareA = parseFloat(a.base_fare) || 0;
      const fareB = parseFloat(b.base_fare) || 0;
      const timeA = new Date(a.departure_datetime).getTime();
      const timeB = new Date(b.departure_datetime).getTime();

      if (sort === 'price_asc') return fareA - fareB;
      if (sort === 'price_desc') return fareB - fareA;
      if (sort === 'time_earliest') return timeA - timeB;
      return 0;
    });

    resultsCount.textContent = `${found.length} results`;
    if (found.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'result-card';
      empty.textContent = 'No trips found.';
      resultsList.appendChild(empty);
      return;
    }

    found.forEach(t => {
      const card = document.createElement('div'); card.className = 'result-card';
      const left = document.createElement('div'); left.className = 'result-left';
      const badge = document.createElement('div'); badge.className = 'operator-badge'; badge.textContent = t.bus_number || 'Bus';
      const info = document.createElement('div'); info.className = 'result-info';
      const departTime = formatTime(t.departure_datetime);
      const arriveTime = t.arrival_estimated ? formatTime(t.arrival_estimated) : '—';
      const title = document.createElement('h3');
      title.textContent = `${t.start_point || t.route_name?.split(' ')[0] || from} → ${t.end_point || to} • ${departTime} - ${arriveTime}`;
      const desc = document.createElement('p');
      desc.textContent = `Route: ${t.route_name || 'N/A'} • Capacity: ${t.capacity || '—'}`;
      info.appendChild(title); info.appendChild(desc);
      left.appendChild(badge); left.appendChild(info);

      const right = document.createElement('div'); right.className = 'result-right';
      const price = document.createElement('div'); price.className = 'price';
      const fare = parseFloat(t.base_fare);
      price.textContent = `৳ ${isNaN(fare) ? '0.00' : fare.toFixed(2)}`;

      const btn = document.createElement('button'); btn.className = 'select-btn'; btn.textContent = 'Select Seats';
      btn.addEventListener('click', () => openSeatModal(t.id, t.route_name || 'Trip'));

      right.appendChild(price); right.appendChild(btn);
      card.appendChild(left); card.appendChild(right);
      resultsList.appendChild(card);
    });
  }

  // --- SEAT MODAL LOGIC ---
  function openSeatModal(tripId, label) {
    activeTripId = tripId; selectedSeats = []; seatData = [];
    seatModalTitle.textContent = `Select Seats • ${label}`;
    seatError.textContent = '';
    seatGrid.innerHTML = '<div style="text-align:center;width:100%">Loading seats...</div>';
    seatModal.setAttribute('aria-hidden', 'false');
    fetchSeats(tripId);
    updateSelectedDisplay();
  }

  function closeSeatModal() {
    seatModal.setAttribute('aria-hidden', 'true');
    activeTripId = null; selectedSeats = []; seatGrid.innerHTML = '';
  }

  seatModalClose.addEventListener('click', closeSeatModal);
  seatModal.addEventListener('click', e => { if (e.target === seatModal) closeSeatModal(); });

  async function fetchSeats(tripId) {
    try {
      const res = await fetch(`backend/api/seats.php?trip_id=${tripId}`);
      if (!res.ok) throw new Error('Seats HTTP ' + res.status);
      const json = await res.json();
      if (json.error) { throw new Error(json.error); }
      seatData = json.seats || [];
      renderSeatGrid();
    } catch (err) {
      seatGrid.innerHTML = '<div>Error loading seats. Check server & passenger existence.</div>';
      console.error(err);
    }
  }

  function renderSeatGrid() {
    seatGrid.innerHTML = '';
    seatData.forEach(seat => {
      const div = document.createElement('div');
      div.className = `seat ${seat.class} ${seat.available ? 'available' : 'booked'}`;
      div.textContent = seat.seat_number;
      div.setAttribute('role', 'gridcell');
      div.setAttribute('aria-label', `Seat ${seat.seat_number} ${seat.available ? 'available' : 'booked'} class ${seat.class}`);
      if (seat.available) {
        div.addEventListener('click', () => toggleSeat(seat));
      }
      seatGrid.appendChild(div);
    });
  }

  function toggleSeat(seat) {
    const idx = selectedSeats.findIndex(s => s.seat_number === seat.seat_number);
    if (idx >= 0) { selectedSeats.splice(idx, 1); } else { selectedSeats.push(seat); }
    updateSelectedDisplay();
    const el = Array.from(seatGrid.children).find(c => c.textContent === seat.seat_number);
    if (el) { el.classList.toggle('selected', selectedSeats.some(s => s.seat_number === seat.seat_number)); }
  }

  function updateSelectedDisplay() {
    if (selectedSeats.length === 0) {
      selectedSeatsDisplay.textContent = 'None';
      totalFareDisplay.textContent = '0.00';
      confirmBookingBtn.disabled = true;
    } else {
      selectedSeatsDisplay.textContent = selectedSeats.map(s => s.seat_number).join(', ');
      const total = selectedSeats.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
      totalFareDisplay.textContent = total.toFixed(2);
      confirmBookingBtn.disabled = false;
    }
  }

  confirmBookingBtn.addEventListener('click', async () => {
    if (!activeTripId || selectedSeats.length === 0) return;
    confirmBookingBtn.disabled = true; seatError.textContent = 'Creating reservation...';
    const seatPayload = selectedSeats.map(s => ({ seat_number: s.seat_number, seat_class: s.class, price: s.price }));
    const payload = { passenger_id: passengerId, trip_id: activeTripId, seats: seatPayload };
    try {
      const res = await fetch('backend/api/bookings_batch.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Booking HTTP ' + res.status);
      const json = await res.json();
      if (json.error) { seatError.textContent = json.error; confirmBookingBtn.disabled = false; return; }

      // We have provisional booking(s) created with payment_status 'pending'
      const bookingIds = json.booking_ids || [];
      const total = seatPayload.reduce((s, it) => s + (parseFloat(it.price) || 0), 0);

      // start SSLCommerz payment flow via backend
      const tranId = 'TR' + Date.now() + Math.floor(Math.random() * 900 + 100);
      // Use relative path so it works when the app is under /download
      const initUrl = `payment/sslcommerz_init.php?amount=${encodeURIComponent(total.toFixed(2))}&tran_id=${encodeURIComponent(tranId)}&booking_ids=${encodeURIComponent(bookingIds.join(','))}`;
      seatError.textContent = 'Redirecting to payment...';
      try {
        const r2 = await fetch(initUrl);
        if (!r2.ok) throw new Error('Payment init failed');
        const j2 = await r2.json();
        if (j2.error) {
          // Show backend error + gateway status/failedreason if available
          let msg = j2.error;
          if (j2.status) msg += ` (status: ${j2.status})`;
          if (j2.failedreason) msg += ` - ${j2.failedreason}`;
          seatError.textContent = 'Payment init error: ' + msg;
          console.error('SSLCommerz init error response:', j2);
          confirmBookingBtn.disabled = false; return;
        }
        const gateway = j2.gateway_url;
        if (!gateway) { seatError.textContent = 'No gateway URL'; confirmBookingBtn.disabled = false; return; }

        // Store context so the return page can show a useful message.
        try {
          localStorage.setItem('pendingPayment', JSON.stringify({ tran_id: tranId, booking_ids: bookingIds, trip_id: activeTripId }));
        } catch(e) {}

        // Redirect in the SAME TAB so the passenger sees the full SSLCommerz bank list page.
        seatError.textContent = 'Redirecting to SSLCommerz...';
        window.location.assign(gateway);
        return;
      } catch (err2) {
        console.error(err2);
        seatError.textContent = 'Payment initiation failed.'; confirmBookingBtn.disabled = false; return;
      }

    } catch (err) {
      seatError.textContent = 'Booking failed.';
      console.error(err); confirmBookingBtn.disabled = false;
    }
  });

  document.getElementById('date').value = new Date().toISOString().slice(0, 10);
  function formatTime(ts) { if (!ts) return '—'; const d = new Date(ts); return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && seatModal.getAttribute('aria-hidden') === 'false') closeSeatModal(); });
});
