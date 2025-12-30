// Point to the actual backend signup endpoint
const PASSENGERS_API = 'backend/api/passengers.php';

async function signupUser(){
  const firstName = (document.getElementById('firstName')||{value:''}).value.trim();
  const lastName = (document.getElementById('lastName')||{value:''}).value.trim();
  const mobile = (document.getElementById('mobile')||{value:''}).value.trim();
  const email = (document.getElementById('email')||{value:''}).value.trim();
  const gender = (document.querySelector('input[name="gender"]:checked')||{value:''}).value;
  const password = (document.getElementById('password')||{value:''}).value;
  const confirmPassword = (document.getElementById('confirmPassword')||{value:''}).value;
  const container = document.querySelector('.container');
  // Prefill mobile if provided via query param (only on first call)
  if(!mobile){
    const params = new URLSearchParams(window.location.search);
    const qMobile = params.get('mobile');
    if(qMobile){
      const mobileInput = document.getElementById('mobile');
      if(mobileInput){ mobileInput.value = qMobile; }
    }
  }

  if(!firstName || !lastName || !mobile || !email || !gender || !password || !confirmPassword){
    showInlineMessage(container,'Please fill out all fields','error');
    return;
  }
  if(password !== confirmPassword){
    showInlineMessage(container,'Passwords do not match','error');
    return;
  }
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
    showInlineMessage(container,'Invalid email format','error');
    return;
  }
  if(mobile.length < 10){
    showInlineMessage(container,'Invalid mobile number','error');
    return;
  }
  const full_name = `${firstName} ${lastName}`.trim();

  try{
    const payload = { full_name, mobile, email, password, status: 'active' };
    console.log('Signup payload:', payload);
    const res = await fetch(PASSENGERS_API,{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch(parseErr){
      console.warn('Non-JSON response:', text);
      showInlineMessage(container,'Unexpected server response','error');
      return;
    }
    console.log('Signup response status:', res.status, 'data:', data);
    if(!res.ok){
      if(data && data.missing){
        showInlineMessage(container, 'Missing: ' + data.missing.join(', '), 'error');
      } else {
        showInlineMessage(container, (data && data.error) || 'Signup failed', 'error');
      }
      return;
    }
    if(!data.id){
      showInlineMessage(container,'Signup success but no ID returned','ok');
    } else {
      showInlineMessage(container,'Account created (ID '+data.id+'). Redirecting...','ok');
    }
    setTimeout(()=>{ window.location.href = 'index.html'; }, 1200);
  }catch(err){
    console.error('Signup network error:', err);
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
