(function(){
  function ensureFooterStyles(){
    if(document.getElementById('shared-footer-style')) return;
    const style = document.createElement('style');
    style.id = 'shared-footer-style';
    style.textContent = `
      .site-footer{margin-top:24px;background:#0f172a;color:#e2e8f0}
      .site-footer .footer-inner{max-width:1000px;margin:0 auto;padding:14px 16px;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}
      .footer-brand{font-weight:700;letter-spacing:.2px}
      .footer-meta{opacity:.85}
      .footer-author{font-weight:600}
    `;
    document.head.appendChild(style);
  }

  function createFooter(){
    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML = `
      <div class="footer-inner">
        <div class="footer-brand">Bus Transport Automation</div>
        <div class="footer-meta">© <span class="footer-year"></span> All rights reserved</div>
        <div class="footer-author">Author: PSTU Student</div>
      </div>
    `;
    return footer;
  }

  function setYear(root){
    const y = new Date().getFullYear();
    const spanById = root.querySelector('#footerYear');
    if(spanById) spanById.textContent = y;
    const spans = root.querySelectorAll('.footer-year');
    spans.forEach(s=> s.textContent = y);
  }

  function init(){
    ensureFooterStyles();

    // If a standard footer already exists, just ensure year
    const existing = document.querySelector('footer.site-footer');
    if(existing){ setYear(existing); return; }

    // Remove simple placeholder footers if present
    const basic = document.querySelector('footer.footer, body > footer:not(.site-footer)');
    if(basic){ basic.remove(); }

    // Inject our shared footer at the end of body
    const f = createFooter();
    document.body.appendChild(f);
    setYear(f);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();