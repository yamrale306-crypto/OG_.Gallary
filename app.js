// Root app.js - compatibility wrapper
// All core logic is housed in public/js/app.js, public/js/api.js, and public/js/three-scene.js
if (typeof window !== 'undefined') {
  // If loaded directly from root in script tag
  const s = document.createElement('script');
  s.src = 'public/js/app.js';
  document.head.appendChild(s);
}
