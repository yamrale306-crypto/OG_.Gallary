/* ============================================================
   OG Gallery — Storefront (v2.0 Luxury Editorial Polish)
   Subhadra Mall 06 · Baramati, Maharashtra
   ============================================================ */
(function () {
  'use strict';

  /* ---------- constants ---------- */
  const FREE_SHIP = 2500;
  const SHIP_FEE = 150;
  const RAIL_PER_CATEGORY = 4;
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
  const imgUrl = (url) => url ? (url.startsWith('/') || url.startsWith('http') ? url : '/' + url) : '';

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
    } catch (e) { /* storage blocked or quota reached */ }
  }

  function copyText(text, successMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast(successMsg || `Copied ${text}`, 'good')).catch(() => fallbackCopy(text, successMsg));
    } else {
      fallbackCopy(text, successMsg);
    }
  }
  function fallbackCopy(text, successMsg) {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    try {
      document.execCommand('copy');
      toast(successMsg || `Copied ${text}`, 'good');
    } catch (e) {
      toast(`Code: ${text}`);
    }
    document.body.removeChild(el);
  }

  /* ---------- state ---------- */
  const store = {
    products: [],
    loadFailed: false,
    rail: [],
    category: 'all',
    search: '',
    sort: 'featured',
    inStockOnly: false,
    bestsellerOnly: false,
    newOnly: false,
    cart: load(LS.cart, []),
    saved: load(LS.saved, []),
    promo: load(LS.promo, null),
    railFocus: 0,
    pdpProduct: null,
    sgCategory: 'Shirts',
    sgUnit: 'inches'
  };

  const byId = (id) => store.products.find((p) => p.id === id) || null;
  const lineKey = (id, size) => id + '::' + size;

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(msg, kind, actionText, actionFn) {
    const el = $('#toast');
    if (!el) return;
    el.innerHTML = `<span>${esc(msg)}</span>${actionText ? `<button type="button" style="text-decoration:underline;color:inherit;font-weight:700;margin-left:0.5rem">${esc(actionText)}</button>` : ''}`;
    el.className = 'toast is-on' + (kind ? ' is-' + kind : '');
    if (actionText && actionFn) {
      const btn = el.querySelector('button');
      if (btn) btn.onclick = () => { actionFn(); el.classList.remove('is-on'); };
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), 3000);
  }

  /* ---------- theme ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = $('#themeToggle');
    const dark = theme === 'dark';
    if (btn) {
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#11100e' : '#f7f4ed');
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
    // Use the browser's native scrolling. A perpetual smooth-scroll RAF
    // competed with the product renderer and added work even while idle.
    lenis = null;
  }
  function scrollTo(target, immediate) {
    if (typeof target === 'string' && !/^#[a-zA-Z][\w-]*$/.test(target)) return;
    if (lenis) {
      lenis.resize();
      lenis.scrollTo(target, { immediate: !!immediate, offset: typeof target === 'string' ? -64 : 0 });
    } else if (typeof target === 'string') {
      const el = document.querySelector(target);
      if (el) el.scrollIntoView({ behavior: immediate ? 'auto' : 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: target, behavior: immediate ? 'auto' : 'smooth' });
    }
  }

  /* ---------- store status (Baramati IST) ---------- */
  function updateStoreStatus() {
    try {
      const now = new Date();
      // Calculate IST time (UTC + 5:30)
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const istDate = new Date(utc + (3600000 * 5.5));
      const hours = istDate.getHours();
      const minutes = istDate.getMinutes();
      const timeInMins = hours * 60 + minutes;
      const openTime = 10 * 60; // 10:00 AM
      const closeTime = 21 * 60 + 30; // 9:30 PM

      const isOpen = timeInMins >= openTime && timeInMins < closeTime;
      const heroStatus = $('#heroStoreStatus');
      const counterStatus = $('#counterLiveText');
      const opensToday = timeInMins < openTime;
      const nextOpening = opensToday ? 'today' : 'tomorrow';
      if (heroStatus) {
        heroStatus.textContent = isOpen
          ? 'Baramati Counter Open Now · Closes at 9:30 PM'
          : `Baramati Counter Opens ${nextOpening} at 10:00 AM · Online 24/7`;
      }
      if (counterStatus) {
        counterStatus.textContent = isOpen
          ? 'Counter Open Today until 9:30 PM IST'
          : `Counter Opens ${nextOpening} at 10:00 AM IST`;
      }
    } catch (e) {}
  }

  /* ---------- product grid & cards ---------- */
  const BADGE_CLASS = { New: 'badge-new', Bestseller: 'badge-bestseller', Limited: 'badge-limited' };

  function cardMarkup(p) {
    const sizes = Array.isArray(p.sizes) ? p.sizes : [];
    const out = !p.stock || p.stock <= 0;
    const off = p.originalPrice > p.price ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
    const badgeClass = out ? 'badge-out' : BADGE_CLASS[p.badge] || '';
    // Only three pieces carry single-digit stock, so "Only 6 left" still means something.
    const low = !out && p.stock > 0 && p.stock <= 6;

    const quick =
      sizes.length > 1
        ? `<div class="card-quick">${sizes
            .map((s) => `<button class="size" data-add="${esc(p.id)}" data-size="${esc(s)}">${esc(s)}</button>`)
            .join('')}</div>`
        : `<div class="card-quick"><button class="one" data-add="${esc(p.id)}" data-size="${esc(sizes[0] || 'Standard')}">Add to bag</button></div>`;

    return `<article class="card" data-id="${esc(p.id)}">
      <a class="card-media" href="#/product/${encodeURIComponent(p.id)}" aria-label="View ${esc(p.name)}">
        <img src="${esc(imgUrl(p.image))}" alt="${esc(p.name)}" loading="lazy" decoding="async" />
        ${badgeClass ? `<div class="badge-group"><span class="badge ${badgeClass}">${out ? 'Sold out' : esc(p.badge)}</span></div>` : ''}
      </a>
      <button class="card-save${store.saved.includes(p.id) ? ' is-on' : ''}" data-save="${esc(p.id)}" aria-label="${store.saved.includes(p.id) ? 'Remove from saved' : 'Save this piece'}" title="Save to wishlist">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20Z"/></svg>
      </button>
      ${out ? '' : quick}
      <div class="card-body">
        <p class="card-cat">${esc(catLabel(p.category))}</p>
        <h3 class="card-name"><a href="#/product/${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3>
        <p class="card-price">
          <span>${money(p.price)}</span>
          ${p.originalPrice ? `<s>${money(p.originalPrice)}</s>` : ''}
          ${off > 0 ? `<span class="off-tag">${off}% off</span>` : ''}
        </p>
        ${p.rating ? `<p class="card-rating"><span class="star" aria-hidden="true">★</span>${Number(p.rating).toFixed(1)}<span>(${p.reviewCount || 0} reviews)</span></p>` : ''}
        ${low ? `<p class="stock-urgency">Only ${p.stock} left</p>` : ''}
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
    if (store.inStockOnly) list = list.filter((p) => p.stock && p.stock > 0);
    if (store.bestsellerOnly) list = list.filter((p) => p.badge === 'Bestseller');
    if (store.newOnly) list = list.filter((p) => p.badge === 'New');

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
    if (!grid) return;
    grid.innerHTML = list.map(cardMarkup).join('');
    const countEl = $('#resultCount');
    if (countEl) countEl.textContent = list.length;
    const emptyState = $('#emptyState');
    if (emptyState) emptyState.hidden = list.length > 0;
    grid.hidden = list.length === 0;

    const titles = { all: 'Shop all', Shirts: 'Shirts', Jeans: 'Denim', 'Slides_Slippers': 'Slides' };
    const shopTitle = $('#shopTitle');
    if (shopTitle) {
      shopTitle.textContent = store.search ? `Results for \u201C${store.search}\u201D` : titles[store.category] || 'Shop all';
    }
    syncChips();
    syncCounts();
  }

  function syncChips() {
    $$('#filterChips .chip').forEach((c) => {
      const on = c.dataset.category === store.category;
      c.classList.toggle('is-on', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const sel = $('#sortSelect');
    if (sel && sel.value !== store.sort) sel.value = store.sort;
    const field = $('#catalogSearch');
    if (field && field.value !== store.search) field.value = store.search;
    const clearBtn = $('#catalogSearchClear');
    if (clearBtn) clearBtn.hidden = !store.search;

    const btnStock = $('#filterInStock');
    if (btnStock) btnStock.classList.toggle('is-on', store.inStockOnly);
    const btnBest = $('#filterBestseller');
    if (btnBest) btnBest.classList.toggle('is-on', store.bestsellerOnly);
    const btnNew = $('#filterNew');
    if (btnNew) btnNew.classList.toggle('is-on', store.newOnly);
  }

  function syncCounts() {
    const all = store.products.length;
    const shirts = store.products.filter((p) => p.category === 'Shirts').length;
    const jeans = store.products.filter((p) => p.category === 'Jeans').length;
    const slides = store.products.filter((p) => p.category === 'Slides_Slippers').length;
    if ($('#countAll')) $('#countAll').textContent = all;
    if ($('#countShirts')) $('#countShirts').textContent = shirts;
    if ($('#countJeans')) $('#countJeans').textContent = jeans;
    if ($('#countSlides')) $('#countSlides').textContent = slides;
  }

  async function loadProducts() {
    const grid = $('#productGrid');
    if (grid) grid.innerHTML = skeletons(8);
    const data = await window.API.getProducts();
    store.products = (data && data.products) || [];
    store.loadFailed = Boolean(data && data.error);
    const fact = $('#factCount');
    if (fact) fact.textContent = store.products.length + ' pieces';
    buildRailList();
    renderGrid();
    if (store.loadFailed) {
      const title = $('#emptyState h3');
      const message = $('#emptyState p');
      const retry = $('#emptyReset');
      if (title) title.textContent = 'The collection could not load.';
      if (message) message.textContent = data.error;
      if (retry) retry.textContent = 'Try again';
    } else {
      const title = $('#emptyState h3');
      const message = $('#emptyState p');
      const retry = $('#emptyReset');
      if (title) title.textContent = 'Nothing matches that rack query.';
      if (message) message.textContent = 'Try searching another keyword, or clear your active filters.';
      if (retry) retry.textContent = 'Reset all filters';
    }
  }

  /* ---------- the rail (3D) ---------- */
  function buildRailList() {
    const out = [];
    ['Shirts', 'Jeans', 'Slides_Slippers'].forEach((cat) => {
      const pool = store.products
        .filter((p) => p.category === cat && p.stock > 0)
        .sort((a, b) => (b.badge ? 1 : 0) - (a.badge ? 1 : 0) || (b.rating || 0) - (a.rating || 0));
      out.push(...pool.slice(0, 2));
    });
    store.rail = out;
    const totalEl = $('#railTotal');
    if (totalEl) totalEl.textContent = String(out.length).padStart(2, '0');
    document.documentElement.style.setProperty('--rail-steps', out.length);
  }

  function renderRailDots() {
    const dots = $('#railDots');
    if (!dots) return;
    dots.innerHTML = store.rail
      .map((p, i) => `<button class="rail-dot${i === 0 ? ' is-on' : ''}" role="tab" data-rail="${i}" aria-label="${esc(p.name)}" title="${esc(p.name)}"></button>`)
      .join('');
  }

  function updateRailMeta(index, product) {
    const p = product || store.rail[index];
    if (!p) return;
    store.railFocus = index;
    if ($('#railCounter')) $('#railCounter').textContent = String(index + 1).padStart(2, '0');
    if ($('#railCat')) $('#railCat').textContent = catLabel(p.category);
    if ($('#railName')) $('#railName').textContent = p.name;
    if ($('#railPrice')) {
      $('#railPrice').textContent = p.originalPrice ? `${money(p.price)}  ·  was ${money(p.originalPrice)}` : money(p.price);
    }
    $$('#railDots .rail-dot').forEach((d, i) => d.classList.toggle('is-on', i === index));
    const hint = $('#railHint');
    if (hint) hint.classList.add('is-off');
  }

  function jumpToRail(index) {
    const n = Math.max(1, store.rail.length - 1);
    const i = clamp(index, 0, n);
    const track = $('#railTrack');
    if (!track) return;
    const total = track.offsetHeight - window.innerHeight;
    scrollTo(docTop(track) + (i / n) * total);
    if (window.OG3D && window.OG3D.setTarget) window.OG3D.setTarget(i);
  }

  function renderRailFallback() {
    const wrap = $('#railFallback');
    if (!wrap) return;
    wrap.hidden = false;
    wrap.innerHTML = `<div class="rail-fallback-inner">${store.rail
      .map((p) => `<a href="#/product/${encodeURIComponent(p.id)}" aria-label="${esc(p.name)}"><img src="${esc(imgUrl(p.image))}" alt="${esc(p.name)}" loading="lazy" /></a>`)
      .join('')}</div>`;
    const hint = $('#railHint');
    if (hint) hint.hidden = true;
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
      let instance = null;
      try {
        instance = OG3D.mount($('#railCanvas'), store.rail, {
          onFocus: updateRailMeta,
          onTap: (product) => { if (product) openQuickView(product.id); },
          reduced: REDUCED
        });
      } catch (e) {
        instance = null;
      }
      if (!instance) return renderRailFallback();

      const rail = $('#rail');
      if ('IntersectionObserver' in window && rail) {
        new IntersectionObserver((entries) => OG3D.setVisible(entries[0].isIntersecting), { rootMargin: '140px' }).observe(rail);
      }
      installRailProgress(OG3D);
      updateRailMeta(0, store.rail[0]);
    });
  }

  function railProgress() {
    const track = $('#railTrack');
    if (!track) return 0;
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

    $('#railDots').addEventListener('click', (e) => {
      const dot = e.target.closest('[data-rail]');
      if (!dot) return;
      jumpToRail(Number(dot.dataset.rail));
    });

    const prevBtn = $('#railPrevBtn');
    const nextBtn = $('#railNextBtn');
    if (prevBtn) prevBtn.addEventListener('click', () => jumpToRail(store.railFocus - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => jumpToRail(store.railFocus + 1));
  }

  function onScroll() {
    if (store.railScene) store.railScene.setProgress(railProgress());
    const y = window.scrollY;
    if (y === onScroll._last) return;
    const head = $('#siteHeader');
    if (head) head.classList.toggle('is-hidden', y > 340 && y > (onScroll._last || 0));
    const tabTop = $('.tab[data-tab="top"]');
    if (tabTop) tabTop.classList.toggle('is-on', y < 200);

    // Sticky mobile buy bar visibility on PDP
    const stickyBar = $('#stickyBuyBar');
    const pdpAdd = $('#pdpAdd');
    if (stickyBar && pdpAdd && !$('#pdpView').hidden) {
      const rect = pdpAdd.getBoundingClientRect();
      const passed = rect.bottom < 80;
      stickyBar.classList.toggle('is-visible', passed);
      stickyBar.setAttribute('aria-hidden', passed ? 'false' : 'true');
    }

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
    toast(`${p.name} (Size ${variant}) added to your bag`, 'good', 'View bag', openCart);
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
    btn.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.22)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.16,1,.3,1)' });
  }

  function updateCartUI() {
    const t = totals();
    const count = $('#cartCount');
    if (count) { count.textContent = t.count; count.hidden = t.count === 0; }
    const tabCount = $('#tabCartCount');
    if (tabCount) { tabCount.textContent = t.count; tabCount.hidden = t.count === 0; }

    const lines = cartLines();
    const cartEmpty = $('#cartEmpty');
    if (cartEmpty) cartEmpty.hidden = lines.length > 0;
    const cartItems = $('#cartItems');
    if (cartItems) {
      cartItems.innerHTML = lines
        .map(
          (l) => `<div class="line-item">
            <img src="${esc(imgUrl(l.product.image))}" alt="${esc(l.product.name)}" />
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
    }

    // Shipping progress bar
    const strip = $('#shipStrip');
    const shipText = $('#shipText');
    const shipFill = $('#shipFill');
    if (strip && shipText && shipFill) {
      if (lines.length === 0) {
        shipText.innerHTML = `<span>Free shipping threshold: ${money(FREE_SHIP)}</span>`;
        shipFill.style.width = '0%';
        strip.classList.remove('is-free');
      } else if (t.freeShip) {
        shipText.innerHTML = `<span>\uD83C\uDF89 Free express shipping unlocked!</span>`;
        shipFill.style.width = '100%';
        strip.classList.add('is-free');
      } else {
        const left = FREE_SHIP - t.subtotal;
        shipText.innerHTML = `<span>Add ${money(Math.max(0, left))} for free shipping</span>`;
        shipFill.style.width = clamp((t.subtotal / FREE_SHIP) * 100, 5, 100) + '%';
        strip.classList.remove('is-free');
      }
    }

    if ($('#lineSubtotal')) $('#lineSubtotal').textContent = money(t.subtotal);
    if ($('#lineDiscountRow')) $('#lineDiscountRow').hidden = t.discount <= 0;
    if ($('#lineDiscount')) $('#lineDiscount').textContent = '\u2212' + money(t.discount);
    if ($('#lineShipping')) $('#lineShipping').textContent = t.subtotal === 0 ? '\u2014' : t.shipping === 0 ? 'Free' : money(t.shipping);
    if ($('#lineTotal')) $('#lineTotal').textContent = money(t.total);

    const tag = $('#promoApplied');
    if (tag) {
      if (store.promo) {
        tag.hidden = false;
        tag.innerHTML = `<span>${esc(store.promo.code)} \u2014 ${esc(store.promo.description || 'applied')}</span><button type="button" id="promoClear">Remove</button>`;
      } else {
        tag.hidden = true;
        tag.innerHTML = '';
      }
    }

    if ($('#checkoutBtn')) $('#checkoutBtn').disabled = lines.length === 0;
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
    if (i > -1) {
      store.saved.splice(i, 1);
      toast('Piece removed from saved items');
    } else {
      store.saved.push(id);
      const p = byId(id);
      toast(`${p ? p.name : 'Piece'} saved to your wishlist`, 'good', 'View saved', openSaved);
    }
    save(LS.saved, store.saved);
    updateWishlistUI();
    syncGridSaves();
  }

  function updateWishlistUI() {
    const items = store.saved.map(byId).filter(Boolean);
    const count = $('#wishlistCount');
    if (count) { count.textContent = items.length; count.hidden = items.length === 0; }
    if ($('#wishlistEmpty')) $('#wishlistEmpty').hidden = items.length > 0;
    if ($('#wishlistAddAll')) $('#wishlistAddAll').disabled = items.length === 0;
    const container = $('#wishlistItems');
    if (container) {
      container.innerHTML = items
        .map(
          (p) => `<div class="line-item">
            <a href="#/product/${encodeURIComponent(p.id)}" data-close-sheets><img src="${esc(imgUrl(p.image))}" alt="${esc(p.name)}" /></a>
            <div>
              <h4>${esc(p.name)}</h4>
              <p class="li-meta">${esc(catLabel(p.category))}</p>
              <p class="li-price">${money(p.price)}</p>
              <br /><button class="li-remove" data-unsave="${esc(p.id)}">Remove</button>
            </div>
            <button class="btn btn-outline btn-sm" data-save-add="${esc(p.id)}">Add to bag</button>
          </div>`
        )
        .join('');
    }
  }

  /* ---------- sheets (drawers) ---------- */
  function openSheet(id, overlayId) {
    const sheet = $(id);
    const overlay = $(overlayId);
    if (!sheet || !overlay) return;
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
    setTimeout(() => {
      sheet.hidden = true;
      overlay.hidden = true;
      if ($$('.sheet.is-open, .modal:not([hidden]), .search:not([hidden]), .lightbox:not([hidden])').length === 0) {
        document.body.classList.remove('is-locked');
        if (lenis) lenis.start();
      }
    }, 420);
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

  /* ---------- instant search ---------- */
  function openSearch() {
    $('#searchOverlay').hidden = false;
    if (lenis) lenis.stop();
    const input = $('#searchInput');
    input.value = '';
    renderSearchResults('');
    setTimeout(() => input.focus(), 50);
  }
  function closeSearch() {
    $('#searchOverlay').hidden = true;
    if (lenis) lenis.start();
  }
  function renderSearchResults(q) {
    const box = $('#searchResults');
    const hint = $('#searchHint');
    if (!box || !hint) return;
    if (!q) {
      box.innerHTML = '';
      hint.hidden = false;
      hint.textContent = 'Search by name, category or detail.';
      return;
    }
    const query = q.toLowerCase();
    const hits = store.products
      .filter((p) => p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query) || (p.material || '').toLowerCase().includes(query))
      .slice(0, 6);
    hint.hidden = hits.length > 0;
    if (!hits.length) hint.textContent = `No items matching "${esc(q)}". Try "shirt", "denim" or "slides".`;
    box.innerHTML = hits
      .map(
        (p) => `<a class="search-hit" href="#/product/${encodeURIComponent(p.id)}" data-close-search>
          <img src="${esc(imgUrl(p.image))}" alt="" />
          <div><h4>${esc(p.name)}</h4><p>${esc(catLabel(p.category))} · ${money(p.price)}</p></div>
        </a>`
      )
      .join('');
  }

  /* ---------- quick view modal ---------- */
  function openQuickView(id) {
    const p = byId(id);
    if (!p) return;
    const modal = $('#quickViewModal');
    const body = $('#quickViewBody');
    if (!modal || !body) return;

    const sizes = Array.isArray(p.sizes) && p.sizes.length ? p.sizes : ['Standard'];
    const out = !p.stock || p.stock <= 0;

    body.innerHTML = `
      <div class="qv-grid">
        <div class="qv-media">
          <img src="${esc(imgUrl(p.image))}" alt="${esc(p.name)}" />
        </div>
        <div class="qv-details">
          <p class="eyebrow">${esc(catLabel(p.category))}</p>
          <h3>${esc(p.name)}</h3>
          <p class="qv-price">
            <span>${money(p.price)}</span>
            ${p.originalPrice ? `<s>${money(p.originalPrice)}</s>` : ''}
          </p>
          <p class="qv-desc">${esc(p.description || '')}</p>
          ${p.material ? `<p class="fine"><strong>Fabric:</strong> ${esc(p.material)}</p>` : ''}

          <div style="margin: 1.2rem 0">
            <p class="pdp-label">Select Size <button type="button" id="qvSizeHelpBtn">Size help</button></p>
            <div class="sizes" id="qvSizes">
              ${sizes.map((s, i) => `<button type="button" data-qv-size="${esc(s)}" class="${i === 0 ? 'is-on' : ''}" ${out ? 'disabled' : ''}>${esc(s)}</button>`).join('')}
            </div>
          </div>

          <div class="qv-actions">
            <button class="btn btn-solid" id="qvAddBtn" ${out ? 'disabled' : ''}>${out ? 'Sold out' : 'Add to bag'}</button>
            <a class="btn btn-outline" href="#/product/${encodeURIComponent(p.id)}" data-close-qv>Full details →</a>
          </div>
        </div>
      </div>
    `;

    let selectedSize = sizes[0] || 'Standard';
    const qvSizes = $$('#qvSizes button');
    $('#qvSizes').addEventListener('click', (e) => {
      const b = e.target.closest('[data-qv-size]');
      if (!b) return;
      qvSizes.forEach((x) => x.classList.remove('is-on'));
      b.classList.add('is-on');
      selectedSize = b.dataset.qvSize;
    });

    $('#qvAddBtn').addEventListener('click', () => {
      addToCart(p.id, selectedSize, 1);
      closeQuickView();
    });

    const helpBtn = $('#qvSizeHelpBtn');
    if (helpBtn) helpBtn.addEventListener('click', () => openSizeGuide(p.category));

    modal.hidden = false;
    document.body.classList.add('is-locked');
    if (lenis) lenis.stop();
  }

  function closeQuickView() {
    const modal = $('#quickViewModal');
    if (!modal) return;
    modal.hidden = true;
    if ($$('.sheet.is-open, .modal:not([hidden]), .search:not([hidden])').length === 0) {
      document.body.classList.remove('is-locked');
      if (lenis) lenis.start();
    }
  }

  /* ---------- size guide modal ---------- */
  const SIZE_DATA = {
    Shirts: {
      headers: ['Size', 'Chest', 'Length', 'Shoulder', 'Sleeve'],
      inches: [
        ['S', '38"', '28"', '17.5"', '24"'],
        ['M', '40"', '29"', '18.5"', '24.5"'],
        ['L', '42"', '30"', '19.5"', '25"'],
        ['XL', '44"', '31"', '20.5"', '25.5"']
      ],
      cm: [
        ['S', '96.5 cm', '71 cm', '44.5 cm', '61 cm'],
        ['M', '101.5 cm', '73.5 cm', '47 cm', '62 cm'],
        ['L', '106.5 cm', '76 cm', '49.5 cm', '63.5 cm'],
        ['XL', '112 cm', '78.5 cm', '52 cm', '65 cm']
      ]
    },
    Jeans: {
      headers: ['Waist Size', 'Waist', 'Hip', 'Inseam', 'Rise'],
      inches: [
        ['30', '30"', '38"', '31"', '10.5"'],
        ['32', '32"', '40"', '32"', '11"'],
        ['34', '34"', '42"', '32"', '11.5"'],
        ['36', '36"', '44"', '32.5"', '12"']
      ],
      cm: [
        ['30', '76 cm', '96.5 cm', '79 cm', '26.5 cm'],
        ['32', '81.5 cm', '101.5 cm', '81.5 cm', '28 cm'],
        ['34', '86.5 cm', '106.5 cm', '81.5 cm', '29 cm'],
        ['36', '91.5 cm', '112 cm', '82.5 cm', '30.5 cm']
      ]
    },
    Slides_Slippers: {
      headers: ['UK / India', 'EU Size', 'US Size', 'Insole Length'],
      inches: [
        ['UK 6', 'EU 40', 'US 7', '9.8"'],
        ['UK 7', 'EU 41', 'US 8', '10.2"'],
        ['UK 8', 'EU 42', 'US 9', '10.5"'],
        ['UK 9', 'EU 43', 'US 10', '10.8"'],
        ['UK 10', 'EU 44', 'US 11', '11.1"']
      ],
      cm: [
        ['UK 6', 'EU 40', 'US 7', '25.0 cm'],
        ['UK 7', 'EU 41', 'US 8', '25.8 cm'],
        ['UK 8', 'EU 42', 'US 9', '26.7 cm'],
        ['UK 9', 'EU 43', 'US 10', '27.5 cm'],
        ['UK 10', 'EU 44', 'US 11', '28.3 cm']
      ]
    }
  };

  function renderSizeTable() {
    const wrap = $('#sgTableContainer');
    if (!wrap) return;
    const cat = store.sgCategory === 'Jeans' ? 'Jeans' : store.sgCategory === 'Slides_Slippers' ? 'Slides_Slippers' : 'Shirts';
    const data = SIZE_DATA[cat];
    const unit = store.sgUnit === 'cm' ? 'cm' : 'inches';
    const rows = data[unit] || [];

    wrap.innerHTML = `
      <table class="sg-table">
        <thead><tr>${data.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    `;

    $$('#sgTabs .sg-tab').forEach((tab) => {
      tab.classList.toggle('is-on', tab.dataset.sgCat === store.sgCategory);
    });
    const uInches = $('#unitInches');
    const uCm = $('#unitCm');
    if (uInches) uInches.classList.toggle('is-on', store.sgUnit === 'inches');
    if (uCm) uCm.classList.toggle('is-on', store.sgUnit === 'cm');
  }

  function openSizeGuide(preferredCategory) {
    if (preferredCategory) store.sgCategory = preferredCategory;
    renderSizeTable();
    $('#sizeGuideModal').hidden = false;
    document.body.classList.add('is-locked');
    if (lenis) lenis.stop();
  }
  function closeSizeGuide() {
    $('#sizeGuideModal').hidden = true;
    if ($$('.sheet.is-open, .modal:not([hidden]), .search:not([hidden])').length === 0) {
      document.body.classList.remove('is-locked');
      if (lenis) lenis.start();
    }
  }

  /* ---------- product page (PDP) ---------- */
  let pdpToken = 0;
  function showPdp(id) {
    const token = ++pdpToken;
    const view = $('#pdpView');
    $('#homeView').hidden = true;
    view.hidden = false;
    view.innerHTML = '<p class="muted" style="padding:4rem 0;text-align:center">Loading item…</p>';
    scrollTo(0, true);
    closeCart();
    closeSaved();
    closeSearch();
    closeQuickView();

    window.API.getProductById(id).then((p) => {
      if (token !== pdpToken) return;
      if (!p) {
        view.innerHTML = `<div class="empty"><h3>We could not find that piece.</h3><p>It may have sold out or the link is expired.</p><a class="btn btn-solid btn-sm" href="#shop">Back to the rack</a></div>`;
        return;
      }
      document.title = `${p.name} — OG Gallery Baramati`;
      store.pdpProduct = p;
      renderPdp(p);
      updateStickyBuyBar(p);
    });
  }

  function hidePdp() {
    pdpToken++;
    const view = $('#pdpView');
    view.hidden = true;
    view.innerHTML = '';
    $('#homeView').hidden = false;
    store.pdpProduct = null;
    document.title = 'OG Gallery — Shirts, Denim & Slides · Subhadra Mall, Baramati';
    const sbb = $('#stickyBuyBar');
    if (sbb) sbb.classList.remove('is-visible');
  }

  function updateStickyBuyBar(p) {
    const sbb = $('#stickyBuyBar');
    if (!sbb) return;
    const img = $('#sbbImg');
    if (img) img.src = imgUrl(p.image);
    const name = $('#sbbName');
    if (name) name.textContent = p.name;
    const price = $('#sbbPrice');
    if (price) price.textContent = money(p.price);
  }

  function pdpMarkup(p) {
    const sizes = Array.isArray(p.sizes) && p.sizes.length ? p.sizes : ['Standard'];
    const out = !p.stock || p.stock <= 0;
    const reviews = Array.isArray(p.reviews) ? p.reviews : [];
    const related = Array.isArray(p.related) ? p.related : [];

    const relatedBlock = related.length
      ? `<section class="related">
          <div class="related-head">
            <h2>More ${esc(catLabel(p.category).toLowerCase())} from the counter</h2>
            <a class="btn btn-quiet btn-sm" href="#shop" data-cat-jump="${esc(p.category)}">See all →</a>
          </div>
          <div class="grid">${related.map(cardMarkup).join('')}</div>
        </section>`
      : '';

    return `
    <nav class="crumbs">
      <a href="#top">Home</a><span class="sep">/</span>
      <a href="#shop">Collection</a><span class="sep">/</span>
      <a href="#shop" data-cat-jump="${esc(p.category)}">${esc(catLabel(p.category))}</a><span class="sep">/</span>
      <span>${esc(p.name)}</span>
    </nav>

    <div class="pdp-grid">
      <div class="pdp-media">
        <img id="pdpImage" src="${esc(imgUrl(p.image))}" alt="${esc(p.name)}" />
        <span class="pdp-zoom-hint">Click to enlarge</span>
      </div>

      <div class="pdp-copy">
        <p class="eyebrow">${esc(catLabel(p.category))}</p>
        <h1>${esc(p.name)}</h1>
        <p class="pdp-price">
          <span>${money(p.price)}</span>
          ${p.originalPrice ? `<s>${money(p.originalPrice)}</s>` : ''}
        </p>
        <p class="pdp-desc">${esc(p.description || '')}</p>

        <p class="pdp-label">Size <button type="button" id="pdpSizeHelp">Size guide &amp; measurements</button></p>
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
          <button class="btn btn-buy-now" id="pdpBuyNow" ${out ? 'disabled' : ''}>Buy Now</button>
        </div>
        <p class="pdp-stock${out ? ' is-out' : ''}"><span class="dot"></span>${out ? 'Sold out' : 'In stock'}</p>

        <!-- Trust Features Row -->
        <div class="pdp-features-row">
          <div class="pdp-feat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            <span>Free shipping over ₹2,500</span>
          </div>
          <div class="pdp-feat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            <span>7-day returns</span>
          </div>
          <div class="pdp-feat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>Visit us at Subhadra Mall</span>
          </div>
          <div class="pdp-feat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><path d="M1 10h22"/></svg>
            <span>UPI, Cards &amp; Cash on Delivery</span>
          </div>
        </div>

        <dl class="spec">
          ${p.material ? `<div><dt>Fabric</dt><dd>${esc(p.material)}</dd></div>` : ''}
          ${p.care ? `<div><dt>Care</dt><dd>${esc(p.care)}</dd></div>` : ''}
          ${Array.isArray(p.features) && p.features.length ? `<div><dt>Details</dt><dd><ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></dd></div>` : ''}
          <div><dt>Returns</dt><dd>7 days, unused, tags intact</dd></div>
        </dl>

        <details class="acc">
          <summary>Shipping &amp; Delivery Timeline</summary>
          <div class="acc-body">
            <p>Free standard shipping across India on orders over ${money(FREE_SHIP)}, otherwise ${money(SHIP_FEE)} flat rate. Dispatched directly from Subhadra Mall 06, Baramati within 24 hours. Standard delivery reaches most Indian cities in 3–5 business days.</p>
          </div>
        </details>

        <details class="acc" open>
            <summary>Customer reviews${reviews.length ? ` (${reviews.length})` : ''}</summary>
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
              : '<p>No customer reviews on this piece yet. Be the first to leave one after wearing it.</p>'}
            <form class="review-form" id="reviewForm">
              <p class="pdp-label">Write your review</p>
              <div class="stars" id="reviewStars">
                ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" aria-label="${n} star${n > 1 ? 's' : ''}">\u2605</button>`).join('')}
              </div>
              <div class="rows-2">
                <label class="field"><span>Your Name</span><input id="reviewAuthor" required placeholder="Arjun" /></label>
                <label class="field"><span>Review line</span><input id="reviewComment" required placeholder="How does the fabric feel?" /></label>
              </div>
              <button class="btn btn-outline btn-sm" type="submit">Submit Review</button>
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
    $('#pdpBuyNow').addEventListener('click', () => {
      addToCart(p.id, size, qty);
      openCheckout();
    });

    const sbbAdd = $('#sbbAddBtn');
    if (sbbAdd) {
      sbbAdd.onclick = () => addToCart(p.id, size, qty);
    }

    $('#pdpSizeHelp').addEventListener('click', () => openSizeGuide(p.category));
    $('#pdpImage').addEventListener('click', () => openLightbox(imgUrl(p.image), p.name));

    const form = $('#reviewForm');
    if (form) {
      let rating = 5;
      $$('#reviewStars button').forEach((x) => x.classList.add('is-on'));
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
        if (!author || !comment) return toast('Please provide your name and a brief review.', 'bad');
        try {
          await window.API.addReview({ productId: p.id, author, rating, comment });
          toast('Thank you! Review published.', 'good');
          const fresh = await window.API.getProductById(p.id);
          if (store.pdpProduct && store.pdpProduct.id === p.id) renderPdp(fresh);
        } catch (err) {
          toast('Could not post that review right now.', 'bad');
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
    if (!store.cart.length) return toast('Your bag is currently empty.', 'bad');
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
    const container = $('#checkoutItems');
    if (container) {
      container.innerHTML = lines
        .map(
          (l) => `<div class="co-item">
            <img src="${esc(imgUrl(l.product.image))}" alt="" />
            <div><p><strong>${esc(l.product.name)}</strong></p><p class="co-meta">Size ${esc(l.size)} · Qty ${l.qty}</p></div>
            <p class="co-price">${money(l.product.price * l.qty)}</p>
          </div>`
        )
        .join('');
    }
    if ($('#coSubtotal')) $('#coSubtotal').textContent = money(t.subtotal);
    if ($('#coDiscountRow')) $('#coDiscountRow').hidden = t.discount <= 0;
    if ($('#coDiscount')) $('#coDiscount').textContent = '\u2212' + money(t.discount);
    if ($('#coShipping')) $('#coShipping').textContent = t.subtotal === 0 ? '\u2014' : t.shipping === 0 ? 'Free' : money(t.shipping);
    if ($('#coTotal')) $('#coTotal').textContent = money(t.total);
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
      if (!el) return;
      const good = ok(el.value.trim());
      el.classList.toggle('is-bad', !good);
      if (!good && !firstBad) firstBad = el;
    });
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  async function placeOrder() {
    const err = $('#checkoutError');
    if (err) err.hidden = true;
    if (!validateCheckout()) {
      if (err) { err.textContent = 'Please check the highlighted delivery fields.'; err.hidden = false; }
      return;
    }
    const btn = $('#placeOrderBtn');
    btn.disabled = true;
    btn.textContent = 'Securing order\u2026';
    const payment = ($('input[name="payment"]:checked') || {}).value || 'UPI';
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
      toast('Order confirmed. Thank you!', 'good');
    } catch (e) {
      if (err) { err.textContent = e.message || 'Something went wrong placing the order. Please try again.'; err.hidden = false; }
    } finally {
      btn.disabled = false;
      btn.textContent = 'Confirm & Place Order';
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

    const copyBtn = $('#confirmBody #copyOrderIdBtn');
    if (copyBtn) copyBtn.addEventListener('click', () => copyText(order.orderId, 'Order ID copied to clipboard'));
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
    return `
      <div class="confirm-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h3>Thank you, ${esc((order.customer.name || '').split(' ')[0])}.</h3>
      <p>Your order is confirmed at Baramati counter. Keep your order reference handy:</p>
      <div class="order-id-pill">
        <span>Order ID: <strong>${esc(order.orderId)}</strong></span>
        <button type="button" class="copy-order-btn" id="copyOrderIdBtn">Copy</button>
      </div>
      <div class="receipt">
        <dl>
          <div><dt>Placed on</dt><dd>${fmt(when)}</dd></div>
          <div><dt>Customer</dt><dd>${esc(order.customer.name)} (${esc(order.customer.phone)})</dd></div>
          <div><dt>Ship to</dt><dd>${esc(order.shipping.address)}, ${esc(order.shipping.city)} ${esc(order.shipping.pincode)}, ${esc(order.shipping.state)}</dd></div>
          <div><dt>Payment</dt><dd>${esc(paymentLabel(order.paymentMethod))}</dd></div>
          <div><dt>Estimated Arrival</dt><dd><strong>${fmt(eta)}</strong></dd></div>
          <div><dt>Subtotal</dt><dd>${money(order.pricing.subtotal)}</dd></div>
          ${order.pricing.discount ? `<div><dt>Promo Discount${order.pricing.promoCode ? ` (${esc(order.pricing.promoCode)})` : ''}</dt><dd>\u2212${money(order.pricing.discount)}</dd></div>` : ''}
          <div><dt>Shipping</dt><dd>${order.pricing.shipping ? money(order.pricing.shipping) : 'Free Express'}</dd></div>
          <div class="receipt-total"><dt>Total Paid</dt><dd>${money(order.pricing.total)}</dd></div>
        </dl>
        <ul class="receipt-lines">
          ${order.items.map((i) => `<li><span>${esc(i.name)} · Size ${esc(i.size)} \u00D7 ${i.quantity}</span><span>${money(i.price * i.quantity)}</span></li>`).join('')}
        </ul>
      </div>
      <p class="fine">OG Gallery · Subhadra Mall 06, Baramati, Maharashtra 413102.</p>`;
  }

  function paymentLabel(method) {
    const m = String(method || '').toUpperCase();
    if (m === 'UPI') return 'UPI / QR Code';
    if (m === 'CARD') return 'Card on Delivery';
    if (m === 'COD' || m.includes('CASH')) return 'Cash on Delivery';
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
      err.textContent = 'Please enter an order number like OG-12345.';
      err.hidden = false;
      return;
    }
    out.innerHTML = '<p class="muted" style="text-align:center;padding:1rem 0">Finding order status\u2026</p>';
    try {
      const order = await window.API.trackOrder(clean);
      out.innerHTML = trackMarkup(order);
    } catch (e) {
      out.innerHTML = '';
      err.textContent = `No order found under "${clean}". Please double check your receipt ID.`;
      err.hidden = false;
    }
  }

  function trackMarkup(order) {
    const eta = new Date(order.estimatedDelivery + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return `<div class="track-summary">
        <dl>
          <div><dt>Order Number</dt><dd><strong>${esc(order.orderId)}</strong></dd></div>
          <div><dt>Current Stage</dt><dd><strong>${esc(order.status)}</strong></dd></div>
          <div><dt>Estimated Arrival</dt><dd>${eta}</dd></div>
          <div><dt>Total Amount</dt><dd>${money(order.pricing.total)}</dd></div>
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
      note.textContent = 'Please enter a valid email address.';
      note.className = 'letter-note is-bad';
      return;
    }
    try {
      const res = await window.API.subscribeNewsletter(email);
      note.textContent = res.alreadySubscribed ? 'Welcome back! You are already on the guest list.' : `Done! Welcome code is OGFIRST10 for 10% off.`;
      note.className = 'letter-note is-ok';
      $('#newsletterEmail').value = '';
      copyText('OGFIRST10', 'Welcome code OGFIRST10 copied!');
    } catch (err) {
      note.textContent = 'Could not subscribe right now. Please try again.';
      note.className = 'letter-note is-bad';
    }
  }

  /* ---------- smart pincode autofill ---------- */
  function setupPincodeAutofill() {
    const pin = $('#checkoutPincode');
    if (!pin) return;
    pin.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val === '413102' || val === '413133') {
        $('#checkoutCity').value = 'Baramati';
        $('#checkoutState').value = 'Maharashtra';
      } else if (val === '411001') {
        $('#checkoutCity').value = 'Pune';
        $('#checkoutState').value = 'Maharashtra';
      } else if (val === '400001') {
        $('#checkoutCity').value = 'Mumbai';
        $('#checkoutState').value = 'Maharashtra';
      }
    });
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

  /* ---------- wire events ---------- */
  function wire() {
    // Top notice code copy
    const noticeCode = $('#copyNoticeCode');
    if (noticeCode) noticeCode.addEventListener('click', () => copyText('OGFIRST10', 'Coupon code OGFIRST10 copied!'));

    // Global delegation
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
      const closeQv = e.target.closest('[data-close-qv]');
      if (closeQv) closeQuickView();
      const openTarget = e.target.closest('[data-open]');
      if (openTarget) { e.preventDefault(); openTrack(); }

      const a = e.target.closest('a[href^="#"]');
      if (a && !a.dataset.closeSheets && !a.dataset.closeSearch && !a.dataset.open && !a.getAttribute('href').startsWith('#/product/')) {
        const href = a.getAttribute('href');
        if (href === '#top' || /^#[a-zA-Z][\w-]*$/.test(href)) {
          const el = document.querySelector(href);
          if (el) {
            e.preventDefault();
            closeMenu();
            if (location.hash !== href) history.replaceState(null, '', href);
            route();
            scrollTo(href, false);
          }
        }
      }

      // Quick coupon apply
      const couponChip = e.target.closest('[data-apply-code]');
      if (couponChip) {
        const code = couponChip.dataset.applyCode;
        if (code) {
          $('#promoInput').value = code;
          $('#promoForm').dispatchEvent(new Event('submit', { cancelable: true }));
        }
      }

      // Search trend tags
      const trendTag = e.target.closest('[data-search-term]');
      if (trendTag) {
        const term = trendTag.dataset.searchTerm;
        $('#searchInput').value = term;
        renderSearchResults(term);
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

    // Header buttons
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

    // Shop Toolbar filters
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
      searchTimer = setTimeout(() => {
        store.search = v;
        renderGrid();
      }, 200);
    });
    $('#catalogSearchClear').addEventListener('click', () => {
      clearTimeout(searchTimer);
      searchTimer = null;
      store.search = '';
      $('#catalogSearch').value = '';
      renderGrid();
    });

    // Secondary filters
    $('#filterInStock').addEventListener('click', () => {
      store.inStockOnly = !store.inStockOnly;
      renderGrid();
    });
    const filterBestseller = $('#filterBestseller');
    if (filterBestseller) filterBestseller.addEventListener('click', () => {
      store.bestsellerOnly = !store.bestsellerOnly;
      renderGrid();
    });
    const filterNew = $('#filterNew');
    if (filterNew) filterNew.addEventListener('click', () => {
      store.newOnly = !store.newOnly;
      renderGrid();
    });
    $('#openSizeGuideBtn').addEventListener('click', () => openSizeGuide('Shirts'));

    $('#emptyReset').addEventListener('click', () => {
      if (store.loadFailed) {
        loadProducts();
        return;
      }
      store.search = '';
      store.category = 'all';
      store.sort = 'featured';
      store.inStockOnly = false;
      store.bestsellerOnly = false;
      store.newOnly = false;
      renderGrid();
    });

    // Grid item interactions delegation
    document.addEventListener('click', (e) => {
      const saveBtn = e.target.closest('[data-save]');
      if (saveBtn) { toggleSave(saveBtn.dataset.save); return; }
      const unlock = e.target.closest('[data-unsave]');
      if (unlock) { toggleSave(unlock.dataset.unsave); updateWishlistUI(); return; }
      const qvBtn = e.target.closest('[data-quickview]');
      if (qvBtn) { openQuickView(qvBtn.dataset.quickview); return; }
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
      if (rem) { removeLine(rem.dataset.remove, rem.dataset.size); toast('Removed from your bag'); return; }
    });

    // Promo application
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
        toast(`Code ${res.code} applied!`, 'good');
      } else {
        toast((res && res.error) || 'Invalid promo code', 'bad');
      }
    });
    $('#promoApplied').addEventListener('click', (e) => {
      if (e.target.id !== 'promoClear') return;
      store.promo = null;
      save(LS.promo, null);
      updateCartUI();
      toast('Promo code removed');
    });

    // Quick View
    $('#quickViewClose').addEventListener('click', closeQuickView);
    $('#quickViewOverlay').addEventListener('click', closeQuickView);

    // Size Guide
    $('#sizeGuideClose').addEventListener('click', closeSizeGuide);
    $('#sizeGuideOverlay').addEventListener('click', closeSizeGuide);
    $('#sgTabs').addEventListener('click', (e) => {
      const tab = e.target.closest('[data-sg-cat]');
      if (!tab) return;
      store.sgCategory = tab.dataset.sgCat;
      renderSizeTable();
    });
    $('#unitInches').addEventListener('click', () => { store.sgUnit = 'inches'; renderSizeTable(); });
    $('#unitCm').addEventListener('click', () => { store.sgUnit = 'cm'; renderSizeTable(); });
    $('#footerSizeLink').addEventListener('click', (e) => { e.preventDefault(); openSizeGuide('Shirts'); });
    const menuSg = $('#menuSizeGuide');
    if (menuSg) menuSg.addEventListener('click', (e) => { e.preventDefault(); closeMenu(); openSizeGuide('Shirts'); });

    // Checkout
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
    setupPincodeAutofill();

    // Confirmation & Receipt
    $('#confirmClose').addEventListener('click', closeConfirm);
    $('#confirmOverlay').addEventListener('click', closeConfirm);
    $('#printReceiptBtn').addEventListener('click', () => window.print());
    $('#trackNowBtn').addEventListener('click', () => {
      const id = lastOrder && lastOrder.orderId;
      closeConfirm();
      openTrack(id);
    });

    // Tracking
    $('#trackForm').addEventListener('submit', (e) => {
      e.preventDefault();
      findOrder($('#trackInput').value);
    });
    $('#trackClose').addEventListener('click', closeTrack);
    $('#trackOverlay').addEventListener('click', closeTrack);
    $('#storeTrackBtn').addEventListener('click', () => openTrack());

    // Lightbox
    $('#lightboxClose').addEventListener('click', closeLightbox);
    $('#lightbox').addEventListener('click', (e) => { if (e.target.id === 'lightbox') closeLightbox(); });

    // Newsletter
    $('#newsletterForm').addEventListener('submit', subscribe);

    // Instagram reels: keep the local thumbnail until the visitor asks for the
    // video, then swap in Instagram's embed. No embed script, no request until click.
    $('#reelsGrid').addEventListener('click', (e) => {
      const card = e.target.closest('[data-reel]');
      if (!card) return;
      const frame = document.createElement('iframe');
      frame.className = 'reel-frame';
      frame.src = 'https://www.instagram.com/reel/' + card.dataset.reel + '/embed/';
      frame.title = card.getAttribute('aria-label') || 'Instagram reel';
      frame.loading = 'lazy';
      frame.allow = 'autoplay; encrypted-media; picture-in-picture';
      frame.allowFullscreen = true;
      frame.setAttribute('scrolling', 'no');
      card.replaceWith(frame);
    });

    // Reels arrows: the strip is a hidden-scroll row, so give the mouse a way in.
    const reelsStep = () => {
      const first = $('#reelsGrid').firstElementChild;
      return first ? first.getBoundingClientRect().width + 12 : 220;
    };
    $('#reelsPrev').addEventListener('click', () => $('#reelsGrid').scrollBy({ left: -reelsStep(), behavior: REDUCED ? 'auto' : 'smooth' }));
    $('#reelsNext').addEventListener('click', () => $('#reelsGrid').scrollBy({ left: reelsStep(), behavior: REDUCED ? 'auto' : 'smooth' }));

    // Rail View actions
    $('#railView').addEventListener('click', () => {
      const p = store.rail[store.railFocus];
      if (p) location.hash = '#/product/' + encodeURIComponent(p.id);
    });
    $('#railQuickView').addEventListener('click', () => {
      const p = store.rail[store.railFocus];
      if (p) openQuickView(p.id);
    });

    $('#year').textContent = new Date().getFullYear();

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!$('#lightbox').hidden) return closeLightbox();
        if (!$('#quickViewModal').hidden) return closeQuickView();
        if (!$('#sizeGuideModal').hidden) return closeSizeGuide();
        if (!$('#searchOverlay').hidden) return closeSearch();
        if (!$('#trackModal').hidden) return closeTrack();
        if (!$('#confirmModal').hidden) return closeConfirm();
        if (!$('#checkoutModal').hidden) return closeCheckout();
        if (!$('#cartDrawer').hidden) return closeCart();
        if (!$('#wishlistDrawer').hidden) return closeSaved();
        if (!$('#mobileMenu').hidden) return closeMenu();
      }
      if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && !/input|textarea|select/i.test(document.activeElement.tagName)) {
        e.preventDefault();
        openSearch();
      }
      // Arrow keys on 3D rail when rail is in view
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !/input|textarea|select/i.test(document.activeElement.tagName)) {
        const rail = $('#rail');
        if (rail) {
          const rect = rail.getBoundingClientRect();
          if (rect.top <= window.innerHeight && rect.bottom >= 0) {
            if (e.key === 'ArrowLeft') jumpToRail(store.railFocus - 1);
            else jumpToRail(store.railFocus + 1);
          }
        }
      }
    });
  }

  /* ---------- boot ---------- */
  async function init() {
    initTheme();
    initScroll();
    wire();
    updateStoreStatus();
    updateCartUI();
    updateWishlistUI();
    route();
    if (location.hash) {
      const el = hashEl();
      if (el) setTimeout(() => scrollTo(location.hash, true), 80);
    }
    await loadProducts();
    setupRail();
    onScroll();
    updateCartUI();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
