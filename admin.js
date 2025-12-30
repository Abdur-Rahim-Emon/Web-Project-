// Prevent unauthorized access (require token & flag)
(function enforceAdminAuth(){
  const loggedIn = localStorage.getItem('adminLoggedIn') === 'true';
  const token = localStorage.getItem('adminToken');
  if(!loggedIn || !token){
    window.location.replace('index.html');
  }
})();

// Backend API endpoints accessed across multiple sections
var BUS_API = 'backend/api/buses.php';
var DRIVER_API = 'backend/api/drivers.php';
var ROUTE_API = 'backend/api/routes.php';

// Tab switching
function showTab(tabId) {
  const tabs = document.querySelectorAll('.tab-content');
  tabs.forEach(tab => tab.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');

  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`[onclick="showTab('${tabId}')"]`);
  if(activeBtn){
    activeBtn.classList.add('active');
    activeBtn.classList.add('pulse-once');
    activeBtn.classList.add('ripple');
    activeBtn.classList.add('active');
    requestAnimationFrame(()=>{
      activeBtn.classList.add('active'); // ensure style applied
      activeBtn.classList.add('ripple');
      activeBtn.classList.add('pulse-once');
      activeBtn.classList.add('active');
      activeBtn.classList.add('ripple');
      activeBtn.classList.add('pulse-once');
      activeBtn.classList.add('active');
      activeBtn.classList.add('ripple');
      activeBtn.classList.add('pulse-once');
      activeBtn.classList.add('active');
      activeBtn.classList.add('ripple');
    });
    activeBtn.classList.add('active');
  }

  // Set background theme per feature
  document.body.classList.remove('bg-search','bg-gps','bg-bus','bg-driver','bg-counter');
  if(tabId === 'searchBusTab') { document.body.classList.add('bg-search'); loadBuses(); }
  else if(tabId === 'gpsTab') document.body.classList.add('bg-gps');
  else if(tabId === 'busManageTab') document.body.classList.add('bg-bus');
  else if(tabId === 'driverManageTab') document.body.classList.add('bg-driver');
  else if(tabId === 'counterManageTab') { document.body.classList.add('bg-counter'); loadCounters(); }
}

// Logout
function logoutAdmin() {
  localStorage.removeItem('adminLoggedIn');
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminUser');
  window.location.href = "index.html";
}

// =============================
// Bus Management (Backend CRUD)
// =============================
var busesData = [];
var busSearchQuery = '';

function sortByIdAscInPlace(list, preferredKeys = ['id']){
  if(!Array.isArray(list)) return list;

  const getId = (obj) => {
    if(!obj || typeof obj !== 'object') return 0;

    for(const key of preferredKeys){
      if(obj[key] != null){
        const n = parseInt(obj[key], 10);
        return isNaN(n) ? 0 : n;
      }
    }

    // Fallback: common pattern like counter_id, route_id, etc.
    for(const k of Object.keys(obj)){
      if(k.endsWith('_id') && obj[k] != null){
        const n = parseInt(obj[k], 10);
        return isNaN(n) ? 0 : n;
      }
    }

    return 0;
  };

  list.sort((a,b) => getId(a) - getId(b));
  return list;
}

async function loadBuses(){
  try {
    const res = await fetch(BUS_API, {headers:{'Accept':'application/json'}});
    if(!res.ok) throw new Error('Failed to load buses');
    busesData = await res.json();
    busesData = Array.isArray(busesData) ? busesData : [];
    sortByIdAscInPlace(busesData);
    renderBuses();
    populateTripFormOptions();
    if(busesData.length === 0){
      showBusMessage('No buses found. Use "Seed Sample Buses" to insert demo data.','error');
    } else {
      showBusMessage(`Loaded ${busesData.length} buses`,'ok');
    }
  } catch(err){
    console.error(err);
    showBusMessage(err.message,'error');
  }
}

