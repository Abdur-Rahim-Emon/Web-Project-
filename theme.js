// Global theme handler shared across all pages
(function(){
  const THEMES = [
    {
      bg: '#f5fff7',
      panel: '#ffffff',
      primary: '#0fa958',
      primaryStrong: '#0b8b48',
      accent: '#f4c542',
      text: '#0f172a',
      muted: '#4b5563',
      border: '#e4efe7',
      gradient: 'radial-gradient(circle at 15% 20%, rgba(15,169,88,0.16), transparent 36%), radial-gradient(circle at 80% 8%, rgba(244,197,66,0.18), transparent 32%), linear-gradient(180deg, #fafffb 0%, #f3fff6 100%)',
      inputBg: '#f8fafc'
    },
    {
      bg: '#f1fbff',
      panel: '#ffffff',
      primary: '#0ea5e9',
      primaryStrong: '#0284c7',
      accent: '#fbbf24',
      text: '#0f172a',
      muted: '#475569',
      border: '#e2e8f0',
      gradient: 'radial-gradient(circle at 18% 18%, rgba(14,165,233,0.16), transparent 35%), radial-gradient(circle at 82% 6%, rgba(251,191,36,0.18), transparent 32%), linear-gradient(180deg, #f8fdff 0%, #f1fbff 100%)',
      inputBg: '#f8fafc'
    },
    {
      bg: '#f2fff8',
      panel: '#ffffff',
      primary: '#12b981',
      primaryStrong: '#0f9a6b',
      accent: '#34d399',
      text: '#0b2e1d',
      muted: '#3f3f46',
      border: '#d9f3e5',
      gradient: 'radial-gradient(circle at 18% 18%, rgba(18,185,129,0.15), transparent 35%), radial-gradient(circle at 80% 0%, rgba(52,211,153,0.18), transparent 34%), linear-gradient(180deg, #f9fffb 0%, #f2fff8 100%)',
      inputBg: '#f8fafc'
    },
    {
      bg: '#0b1220',
      panel: '#0f172a',
      primary: '#22c55e',
      primaryStrong: '#16a34a',
      accent: '#f4c542',
      text: '#e5e7eb',
      muted: '#94a3b8',
      border: '#1f2937',
      gradient: 'radial-gradient(circle at 18% 18%, rgba(34,197,94,0.12), transparent 35%), radial-gradient(circle at 82% 6%, rgba(244,197,66,0.12), transparent 32%), linear-gradient(180deg, #0b1220 0%, #0f172a 100%)',
      inputBg: '#111827'
    }
  ];

  function applyTheme(theme){
    const root = document.documentElement;
    root.style.setProperty('--bg', theme.bg);
    root.style.setProperty('--panel', theme.panel);
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--primary-strong', theme.primaryStrong);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--text', theme.text);
    root.style.setProperty('--muted', theme.muted);
    root.style.setProperty('--border', theme.border);
    root.style.setProperty('--gradient', theme.gradient);
    root.style.setProperty('--input-bg', theme.inputBg || '#f8fafc');
  }

  function loadSavedThemeIndex(){
    const saved = localStorage.getItem('themeIndex');
    if(saved !== null){
      const idx = parseInt(saved, 10);
      if(!isNaN(idx) && idx >=0 && idx < THEMES.length){
        return idx;
      }
    }
    return 0;
  }

  let currentIndex = loadSavedThemeIndex();

  function setTheme(index){
    currentIndex = (index + THEMES.length) % THEMES.length;
    applyTheme(THEMES[currentIndex]);
    localStorage.setItem('themeIndex', String(currentIndex));
    return currentIndex;
  }

  function cycleTheme(){
    return setTheme(currentIndex + 1);
  }

  function initTheme(){
    setTheme(currentIndex);
  }

  // Expose globals for page scripts
  window.THEMES = THEMES;
  window.applyThemeByIndex = setTheme;
  window.cycleTheme = cycleTheme;
  window.initTheme = initTheme;

  document.addEventListener('DOMContentLoaded', initTheme);
})();
