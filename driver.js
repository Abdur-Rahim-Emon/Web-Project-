document.addEventListener('DOMContentLoaded', () => {
  const driverRaw = localStorage.getItem('driver');
  let driver = null;
  try { driver = driverRaw ? JSON.parse(driverRaw) : null; } catch { driver = null; }
  if(!driver || !driver.id){
    window.location.replace('index.html');
    return;
  }

  window.currentDriverId = driver.id;

  const welcome = document.getElementById('driverWelcome');
  if(welcome){ welcome.textContent = 'Welcome ' + (driver.name || 'Driver') + ' 👋'; }

  const logoutLink = document.getElementById('driverLogoutLink');
  if(logoutLink){ logoutLink.addEventListener('click', (e) => { e.preventDefault(); logoutDriver(); }); }

  wireTabs();
  loadTrips(driver.id);
  loadRoutes(driver.id);
});

function wireTabs(){
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === target);
      });
    });
  });
}

async function loadTrips(driverId){
  const activeContainer = document.getElementById('activeTrips');
  const completedContainer = document.getElementById('completedTrips');
  const activeCount = document.getElementById('activeCount');
  const completedCount = document.getElementById('completedCount');
  if(activeContainer) activeContainer.innerHTML = '<div class="loading">Loading trips...</div>';
  if(completedContainer) completedContainer.innerHTML = '<div class="loading">Loading trips...</div>';
  try{
    const res = await fetch(`backend/api/trips.php?driver_id=${encodeURIComponent(driverId)}`, { headers:{'Accept':'application/json'} });
    const text = await res.text();
    let rows; try { rows = JSON.parse(text); } catch { rows = null; }
    if(!res.ok || !rows){
      if(activeContainer) activeContainer.innerHTML = '<div class="loading">Failed to load trips</div>';
      if(completedContainer) completedContainer.innerHTML = '<div class="loading">Failed to load trips</div>';
      return;
    }
    const active = rows.filter(t => t.status !== 'completed');
    const completed = rows.filter(t => t.status === 'completed');
    if(activeCount) activeCount.textContent = active.length;
    if(completedCount) completedCount.textContent = completed.length;
    renderActiveTrips(activeContainer, active);
    renderCompletedTrips(completedContainer, completed);
  } catch(err){
    console.error(err);
    if(activeContainer) activeContainer.innerHTML = '<div class="loading">Network error</div>';
    if(completedContainer) completedContainer.innerHTML = '<div class="loading">Network error</div>';
  }
}

