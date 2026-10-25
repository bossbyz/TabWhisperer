// Colour is user-selected; brightness always follows the system preference.
(() => {
  const { normalize, build, defaultColor } = BookmarkPalette;
  const preference = matchMedia('(prefers-color-scheme: dark)');
  let color = defaultColor;
  let storedColor = defaultColor;
  let revision = 0;
  function apply(value) {
    color = normalize(value);
    const root = document.documentElement;
    root.setAttribute('data-scheme', preference.matches ? 'dark' : 'light');
    root.style.setProperty('color-scheme', preference.matches ? 'dark' : 'light');
    for (const [key, value] of Object.entries(build(color, preference.matches))) root.style.setProperty(`--${key}`, value);
    for (const pickerId of ['primary-color', 'header-primary-color']) {
      const picker = document.getElementById(pickerId);
      if (picker) picker.value = color;
    }
    try { localStorage.setItem('primaryColor', color); } catch { /* Use the default if storage is unavailable. */ }
  }
  try { color = normalize(localStorage.getItem('primaryColor')); } catch { /* Use the default colour. */ }
  storedColor = color;
  apply(color);
  preference.addEventListener('change', () => apply(color));
  chrome.storage.local.get('primaryColor').then(saved => {
    if (!revision) { storedColor = normalize(saved.primaryColor); apply(storedColor); }
  }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.primaryColor) {
      revision++;
      storedColor = normalize(changes.primaryColor.newValue);
      apply(storedColor);
    }
  });
  function wire() {
    const pickers = ['primary-color', 'header-primary-color']
      .map(id => document.getElementById(id)).filter(Boolean);
    if (!pickers.length) return;
    apply(color);
    for (const picker of pickers) picker.addEventListener('input', () => { revision++; apply(picker.value); });
    async function save(value) {
      const request = ++revision;
      const status = document.getElementById('theme-status');
      status.textContent = '';
      apply(value);
      const chosen = color;
      try {
        await chrome.storage.local.set({ primaryColor: chosen });
        if (request === revision) storedColor = chosen;
      }
      catch {
        if (request === revision) {
          apply(storedColor);
          status.textContent = 'Could not save your colour. Please try again.';
        }
      }
    }
    for (const picker of pickers) picker.addEventListener('change', () => save(picker.value));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire, { once: true });
  else wire();
})();
