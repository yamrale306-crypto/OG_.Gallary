/* ============================================================
   OG Gallery — the rail.
   A scroll-driven 3D showcase of the real product photos.
   Each piece is a textured plane; scrolling dollies the camera
   down the rail, dragging turns the focused piece.

   Exposes window.OG3D. Degrades to nothing if WebGL is missing
   (app.js draws an HTML rail instead).
   ============================================================ */
import * as THREE from 'three';

const FOV = 38;
const CARD_ASPECT = 3 / 4;

const state = {
  ready: false,
  mount: null,
  cards: [],
  group: null,
  shadow: null,
  renderer: null,
  scene: null,
  camera: null,
  target: 0,      // target focus index (fractional)
  current: 0,     // eased focus index
  drag: 0,        // drag rotation on the focused card, radians
  dragTarget: 0,
  velocity: 0,    // rotation speed at release, radians/ms
  lastFocus: -1,
  layout: null,
  running: false,
  visible: true,
  raf: null
};

/* ---------- helpers ---------- */
function layoutFor(w, h) {
  const wide = w / h >= 1.25;
  if (wide) {
    return { cardH: 4.4, cardW: 4.4 * CARD_ASPECT, pitch: 3.95, camZ: 8.4, groupX: 1.25, groupY: 0.2 };
  }
  return { cardH: 3.7, cardW: 3.7 * CARD_ASPECT, pitch: 3.1, camZ: 7.7, groupX: 0, groupY: 0.62 };
}

/** Crop the texture so it covers the card without stretching. */
function coverUV(texture, cardAspect) {
  const img = texture.image;
  if (!img || !img.width || !img.height) return;
  const imgAspect = img.width / img.height;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  if (imgAspect > cardAspect) {
    const sx = cardAspect / imgAspect;
    texture.repeat.set(sx, 1);
    texture.offset.set((1 - sx) / 2, 0);
  } else {
    const sy = imgAspect / cardAspect;
    texture.repeat.set(1, sy);
    texture.offset.set(0, (1 - sy) / 2);
  }
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,.42)');
  g.addColorStop(.55, 'rgba(0,0,0,.16)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- mount ---------- */
function mount(canvas, products, opts = {}) {
  const onFocus = opts.onFocus || (() => {});
  const reduced = !!opts.reduced;
  const compact = window.matchMedia('(max-width: 720px)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !compact, powerPreference: 'high-performance' });
  } catch (err) {
    return null;
  }
  if (!renderer || !renderer.getContext()) return null;

  // A capped drawing buffer keeps the full-screen rail crisp without asking
  // mobile GPUs to shade millions of unnecessary pixels every frame.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.25 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  const group = new THREE.Group();
  scene.add(group);

  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const cards = products.map((product, i) => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xd8d2c6, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.userData = { product, index: i };
    group.add(mesh);

    loader.load(
      product.image,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(4, maxAniso || 1);
        coverUV(tex, CARD_ASPECT);
        mat.map = tex;
        mat.color.set(0xffffff);
        mat.needsUpdate = true;
        // give the cover-crop a moment to apply before showing
        mesh.userData.tex = tex;
        renderOnce();
      },
      undefined,
      () => { /* keep the placeholder tint if a photo will not load */ }
    );
    return mesh;
  });

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, opacity: .85, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  group.add(shadow);

  state.renderer = renderer;
  state.scene = scene;
  state.camera = camera;
  state.group = group;
  state.cards = cards;
  state.shadow = shadow;
  state.onFocus = onFocus;
  state.onTap = opts.onTap || null;
  state.reduced = reduced;
  state.current = state.target = 0;
  state.lastFocus = -1;
  state.ready = true;
  state.mount = { canvas, products };

  applyLayout();
  window.addEventListener('resize', applyLayout);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: true });

  state.visible = true;
  startLoop();

  state.fitTheme = fitTheme;
  fitTheme();
  return state;
}