function renderActiveTrips(container, trips){
  if(!container) return;
  if(!Array.isArray(trips) || trips.length === 0){
    container.innerHTML = '<div class="loading">No active trips.</div>';
    return;
  }
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Trip ID','Route','Departure','Arrival','Bus','Status','Action'].forEach(h => {
    const th = document.createElement('th'); th.textContent = h; headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  trips.forEach(t => {
    const tr = document.createElement('tr');
    const routeText = (t.route_name || '') + ' (' + (t.start_point || '') + ' → ' + (t.end_point || '') + ')';
    const statusBadge = `<span class="status ${t.status}">${t.status}</span>`;
    const cells = [
      t.id,
      routeText,
      formatDateTime(t.departure_datetime),
      formatDateTime(t.arrival_estimated),
      (t.bus_number || '') + (t.bus_type ? ' • ' + t.bus_type : ''),
      statusBadge
    ];
    cells.forEach((val, idx) => {
      const td = document.createElement('td');
      if(idx === 5){ td.innerHTML = String(val); } else { td.textContent = String(val ?? ''); }
      tr.appendChild(td);
    });

    const actionTd = document.createElement('td');
    if(t.status === 'completed' || t.status === 'cancelled'){
      actionTd.textContent = '—';
    } else {
      const btn = document.createElement('button');
      btn.className = 'action-btn';
      btn.textContent = '✔ Mark Done';
      btn.addEventListener('click', () => markTripDone(t.id, btn));
      actionTd.appendChild(btn);
    }
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.innerHTML = '';
  container.appendChild(table);
}

function renderCompletedTrips(container, trips){
  if(!container) return;
  if(!Array.isArray(trips) || trips.length === 0){
    container.innerHTML = '<div class="loading">No completed trips yet.</div>';
    return;
  }
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Trip ID','Route','Departure','Arrival','Bus','Status'].forEach(h => {
    const th = document.createElement('th'); th.textContent = h; headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  trips.forEach(t => {
    const tr = document.createElement('tr');
    const routeText = (t.route_name || '') + ' (' + (t.start_point || '') + ' → ' + (t.end_point || '') + ')';
    const statusBadge = '<span class="done-badge"><span class="done-icon">✔</span>Done</span>';
    [
      t.id,
      routeText,
      formatDateTime(t.departure_datetime),
      formatDateTime(t.arrival_estimated),
      (t.bus_number || '') + (t.bus_type ? ' • ' + t.bus_type : ''),
      statusBadge
    ].forEach((val, idx) => {
      const td = document.createElement('td');
      if(idx === 5){ td.innerHTML = String(val); } else { td.textContent = String(val ?? ''); }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.innerHTML = '';
  container.appendChild(table);
}

function formatDateTime(dt){
  if(!dt) return '—';
  try{
    const d = new Date(dt.replace(' ','T'));
    return d.toLocaleString();
  } catch{ return dt; }
}

async function markTripDone(tripId, btn){
  if(btn){ btn.disabled = true; btn.textContent = 'Updating...'; }
  try{
    const res = await fetch('backend/api/trip_status_driver.php', {
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify({ trip_id: tripId, driver_id: window.currentDriverId, status: 'completed' })
    });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = null; }
    if(!res.ok || !data){
      if(btn){ btn.disabled = false; btn.textContent = '✔ Mark Done'; }
      alert((data && data.error) || 'Could not update trip');
      return;
    }
    loadTrips(window.currentDriverId);
  } catch(err){
    console.error(err);
    if(btn){ btn.disabled = false; btn.textContent = '✔ Mark Done'; }
    alert('Network error');
  }
}

async function loadRoutes(driverId){
  const container = document.getElementById('routesContainer');
  const countEl = document.getElementById('routesCount');
  if(container) container.innerHTML = '<div class="loading">Loading routes...</div>';
  try{
    const res = await fetch(`backend/api/trips.php?driver_id=${encodeURIComponent(driverId)}`, { headers:{'Accept':'application/json'} });
    const text = await res.text();
    let rows; try { rows = JSON.parse(text); } catch { rows = null; }
    if(!res.ok || !rows){
      if(container) container.innerHTML = '<div class="loading">Failed to load routes</div>';
      return;
    }

    const byRouteId = new Map();
    (Array.isArray(rows) ? rows : []).forEach(t => {
      const rid = t.route_id;
      if(!rid) return;
      if(byRouteId.has(rid)) return;
      byRouteId.set(rid, {
        id: rid,
        name: t.route_name || '',
        start_point: t.start_point || '',
        end_point: t.end_point || ''
      });
    });

    const routes = [...byRouteId.values()].sort((a,b) => (parseInt(a.id,10)||0) - (parseInt(b.id,10)||0));
    if(countEl) countEl.textContent = routes.length;
    renderAssignedRoutes(container, routes);
  } catch(err){
    console.error(err);
    if(container) container.innerHTML = '<div class="loading">Network error</div>';
  }
}

function renderAssignedRoutes(container, routes){
  if(!container) return;
  if(!Array.isArray(routes) || routes.length === 0){
    container.innerHTML = '<div class="loading">No assigned routes found.</div>';
    return;
  }
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Route ID','Name','From','To'].forEach(h => {
    const th = document.createElement('th'); th.textContent = h; headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  routes.forEach(r => {
    const tr = document.createElement('tr');
    [
      r.id,
      r.name,
      r.start_point,
      r.end_point
    ].forEach(val => {
      const td = document.createElement('td'); td.textContent = String(val ?? '—'); tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.innerHTML = '';
  container.appendChild(table);
}

function logoutDriver(){
  localStorage.removeItem('driver');
  localStorage.removeItem('driverToken');
  window.location.href = 'index.html';
}
