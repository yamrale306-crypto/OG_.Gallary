/* ============================================================
   OG Gallery — storefront
   ============================================================ */
(function () {
  'use strict';

  /* ---------- constants ---------- */
  const FREE_SHIP = 2500;
  const SHIP_FEE = 150;
  const RAIL_PER_CATEGORY = 4;      // pieces pulled from each category onto the 3D rail
  const LS = { cart: 'og_cart', saved: 'og_saved', promo: 'og_promo', theme: 'og_theme' };
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- tiny helpers ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const money = (n) => '\u20B9' + Number(n || 0).toLocaleString('en-IN');
  const catLabel = (c) => (c === 'Jeans' ? 'Denim' : c === 'Slides_Slippers' ? 'Slides' : c);
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const stars = (r) => '\u2605'.repeat(Math.round(r)) + '\u2606'.repeat(Math.max(0, 5 - Math.round(r)));
  const docTop = (el) => el.getBoundingClientRect().top + window.scrollY;
  const hashEl = () => (/^#[a-zA-Z][\w-]*$/.test(location.hash) ? document.querySelector(location.hash) : null);

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* storage full or blocked — the session still works */ }
  }

  /* ---------- state ---------- */
  const store = {
    products: [],
    rail: [],
    category: 'all',
    search: '',
    sort: 'featured',
    cart: load(LS.cart, []),
    saved: load(LS.saved, []),
    promo: load(LS.promo, null),
    railFocus: 0,
    pdpProduct: null
  };

  const byId = (id) => store.products.find((p) => p.id === id) || null;
  const lineKey = (id, size) => id + '::' + size;

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(msg, kind) {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast is-on' + (kind ? ' is-' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
  }

  /* ---------- theme ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = $('#themeToggle');
    const dark = theme === 'dark';
    btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#100f0e' : '#f3efe6');
    if (window.OG3D && window.OG3D.setTheme) window.OG3D.setTheme();
  }
  function initTheme() {
    const saved = load(LS.theme, null);
    const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (prefersDark ? 'dark' : 'light'));
  }

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  function initScroll() {
    if (REDUCED || typeof window.Lenis !== 'function') return;
    lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true, touchMultiplier: 1.4 });
    const raf = (t) => {
      lenis.raf(t);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
    lenis.on('scroll', onScroll);
  }
  function scrollTo(target, immediate) {
    if (typeof target === 'string' && !/^#[a-zA-Z][\w-]*$/.test(target)) return;
    if (lenis) {
      // The view can change height on the same tick (leaving a product page);
      // refresh the limit or Lenis clamps the scroll to the old short page.
      lenis.resize();
      lenis.scrollTo(target, { immediate: !!immediate, offset: typeof target === 'string' ? -62 : 0 });
    } else if (typeof target === 'string') {
      const el = document.querySelector(target);
      if (el) el.scrollIntoView({ behavior: immediate ? 'auto' : 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: target, behavior: immediate ? 'auto' : 'smooth' });
    }
  }

  /* ---------- grid ---------- */
  function cardMarkup(p) {
    const off = p.originalPrice && p.originalPrice > p.price ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100) : 0;
    const sizes = Array.isArray(p.sizes) ? p.sizes : [];
    const out = !p.stock || p.stock <= 0;
    const quick =
      sizes.length > 1
        ? `<div class="card-quick">${sizes
            .map((s) => `<button class="size" data-add="${esc(p.id)}" data-size="${esc(s)}">${esc(s)}</button>`)
            .join('')}</div>`
        : `<div class="card-quick"><button class="one" data-add="${esc(p.id)}" data-size="${esc(sizes[0] || 'Standard')}">Add to bag</button></div>`;

    return `<article class="card" data-id="${esc(p.id)}">
      <a class="card-media" href="#/product/${encodeURIComponent(p.id)}" aria-label="View ${esc(p.name)}">
        <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async" />
        ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}
        ${out ? '<span class="badge badge-out">Sold out</span>' : ''}
      </a>
      <button class="card-save${store.saved.includes(p.id) ? ' is-on' : ''}" data-save="${esc(p.id)}" aria-label="${store.saved.includes(p.id) ? 'Remove from saved' : 'Save this piece'}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20Z"/></svg>
      </button>
      ${out ? '' : quick}
      <div class="card-body">
        <p class="card-cat">${esc(catLabel(p.category))}</p>
        <h3 class="card-name"><a href="#/product/${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3>
        <p class="card-price"><span>${money(p.price)}</span>${p.originalPrice ? `<s>${money(p.originalPrice)}</s>` : ''}${off ? `<span class="muted" style="font-size:.72rem;font-weight:500">${off}% off</span>` : ''}</p>
        ${p.rating ? `<p class="card-rating"><span class="star">\u2605</span> ${Number(p.rating).toFixed(1)}${p.reviewCount ? ` \u00B7 ${p.reviewCount}` : ''}</p>` : ''}
      </div>
    </article>`;
  }

  function skeletons(n) {
    return Array.from({ length: n })
      .map(() => '<div class="card card-skeleton"><div class="sk-media"></div><div class="sk-line"></div><div class="sk-line short"></div></div>')
      .join('');
  }

  function visibleProducts() {
    let list = store.products.slice();
    if (store.category !== 'all') list = list.filter((p) => p.category === store.category);
    if (store.search) {
      const q = store.search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q) ||
          (p.material || '').toLowerCase().includes(q)
      );
    }
    if (store.sort === 'low') list.sort((a, b) => a.price - b.price);
    else if (store.sort === 'high') list.sort((a, b) => b.price - a.price);
    else if (store.sort === 'rating') list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (store.sort === 'new') list.sort((a, b) => (b.badge === 'New' ? 1 : 0) - (a.badge === 'New' ? 1 : 0));
    return list;
  }

  function renderGrid() {
    const list = visibleProducts();
    const grid = $('#productGrid');
    grid.innerHTML = list.map(cardMarkup).join('');
    $('#resultCount').textContent = list.length;
    $('#emptyState').hidden = list.length > 0;
    grid.hidden = list.length === 0;

    const titles = { all: 'Everything in store', Shirts: 'Shirts', Jeans: 'Denim', 'Slides_Slippers': 'Slides' };
    $('#shopTitle').textContent = store.search ? `Results for \u201C${store.search}\u201D` : titles[store.category] || 'Everything in store';
    syncChips();
  }

  function syncChips() {
    $$('#filterChips .chip').forEach((c) => {
      const on = c.dataset.category === store.category;
      c.classList.toggle('is-on', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const sel = $('#sortSelect');
    if (sel.value !== store.sort) sel.value = store.sort;
    const field = $('#catalogSearch');
    if (field.value !== store.search) field.value = store.search;
  }

  async function loadProducts() {
    $('#productGrid').innerHTML = skeletons(8);
    const data = await window.API.getProducts();
    store.products = (data && data.products) || [];
    $('#factCount').textContent = store.products.length + ' pieces';
    buildRailList();
    renderGrid();
  }

  /* ---------- the rail ---------- */
  function buildRailList() {
    const out = [];
    ['Shirts', 'Jeans', 'Slides_Slippers'].forEach((cat) => {
      const pool = store.products
        .filter((p) => p.category === cat && p.stock > 0)
        .sort((a, b) => (b.badge ? 1 : 0) - (a.badge ? 1 : 0) || (b.rating || 0) - (a.rating || 0));
      out.push(...pool.slice(0, RAIL_PER_CATEGORY));
    });
    store.rail = out;
    $('#railTotal').textContent = String(out.length).padStart(2, '0');
    document.documentElement.style.setProperty('--rail-steps', out.length);
  }

  function renderRailDots() {
    $('#railDots').innerHTML = store.rail
      .map((p, i) => `<button class="rail-dot${i === 0 ? ' is-on' : ''}" role="tab" data-rail="${i}" aria-label="${esc(p.name)}"></button>`)
      .join('');
  }

  function updateRailMeta(index, product) {
    const p = product || store.rail[index];
    if (!p) return;
    store.railFocus = index;
    $('#railCounter').textContent = String(index + 1).padStart(2, '0');
    $('#railCat').textContent = catLabel(p.category);
    $('#railName').textContent = p.name;
    $('#railPrice').textContent = p.originalPrice ? `${money(p.price)}  ·  was ${money(p.originalPrice)}` : money(p.price);
    $$('#railDots .rail-dot').forEach((d, i) => d.classList.toggle('is-on', i === index));
    $('#railHint').classList.add('is-off');
  }

  function renderRailFallback() {
    const wrap = $('#railFallback');
    wrap.hidden = false;
    wrap.innerHTML = `<div class="rail-fallback-inner">${store.rail
      .map((p) => `<a href="#/product/${encodeURIComponent(p.id)}" aria-label="${esc(p.name)}"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" /></a>`)
      .join('')}</div>`;
    $('#railHint').hidden = true;
    updateRailMeta(0, store.rail[0]);
  }

  function hasWebGL() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  function when3D(timeout) {
    return new Promise((resolve) => {
      if (window.OG3D) return resolve(window.OG3D);
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        resolve(v);
      };
      window.addEventListener('og3d:ready', () => finish(window.OG3D), { once: true });
      setTimeout(() => finish(window.OG3D || null), timeout || 2000);
    });
  }

  function setupRail() {
    renderRailDots();
    if (!store.rail.length) return;
    if (REDUCED || !hasWebGL()) return renderRailFallback();

    when3D().then((OG3D) => {
      if (!OG3D) return renderRailFallback();
      let inst = null;
      try {
        inst = OG3D.mount($('#railCanvas'), store.rail, { onFocus: updateRailMeta, reduced: REDUCED });
      } catch (e) {
        inst = null;
      }
      if (!inst) return renderRailFallback();

      const rail = $('#rail');
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((entries) => OG3D.setVisible(entries[0].isIntersecting), { rootMargin: '120px' }).observe(rail);
      }
      installRailProgress(OG3D);
      updateRailMeta(0, store.rail[0]);
    });
  }

  function railProgress() {
    const track = $('#railTrack');
    const total = track.offsetHeight - window.innerHeight;
    if (total <= 0) return 0;
    const top = track.getBoundingClientRect().top;
    return clamp(-top / total, 0, 1);
  }

  function installRailProgress(OG3D) {
    store.railScene = OG3D;
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // dots jump to a piece
    $('#railDots').addEventListener('click', (e) => {
      const dot = e.target.closest('[data-rail]');
      if (!dot) return;
      const i = Number(dot.dataset.rail);
      const n = Math.max(1, store.rail.length - 1);
      const track = $('#railTrack');
      const total = track.offsetHeight - window.innerHeight;
      scrollTo(docTop(track) + (i / n) * total);
    });
  }

  function onScroll() {
    if (store.railScene) store.railScene.setProgress(railProgress());
    const y = window.scrollY;
    // Lenis and the window listener both fire each frame with the same
    // position; without this guard the header is un-hidden right away.
    if (y === onScroll._last) return;
    const head = $('#siteHeader');
    if (head) head.classList.toggle('is-hidden', y > 320 && y > (onScroll._last || 0));
    const tabTop = $('.tab[data-tab="top"]');
    if (tabTop) tabTop.classList.toggle('is-on', y < 200);
    onScroll._last = y;
  }

  /* ---------- cart ---------- */
  function cartLines() {
    return store.cart
      .map((line) => ({ ...line, product: byId(line.id) }))
      .filter((l) => l.product);
  }

  function totals() {
    const lines = cartLines();
    const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
    let discount = 0;
    let freeShip = subtotal >= FREE_SHIP;
    const promo = store.promo;
    if (promo && subtotal > 0) {
      if (promo.type === 'percentage') discount = Math.round((subtotal * promo.value) / 100);
      else if (promo.type === 'fixed') discount = Math.min(subtotal, promo.value);
      else if (promo.type === 'free_shipping') freeShip = true;
    }
    const shipping = subtotal === 0 ? 0 : freeShip ? 0 : SHIP_FEE;
    return { subtotal, discount, shipping, freeShip, total: Math.max(0, subtotal - discount + shipping), count: lines.reduce((n, l) => n + l.qty, 0) };
  }

  function persistCart() {
    save(LS.cart, store.cart);
  }

  function addToCart(id, size, qty) {
    const p = byId(id);
    if (!p) return;
    if (!p.stock || p.stock <= 0) return toast('That piece is sold out.', 'bad');
    const variant = size || (Array.isArray(p.sizes) && p.sizes[0]) || 'Standard';
    const key = lineKey(id, variant);
    const existing = store.cart.find((l) => lineKey(l.id, l.size) === key);
    const cap = Math.min(20, p.stock);
    if (existing) existing.qty = Math.max(1, Math.min(cap, existing.qty + (qty || 1)));
    else store.cart.push({ id, size: variant, qty: Math.max(1, Math.min(cap, qty || 1)) });
    persistCart();
    updateCartUI();
    cartBump();
    toast(`${p.name} added to your bag`, 'good');
  }

  function setQty(id, size, qty) {
    const key = lineKey(id, size);
    const line = store.cart.find((l) => lineKey(l.id, l.size) === key);
    if (!line) return;
    if (qty <= 0) store.cart = store.cart.filter((l) => lineKey(l.id, l.size) !== key);
    else {
      const p = byId(id);
      line.qty = Math.max(1, Math.min(20, p && p.stock > 0 ? p.stock : 20, qty));
    }
    persistCart();
    updateCartUI();
  }

  function removeLine(id, size) {
    store.cart = store.cart.filter((l) => lineKey(l.id, l.size) !== lineKey(id, size));
    persistCart();
    updateCartUI();
  }

  function cartBump() {
    const btn = $('#cartToggle');
    if (!btn || REDUCED) return;
    btn.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.16)' }, { transform: 'scale(1)' }], { duration: 340, easing: 'cubic-bezier(.16,1,.3,1)' });
  }

  function updateCartUI() {
    const t = totals();
    $('#cartCount').textContent = t.count;
    $('#cartCount').hidden = t.count === 0;
    $('#tabCartCount').textContent = t.count;
    $('#tabCartCount').hidden = t.count === 0;

    const lines = cartLines();
    $('#cartEmpty').hidden = lines.length > 0;
    $('#cartItems').innerHTML = lines
      .map(
        (l) => `<div class="line-item">
          <img src="${esc(l.product.image)}" alt="${esc(l.product.name)}" />
          <div>
            <h4>${esc(l.product.name)}</h4>
            <p class="li-meta">${esc(catLabel(l.product.category))} · Size ${esc(l.size)}</p>
            <div class="step">
              <button data-step="-1" data-id="${esc(l.id)}" data-size="${esc(l.size)}" aria-label="Fewer">\u2212</button>
              <span>${l.qty}</span>
              <button data-step="1" data-id="${esc(l.id)}" data-size="${esc(l.size)}" aria-label="More">+</button>
            </div>
            <br /><button class="li-remove" data-remove="${esc(l.id)}" data-size="${esc(l.size)}">Remove</button>
          </div>
          <p class="li-price">${money(l.product.price * l.qty)}</p>
        </div>`
      )
      .join('');

    // shipping nudge
    const strip = $('#shipStrip');
    if (lines.length === 0) {
      $('#shipText').textContent = `Free shipping over ${money(FREE_SHIP)}`;
      $('#shipFill').style.width = '0%';
      strip.classList.remove('is-free');
    } else if (t.freeShip) {
      $('#shipText').textContent = 'Free shipping unlocked';
      $('#shipFill').style.width = '100%';
      strip.classList.add('is-free');
    } else {
      // The threshold is on the pre-discount subtotal, same as totals() and the server.
      const left = FREE_SHIP - t.subtotal;
      $('#shipText').textContent = `Add ${money(Math.max(0, left))} for free shipping`;
      $('#shipFill').style.width = clamp((t.subtotal / FREE_SHIP) * 100, 4, 100) + '%';
      strip.classList.remove('is-free');
    }

    $('#lineSubtotal').textContent = money(t.subtotal);
    $('#lineDiscountRow').hidden = t.discount <= 0;
    $('#lineDiscount').textContent = '\u2212' + money(t.discount);
    $('#lineShipping').textContent = t.subtotal === 0 ? '\u2014' : t.shipping === 0 ? 'Free' : money(t.shipping);
    $('#lineTotal').textContent = money(t.total);

    const tag = $('#promoApplied');
    if (store.promo) {
      tag.hidden = false;
      tag.innerHTML = `<span>${esc(store.promo.code)} \u2014 ${esc(store.promo.description || 'applied')}</span><button type="button" id="promoClear">Remove</button>`;
    } else {
      tag.hidden = true;
      tag.innerHTML = '';
    }

    $('#checkoutBtn').disabled = lines.length === 0;
    syncCheckoutSummary(t);
    syncGridSaves();
  }

  function syncGridSaves() {
    $$('.card-save').forEach((b) => {
      const on = store.saved.includes(b.dataset.save);
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-label', on ? 'Remove from saved' : 'Save this piece');
    });
  }

  /* ---------- wishlist ---------- */
  function toggleSave(id) {
    const i = store.saved.indexOf(id);
    if (i > -1) store.saved.splice(i, 1);
    else store.saved.push(id);
    save(LS.saved, store.saved);
    updateWishlistUI();
    syncGridSaves();
  }

  function updateWishlistUI() {
    const items = store.saved.map(byId).filter(Boolean);
    $('#wishlistCount').textContent = items.length;
    $('#wishlistCount').hidden = items.length === 0;
    $('#wishlistEmpty').hidden = items.length > 0;
    $('#wishlistAddAll').disabled = items.length === 0;
    $('#wishlistItems').innerHTML = items
      .map(
        (p) => `<div class="line-item">
          <a href="#/product/${encodeURIComponent(p.id)}" data-close-sheets><img src="${esc(p.image)}" alt="${esc(p.name)}" /></a>
          <div>
            <h4>${esc(p.name)}</h4>
            <p class="li-meta">${esc(catLabel(p.category))}</p>
            <p class="li-price">${money(p.price)}</p>
            <br /><button class="li-remove" data-unsave="${esc(p.id)}">Remove</button>
          </div>
          <button class="btn btn-outline btn-sm" data-save-add="${esc(p.id)}">Add</button>
        </div>`
      )
      .join('');
  }

  /* ---------- sheets ---------- */
  function openSheet(id, overlayId) {
    const sheet = $(id);
    const overlay = $(overlayId);
    sheet.hidden = false;
    overlay.hidden = false;
    document.body.classList.add('is-locked');
    if (lenis) lenis.stop();
    requestAnimationFrame(() => {
      sheet.classList.add('is-open');
      overlay.classList.add('is-open');
    });
  }
  function closeSheet(id, overlayId) {
    const sheet = $(id);
    const overlay = $(overlayId);
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove('is-open');
    overlay.classList.remove('is-open');
    const done = () => {
      sheet.hidden = true;
      overlay.hidden = true;
      if ($$('.sheet.is-open, .modal:not([hidden]), .search:not([hidden]), .lightbox:not([hidden])').length === 0) {
        document.body.classList.remove('is-locked');
        if (lenis) lenis.start();
      }
    };
    setTimeout(done, 420);
  }
  const openCart = () => openSheet('#cartDrawer', '#cartOverlay');
  const closeCart = () => closeSheet('#cartDrawer', '#cartOverlay');
  const openSaved = () => openSheet('#wishlistDrawer', '#wishlistOverlay');
  const closeSaved = () => closeSheet('#wishlistDrawer', '#wishlistOverlay');
  const openMenu = () => {
    $('#mobileMenu').hidden = false;
    $('#menuOverlay').hidden = false;
    $('#menuToggle').setAttribute('aria-expanded', 'true');
    if (lenis) lenis.stop();
    requestAnimationFrame(() => {
      $('#mobileMenu').classList.add('is-open');
      $('#menuOverlay').classList.add('is-open');
    });
  };
  const closeMenu = () => {
    $('#mobileMenu').classList.remove('is-open');
    $('#menuOverlay').classList.remove('is-open');
    $('#menuToggle').setAttribute('aria-expanded', 'false');
    if (lenis) lenis.start();
    setTimeout(() => {
      $('#mobileMenu').hidden = true;
      $('#menuOverlay').hidden = true;
    }, 420);
  };

  /* ---------- search ---------- */
  function openSearch() {
    $('#searchOverlay').hidden = false;
    if (lenis) lenis.stop();
    const input = $('#searchInput');
    input.value = '';
    renderSearchResults('');
    setTimeout(() => input.focus(), 40);
  }
  function closeSearch() {
    $('#searchOverlay').hidden = true;
    if (lenis) lenis.start();
  }
  function renderSearchResults(q) {
    const box = $('#searchResults');
    const hint = $('#searchHint');
    if (!q) {
      box.innerHTML = '';
      hint.hidden = false;
      hint.textContent = 'Start typing. Six results at a time.';
      return;
    }
    const query = q.toLowerCase();
    const hits = store.products
      .filter((p) => p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query) || (p.material || '').toLowerCase().includes(query))
      .slice(0, 6);
    hint.hidden = hits.length > 0;
    if (!hits.length) hint.textContent = 'Nothing under that name. Try “shirt” or “denim”.';
    box.innerHTML = hits
      .map(
        (p) => `<a class="search-hit" href="#/product/${encodeURIComponent(p.id)}" data-close-search>
          <img src="${esc(p.image)}" alt="" />
          <div><h4>${esc(p.name)}</h4><p>${esc(catLabel(p.category))} · ${money(p.price)}</p></div>
        </a>`
      )
      .join('');
  }

  /* ---------- product view ---------- */
  let pdpToken = 0;
  function showPdp(id) {
    const token = ++pdpToken;
    const view = $('#pdpView');
    $('#homeView').hidden = true;
    view.hidden = false;
    view.innerHTML = '<p class="muted" style="padding:4rem 0">Loading the piece…</p>';
    scrollTo(0, true);
    closeCart();
    closeSaved();
    closeSearch();

    window.API.getProductById(id).then((p) => {
      if (token !== pdpToken) return;
      if (!p) {
        view.innerHTML = `<div class="empty"><h3>We could not find that piece.</h3><p>It may have sold out or the link is old.</p><a class="btn btn-solid btn-sm" href="#shop">Back to the collection</a></div>`;
        return;
      }
      document.title = `${p.name} — OG Gallery`;
      store.pdpProduct = p;
      renderPdp(p);
    });
  }

  function hidePdp() {
    pdpToken++;
    const view = $('#pdpView');
    view.hidden = true;
    view.innerHTML = '';
    $('#homeView').hidden = false;
    store.pdpProduct = null;
    document.title = 'OG Gallery — Shirts, Denim & Slides. Baramati.';
  }

  function pdpMarkup(p) {
    const off = p.originalPrice && p.originalPrice > p.price ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100) : 0;
    const sizes = Array.isArray(p.sizes) && p.sizes.length ? p.sizes : ['Standard'];
    const out = !p.stock || p.stock <= 0;
    const reviews = Array.isArray(p.reviews) ? p.reviews : [];
    const related = Array.isArray(p.related) ? p.related : [];

    const relatedBlock = related.length
      ? `<section class="related">
          <div class="related-head"><h2>More ${esc(catLabel(p.category).toLowerCase())}</h2><a class="btn btn-quiet btn-sm" href="#shop" data-cat-jump="${esc(p.category)}">See all</a></div>
          <div class="grid">${related.map(cardMarkup).join('')}</div>
        </section>`
      : '';

    return `
    <nav class="crumbs">
      <a href="#shop">Shop</a><span class="sep">/</span>
      <a href="#shop" data-cat-jump="${esc(p.category)}">${esc(catLabel(p.category))}</a><span class="sep">/</span>
      <span>${esc(p.name)}</span>
    </nav>

    <div class="pdp-grid">
      <div class="pdp-media">
        <img id="pdpImage" src="${esc(p.image)}" alt="${esc(p.name)}" />
        <span class="pdp-zoom-hint">Click to enlarge</span>
      </div>

      <div class="pdp-copy">
        <p class="eyebrow">${esc(catLabel(p.category))}</p>
        <h1>${esc(p.name)}</h1>
        <p class="pdp-price">
          <span>${money(p.price)}</span>
          ${p.originalPrice ? `<s>${money(p.originalPrice)}</s>` : ''}
          ${off ? `<span class="off">${off}% off</span>` : ''}
        </p>
        <p class="pdp-desc">${esc(p.description || '')}</p>

        <p class="pdp-label">Size <button type="button" id="pdpSizeHelp">Size help</button></p>
        <div class="sizes" id="pdpSizes">
          ${sizes.map((s, i) => `<button type="button" data-size="${esc(s)}" class="${i === 0 ? 'is-on' : ''}" ${out ? 'disabled' : ''}>${esc(s)}</button>`).join('')}
        </div>

        <div class="pdp-buy">
          <div class="pdp-qty">
            <button type="button" id="pdpMinus" aria-label="Fewer">\u2212</button>
            <span id="pdpQty">1</span>
            <button type="button" id="pdpPlus" aria-label="More">+</button>
          </div>
          <button class="btn btn-solid" id="pdpAdd" ${out ? 'disabled' : ''}>${out ? 'Sold out' : 'Add to bag'}</button>
        </div>
        <p class="pdp-stock${out ? ' is-out' : ''}"><span class="dot"></span>${out ? 'Sold out for now' : `In stock${p.stock < 8 ? ` \u00B7 only ${p.stock} left` : ''} \u00B7 ships in 3\u20135 days`}</p>

        <dl class="spec">
          ${p.material ? `<div><dt>Fabric</dt><dd>${esc(p.material)}</dd></div>` : ''}
          ${p.care ? `<div><dt>Care</dt><dd>${esc(p.care)}</dd></div>` : ''}
          ${Array.isArray(p.features) && p.features.length ? `<div><dt>Details</dt><dd><ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></dd></div>` : ''}
          <div><dt>Returns</dt><dd>7 days, unused, tags on</dd></div>
        </dl>

        <details class="acc">
          <summary>Shipping</summary>
          <div class="acc-body">
            <p>Free over ${money(FREE_SHIP)}, otherwise ${money(SHIP_FEE)} flat. Dispatched from Baramati, usually within a day, and delivered in 3\u20135 days across India.</p>
          </div>
        </details>

        <details class="acc">
          <summary>Reviews${reviews.length ? ` (${reviews.length})` : ''}</summary>
          <div class="acc-body">
            ${reviews.length
              ? `<div class="reviews">${reviews
                  .map(
                    (r) => `<div class="review">
                      <div class="review-head"><strong>${esc(r.author)}</strong><span class="star">${stars(r.rating)}</span><time>${esc(r.date || '')}</time></div>
                      <p>${esc(r.comment)}</p>
                    </div>`
                  )
                  .join('')}</div>`
              : '<p>No reviews on this piece yet. If you have bought it, say what you think.</p>'}
            <form class="review-form" id="reviewForm">
              <p class="pdp-label">Your rating</p>
              <div class="stars" id="reviewStars">
                ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" aria-label="${n} star${n > 1 ? 's' : ''}">\u2605</button>`).join('')}
              </div>
              <div class="rows-2">
                <label class="field"><span>Name</span><input id="reviewAuthor" required /></label>
                <label class="field"><span>One line</span><input id="reviewComment" required placeholder="How does it wear?" /></label>
              </div>
              <button class="btn btn-outline btn-sm" type="submit">Post review</button>
            </form>
          </div>
        </details>
      </div>
    </div>
    ${relatedBlock}`;
  }

  function renderPdp(p) {
    $('#pdpView').innerHTML = pdpMarkup(p);

    const sizes = $$('#pdpSizes button');
    let size = sizes.length ? sizes[0].dataset.size : 'Standard';
    let qty = 1;

    $('#pdpSizes').addEventListener('click', (e) => {
      const b = e.target.closest('[data-size]');
      if (!b) return;
      sizes.forEach((s) => s.classList.remove('is-on'));
      b.classList.add('is-on');
      size = b.dataset.size;
    });

    const paintQty = () => ($('#pdpQty').textContent = qty);
    $('#pdpMinus').addEventListener('click', () => { qty = clamp(qty - 1, 1, 20); paintQty(); });
    $('#pdpPlus').addEventListener('click', () => { qty = Math.min(20, Math.max(1, p.stock || 1), qty + 1); paintQty(); });
    $('#pdpAdd').addEventListener('click', () => addToCart(p.id, size, qty));
    $('#pdpSizeHelp').addEventListener('click', () => toast('Sizes run true. Message @og._gallery for measurements.', ''));
    $('#pdpImage').addEventListener('click', () => openLightbox(p.image, p.name));

    const form = $('#reviewForm');
    if (form) {
      let rating = 0;
      $$('#reviewStars button').forEach((b) => {
        b.addEventListener('click', () => {
          rating = Number(b.dataset.star);
          $$('#reviewStars button').forEach((x) => x.classList.toggle('is-on', Number(x.dataset.star) <= rating));
        });
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const author = $('#reviewAuthor').value.trim();
        const comment = $('#reviewComment').value.trim();
        if (!rating) return toast('Pick a star rating first.', 'bad');
        if (!author || !comment) return toast('A name and a line, please.', 'bad');
        try {
          await window.API.addReview({ productId: p.id, author, rating, comment });
          toast('Review posted. Thank you.', 'good');
          const fresh = await window.API.getProductById(p.id);
          if (store.pdpProduct && store.pdpProduct.id === p.id) renderPdp(fresh);
        } catch (err) {
          toast('Could not post that review.', 'bad');
        }
      });
    }
  }

  /* ---------- lightbox ---------- */
  function openLightbox(src, alt) {
    const box = $('#lightbox');
    $('#lightboxImg').src = src;
    $('#lightboxImg').alt = alt || '';
    box.hidden = false;
    document.body.classList.add('is-locked');
    if (lenis) lenis.stop();
  }
  function closeLightbox() {
    $('#lightbox').hidden = true;
    if ($$('.sheet.is-open, .modal:not([hidden]), .search:not([hidden])').length === 0) {
      document.body.classList.remove('is-locked');
      if (lenis) lenis.start();
    }
  }

  /* ---------- checkout ---------- */
  function openCheckout() {
    if (!store.cart.length) return toast('Your bag is empty.', 'bad');
    closeCart();
    $('#checkoutModal').hidden = false;
    document.body.classList.add('is-locked');
    if (lenis) lenis.stop();
    syncCheckoutSummary(totals());
  }
  function closeCheckout() {
    $('#checkoutModal').hidden = true;
    document.body.classList.remove('is-locked');
    if (lenis) lenis.start();
  }

  function syncCheckoutSummary(t) {
    const lines = cartLines();
    $('#checkoutItems').innerHTML = lines
      .map(
        (l) => `<div class="co-item">
          <img src="${esc(l.product.image)}" alt="" />
          <div><p>${esc(l.product.name)}</p><p class="co-meta">Size ${esc(l.size)} · Qty ${l.qty}</p></div>
          <p class="co-price">${money(l.product.price * l.qty)}</p>
        </div>`
      )
      .join('');
    $('#coSubtotal').textContent = money(t.subtotal);
    $('#coDiscountRow').hidden = t.discount <= 0;
    $('#coDiscount').textContent = '\u2212' + money(t.discount);
    $('#coShipping').textContent = t.subtotal === 0 ? '\u2014' : t.shipping === 0 ? 'Free' : money(t.shipping);
    $('#coTotal').textContent = money(t.total);
  }

  function validateCheckout() {
    const checks = [
      ['#checkoutName', (v) => v.length >= 2],
      ['#checkoutEmail', (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)],
      ['#checkoutPhone', (v) => /^[0-9]{10}$/.test(v.replace(/\D/g, ''))],
      ['#checkoutAddress', (v) => v.length >= 6],
      ['#checkoutCity', (v) => v.length >= 2],
      ['#checkoutState', (v) => v.length >= 2],
      ['#checkoutPincode', (v) => /^[0-9]{6}$/.test(v)]
    ];
    let firstBad = null;
    checks.forEach(([sel, ok]) => {
      const el = $(sel);
      const good = ok(el.value.trim());
      el.classList.toggle('is-bad', !good);
      if (!good && !firstBad) firstBad = el;
    });
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  async function placeOrder() {
    const err = $('#checkoutError');
    err.hidden = true;
    if (!validateCheckout()) {
      err.textContent = 'Check the highlighted fields.';
      err.hidden = false;
      return;
    }
    const btn = $('#placeOrderBtn');
    btn.disabled = true;
    btn.textContent = 'Placing\u2026';
    const payment = ($('input[name="payment"]:checked') || {}).value || 'COD';
    const payload = {
      customer: {
        name: $('#checkoutName').value.trim(),
        email: $('#checkoutEmail').value.trim(),
        phone: $('#checkoutPhone').value.trim()
      },
      shipping: {
        address: $('#checkoutAddress').value.trim(),
        city: $('#checkoutCity').value.trim(),
        state: $('#checkoutState').value.trim(),
        pincode: $('#checkoutPincode').value.trim()
      },
      items: cartLines().map((l) => ({ id: l.id, size: l.size, quantity: l.qty })),
      paymentMethod: payment,
      promoCode: store.promo ? store.promo.code : null
    };
    try {
      const data = await window.API.createOrder(payload);
      store.cart = [];
      store.promo = null;
      save(LS.promo, null);
      persistCart();
      updateCartUI();
      closeCheckout();
      showConfirm(data.order);
      toast('Order placed. Thank you.', 'good');
    } catch (e) {
      err.textContent = e.message || 'Something went wrong placing the order. Try again.';
      err.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Place order';
    }
  }

  /* ---------- confirmation + receipt ---------- */
  let lastOrder = null;
  function showConfirm(order) {
    lastOrder = order;
    $('#confirmModal').hidden = false;
    document.body.classList.add('is-locked');
    if (lenis) lenis.stop();
    $('#confirmBody').innerHTML = receiptMarkup(order);
  }
  function closeConfirm() {
    $('#confirmModal').hidden = true;
    document.body.classList.remove('is-locked');
    if (lenis) lenis.start();
  }

  function receiptMarkup(order) {
    const when = new Date(order.createdAt);
    const eta = new Date(order.estimatedDelivery + 'T00:00:00');
    const fmt = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return `<h3>Thank you, ${esc((order.customer.name || '').split(' ')[0])}.</h3>
      <p>Order <strong>${esc(order.orderId)}</strong> is with us. Keep that number to track it.</p>
      <div class="receipt">
        <dl>
          <div><dt>Order</dt><dd>${esc(order.orderId)}</dd></div>
          <div><dt>Placed</dt><dd>${fmt(when)}</dd></div>
          <div><dt>Name</dt><dd>${esc(order.customer.name)}</dd></div>
          <div><dt>Phone</dt><dd>${esc(order.customer.phone)}</dd></div>
          <div><dt>Ship to</dt><dd>${esc(order.shipping.address)}, ${esc(order.shipping.city)} ${esc(order.shipping.pincode)}, ${esc(order.shipping.state)}</dd></div>
          <div><dt>Payment</dt><dd>${esc(paymentLabel(order.paymentMethod))}</dd></div>
          <div><dt>Arrives by</dt><dd>${fmt(eta)}</dd></div>
          <div><dt>Subtotal</dt><dd>${money(order.pricing.subtotal)}</dd></div>
          ${order.pricing.discount ? `<div><dt>Discount${order.pricing.promoCode ? ` (${esc(order.pricing.promoCode)})` : ''}</dt><dd>\u2212${money(order.pricing.discount)}</dd></div>` : ''}
          <div><dt>Shipping</dt><dd>${order.pricing.shipping ? money(order.pricing.shipping) : 'Free'}</dd></div>
          <div class="receipt-total"><dt>Total</dt><dd>${money(order.pricing.total)}</dd></div>
        </dl>
        <ul class="receipt-lines">
          ${order.items.map((i) => `<li><span>${esc(i.name)} · ${esc(i.size)} \u00D7 ${i.quantity}</span><span>${money(i.price * i.quantity)}</span></li>`).join('')}
        </ul>
      </div>
      <p class="fine">OG Gallery, Subhadra Mall 06, Baramati 413102, Maharashtra.</p>`;
  }

  function paymentLabel(method) {
    const m = String(method || '').toUpperCase();
    if (m === 'UPI') return 'UPI';
    if (m === 'CARD') return 'Card on delivery';
    if (m === 'COD' || m.includes('CASH')) return 'Cash on delivery';
    return method;
  }

  /* ---------- tracking ---------- */
  function openTrack(id) {
    $('#trackModal').hidden = false;
    document.body.classList.add('is-locked');
    if (lenis) lenis.stop();
    $('#trackError').hidden = true;
    if (id) {
      $('#trackInput').value = id;
      findOrder(id);
    }
  }
  function closeTrack() {
    $('#trackModal').hidden = true;
    document.body.classList.remove('is-locked');
    if (lenis) lenis.start();
  }

  async function findOrder(id) {
    const err = $('#trackError');
    const out = $('#trackResult');
    err.hidden = true;
    out.innerHTML = '';
    const clean = String(id || '').trim().toUpperCase();
    if (!clean) {
      err.textContent = 'Enter an order number like OG-12345.';
      err.hidden = false;
      return;
    }
    out.innerHTML = '<p class="muted">Looking\u2026</p>';
    try {
      const order = await window.API.trackOrder(clean);
      out.innerHTML = trackMarkup(order);
    } catch (e) {
      out.innerHTML = '';
      err.textContent = `No order under ${clean}. Check the number on your receipt.`;
      err.hidden = false;
    }
  }

  function trackMarkup(order) {
    const eta = new Date(order.estimatedDelivery + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return `<div class="track-summary">
        <dl>
          <div><dt>Order</dt><dd>${esc(order.orderId)}</dd></div>
          <div><dt>Status</dt><dd>${esc(order.status)}</dd></div>
          <div><dt>Arrives by</dt><dd>${eta}</dd></div>
          <div><dt>Total</dt><dd>${money(order.pricing.total)}</dd></div>
        </dl>
      </div>
      <div class="timeline">
        ${(order.timeline || [])
          .map(
            (s) => `<div class="tl-step${s.done ? ' is-done' : ''}">
              <span class="tl-dot"></span>
              <div>
                <h4>${esc(s.status)}</h4>
                <p>${esc(s.detail || '')}</p>
                <time>${esc(s.time || '')}</time>
              </div>
            </div>`
          )
          .join('')}
      </div>`;
  }

  /* ---------- newsletter ---------- */
  async function subscribe(e) {
    e.preventDefault();
    const note = $('#newsletterNote');
    const email = $('#newsletterEmail').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      note.textContent = 'That email does not look right.';
      note.className = 'letter-note is-bad';
      return;
    }
    try {
      const res = await window.API.subscribeNewsletter(email);
      note.textContent = res.alreadySubscribed ? 'You are already on the list.' : `Done. Use ${'OGFIRST10'} at checkout for 10% off.`;
      note.className = 'letter-note is-ok';
      $('#newsletterEmail').value = '';
    } catch (err) {
      note.textContent = 'Could not sign you up. Try again in a moment.';
      note.className = 'letter-note is-bad';
    }
  }

  /* ---------- routing ---------- */
  function route() {
    const m = location.hash.match(/^#\/product\/(.+)$/);
    if (m) {
      showPdp(decodeURIComponent(m[1]));
    } else if (m === null && !$('#pdpView').hidden) {
      hidePdp();
    }
  }

  /* ---------- events ---------- */
  function wire() {
    // anchors + router
    document.addEventListener('click', (e) => {
      const jump = e.target.closest('[data-cat-jump]');
      if (jump) {
        store.category = jump.dataset.catJump;
        renderGrid();
      }
      const catLink = e.target.closest('[data-cat-link]');
      if (catLink) {
        store.category = catLink.dataset.catLink;
        renderGrid();
      }
      const closeSheets = e.target.closest('[data-close-sheets]');
      if (closeSheets) { closeCart(); closeSaved(); closeMenu(); }
      const closeSearchEl = e.target.closest('[data-close-search]');
      if (closeSearchEl) closeSearch();
      const openTarget = e.target.closest('[data-open]');
      if (openTarget) { e.preventDefault(); openTrack(); }

      const a = e.target.closest('a[href^="#"]');
      if (a && !a.dataset.closeSheets && !a.dataset.closeSearch && !a.dataset.open) {
        const href = a.getAttribute('href');
        if (href === '#top' || /^#[a-zA-Z][\w-]*$/.test(href)) {
          const el = document.querySelector(href);
          if (el) {
            e.preventDefault();
            closeMenu();
            if (location.hash !== href) history.replaceState(null, '', href);
            route(); // replaceState fires no hashchange, so leave a product page here
            scrollTo(href, false);
          }
        }
      }
    });

    window.addEventListener('hashchange', () => {
      route();
      const m = location.hash.match(/^#\/product\//);
      if (!m) {
        const el = hashEl();
        if (el) scrollTo(location.hash, false);
      }
    });

    // header
    $('#menuToggle').addEventListener('click', openMenu);
    $('#menuClose').addEventListener('click', closeMenu);
    $('#menuOverlay').addEventListener('click', closeMenu);
    $('#themeToggle').addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      save(LS.theme, next);
    });
    $('#cartToggle').addEventListener('click', openCart);
    $('#cartClose').addEventListener('click', closeCart);
    $('#cartOverlay').addEventListener('click', closeCart);
    $('#wishlistToggle').addEventListener('click', openSaved);
    $('#wishlistClose').addEventListener('click', closeSaved);
    $('#wishlistOverlay').addEventListener('click', closeSaved);
    $('#wishlistAddAll').addEventListener('click', () => {
      const items = store.saved.map(byId).filter(Boolean);
      if (!items.length) return;
      items.forEach((p) => {
        const size = (Array.isArray(p.sizes) && p.sizes[0]) || 'Standard';
        const key = lineKey(p.id, size);
        if (!store.cart.find((l) => lineKey(l.id, l.size) === key)) store.cart.push({ id: p.id, size, qty: 1 });
      });
      persistCart();
      updateCartUI();
      closeSaved();
      openCart();
    });
    $('#searchToggle').addEventListener('click', openSearch);
    $('#tabSearch').addEventListener('click', openSearch);
    $('#tabWishlist').addEventListener('click', openSaved);
    $('#tabCart').addEventListener('click', openCart);
    $('#searchClose').addEventListener('click', closeSearch);
    $('#searchInput').addEventListener('input', (e) => renderSearchResults(e.target.value.trim()));
    $('#searchOverlay').addEventListener('click', (e) => { if (e.target.id === 'searchOverlay') closeSearch(); });

    // filters / sort / catalog search
    $('#filterChips').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-category]');
      if (!chip) return;
      store.category = chip.dataset.category;
      renderGrid();
    });
    $('#sortSelect').addEventListener('change', (e) => { store.sort = e.target.value; renderGrid(); });
    let searchTimer = null;
    $('#catalogSearch').addEventListener('input', (e) => {
      const v = e.target.value.trim();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { store.search = v; renderGrid(); }, 220);
    });
    $('#emptyReset').addEventListener('click', () => {
      store.search = '';
      store.category = 'all';
      store.sort = 'featured';
      renderGrid();
    });

    // grid delegation (cards live in the grid and in related rows)
    document.addEventListener('click', (e) => {
      const saveBtn = e.target.closest('[data-save]');
      if (saveBtn) { toggleSave(saveBtn.dataset.save); return; }
      const unlock = e.target.closest('[data-unsave]');
      if (unlock) { toggleSave(unlock.dataset.unsave); updateWishlistUI(); return; }
      const add = e.target.closest('[data-add]');
      if (add) { e.preventDefault(); addToCart(add.dataset.add, add.dataset.size, 1); return; }
      const saveAdd = e.target.closest('[data-save-add]');
      if (saveAdd) {
        const p = byId(saveAdd.dataset.saveAdd);
        if (p) addToCart(p.id, (Array.isArray(p.sizes) && p.sizes[0]) || 'Standard', 1);
        return;
      }
      const step = e.target.closest('[data-step]');
      if (step) {
        const id = step.dataset.id;
        const size = step.dataset.size;
        const line = store.cart.find((l) => lineKey(l.id, l.size) === lineKey(id, size));
        if (line) setQty(id, size, line.qty + Number(step.dataset.step));
        return;
      }
      const rem = e.target.closest('[data-remove]');
      if (rem) { removeLine(rem.dataset.remove, rem.dataset.size); toast('Removed from bag'); return; }
    });

    // promo
    $('#promoForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = $('#promoInput').value.trim();
      if (!code) return;
      const t = totals();
      const res = await window.API.validatePromo(code, t.subtotal);
      if (res && res.valid) {
        store.promo = { code: res.code, type: res.type, value: res.value, description: res.description };
        save(LS.promo, store.promo);
        $('#promoInput').value = '';
        updateCartUI();
        toast('Code applied', 'good');
      } else {
        toast((res && res.error) || 'That code did not work.', 'bad');
      }
    });
    $('#promoApplied').addEventListener('click', (e) => {
      if (e.target.id !== 'promoClear') return;
      store.promo = null;
      save(LS.promo, null);
      updateCartUI();
      toast('Code removed');
    });

    // checkout
    $('#checkoutBtn').addEventListener('click', openCheckout);
    $('#checkoutClose').addEventListener('click', closeCheckout);
    $('#checkoutOverlay').addEventListener('click', closeCheckout);
    $('#placeOrderBtn').addEventListener('click', placeOrder);
    $('#paymentOptions').addEventListener('change', () => {
      $$('.pay-opt').forEach((o) => o.classList.toggle('is-on', o.querySelector('input').checked));
      const val = ($('input[name="payment"]:checked') || {}).value;
      $('#upiBox').hidden = val !== 'UPI';
    });
    $('#checkoutForm').addEventListener('input', (e) => e.target.classList.remove('is-bad'));

    // confirm
    $('#confirmClose').addEventListener('click', closeConfirm);
    $('#confirmOverlay').addEventListener('click', closeConfirm);
    $('#printReceiptBtn').addEventListener('click', () => window.print());
    $('#trackNowBtn').addEventListener('click', () => {
      const id = lastOrder && lastOrder.orderId;
      closeConfirm();
      openTrack(id);
    });

    // track
    $('#trackForm').addEventListener('submit', (e) => {
      e.preventDefault();
      findOrder($('#trackInput').value);
    });
    $('#trackClose').addEventListener('click', closeTrack);
    $('#trackOverlay').addEventListener('click', closeTrack);
    $('#storeTrackBtn').addEventListener('click', () => openTrack());

    // lightbox
    $('#lightboxClose').addEventListener('click', closeLightbox);
    $('#lightbox').addEventListener('click', (e) => { if (e.target.id === 'lightbox') closeLightbox(); });

    // newsletter
    $('#newsletterForm').addEventListener('submit', subscribe);

    // rail
    $('#railView').addEventListener('click', () => {
      const p = store.rail[store.railFocus];
      if (p) location.hash = '#/product/' + encodeURIComponent(p.id);
    });

    // misc links
    $('#footerSizeLink').addEventListener('click', (e) => {
      e.preventDefault();
      toast('Sizes run true. Message @og._gallery for measurements.');
    });
    $('#year').textContent = new Date().getFullYear();

    // keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!$('#lightbox').hidden) return closeLightbox();
        if (!$('#searchOverlay').hidden) return closeSearch();
        if (!$('#trackModal').hidden) return closeTrack();
        if (!$('#confirmModal').hidden) return closeConfirm();
        if (!$('#checkoutModal').hidden) return closeCheckout();
        if (!$('#cartDrawer').hidden) return closeCart();
        if (!$('#wishlistDrawer').hidden) return closeSaved();
        if (!$('#mobileMenu').hidden) return closeMenu();
      }
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
        e.preventDefault();
        openSearch();
      }
    });

    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- boot ---------- */
  async function init() {
    initTheme();
    initScroll();
    wire();
    updateCartUI();
    updateWishlistUI();
    route();
    if (location.hash) {
      const el = hashEl();
      if (el) setTimeout(() => scrollTo(location.hash, true), 60);
    }
    await loadProducts();
    setupRail();
    onScroll();
    updateCartUI();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