function applyLayout() {
  const canvas = state.mount && state.mount.canvas;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  const l = layoutFor(w, h);
  state.layout = l;

  state.renderer.setSize(w, h, false);
  state.camera.aspect = w / h;
  state.camera.position.set(0, 0, l.camZ);
  state.camera.lookAt(0, 0, 0);
  state.camera.updateProjectionMatrix();

  state.group.position.set(l.groupX, l.groupY, 0);

  state.cards.forEach((mesh) => mesh.geometry.dispose());
  state.cards.forEach((mesh) => mesh.geometry = new THREE.PlaneGeometry(l.cardW, l.cardH));
  state.shadow.geometry.dispose();
  state.shadow.geometry = new THREE.PlaneGeometry(l.cardW * 1.25, l.cardW * .62);

  layoutCards();
  renderOnce();
}

function fitTheme() {
  if (!state.shadow || !state.shadow.material) return;
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  state.shadow.material.opacity = dark ? .95 : .8;
}

/* ---------- per-frame layout ---------- */
function layoutCards() {
  const l = state.layout;
  if (!l) return;
  const n = state.cards.length;
  const f = state.current;

  state.cards.forEach((mesh, i) => {
    const d = i - f;                     // distance from the focused piece, in pieces
    const abs = Math.abs(d);
    const isFocus = Math.round(f) === i;
    const scale = isFocus ? 1 : Math.max(.84, 1 - abs * .07);
    const rot = THREE.MathUtils.clamp(-d * .34, -0.62, 0.62) + (isFocus ? state.drag : 0);

    mesh.position.set(d * l.pitch, -abs * .16, -abs * .5);
    mesh.rotation.set(0, rot, 0);
    mesh.scale.set(scale, scale, 1);
    mesh.material.opacity = abs > 3.7 ? 0 : Math.max(.25, 1 - abs * .17);
    mesh.visible = abs < 4.2;
    mesh.renderOrder = 10 - abs;
    mesh.material.depthWrite = abs < .5;
  });

  const active = state.cards[Math.round(f)];
  if (active) {
    state.shadow.position.set(active.position.x, active.position.y - l.cardH / 2 - .14, active.position.z);
    state.shadow.scale.setScalar(THREE.MathUtils.clamp(1 - Math.abs(f - Math.round(f)), .55, 1));
  }
}

function renderOnce() {
  if (!state.ready || !state.visible) return;
  layoutCards();
  state.renderer.render(state.scene, state.camera);
}

/* ---------- loop ---------- */
function startLoop() {
  if (state.running) return;
  state.running = true;
  const tick = () => {
    state.raf = null;
    if (!state.ready) return;
    const ease = state.reduced ? 1 : 0.14;
    state.current += (state.target - state.current) * ease;
    if (Math.abs(state.target - state.current) < 0.0004) state.current = state.target;
    state.drag += (state.dragTarget - state.drag) * (state.reduced ? 1 : 0.12);

    if (state.visible) {
      layoutCards();
      state.renderer.render(state.scene, state.camera);
    }

    const focus = Math.round(state.current);
    if (focus !== state.lastFocus) {
      state.lastFocus = focus;
      if (state.onFocus) state.onFocus(focus, state.cards[focus] && state.cards[focus].userData.product);
    }
    const moving = Math.abs(state.target - state.current) >= 0.0004 || Math.abs(state.dragTarget - state.drag) >= 0.001;
    if (moving && state.visible) state.raf = requestAnimationFrame(tick);
    else state.running = false;
  };
  state.raf = requestAnimationFrame(tick);
}

function stopLoop() {
  state.running = false;
  if (state.raf) cancelAnimationFrame(state.raf);
  state.raf = null;
}

/* ---------- input ---------- */
const TURN_LIMIT = 0.7;

