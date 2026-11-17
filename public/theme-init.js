// Applies a remembered theme before first paint (kept outside the bundle on purpose).
try {
  var t = window.localStorage.getItem('habit-grid:theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch (e) {
  /* storage unavailable */
}
