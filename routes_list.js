document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('routesBody');
  const startFilter = document.getElementById('startFilter');
  const endFilter = document.getElementById('endFilter');
  const searchBox = document.getElementById('routeSearch');
  const countEl = document.getElementById('routesCount');

  let trips = [];
  let routesById = {};

  async function loadTrips(){
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center">Loading trips...</td></tr>';
    try {
      const [tripsRes, routesRes] = await Promise.all([
        fetch('backend/api/trips.php'),
        fetch('backend/api/routes.php')
      ]);
      if(!tripsRes.ok) throw new Error('Trips HTTP ' + tripsRes.status);
      if(!routesRes.ok) throw new Error('Routes HTTP ' + routesRes.status);

      const routesData = await routesRes.json();
      routesById = Array.isArray(routesData)
        ? routesData.reduce((acc, r) => { acc[r.id] = normalizeRoute(r); return acc; }, {})
        : {};

      const tripsData = await tripsRes.json();
      trips = Array.isArray(tripsData) ? tripsData.map(t => normalizeTrip(t)) : [];
      populateFilters();
      render();
    } catch (err) {
      console.error(err);
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#b00020">Failed to load trips. Ensure the PHP server and database are running.</td></tr>';
      updateCount(0);
    }
  }

  function normalizeRoute(r){
    let stops = [];
    if(Array.isArray(r.stops)) stops = r.stops;
    else if(r.stops_json){
      try { stops = JSON.parse(r.stops_json) || []; }
      catch { stops = []; }
    }
    return {
      id: r.id,
      name: r.name || '—',
      start: r.start_point || '—',
      end: r.end_point || '—',
      stops
    };
  }

  function normalizeTrip(t){
    const route = routesById[t.route_id] || {};
    return {
      id: t.id,
      routeName: t.route_name || route.name || '—',
      start: t.start_point || route.start || route.start_point || '—',
      end: t.end_point || route.end || route.end_point || '—',
      stops: route.stops || [],
      departure: t.departure_datetime,
      arrival: t.arrival_estimated,
      fare: t.base_fare,
      bus: t.bus_number || t.bus_id || '—',
      status: t.status || 'scheduled'
    };
  }

  function populateFilters(){
    const starts = Array.from(new Set(trips.map(r => (r.start || '').trim()).filter(Boolean))).sort();
    const ends = Array.from(new Set(trips.map(r => (r.end || '').trim()).filter(Boolean))).sort();
    startFilter.innerHTML = '<option value="">All</option>' + starts.map(s => `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`).join('');
    endFilter.innerHTML = '<option value="">All</option>' + ends.map(e => `<option value="${escapeAttr(e)}">${escapeHtml(e)}</option>`).join('');
  }

  function render(){
    const q = (searchBox.value || '').toLowerCase().trim();
    const startVal = startFilter.value || '';
    const endVal = endFilter.value || '';

    let filtered = trips;
    if(startVal) filtered = filtered.filter(r => (r.start || '') === startVal);
    if(endVal) filtered = filtered.filter(r => (r.end || '') === endVal);
    if(q){
      filtered = filtered.filter(r =>
        (r.routeName || '').toLowerCase().includes(q) ||
        (r.start || '').toLowerCase().includes(q) ||
        (r.end || '').toLowerCase().includes(q)
      );
    }

    updateCount(filtered.length);

    if(!filtered.length){
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center">No trips found.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    filtered
      .sort((a,b) => (a.departure || '').localeCompare(b.departure || ''))
      .forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(item.routeName)}</td>
          <td>${escapeHtml(item.start)}</td>
          <td>${escapeHtml(item.end)}</td>
          <td>${renderStops(item.stops)}</td>
          <td>${formatDateTime(item.departure)}</td>
          <td>${formatFare(item.fare)}</td>
          <td>${escapeHtml(item.bus)}</td>
          <td>${escapeHtml(item.status)}</td>
        `;
        tbody.appendChild(tr);
      });
  }

  function renderStops(stops){
    if(!stops || !stops.length) return '<span class="muted">No stops listed</span>';
    return '<div class="stops-list">' + stops.map(s => `<span class="stop-pill">${escapeHtml(s)}</span>`).join('') + '</div>';
  }

  function updateCount(count){
    if(countEl) countEl.textContent = `${count} trip${count === 1 ? '' : 's'}`;
  }

  function formatDateTime(dt){
    if(!dt) return '<span class="muted">—</span>';
    const d = new Date(dt.replace(' ', 'T'));
    if(Number.isNaN(d.getTime())) return escapeHtml(dt);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
  }

  function formatFare(fare){
    if(fare == null || fare === '') return '<span class="muted">—</span>';
    const num = Number(fare);
    if(Number.isNaN(num)) return escapeHtml(fare);
    return `BDT ${num.toFixed(0)}`;
  }

  function escapeHtml(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(s){
    return String(s == null ? '' : s).replace(/"/g, '');
  }

  startFilter.addEventListener('change', render);
  endFilter.addEventListener('change', render);
  searchBox.addEventListener('input', render);

  loadTrips();
});