function onPointerDown(e) {
  if (!state.ready) return;
  state.dragging = true;
  state.dragged = 0;
  state.velocity = 0;
  state.downAt = e.timeStamp;
  state.downX = e.clientX;
  state.dragStartX = e.clientX;
  state.dragBase = state.dragTarget;
  state.lastMoveAt = e.timeStamp;
  state.mount.canvas.classList.add('is-dragging');
  state.mount.canvas.setPointerCapture && state.mount.canvas.setPointerCapture(e.pointerId);
}

function onPointerMove(e) {
  if (!state.dragging) return;
  const dx = e.clientX - state.dragStartX;
  const next = THREE.MathUtils.clamp(state.dragBase + dx * 0.004, -TURN_LIMIT, TURN_LIMIT);
  const dt = Math.max(1, e.timeStamp - state.lastMoveAt);
  state.velocity = (next - state.dragTarget) / dt;
  state.dragTarget = next;
  state.dragged = Math.max(state.dragged, Math.abs(e.clientX - state.downX));
  state.lastMoveAt = e.timeStamp;
  startLoop();
}

function onPointerUp(e) {
  if (!state.dragging) return;
  state.dragging = false;
  state.mount.canvas.classList.remove('is-dragging');
  // A short, still press opens the piece; anything longer or moved is a drag.
  if (e && e.type === 'pointerup' && state.dragged < 6 && e.timeStamp - state.downAt < 400) {
    const card = state.cards[Math.round(state.current)];
    if (card && state.onTap) state.onTap(card.userData.product);
    return;
  }
  // Carry the release speed into the turn so it flings past before settling back.
  state.drag = THREE.MathUtils.clamp(state.drag + (state.velocity || 0) * 70, -0.95, 0.95);
  state.dragTarget = 0;
  startLoop();
}

function onWheel(e) {
  if (!state.ready || state.dragging) return;
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;   // vertical scroll still moves the rail
  state.dragTarget = THREE.MathUtils.clamp(state.dragTarget + e.deltaX * 0.002, -TURN_LIMIT, TURN_LIMIT);
  startLoop();
  clearTimeout(state.wheelReset);
  state.wheelReset = setTimeout(() => { if (!state.dragging) { state.dragTarget = 0; startLoop(); } }, 400);
}

/* ---------- public ---------- */
function setProgress(p) {
  if (!state.ready) return;
  const n = state.cards.length;
  if (!n) return;
  const clamped = Math.min(1, Math.max(0, p));
  const next = clamped * (n - 1);
  if (Math.abs(next - state.target) > 0.0001) {
    state.target = next;
    startLoop();
  }
}

function setVisible(v) {
  state.visible = !!v;
  if (state.visible) { renderOnce(); startLoop(); }
  else stopLoop();
}

function setTarget(idx) {
  if (!state.ready) return;
  const n = state.cards.length;
  if (!n) return;
  state.target = THREE.MathUtils.clamp(idx, 0, n - 1);
  startLoop();
}

function rotateCard(delta) {
  if (!state.ready) return;
  state.dragTarget = THREE.MathUtils.clamp((state.dragTarget || 0) + delta, -0.85, 0.85);
  startLoop();
  setTimeout(() => {
    if (!state.dragging) state.dragTarget = 0;
  }, 1200);
}

function dispose() {
  stopLoop();
  window.removeEventListener('resize', applyLayout);
  const canvas = state.mount && state.mount.canvas;
  if (canvas) {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.removeEventListener('pointerleave', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
  }
  clearTimeout(state.wheelReset);
  state.cards.forEach((m) => {
    m.geometry.dispose();
    if (m.userData.tex) m.userData.tex.dispose();
    m.material.dispose();
  });
  if (state.shadow) { state.shadow.geometry.dispose(); state.shadow.material.map.dispose(); state.shadow.material.dispose(); }
  if (state.renderer) state.renderer.dispose();
  state.ready = false;
  state.cards = [];
}

window.OG3D = { mount, setProgress, setVisible, dispose, setTheme: fitTheme, setTarget, rotateCard, state, isAvailable: () => true };
window.dispatchEvent(new CustomEvent('og3d:ready'));
