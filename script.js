// =============================
// Toggle Login Forms (Passenger/Admin)
// =============================
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('themeToggle');
  if(toggle && window.cycleTheme){
    toggle.addEventListener('click', () => {
      window.cycleTheme();
    });
  }

  const userForm = document.getElementById('userLogin');
  if(userForm){
    userForm.addEventListener('submit', (e) => {
      e.preventDefault();
      loginUser();
    });
  }

  const adminForm = document.getElementById('adminLogin');
  if(adminForm){
    adminForm.addEventListener('submit', (e) => {
      e.preventDefault();
      loginAdmin();
    });
  }

  const driverForm = document.getElementById('driverLogin');
  if(driverForm){
    driverForm.addEventListener('submit', (e) => {
      e.preventDefault();
      loginDriver();
    });
  }
});

function showUserLogin(){
  document.getElementById('userLogin').classList.add('active');
  document.getElementById('adminLogin').classList.remove('active');
  document.getElementById('userBtn').classList.add('active');
  document.getElementById('adminBtn').classList.remove('active');
}

function showAdminLogin(){
  document.getElementById('adminLogin').classList.add('active');
  document.getElementById('userLogin').classList.remove('active');
  document.getElementById('driverLogin').classList.remove('active');
  document.getElementById('adminBtn').classList.add('active');
  document.getElementById('userBtn').classList.remove('active');
  const driverBtn = document.getElementById('driverBtn');
  if(driverBtn) driverBtn.classList.remove('active');
}

function showDriverLogin(){
  const user = document.getElementById('userLogin');
  const admin = document.getElementById('adminLogin');
  const driver = document.getElementById('driverLogin');
  if(user) user.classList.remove('active');
  if(admin) admin.classList.remove('active');
  if(driver) driver.classList.add('active');
  const userBtn = document.getElementById('userBtn');
  const adminBtn = document.getElementById('adminBtn');
  const driverBtn = document.getElementById('driverBtn');
  if(userBtn) userBtn.classList.remove('active');
  if(adminBtn) adminBtn.classList.remove('active');
  if(driverBtn) driverBtn.classList.add('active');
}

// =============================
// Passenger Authentication
// =============================
// Point to actual backend passenger auth endpoint
const PASSENGER_AUTH_API = 'backend/api/passenger_auth.php';

async function loginUser(){
  const mobile = (document.getElementById('userMobile')||{value:''}).value.trim();
  const password = (document.getElementById('userPassword')||{value:''}).value.trim();
  const container = document.querySelector('.container');
  if(!mobile || !password){
    showInlineMessage(container, 'Please enter mobile and password', 'error');
    return;
  }
  try{
    const res = await fetch(PASSENGER_AUTH_API,{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify({ mobile, password })
    });
    const text = await res.text();
    let data;
    try{ data = JSON.parse(text); }catch(e){
      showInlineMessage(container,'Invalid server response','error');
      return;
    }
    if(!res.ok){
      // Invalid credentials -> offer signup
      if(res.status === 401){
        showInlineMessage(container,'No account found. Redirecting to signup...','error');
        setTimeout(()=>{ window.location.href = 'signup.html?mobile='+encodeURIComponent(mobile); }, 1200);
        return;
      }
      showInlineMessage(container, data.error || 'Login failed', 'error');
      return;
    }
    // Expected format: { token, passenger: {...} }
    if(data.passenger){
      localStorage.setItem('passengerToken', data.token||'');
      localStorage.setItem('passenger', JSON.stringify(data.passenger));
    } else {
      // Fallback if older format
      localStorage.setItem('passenger', JSON.stringify(data));
    }
    window.location.href = 'passenger.html';
  }catch(err){
    console.error(err);
    showInlineMessage(container, 'Network error', 'error');
  }
}

// Point to actual backend admin auth endpoint
const ADMIN_AUTH_API = 'backend/api/auth.php';

async function loginAdmin(){
  const user = (document.getElementById('adminUser')||{value:''}).value.trim();
  const pass = (document.getElementById('adminPass')||{value:''}).value.trim();
  const container = document.querySelector('.container');
  if(!user || !pass){ showInlineMessage(container,'Enter admin username & password','error'); return; }
  try {
    const res = await fetch(ADMIN_AUTH_API,{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify({ username: user, password: pass })
    });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch(e){ showInlineMessage(container,'Invalid server response','error'); return; }
    if(!res.ok){
      showInlineMessage(container, data.error || 'Admin login failed', 'error');
      return;
    }
    // Store token & username
    localStorage.setItem('adminToken', data.token||'');
    localStorage.setItem('adminUser', data.username||user);
    localStorage.setItem('adminLoggedIn','true');
    window.location.href = 'admin.html';
  } catch(err){
    console.error('Admin login error:', err);
    showInlineMessage(container,'Network error','error');
  }
}

function showInlineMessage(parent, msg, type){
  if(!parent) return;
  let box = parent.querySelector('#inlineMessage');
  if(!box){
    box = document.createElement('div');
    box.id = 'inlineMessage';
    box.style.marginTop = '8px';
    parent.appendChild(box);
  }
  box.textContent = msg;
  box.style.color = type==='error' ? '#c00' : '#060';
  if(type!=='error') setTimeout(()=>{ box.textContent=''; }, 3000);
}

// Link to signup page (manual trigger)
function signupUser(){ window.location.href = 'signup.html'; }

// =============================
// Driver Authentication
// =============================
const DRIVER_AUTH_API = 'backend/api/driver_auth.php';

async function loginDriver(){
  const phone = (document.getElementById('driverPhone')||{value:''}).value.trim();
  const license_number = (document.getElementById('driverLicense')||{value:''}).value.trim();
  const container = document.querySelector('.container');
  if(!phone || !license_number){
    showInlineMessage(container, 'Enter phone & license number', 'error');
    return;
  }
  try{
    const res = await fetch(DRIVER_AUTH_API,{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify({ phone, license_number })
    });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch(e){ showInlineMessage(container,'Invalid server response','error'); return; }
    if(!res.ok){
      showInlineMessage(container, data.error || 'Driver login failed', 'error');
      return;
    }
    // Store token & driver info
    if(data.driver){
      localStorage.setItem('driverToken', data.token||'');
      localStorage.setItem('driver', JSON.stringify(data.driver));
    } else {
      localStorage.setItem('driver', JSON.stringify(data));
    }
    window.location.href = 'driver.html';
  } catch(err){
    console.error('Driver login error:', err);
    showInlineMessage(container,'Network error','error');
  }
}