function renderBuses(){
  const tbody = document.getElementById('busTbody');
  if(!tbody) return;
  tbody.innerHTML = '';
  const list = busesData.filter(b => {
    if(!busSearchQuery) return true;
    const q = busSearchQuery.toLowerCase();
    return (b.number||'').toLowerCase().includes(q) || (b.type||'').toLowerCase().includes(q);
  });
  if(list.length === 0){
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="6" style="text-align:center;padding:10px;">No buses match your search.</td>';
    tbody.appendChild(tr);
    return;
  }
  list.forEach(bus => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${bus.id}</td>
      <td>${escapeHtml(bus.number)}</td>
      <td>${escapeHtml(bus.type)}</td>
      <td>${bus.capacity}</td>
      <td>${escapeHtml(bus.status_condition)}</td>
      <td>
        <button onclick="editBus(${bus.id})">Edit</button>
        <button onclick="deleteBus(${bus.id})">Delete</button>
      </td>`;
    tr.onclick = () => selectBusRow(bus.id);
    tbody.appendChild(tr);
  });
}

function resetBusForm(){
  document.getElementById('busForm').reset();
  document.getElementById('busId').value='';
  const saveBtn = document.getElementById('busSaveBtn');
  if(saveBtn) saveBtn.textContent = 'Add Bus';
  const delBtn = document.getElementById('busDeleteBtn');
  if(delBtn) delBtn.style.display = 'none';
}

function selectBusRow(id){
  const bus = busesData.find(b=>b.id==id);
  if(!bus) return;
  // Switch to Add/Edit section if a list-only view exists
  if(typeof showBusSection === 'function') {
    showBusSection('busAddSection');
  }
  document.getElementById('busId').value = bus.id;
  document.getElementById('busNumber').value = bus.number;
  document.getElementById('busType').value = bus.type;
  document.getElementById('busCapacity').value = bus.capacity;
  document.getElementById('busCondition').value = bus.status_condition;
  const saveBtn = document.getElementById('busSaveBtn');
  if(saveBtn) saveBtn.textContent = 'Update Bus';
  const delBtn = document.getElementById('busDeleteBtn');
  if(delBtn) delBtn.style.display = 'inline-block';
  highlightEditingRow(bus.id);
}

async function saveBus(){
  const id = document.getElementById('busId').value.trim();
  const payload = {
    number: document.getElementById('busNumber').value.trim(),
    type: document.getElementById('busType').value.trim(),
    capacity: parseInt(document.getElementById('busCapacity').value,10),
    status_condition: document.getElementById('busCondition').value.trim()
  };
  if(!payload.number || !payload.type || !payload.capacity || !payload.status_condition){
    alert('All fields are required');
    return;
  }
  try {
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${BUS_API}?id=${encodeURIComponent(id)}` : BUS_API;
    const res = await fetch(url, {
      method,
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if(!res.ok){
      console.error(data); showBusMessage(data.error || 'Request failed','error'); return;
    }
    resetBusForm();
    await loadBuses();
    showBusMessage(id? 'Bus updated':'Bus added','ok');
    const saveBtn = document.getElementById('busSaveBtn');
    if(saveBtn) saveBtn.textContent = 'Add Bus';
    const delBtn = document.getElementById('busDeleteBtn');
    if(delBtn) delBtn.style.display = 'none';
  }catch(err){
    console.error(err); showBusMessage('Network error','error');
  }
}

async function deleteSelectedBus(){
  const id = document.getElementById('busId').value.trim();
  if(!id){ showBusMessage('No bus selected','error'); return; }
  if(!confirm('Delete this bus?')) return;
  try {
    const res = await fetch(`${BUS_API}?id=${encodeURIComponent(id)}`, {method:'DELETE', headers:{'Accept':'application/json'}});
    const data = await res.json();
    if(!res.ok){ showBusMessage(data.error||'Delete failed','error'); return; }
    showBusMessage('Bus deleted','ok');
    resetBusForm();
    const saveBtn = document.getElementById('busSaveBtn');
    if(saveBtn) saveBtn.textContent = 'Add Bus';
    const delBtn = document.getElementById('busDeleteBtn');
    if(delBtn) delBtn.style.display = 'none';
    await loadBuses();
  }catch(err){ console.error(err); showBusMessage('Network error','error'); }
}

// Admin Management: Add/Update Drivers
// =============================
// Driver Management (Backend CRUD)
// =============================
var driversData = [];
var driverSearchQuery = '';

async function loadDrivers(){
  try {
    const res = await fetch(DRIVER_API, {headers:{'Accept':'application/json'}});
    if(!res.ok) throw new Error('Failed to load drivers');
    driversData = await res.json();
    driversData = Array.isArray(driversData) ? driversData : [];
    sortByIdAscInPlace(driversData);
    renderDrivers();
    populateTripFormOptions();
    const box = document.getElementById('driverMessages');
    if(box){
      if(driversData.length === 0) box.textContent = 'No drivers found.';
      else box.textContent = `Loaded ${driversData.length} drivers`;
      box.style.color = '#060';
      setTimeout(()=>{ if(box.textContent.startsWith('Loaded')) box.textContent=''; },3000);
    }
  } catch(err){
    console.error(err);
    const box = document.getElementById('driverMessages');
    if(box){ box.style.color = '#c00'; box.textContent = err.message; }
  }
}

function renderDrivers(){
  const tbody = document.getElementById('driverTbody');
  if(!tbody) return;
  tbody.innerHTML = '';
  const list = driversData.filter(d => {
    if(!driverSearchQuery) return true;
    const q = driverSearchQuery.toLowerCase();
    return (d.name||'').toLowerCase().includes(q) || (d.license_number||'').toLowerCase().includes(q);
  });
  if(list.length === 0){
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="8" style="text-align:center;padding:10px;">No drivers match your search.</td>';
    tbody.appendChild(tr);
    return;
  }
  list.forEach(driver => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${driver.id}</td>
      <td>${escapeHtml(driver.name||'')}</td>
      <td>${escapeHtml(driver.license_number||'')}</td>
      <td>${escapeHtml(driver.phone||'')}</td>
      <td>${(driver.active==null? '': (String(driver.active)==='1'||driver.active===1||driver.active===true)?'Yes':'No')}</td>
      <td>${escapeHtml(driver.created_at||'')}</td>
      <td>${escapeHtml(driver.updated_at||'')}</td>
      <td>
        <button onclick="editDriver(${driver.id})">Edit</button>
        <button onclick="deleteDriver(${driver.id})">Delete</button>
      </td>`;
    tr.onclick = () => selectDriverRow(driver.id);
    tbody.appendChild(tr);
  });
}

function resetDriverForm(){
  const form = document.getElementById('driverForm');
  if(form) form.reset();
  const idEl = document.getElementById('driverId');
  if(idEl) idEl.value = '';
  const saveBtn = document.getElementById('driverSaveBtn');
  if(saveBtn) saveBtn.textContent = 'Add Driver';
  const delBtn = document.getElementById('driverDeleteBtn');
  if(delBtn) delBtn.style.display = 'none';
}

function selectDriverRow(id){
  const driver = driversData.find(d=>d.id==id);
  if(!driver) return;
  if(typeof showDriverSection === 'function') showDriverSection('driverAddSection');
  document.getElementById('driverId').value = driver.id;
  document.getElementById('driverName').value = driver.name||'';
  const licEl = document.getElementById('driverLicenseNumber');
  if(licEl) licEl.value = driver.license_number||'';
  document.getElementById('driverPhone').value = driver.phone||'';
  const activeEl = document.getElementById('driverActive');
  if(activeEl) activeEl.value = String(driver.active==null? '1': (String(driver.active)==='1'||driver.active===1||driver.active===true?1:0));
  const saveBtn = document.getElementById('driverSaveBtn');
  if(saveBtn) saveBtn.textContent = 'Update Driver';
  const delBtn = document.getElementById('driverDeleteBtn');
  if(delBtn) delBtn.style.display = 'inline-block';
  highlightEditingDriverRow(id);
}

async function saveDriver() {
  const id = (document.getElementById('driverId') || { value: '' }).value.trim();
  const name = (document.getElementById('driverName') || { value: '' }).value.trim();
  const license_number = (document.getElementById('driverLicenseNumber') || { value: '' }).value.trim();
  const phone = (document.getElementById('driverPhone') || { value: '' }).value.trim();
  const activeVal = (document.getElementById('driverActive') || { value: '1' }).value;
  const active = parseInt(activeVal,10) === 1 ? 1 : 0;

  const payload = { name, license_number, phone, active };

  if (!payload.name || !payload.license_number || !payload.phone) {
    alert('Name, License Number and Phone are required');
    return;
  }

  try {
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${DRIVER_API}?id=${encodeURIComponent(id)}` : DRIVER_API;
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(data);
      const box = document.getElementById('driverMessages');
      if (box) { box.style.color = '#c00'; box.textContent = data.error || 'Request failed'; }
      return;
    }
    resetDriverForm();
    await loadDrivers();
    const box = document.getElementById('driverMessages');
    if (box) { box.style.color = '#060'; box.textContent = id ? 'Driver updated' : 'Driver added'; setTimeout(() => { box.textContent = ''; }, 3000); }
  } catch (err) {
    console.error(err);
    const box = document.getElementById('driverMessages');
    if (box) { box.style.color = '#c00'; box.textContent = 'Network error'; }
  }
}




async function deleteSelectedDriver(){
  const id = (document.getElementById('driverId')||{value:''}).value.trim();
  if(!id){ const box = document.getElementById('driverMessages'); if(box){ box.style.color='#c00'; box.textContent='No driver selected'; } return; }
  if(!confirm('Delete this driver?')) return;
  try {
    const res = await fetch(`${DRIVER_API}?id=${encodeURIComponent(id)}`, {method:'DELETE', headers:{'Accept':'application/json'}});
    const data = await res.json();
    if(!res.ok){ const box = document.getElementById('driverMessages'); if(box){ box.style.color='#c00'; box.textContent=data.error||'Delete failed'; } return; }
    const box = document.getElementById('driverMessages'); if(box){ box.style.color='#060'; box.textContent='Driver deleted'; setTimeout(()=>{ box.textContent=''; },3000); }
    resetDriverForm();
    await loadDrivers();
  } catch(err){ console.error(err); const box = document.getElementById('driverMessages'); if(box){ box.style.color='#c00'; box.textContent='Network error'; } }
}

function applyDriverSearch(){
  const input = document.getElementById('driverListSearch');
  driverSearchQuery = input ? input.value.trim() : '';
  renderDrivers();
}

function clearDriverSearch(){
  const input = document.getElementById('driverListSearch');
  if(input) input.value = '';
  driverSearchQuery = '';
  renderDrivers();
}

function manualLoadDrivers(){ loadDrivers(); }

function highlightEditingDriverRow(id){
  const tbody = document.getElementById('driverTbody');
  if(!tbody) return;
  [...tbody.querySelectorAll('tr')].forEach(tr=>tr.classList.remove('editing'));
  const target = [...tbody.querySelectorAll('tr')].find(tr=> tr.firstChild && tr.firstChild.textContent == id);
  if(target){ target.classList.add('editing'); }
}

function editDriver(id){ selectDriverRow(id); }
function deleteDriver(id){ document.getElementById('driverId').value = id; deleteSelectedDriver(); }

// Admin Management: Add/Update Routes
function addRoute() {
  const name = document.getElementById('routeName').value;
  const start = document.getElementById('routeStart').value;
  const end = document.getElementById('routeEnd').value;

  const routeList = document.getElementById('routeManageList');
  const routeInfo = document.createElement('p');
  routeInfo.textContent = `Route ${name} | From: ${start} | To: ${end}`;
  routeList.appendChild(routeInfo);

  document.getElementById('routeForm').reset();
}

// =============================
// Route Management (Backend CRUD)
// =============================
var routesData = [];
var routeSearchQuery = '';

async function loadRoutes(){
  try{
    const res = await fetch(ROUTE_API, {headers:{'Accept':'application/json'}});
    if(!res.ok) throw new Error('Failed to load routes');
    const data = await res.json();
    routesData = Array.isArray(data) ? data.map(r => {
      let stopsArr = [];
      if (r.stops_json) {
        try { stopsArr = JSON.parse(r.stops_json); } catch(e) { console.warn('Invalid stops_json for route', r.id, e); }
      }
      r.stops = Array.isArray(stopsArr) ? stopsArr : [];
      return r;
    }) : [];
    sortByIdAscInPlace(routesData);
    renderRoutes();
    populateTripFormOptions();
    const box = document.getElementById('routeMessages');
    if(box){
      if(routesData.length === 0) box.textContent = 'No routes found.';
      else box.textContent = `Loaded ${routesData.length} routes`;
      box.style.color = '#060';
      setTimeout(()=>{ if(box.textContent.startsWith('Loaded')) box.textContent=''; },3000);
    }
  }catch(err){
    console.error(err);
    const box = document.getElementById('routeMessages');
    if(box){ box.style.color = '#c00'; box.textContent = err.message; }
  }
}

function renderRoutes(){
  const tbody = document.getElementById('routeTbody');
  if(!tbody) return;
  tbody.innerHTML = '';
  const list = routesData.filter(r => {
    if(!routeSearchQuery) return true;
    const q = routeSearchQuery.toLowerCase();
    return (r.name||'').toLowerCase().includes(q)
        || (r.start_point||'').toLowerCase().includes(q)
        || (r.end_point||'').toLowerCase().includes(q);
  });
  if(list.length === 0){
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="7" style="text-align:center;padding:10px;">No routes match your search.</td>';
    tbody.appendChild(tr);
    return;
  }
  list.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${escapeHtml(r.name||'')}</td>
      <td>${escapeHtml(r.start_point||'')}</td>
      <td>${escapeHtml(r.end_point||'')}</td>
      <td>${escapeHtml(r.distance_km != null ? String(r.distance_km) : '')}</td>
      <td>${escapeHtml(r.duration_minutes != null ? String(r.duration_minutes) : '')}</td>
      <td>
        <button onclick="editRouteAdmin(${r.id})">Edit</button>
        <button onclick="deleteRouteAdmin(${r.id})">Delete</button>
      </td>`;
    tr.onclick = () => selectRouteRow(r.id);
    tbody.appendChild(tr);
  });
}

function resetRouteForm(){
  const form = document.getElementById('routeForm');
  if(form) form.reset();
  const idEl = document.getElementById('routeId');
  if(idEl) idEl.value = '';
  const saveBtn = document.getElementById('routeSaveBtn');
  if(saveBtn) saveBtn.textContent = 'Add Route';
  const delBtn = document.getElementById('routeDeleteBtn');
  if(delBtn) delBtn.style.display = 'none';
}

function selectRouteRow(id){
  const r = routesData.find(x => String(x.id) === String(id));
  if(!r) return;
  if(typeof showRouteSection === 'function') showRouteSection('routeAddSection');
  document.getElementById('routeId').value = r.id;
  document.getElementById('routeName').value = r.name || '';
  document.getElementById('routeStart').value = r.start_point || '';
  document.getElementById('routeEnd').value = r.end_point || '';
  const stopsInput = document.getElementById('routeStops');
  if(stopsInput) stopsInput.value = Array.isArray(r.stops) ? r.stops.join(', ') : '';
  const busIdEl = document.getElementById('routeBusId');
  if(busIdEl) busIdEl.value = r.bus_id != null ? r.bus_id : '';
  const distEl = document.getElementById('routeDistance');
  if(distEl) distEl.value = r.distance_km != null ? r.distance_km : '';
  const durEl = document.getElementById('routeDuration');
  if(durEl) durEl.value = r.duration_minutes != null ? r.duration_minutes : '';
  const saveBtn = document.getElementById('routeSaveBtn');
  if(saveBtn) saveBtn.textContent = 'Update Route';
  const delBtn = document.getElementById('routeDeleteBtn');
  if(delBtn) delBtn.style.display = 'inline-block';
  highlightEditingRouteRow(id);
}

async function saveRouteAdmin(){
  const id = (document.getElementById('routeId')||{value:''}).value.trim();
  const name = (document.getElementById('routeName')||{value:''}).value.trim();
  const start_point = (document.getElementById('routeStart')||{value:''}).value.trim();
  const end_point = (document.getElementById('routeEnd')||{value:''}).value.trim();
  const stopsRaw = (document.getElementById('routeStops')||{value:''}).value.trim();
  const busIdVal = (document.getElementById('routeBusId')||{value:''}).value.trim();
  const distVal = (document.getElementById('routeDistance')||{value:''}).value.trim();
  const durVal = (document.getElementById('routeDuration')||{value:''}).value.trim();

  const stops = stopsRaw ? stopsRaw.split(',').map(s=>s.trim()).filter(Boolean) : [];

  const payload = {
    name,
    start_point,
    end_point,
    stops,
    bus_id: busIdVal ? parseInt(busIdVal,10) : null,
    distance_km: distVal ? parseFloat(distVal) : null,
    duration_minutes: durVal ? parseInt(durVal,10) : null
  };

  if(!payload.name || !payload.start_point || !payload.end_point || payload.stops.length === 0){
    alert('Route Name, Start Point, End Point and at least one Stop are required');
    return;
  }

  try{
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${ROUTE_API}?id=${encodeURIComponent(id)}` : ROUTE_API;
    const res = await fetch(url, {
      method,
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if(!res.ok){
      console.error(data);
      const box = document.getElementById('routeMessages');
      if(box){
        box.style.color = '#c00';
        box.textContent = (data && data.error) ? data.error : 'Route save failed';
      }
      return;
    }
    resetRouteForm();
    await loadRoutes();
    const box = document.getElementById('routeMessages');
    if(box){
      box.style.color = '#060';
      box.textContent = id ? 'Route updated' : 'Route added';
      setTimeout(()=>{ box.textContent=''; },3000);
    }
  }catch(err){
    console.error(err);
    const box = document.getElementById('routeMessages');
    if(box){ box.style.color = '#c00'; box.textContent = 'Network error'; }
  }
}

async function deleteSelectedRoute(){
  const id = (document.getElementById('routeId')||{value:''}).value.trim();
  if(!id){
    const box = document.getElementById('routeMessages');
    if(box){ box.style.color='#c00'; box.textContent='No route selected'; }
    return;
  }
  if(!confirm('Delete this route?')) return;
  try{
    const res = await fetch(`${ROUTE_API}?id=${encodeURIComponent(id)}`, {method:'DELETE', headers:{'Accept':'application/json'}});
    const data = await res.json();
    if(!res.ok){
      const box = document.getElementById('routeMessages');
      if(box){ box.style.color='#c00'; box.textContent = (data && data.error) ? data.error : 'Delete failed'; }
      return;
    }
    const box = document.getElementById('routeMessages');
    if(box){ box.style.color='#060'; box.textContent='Route deleted'; setTimeout(()=>{ box.textContent=''; },3000); }
    resetRouteForm();
    await loadRoutes();
  }catch(err){
    console.error(err);
    const box = document.getElementById('routeMessages');
    if(box){ box.style.color='#c00'; box.textContent='Network error'; }
  }
}

function applyRouteSearch(){
  const input = document.getElementById('routeListSearch');
  routeSearchQuery = input ? input.value.trim() : '';
  renderRoutes();
}

function clearRouteSearch(){
  const input = document.getElementById('routeListSearch');
  if(input) input.value = '';
  routeSearchQuery = '';
  renderRoutes();
}

function manualLoadRoutes(){ loadRoutes(); }

function highlightEditingRouteRow(id){
  const tbody = document.getElementById('routeTbody');
  if(!tbody) return;
  [...tbody.querySelectorAll('tr')].forEach(tr=>tr.classList.remove('editing'));
  const target = [...tbody.querySelectorAll('tr')].find(tr=> tr.firstChild && tr.firstChild.textContent == id);
  if(target){ target.classList.add('editing'); }
}

function editRouteAdmin(id){ selectRouteRow(id); }
function deleteRouteAdmin(id){ document.getElementById('routeId').value = id; deleteSelectedRoute(); }

// Passenger-like feature: Search Bus
function searchBus() {
  const input = document.getElementById('searchBusInput').value.toLowerCase();
  const resultsDiv = document.getElementById('searchResults');
  resultsDiv.innerHTML = '';
  const filtered = busesData.filter(bus => 
    bus.number.toLowerCase().includes(input) ||
    bus.type.toLowerCase().includes(input)
  );
  if(filtered.length === 0) {
    resultsDiv.textContent = 'No buses found.';
  } else {
    filtered.forEach(bus => {
      const p = document.createElement('p');
      p.textContent = `Bus ${bus.number} | Type: ${bus.type} | Capacity: ${bus.capacity} | Condition: ${bus.status_condition}`;
      resultsDiv.appendChild(p);
    });
  }
}

// Update passenger bus list whenever a new bus is added
// Legacy updatePassengerBusList removed; search now uses busesData from backend.

// Prevent form submission reload
var busFormEl = document.getElementById('busForm');
if (busFormEl) busFormEl.addEventListener('submit', e => e.preventDefault());
var driverFormEl = document.getElementById('driverForm');
if (driverFormEl) driverFormEl.addEventListener('submit', e => e.preventDefault());
var routeFormEl = document.getElementById('routeForm');
if (routeFormEl) routeFormEl.addEventListener('submit', e => e.preventDefault());
// Counters form submit prevention
document.addEventListener('DOMContentLoaded', () => {
  const cf = document.getElementById('counterForm');
  if (cf) cf.addEventListener('submit', e => e.preventDefault());
});

// =============================
// Trip Management (Backend CRUD)
// =============================
var tripsData = [];
var tripSearchQuery = '';

function populateTripFormOptions(){
  const busSel = document.getElementById('tripBusId');
  const routeSel = document.getElementById('tripRouteId');
  const driverSel = document.getElementById('tripDriverId');

  const currentBus = busSel ? busSel.value : '';
  const currentRoute = routeSel ? routeSel.value : '';
  const currentDriver = driverSel ? driverSel.value : '';

  if(busSel && Array.isArray(busesData)){
    const list = [...busesData].sort((a,b)=> (a.id||0) - (b.id||0));
    busSel.innerHTML = '<option value="">Select bus</option>';
    list.forEach(b => {
      const opt = document.createElement('option');
      opt.value = String(b.id);
      const type = b.type ? `, ${b.type}` : '';
      const cap = b.capacity ? `, cap ${b.capacity}` : '';
      opt.textContent = `${b.id} - ${b.number || ''}${type}${cap}`;
      busSel.appendChild(opt);
    });
    if(currentBus) busSel.value = currentBus;
  }

  if(routeSel && Array.isArray(routesData)){
    const list = [...routesData].sort((a,b)=> (a.id||0) - (b.id||0));
    routeSel.innerHTML = '<option value="">Select route</option>';
    list.forEach(r => {
      const opt = document.createElement('option');
      opt.value = String(r.id);
      const from = r.start_point || '';
      const to = r.end_point || '';
      opt.textContent = `${r.id} - ${r.name || ''} (${from} → ${to})`;
      routeSel.appendChild(opt);
    });
    if(currentRoute) routeSel.value = currentRoute;
  }

  if(driverSel && Array.isArray(driversData)){
    const list = [...driversData].sort((a,b)=> (a.id||0) - (b.id||0));
    driverSel.innerHTML = '<option value="">Unassigned</option>';
    list.forEach(d => {
      const opt = document.createElement('option');
      opt.value = String(d.id);
      const lic = d.license_number ? ` (${d.license_number})` : '';
      const inactive = (String(d.active)==='0' || d.active === 0 || d.active === false) ? ' [inactive]' : '';
      opt.textContent = `${d.id} - ${d.name || ''}${lic}${inactive}`;
      driverSel.appendChild(opt);
    });
    if(currentDriver) driverSel.value = currentDriver;
  }
}

async function loadTrips(){
  try{
    const res = await fetch('backend/api/trips.php', {headers:{'Accept':'application/json'}});
    if(!res.ok) throw new Error('Failed to load trips');
    const data = await res.json();
    tripsData = Array.isArray(data) ? data : [];
    sortByIdAscInPlace(tripsData);
    renderTrips();
    const box = document.getElementById('tripMessages');
    if(box){
      if(tripsData.length === 0) box.textContent = 'No trips found.';
      else box.textContent = `Loaded ${tripsData.length} trips`;
      box.style.color = '#060';
      setTimeout(()=>{ if(box.textContent.startsWith('Loaded')) box.textContent=''; },3000);
    }
  }catch(err){
    console.error(err);
    const box = document.getElementById('tripMessages');
    if(box){ box.style.color='#c00'; box.textContent = err.message; }
  }
}

function renderTrips(){
  const tbody = document.getElementById('tripTbody');
  if(!tbody) return;
  tbody.innerHTML = '';
  const list = tripsData.filter(t => {
    if(!tripSearchQuery) return true;
    const q = tripSearchQuery.toLowerCase();
    return (t.route_name||'').toLowerCase().includes(q)
        || (t.bus_number||'').toLowerCase().includes(q)
        || (t.status||'').toLowerCase().includes(q);
  });
  if(list.length === 0){
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="8" style="text-align:center;padding:10px;">No trips match your search.</td>';
    tbody.appendChild(tr);
    return;
  }
  list.forEach(t => {
    const tr = document.createElement('tr');
    const depart = t.departure_datetime ? new Date(t.departure_datetime).toLocaleString() : '';
    const arrive = t.arrival_estimated ? new Date(t.arrival_estimated).toLocaleString() : '';
    tr.innerHTML = `
      <td>${t.id}</td>
      <td>${escapeHtml(t.bus_number||String(t.bus_id||''))}</td>
      <td>${escapeHtml(t.route_name||String(t.route_id||''))}</td>
      <td>${escapeHtml(depart)}</td>
      <td>${escapeHtml(arrive)}</td>
      <td>${escapeHtml(String(t.base_fare||''))}</td>
      <td>${escapeHtml(t.status||'')}</td>
      <td>
        <button onclick="editTrip(${t.id})">Edit</button>
        <button onclick="deleteTrip(${t.id})">Delete</button>
      </td>`;
    tr.onclick = () => selectTripRow(t.id);
    tbody.appendChild(tr);
  });
}

function resetTripForm(){
  const form = document.getElementById('tripForm');
  if(form) form.reset();
  const idEl = document.getElementById('tripId'); if(idEl) idEl.value='';
  const saveBtn = document.getElementById('tripSaveBtn'); if(saveBtn) saveBtn.textContent='Add Trip';
  const delBtn = document.getElementById('tripDeleteBtn'); if(delBtn) delBtn.style.display='none';
  populateTripFormOptions();
}

function selectTripRow(id){
  const t = tripsData.find(x => String(x.id) === String(id));
  if(!t) return;
  if(typeof showTripSection === 'function') showTripSection('tripAddSection');
  document.getElementById('tripId').value = t.id;
  const busEl = document.getElementById('tripBusId'); if(busEl) busEl.value = t.bus_id || '';
  const routeEl = document.getElementById('tripRouteId'); if(routeEl) routeEl.value = t.route_id || '';
  const driverEl = document.getElementById('tripDriverId'); if(driverEl) driverEl.value = t.driver_id || '';
  const depEl = document.getElementById('tripDeparture'); if(depEl && t.departure_datetime) depEl.value = t.departure_datetime.replace(' ','T').slice(0,16);
  const arrEl = document.getElementById('tripArrival'); if(arrEl && t.arrival_estimated) arrEl.value = t.arrival_estimated.replace(' ','T').slice(0,16);
  const fareEl = document.getElementById('tripBaseFare'); if(fareEl) fareEl.value = t.base_fare || '';
  const statusEl = document.getElementById('tripStatus'); if(statusEl) statusEl.value = t.status || 'scheduled';
  const saveBtn = document.getElementById('tripSaveBtn'); if(saveBtn) saveBtn.textContent='Update Trip';
  const delBtn = document.getElementById('tripDeleteBtn'); if(delBtn) delBtn.style.display='inline-block';
  highlightEditingTripRow(id);
}

async function saveTrip(){
  const id = (document.getElementById('tripId')||{value:''}).value.trim();
  const payload = {
    bus_id: parseInt((document.getElementById('tripBusId')||{value:''}).value,10) || null,
    route_id: parseInt((document.getElementById('tripRouteId')||{value:''}).value,10) || null,
    driver_id: (function(){ const v = (document.getElementById('tripDriverId')||{value:''}).value.trim(); return v ? parseInt(v,10) : null; })(),
    departure_datetime: (document.getElementById('tripDeparture')||{value:''}).value || null,
    arrival_estimated: (document.getElementById('tripArrival')||{value:''}).value || null,
    base_fare: parseFloat((document.getElementById('tripBaseFare')||{value:''}).value) || 0,
    status: (document.getElementById('tripStatus')||{value:'scheduled'}).value
  };

  if(!payload.bus_id || !payload.route_id || !payload.departure_datetime || !payload.base_fare){
    alert('Bus ID, Route ID, Departure and Base Fare are required');
    return;
  }

  // Convert datetime-local (YYYY-MM-DDTHH:MM) to MySQL DATETIME (YYYY-MM-DD HH:MM:SS)
  if(payload.departure_datetime && payload.departure_datetime.includes('T')){
    payload.departure_datetime = payload.departure_datetime.replace('T',' ') + ':00';
  }
  if(payload.arrival_estimated && payload.arrival_estimated.includes('T')){
    payload.arrival_estimated = payload.arrival_estimated.replace('T',' ') + ':00';
  }

  try{
    const method = id ? 'PUT' : 'POST';
    const url = id ? `backend/api/trips_admin.php?id=${encodeURIComponent(id)}` : 'backend/api/trips_admin.php';
    const res = await fetch(url, {method, headers:{'Content-Type':'application/json','Accept':'application/json'}, body: JSON.stringify(payload)});
    const data = await res.json();
    if(!res.ok){
      console.error(data);
      const box = document.getElementById('tripMessages');
      if(box){ box.style.color='#c00'; box.textContent = (data && data.error) ? data.error : 'Trip save failed'; }
      return;
    }
    resetTripForm();
    await loadTrips();
    const box = document.getElementById('tripMessages');
    if(box){ box.style.color='#060'; box.textContent = id ? 'Trip updated' : 'Trip added'; setTimeout(()=>{ box.textContent=''; },3000); }
  }catch(err){
    console.error(err);
    const box = document.getElementById('tripMessages');
    if(box){ box.style.color='#c00'; box.textContent = 'Network error'; }
  }
}

async function deleteSelectedTrip(){
  const id = (document.getElementById('tripId')||{value:''}).value.trim();
  if(!id){ const box = document.getElementById('tripMessages'); if(box){ box.style.color='#c00'; box.textContent='No trip selected'; } return; }
  if(!confirm('Delete this trip?')) return;
  try{
    const res = await fetch(`backend/api/trips_admin.php?id=${encodeURIComponent(id)}`, {method:'DELETE', headers:{'Accept':'application/json'}});
    const data = await res.json();
    if(!res.ok){
      const box = document.getElementById('tripMessages');
      if(box){ box.style.color='#c00'; box.textContent = (data && data.error) ? data.error : 'Delete failed'; }
      return;
    }
    const box = document.getElementById('tripMessages'); if(box){ box.style.color='#060'; box.textContent='Trip deleted'; setTimeout(()=>{ box.textContent=''; },3000); }
    resetTripForm();
    await loadTrips();
  }catch(err){
    console.error(err);
    const box = document.getElementById('tripMessages'); if(box){ box.style.color='#c00'; box.textContent='Network error'; }
  }
}

function applyTripSearch(){
  const input = document.getElementById('tripListSearch');
  tripSearchQuery = input ? input.value.trim() : '';
  renderTrips();
}

function clearTripSearch(){
  const input = document.getElementById('tripListSearch');
  if(input) input.value='';
  tripSearchQuery='';
  renderTrips();
}

function manualLoadTrips(){ loadTrips(); }

function highlightEditingTripRow(id){
  const tbody = document.getElementById('tripTbody');
  if(!tbody) return;
  [...tbody.querySelectorAll('tr')].forEach(tr=>tr.classList.remove('editing'));
  const target = [...tbody.querySelectorAll('tr')].find(tr=> tr.firstChild && tr.firstChild.textContent == id);
  if(target){ target.classList.add('editing'); }
}

function editTrip(id){ selectTripRow(id); }
function deleteTrip(id){ document.getElementById('tripId').value = id; deleteSelectedTrip(); }

// =============================
// Counter Management (Backend CRUD)
// =============================
var countersData = [];
var counterSearchQuery = '';

async function loadCounters(){
  try{
    const res = await fetch('backend/api/counters.php', {headers:{'Accept':'application/json'}});
    const raw = await res.text();
    let payload = null;
    try { payload = raw ? JSON.parse(raw) : null; } catch(parseErr){
      console.warn('Failed to parse counters response as JSON', parseErr, raw);
    }
    if(!res.ok){
      const message = payload && payload.error
        ? payload.error + (payload.detail ? `: ${payload.detail}` : '')
        : (raw || `HTTP ${res.status}`);
      throw new Error(message);
    }
    countersData = Array.isArray(payload) ? payload : [];
    sortByIdAscInPlace(countersData, ['counter_id','id']);
    renderCounters();
    showCounterMessage(countersData.length ? `Loaded ${countersData.length} counters` : 'No counters found.', countersData.length ? 'ok':'error');
  }catch(err){
    console.error(err);
    showCounterMessage(err.message,'error');
  }
}

function renderCounters(){
  const tbody = document.getElementById('counterTbody');
  if(!tbody) return;
  tbody.innerHTML = '';
  const list = countersData.filter(c => {
    if(!counterSearchQuery) return true;
    const q = counterSearchQuery.toLowerCase();
    return (c.counter_name||'').toLowerCase().includes(q)
        || (c.district||'').toLowerCase().includes(q)
        || (c.contact_number||'').toLowerCase().includes(q);
  });
  if(list.length === 0){
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="11" style="text-align:center;padding:10px;">No counters match your search.</td>';
    tbody.appendChild(tr);
    return;
  }
  list.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.counter_id}</td>
      <td>${escapeHtml(c.counter_name||'')}</td>
      <td>${escapeHtml(c.district||'')}</td>
      <td>${escapeHtml(c.location_address||'')}</td>
      <td>${escapeHtml(c.contact_number||'')}</td>
      <td>${escapeHtml(c.alternate_contact||'')}</td>
      <td>${escapeHtml(c.email||'')}</td>
      <td>${formatTimeHHMM(c.opening_time)}</td>
      <td>${formatTimeHHMM(c.closing_time)}</td>
      <td>${escapeHtml(c.status||'')}</td>
      <td>
        <button onclick="editCounter(${c.counter_id})">Edit</button>
        <button onclick="deleteCounter(${c.counter_id})">Delete</button>
      </td>`;
    tr.onclick = () => selectCounterRow(c.counter_id);
    tbody.appendChild(tr);
  });
}

function resetCounterForm(){
  const form = document.getElementById('counterForm');
  if(form) form.reset();
  const idEl = document.getElementById('counterId');
  if(idEl) idEl.value = '';
  const saveBtn = document.getElementById('counterSaveBtn');
  if(saveBtn) saveBtn.textContent = 'Add Counter';
  const delBtn = document.getElementById('counterDeleteBtn');
  if(delBtn) delBtn.style.display = 'none';
}

function selectCounterRow(id){
  const c = countersData.find(x=> String(x.counter_id) === String(id));
  if(!c) return;
  if(typeof showCounterSection === 'function') showCounterSection('counterAddSection');
  document.getElementById('counterId').value = c.counter_id;
  document.getElementById('counterName').value = c.counter_name||'';
  document.getElementById('counterDistrict').value = c.district||'';
  document.getElementById('counterAddress').value = c.location_address||'';
  document.getElementById('counterPhone').value = c.contact_number||'';
  const alt = document.getElementById('counterAltPhone'); if(alt) alt.value = c.alternate_contact||'';
  const em = document.getElementById('counterEmail'); if(em) em.value = c.email||'';
  const o = document.getElementById('counterOpen'); if(o && c.opening_time) o.value = String(c.opening_time).slice(0,5);
  const cl = document.getElementById('counterClose'); if(cl && c.closing_time) cl.value = String(c.closing_time).slice(0,5);
  const st = document.getElementById('counterStatus'); if(st) st.value = c.status||'active';
  const saveBtn = document.getElementById('counterSaveBtn'); if(saveBtn) saveBtn.textContent = 'Update Counter';
  const delBtn = document.getElementById('counterDeleteBtn'); if(delBtn) delBtn.style.display = 'inline-block';
  highlightEditingCounterRow(id);
}

async function saveCounter(){
  const id = (document.getElementById('counterId')||{value:''}).value.trim();
  const payload = {
    counter_name: (document.getElementById('counterName')||{value:''}).value.trim(),
    district: (document.getElementById('counterDistrict')||{value:''}).value.trim(),
    location_address: (document.getElementById('counterAddress')||{value:''}).value.trim(),
    contact_number: (document.getElementById('counterPhone')||{value:''}).value.trim(),
    alternate_contact: (document.getElementById('counterAltPhone')||{value:''}).value.trim() || null,
    email: (document.getElementById('counterEmail')||{value:''}).value.trim() || null,
    opening_time: (document.getElementById('counterOpen')||{value:''}).value || null,
    closing_time: (document.getElementById('counterClose')||{value:''}).value || null,
    status: (document.getElementById('counterStatus')||{value:'active'}).value
  };
  if(!payload.counter_name || !payload.district || !payload.location_address || !payload.contact_number){
    alert('Counter Name, District, Address and Contact Number are required');
    return;
  }
  try{
    const method = id ? 'PUT' : 'POST';
    const url = id ? `backend/api/counters.php?id=${encodeURIComponent(id)}` : 'backend/api/counters.php';
    const res = await fetch(url, { method, headers:{'Content-Type':'application/json','Accept':'application/json'}, body: JSON.stringify(payload) });
    const data = await res.json();
    if(!res.ok){
      console.error(data);
      const message = data && data.error ? data.error + (data.detail ? `: ${data.detail}` : '') : 'Request failed';
      showCounterMessage(message,'error');
      return;
    }
    resetCounterForm();
    await loadCounters();
    showCounterMessage(id? 'Counter updated':'Counter added','ok');
  }catch(err){ console.error(err); showCounterMessage('Network error','error'); }
}

async function deleteSelectedCounter(){
  const id = (document.getElementById('counterId')||{value:''}).value.trim();
  if(!id){ showCounterMessage('No counter selected','error'); return; }
  if(!confirm('Delete this counter?')) return;
  try{
    const res = await fetch(`backend/api/counters.php?id=${encodeURIComponent(id)}`, {method:'DELETE', headers:{'Accept':'application/json'}});
    const data = await res.json();
    if(!res.ok){
      const message = data && data.error ? data.error + (data.detail ? `: ${data.detail}` : '') : 'Delete failed';
      showCounterMessage(message,'error');
      return;
    }
    showCounterMessage('Counter deleted','ok');
    resetCounterForm();
    await loadCounters();
  }catch(err){ console.error(err); showCounterMessage('Network error','error'); }
}

function applyCounterSearch(){
  const input = document.getElementById('counterListSearch');
  counterSearchQuery = input ? input.value.trim() : '';
  renderCounters();
}

function clearCounterSearch(){
  const input = document.getElementById('counterListSearch');
  if(input) input.value = '';
  counterSearchQuery = '';
  renderCounters();
}

function manualLoadCounters(){ loadCounters(); }

function showCounterMessage(msg,type){
  const box = document.getElementById('counterMessages');
  if(!box) return;
  box.style.color = type==='error'? '#c00':'#060';
  box.textContent = msg;
  if(type!=='error') setTimeout(()=>{ if(box.textContent===msg) box.textContent=''; },3000);
}

function highlightEditingCounterRow(id){
  const tbody = document.getElementById('counterTbody');
  if(!tbody) return;
  [...tbody.querySelectorAll('tr')].forEach(tr=>tr.classList.remove('editing'));
  const target = [...tbody.querySelectorAll('tr')].find(tr=> tr.firstChild && tr.firstChild.textContent == id);
  if(target){ target.classList.add('editing'); }
}

function editCounter(id){ selectCounterRow(id); }
function deleteCounter(id){ document.getElementById('counterId').value = id; deleteSelectedCounter(); }

function showCounterSection(sectionId){
  const sections = document.querySelectorAll('#counterManageTab .bus-section');
  sections.forEach(s=>{
    if(s.id === sectionId){ s.style.display='block'; s.classList.add('active'); }
    else { s.style.display='none'; s.classList.remove('active'); }
  });
  const buttons = document.querySelectorAll('#counterManageTab .bus-sub-btn');
  buttons.forEach(btn=>{
    if(btn.getAttribute('onclick').includes(sectionId)) btn.classList.add('active');
    else btn.classList.remove('active');
  });
  if(sectionId === 'counterAddSection') resetCounterForm();
}

function formatTimeHHMM(t){ if(!t) return ''; const p = String(t).split(':'); return p[0]+':'+p[1]; }

// =====================================
// Enhanced Editable Routes (Routes tab)
// =====================================
let editableRoutes = [];
let routeIdCounter = 1;

function renderEditableRoutes(){
  const tbody = document.getElementById('routesTbody');
  if(!tbody) return;
  tbody.innerHTML='';
  editableRoutes.forEach(r => {
    const tr = document.createElement('tr');
    tr.dataset.id = r.id;
    tr.innerHTML = `
      <td class="cell-bus">${escapeHtml(r.busName)}</td>
      <td class="cell-from">${escapeHtml(r.from)}</td>
      <td class="cell-to">${escapeHtml(r.to)}</td>
      <td class="cell-stops">${r.stops.map(s=>`<span>${escapeHtml(s)}</span>`).join(', ')}</td>
      <td class="route-actions">
        <button class="btn-edit" onclick="editRoute(${r.id})">Edit</button>
        <button class="btn-delete" onclick="deleteRoute(${r.id})">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function addEditableRoute(e){
  e.preventDefault();
  const busName = document.getElementById('routeBusName').value.trim();
  const from = document.getElementById('routeFrom').value.trim();
  const to = document.getElementById('routeTo').value.trim();
  const stopsRaw = document.getElementById('routeStops').value.trim();
  if(!busName || !from || !to || !stopsRaw){return;}
  const stops = stopsRaw.split(',').map(s=>s.trim()).filter(Boolean);
  editableRoutes.push({id:routeIdCounter++, busName, from, to, stops});
  document.getElementById('routesAddForm').reset();
  renderEditableRoutes();
}

function editRoute(id){
  const tr = document.querySelector(`#routesTbody tr[data-id='${id}']`);
  if(!tr) return;
  const route = editableRoutes.find(r=>r.id===id);
  tr.classList.add('editing');
  tr.innerHTML = `
    <td><input type="text" value="${escapeAttr(route.busName)}" class="edit-bus"></td>
    <td><input type="text" value="${escapeAttr(route.from)}" class="edit-from"></td>
    <td><input type="text" value="${escapeAttr(route.to)}" class="edit-to"></td>
    <td><input type="text" value="${escapeAttr(route.stops.join(', '))}" class="edit-stops"></td>
    <td class="route-actions">
      <button class="btn-save" onclick="saveRoute(${id})">Save</button>
      <button class="btn-cancel" onclick="cancelEdit(${id})">Cancel</button>
      <button class="btn-delete" onclick="deleteRoute(${id})">Delete</button>
    </td>`;
}

function saveRoute(id){
  const tr = document.querySelector(`#routesTbody tr[data-id='${id}']`);
  if(!tr) return;
  const busName = tr.querySelector('.edit-bus').value.trim();
  const from = tr.querySelector('.edit-from').value.trim();
  const to = tr.querySelector('.edit-to').value.trim();
  const stopsRaw = tr.querySelector('.edit-stops').value.trim();
  const stops = stopsRaw.split(',').map(s=>s.trim()).filter(Boolean);
  const route = editableRoutes.find(r=>r.id===id);
  Object.assign(route,{busName,from,to,stops});
  renderEditableRoutes();
}

function cancelEdit(id){
  renderEditableRoutes();
}

function deleteRoute(id){
  editableRoutes = editableRoutes.filter(r=>r.id!==id);
  renderEditableRoutes();
}

function escapeHtml(str){return str.replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function escapeAttr(str){return escapeHtml(str).replace(/'/g,'&#39;');}

// Hook add form
const addForm = document.getElementById('routesAddForm');
if(addForm){ addForm.addEventListener('submit', addEditableRoute); }

// Extend tab switch for bus manage
const originalShowTab = showTab;
showTab = function(tabId){
  originalShowTab(tabId);
  if(tabId === 'busManageTab'){
    loadBuses();
    if(typeof showBusSection === 'function') showBusSection('busAddSection');
  } else if(tabId === 'routeManageTab'){
    loadRoutes();
    if(typeof showRouteSection === 'function') showRouteSection('routeAddSection');
  } else if(tabId === 'driverManageTab'){
    loadDrivers();
    if(typeof showDriverSection === 'function') showDriverSection('driverAddSection');
  } else if(tabId === 'counterManageTab'){
    loadCounters();
    if(typeof showCounterSection === 'function') showCounterSection('counterAddSection');
  } else if(tabId === 'tripManageTab'){
    // Trip form selects depend on busesData/routesData/driversData.
    // Load them here so the dropdowns populate even if other tabs weren't opened first.
    loadBuses();
    loadRoutes();
    loadDrivers();
    loadTrips();
    if(typeof showTripSection === 'function') showTripSection('tripAddSection');
  } else if(tabId === 'reportTab'){
    ensureAdminReportReady();
  }
};

function setReportMessage(msg, type){
  const el = document.getElementById('reportMessages');
  if(!el) return;
  el.textContent = msg || '';
  el.style.color = type === 'ok' ? '#060' : '#c00';
}

function safeText(v){
  if(v == null) return '';
  return String(v);
}

function formatReportDateTime(dt){
  if(!dt) return '';
  try{
    const d = new Date(String(dt).replace(' ','T'));
    return d.toLocaleString();
  }catch{ return String(dt); }
}

async function ensureAdminReportReady(){
  const container = document.getElementById('adminReportContent');
  if(container) container.innerHTML = '<div style="padding:8px">Loading report...</div>';
  setReportMessage('', 'ok');
  try{
    // Ensure data arrays are populated
    await Promise.all([
      (async ()=>{ try { await loadBuses(); } catch(e){} })(),
      (async ()=>{ try { await loadRoutes(); } catch(e){} })(),
      (async ()=>{ try { await loadDrivers(); } catch(e){} })(),
      (async ()=>{ try { await loadCounters(); } catch(e){} })(),
      (async ()=>{ try { await loadTrips(); } catch(e){} })()
    ]);

    renderAdminReportInto(container);
    setReportMessage('Report is ready.', 'ok');
    setTimeout(()=>setReportMessage('', 'ok'), 2500);
  }catch(err){
    console.error(err);
    if(container) container.innerHTML = '<div style="padding:8px">Failed to build report.</div>';
    setReportMessage('Failed to build report', 'error');
  }
}

function renderAdminReportInto(container){
  if(!container) return;

  const adminUser = localStorage.getItem('adminUser') || 'Admin';
  const now = new Date();

  const buses = Array.isArray(busesData) ? busesData : [];
  const routes = Array.isArray(routesData) ? routesData : [];
  const drivers = Array.isArray(driversData) ? driversData : [];
  const counters = Array.isArray(countersData) ? countersData : [];
  const trips = Array.isArray(tripsData) ? tripsData : [];

  // Basic header + summary
  const header = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div>
        <h3 style="margin:0 0 4px 0">Bus Transport Automation - Admin Report</h3>
        <div style="font-size:0.9em;opacity:0.85">Generated by: ${escapeHtml(safeText(adminUser))}</div>
        <div style="font-size:0.9em;opacity:0.85">Generated at: ${escapeHtml(now.toLocaleString())}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div style="padding:8px 10px;border:1px solid rgba(0,0,0,0.12);border-radius:10px">Buses: <strong>${buses.length}</strong></div>
        <div style="padding:8px 10px;border:1px solid rgba(0,0,0,0.12);border-radius:10px">Routes: <strong>${routes.length}</strong></div>
        <div style="padding:8px 10px;border:1px solid rgba(0,0,0,0.12);border-radius:10px">Drivers: <strong>${drivers.length}</strong></div>
        <div style="padding:8px 10px;border:1px solid rgba(0,0,0,0.12);border-radius:10px">Counters: <strong>${counters.length}</strong></div>
        <div style="padding:8px 10px;border:1px solid rgba(0,0,0,0.12);border-radius:10px">Trips: <strong>${trips.length}</strong></div>
      </div>
    </div>
  `;

  const section = (title, inner) => `
    <div style="margin-top:14px">
      <h4 style="margin:0 0 8px 0">${escapeHtml(title)}</h4>
      ${inner}
    </div>
  `;

  const table = (columns, rows) => {
    const thead = `<thead><tr>${columns.map(c=>`<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${escapeHtml(safeText(v))}</td>`).join('')}</tr>`).join('')}</tbody>`;
    return `<table class="data-table" style="width:100%;margin:0"><!-- data-table styles from admin.css -->${thead}${tbody}</table>`;
  };

  const busesTable = table(
    ['ID','Number','Type','Capacity','Condition'],
    buses.map(b=>[b.id, b.number, b.type, b.capacity, b.status_condition])
  );

  const routesTable = table(
    ['ID','Name','From','To','Distance (km)','Duration (min)','Bus ID'],
    routes.map(r=>[r.id, r.name, r.start_point, r.end_point, r.distance_km ?? '', r.duration_minutes ?? '', r.bus_id ?? ''])
  );

  const driversTable = table(
    ['ID','Name','License','Phone','Active'],
    drivers.map(d=>[d.id, d.name, d.license_number, d.phone, (String(d.active)==='1'||d.active===1||d.active===true)?'Yes':'No'])
  );

  const countersTable = table(
    ['ID','Name','District','Phone','Status'],
    counters.map(c=>[c.counter_id ?? c.id, c.counter_name, c.district, c.contact_number, c.status])
  );

  const tripsTable = table(
    ['ID','Bus','Route','Driver ID','Departure','Arrival','Fare','Status'],
    trips.map(t=>[
      t.id,
      t.bus_number || t.bus_id,
      t.route_name || t.route_id,
      t.driver_id ?? '',
      formatReportDateTime(t.departure_datetime),
      formatReportDateTime(t.arrival_estimated),
      t.base_fare,
      t.status
    ])
  );

  container.innerHTML = [
    header,
    section('Buses', buses.length ? busesTable : '<div>No data</div>'),
    section('Routes', routes.length ? routesTable : '<div>No data</div>'),
    section('Drivers', drivers.length ? driversTable : '<div>No data</div>'),
    section('Counters', counters.length ? countersTable : '<div>No data</div>'),
    section('Trips', trips.length ? tripsTable : '<div>No data</div>')
  ].join('');
}

async function printAdminReport(){
  await ensureAdminReportReady();
  const reportEl = document.getElementById('adminReportContent');
  if(!reportEl) return;

  const html = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Admin Report</title>
      <style>
        body{ font-family: Arial, sans-serif; padding: 16px; color:#000; }
        h3,h4{ margin:0 0 8px 0; }
        table{ width:100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 12px; }
        th,td{ border:1px solid #ccc; padding:6px; text-align:left; vertical-align: top; }
        th{ background:#f3f3f3; }
      </style>
    </head>
    <body>
      ${reportEl.innerHTML}
      <script>
        window.onload = () => { window.print(); };
      <\/script>
    </body>
  </html>`;

  const w = window.open('', '_blank');
  if(!w){
    setReportMessage('Popup blocked. Allow popups to print.', 'error');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

async function downloadAdminReportPdf(){
  await ensureAdminReportReady();
  const reportEl = document.getElementById('adminReportContent');
  if(!reportEl) return;

  const adminUser = localStorage.getItem('adminUser') || 'admin';
  const fileName = `admin-report-${adminUser}-${new Date().toISOString().slice(0,10)}.pdf`;

  if(typeof window.html2pdf !== 'function'){
    // Fallback: user can save as PDF from the print dialog
    setReportMessage('PDF library not available. Use Print and choose “Save as PDF”.', 'error');
    await printAdminReport();
    return;
  }

  setReportMessage('Generating PDF...', 'ok');
  try{
    const opt = {
      margin:       10,
      filename:     fileName,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    await window.html2pdf().set(opt).from(reportEl).save();
    setReportMessage('PDF downloaded.', 'ok');
    setTimeout(()=>setReportMessage('', 'ok'), 2500);
  }catch(err){
    console.error(err);
    setReportMessage('PDF generation failed. Use Print instead.', 'error');
  }
}

// Initial data load so Search tab has data
document.addEventListener('DOMContentLoaded', ()=>{
  try { loadBuses(); } catch(e){}
  try { loadCounters(); } catch(e){}
  try { loadRoutes(); } catch(e){}
  try { loadTrips(); } catch(e){}
});
// Ripple on bus sub buttons
document.addEventListener('click', (e)=>{
  const target = e.target.closest('.bus-sub-btn, .btn');
  if(target){
    target.classList.add('pulse-once');
    target.classList.add('ripple','active');
    setTimeout(()=>{ target.classList.remove('pulse-once'); target.classList.remove('active'); }, 400);
  }
});

function showBusSection(sectionId){
  const sections = document.querySelectorAll('#busManageTab .bus-section');
  sections.forEach(s=>{
    if(s.id === sectionId){ s.style.display='block'; s.classList.add('active'); }
    else { s.style.display='none'; s.classList.remove('active'); }
  });
  const buttons = document.querySelectorAll('#busManageTab .bus-sub-btn');
  buttons.forEach(btn=>{
    if(btn.getAttribute('onclick').includes(sectionId)) btn.classList.add('active');
    else btn.classList.remove('active');
  });
  // apply subtle background theme per sub-section
  if(sectionId === 'tripAddSection'){
    // Ensure dependent datasets are loaded so dropdowns are selectable.
    try{
      if(!Array.isArray(busesData) || busesData.length === 0) loadBuses();
      if(!Array.isArray(routesData) || routesData.length === 0) loadRoutes();
      if(!Array.isArray(driversData) || driversData.length === 0) loadDrivers();
    }catch(e){ /* non-fatal */ }
    populateTripFormOptions();
  }
  if(sectionId === 'busAddSection') document.body.classList.add('bg-bus-add');
  else if(sectionId === 'busListSection') document.body.classList.add('bg-bus-list');
  if(sectionId === 'busAddSection'){
    resetBusForm();
    showBusMessage('Add a new bus.','ok');
  }
}

function showDriverSection(sectionId){
  const sections = document.querySelectorAll('#driverManageTab .bus-section');
  sections.forEach(s=>{
    if(s.id === sectionId){ s.style.display='block'; s.classList.add('active'); }
    else { s.style.display='none'; s.classList.remove('active'); }
  });
  const buttons = document.querySelectorAll('#driverManageTab .bus-sub-btn');
  buttons.forEach(btn=>{
    if(btn.getAttribute('onclick').includes(sectionId)) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

function showRouteSection(sectionId){
  const sections = document.querySelectorAll('#routeManageTab .bus-section');
  sections.forEach(s=>{
    if(s.id === sectionId){ s.style.display='block'; s.classList.add('active'); }
    else { s.style.display='none'; s.classList.remove('active'); }
  });
  const buttons = document.querySelectorAll('#routeManageTab .bus-sub-btn');
  buttons.forEach(btn=>{
    if(btn.getAttribute('onclick').includes(sectionId)) btn.classList.add('active');
    else btn.classList.remove('active');
  });
  if(sectionId === 'routeAddSection') resetRouteForm();
}

function showTripSection(sectionId){
  const sections = document.querySelectorAll('#tripManageTab .bus-section');
  sections.forEach(s=>{
    if(s.id === sectionId){ s.style.display='block'; s.classList.add('active'); }
    else { s.style.display='none'; s.classList.remove('active'); }
  });
  const buttons = document.querySelectorAll('#tripManageTab .bus-sub-btn');
  buttons.forEach(btn=>{
    if(btn.getAttribute('onclick').includes(sectionId)) btn.classList.add('active');
    else btn.classList.remove('active');
  });
  if(sectionId === 'tripAddSection') resetTripForm();
  if(sectionId === 'tripAddSection') populateTripFormOptions();
}

document.addEventListener('DOMContentLoaded', () => {
    showDriverSection('driverAddSection'); // ensure the add form is visible
});


function manualLoadBuses(){ loadBuses(); }

function applyBusSearch(){
  const input = document.getElementById('busListSearch');
  busSearchQuery = input ? input.value.trim() : '';
  renderBuses();
}

function clearBusSearch(){
  const input = document.getElementById('busListSearch');
  if(input) input.value = '';
  busSearchQuery = '';
  renderBuses();
}

async function seedSampleBuses(){
  const samples = [
    {number:'BL100', type:'AC', capacity:40, status_condition:'Good'},
    {number:'CL200', type:'Non-AC', capacity:36, status_condition:'Fair'},
    {number:'EX300', type:'AC', capacity:44, status_condition:'Excellent'}
  ];
  showBusMessage('Seeding sample buses...','ok');
  for(const bus of samples){
    try {
      const res = await fetch(BUS_API, {
        method:'POST',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body: JSON.stringify(bus)
      });
      const data = await res.json();
      if(!res.ok){
        console.error(data);
        showBusMessage('Seeding error: '+(data.error||'Unknown error'),'error');
        return;
      }
    } catch(err){
      console.error(err);
      showBusMessage('Network error during seeding','error');
      return;
    }
  }
  await loadBuses();
  showBusMessage('Sample buses seeded','ok');
}

function showBusMessage(msg,type){
  const box = document.getElementById('busMessages');
  if(!box) return;
  box.style.color = type==='error'? '#c00':'#060';
  box.textContent = msg;
  if(type!=='error') setTimeout(()=>{ if(box.textContent===msg) box.textContent=''; },3000);
}

function highlightEditingRow(id){
  const tbody = document.getElementById('busTbody');
  if(!tbody) return;
  [...tbody.querySelectorAll('tr')].forEach(tr=>tr.classList.remove('editing'));
  const target = [...tbody.querySelectorAll('tr')].find(tr=> tr.firstChild && tr.firstChild.textContent == id);
  if(target){ target.classList.add('editing'); }
}

// Routes features removed from UI; keep data inactive.

// =============================
// BACKEND INTEGRATION (PHP API)
// =============================
// To integrate with the new PHP backend:
// 1. Replace sample data load with fetch('backend/api/routes.php') then map.
// 2. On addEditableRoute, POST to backend/api/routes.php with stops array.
// 3. On saveRoute, PUT to backend/api/routes.php?id=ID.
// 4. On deleteRoute, DELETE backend/api/routes.php?id=ID.
// 5. Similar approach for buses and drivers endpoints.
// See backend/README_backend.md for endpoint details.

