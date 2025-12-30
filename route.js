document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('countersBody');
  const districtFilter = document.getElementById('districtFilter');
  const searchBox = document.getElementById('searchBox');

  let counters = [];

  async function loadCounters() {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center">Loading...</td></tr>';
    try {
      const params = new URLSearchParams();
      if (districtFilter.value) params.set('district', districtFilter.value);
      const res = await fetch(`backend/api/counters.php?${params.toString()}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      counters = await res.json();
      render();
      populateDistricts();
    } catch (e) {
      console.error(e);
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#b00020">Failed to load counters. Ensure PHP server and DB schema are updated.</td></tr>';
    }
  }

  function populateDistricts() {
    const prev = districtFilter.value;
    const districts = Array.from(new Set(counters.map(c => (c.district || '').trim()).filter(Boolean))).sort();
    districtFilter.innerHTML = '<option value="">All</option>' + districts.map(d => `<option value="${d}">${d}</option>`).join('');
    districtFilter.value = prev || '';
  }

  function render() {
    const q = (searchBox.value || '').toLowerCase().trim();
    const dist = districtFilter.value || '';
    let filtered = counters;
    if (dist) filtered = filtered.filter(c => (c.district || '') === dist);
    if (q) {
      filtered = filtered.filter(c =>
        (c.counter_name || '').toLowerCase().includes(q) ||
        (c.location_address || '').toLowerCase().includes(q)
      );
    }

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center">No counters found.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    filtered.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(c.counter_name)}</td>
        <td>${escapeHtml(c.location_address)}</td>
        <td>${escapeHtml(c.district)}</td>
        <td><a href="tel:${escapeAttr(c.contact_number)}">${escapeHtml(c.contact_number)}</a></td>
        <td>${c.alternate_contact ? `<a href=\"tel:${escapeAttr(c.alternate_contact)}\">${escapeHtml(c.alternate_contact)}</a>` : '—'}</td>
        <td>${c.email ? `<a href=\"mailto:${escapeAttr(c.email)}\">${escapeHtml(c.email)}</a>` : '—'}</td>
        <td>${formatTime(c.opening_time)}</td>
        <td>${formatTime(c.closing_time)}</td>
        <td>${c.status || 'active'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function formatTime(t) {
    if (!t) return '—';
    // If PHP returns HH:MM:SS, keep HH:MM
    const parts = String(t).split(':');
    if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
    return t;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(s) {
    return String(s == null ? '' : s).replace(/"/g, '');
  }

  districtFilter.addEventListener('change', render);
  searchBox.addEventListener('input', render);

  loadCounters();
});
