/**
 * OG Gallery — Main Interactive Application
 * 3D Scroll, UI/UX, Bag Drawer, Checkout & Backend API Integration
 */

(function () {
  'use strict';

  // Global State
  const state = {
    products: [],
    category: 'all',
    search: '',
    sort: 'featured',
    badge: '',
    viewMode: 'grid', // 'grid' (4-col) or 'focus' (2-col)
    cart: JSON.parse(localStorage.getItem('og_cart') || '[]'),
    wishlist: JSON.parse(localStorage.getItem('og_wishlist') || '[]'),
    appliedPromo: JSON.parse(localStorage.getItem('og_promo') || 'null'),
    activeProduct: null,
    isLoading: true
  };

  const FREE_SHIPPING_THRESHOLD = 2500;

  // DOM Elements
  const DOM = {
    productGrid: document.getElementById('productGrid'),
    productCount: document.getElementById('productCount'),
    cartCount: document.getElementById('cartCount'),
    wishlistCount: document.getElementById('wishlistCount'),
    cartDrawer: document.getElementById('cartDrawer'),
    cartOverlay: document.getElementById('cartOverlay'),
    cartItemsList: document.getElementById('cartItemsList'),
    cartSubtotal: document.getElementById('cartSubtotal'),
    cartDiscount: document.getElementById('cartDiscount'),
    cartShipping: document.getElementById('cartShipping'),
    cartTotal: document.getElementById('cartTotal'),
    shippingProgressBar: document.getElementById('shippingProgressBar'),
    shippingProgressText: document.getElementById('shippingProgressText'),
    promoInput: document.getElementById('promoInput'),
    promoMessage: document.getElementById('promoMessage'),
    applyPromoBtn: document.getElementById('applyPromoBtn'),
    removePromoBtn: document.getElementById('removePromoBtn'),
    appliedPromoTag: document.getElementById('appliedPromoTag'),
    quickViewModal: document.getElementById('quickViewModal'),
    quickViewContent: document.getElementById('quickViewContent'),
    checkoutModal: document.getElementById('checkoutModal'),
    checkoutForm: document.getElementById('checkoutForm'),
    orderConfirmModal: document.getElementById('orderConfirmModal'),
    trackOrderModal: document.getElementById('trackOrderModal'),
    wishlistDrawer: document.getElementById('wishlistDrawer'),
    searchOverlay: document.getElementById('searchOverlay'),
    searchInput: document.getElementById('searchInput'),
    searchResults: document.getElementById('searchResults'),
    toast: document.getElementById('toast'),
    sortSelect: document.getElementById('sortSelect'),
    soundToggleBtn: document.getElementById('soundToggleBtn'),
    viewGridBtn: document.getElementById('viewGridBtn'),
    viewFocusBtn: document.getElementById('viewFocusBtn'),
    menuToggle: document.getElementById('menuToggle'),
    mainNav: document.querySelector('.main-nav')
  };

  // Sound helper
  function playSound(type) {
    if (window.soundFX) {
      if (type === 'add') window.soundFX.playAdd();
      else if (type === 'success') window.soundFX.playSuccess();
      else window.soundFX.playClick();
    }
  }

  // Currency Formatter
  function formatPrice(amt) {
    return '₹' + Number(amt || 0).toLocaleString('en-IN');
  }

  // Toast Notification
  let toastTimer;
  function showToast(message, type = 'info') {
    if (!DOM.toast) return;
    DOM.toast.innerHTML = `<span class="toast-spark">✳</span> <span>${message}</span>`;
    DOM.toast.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      DOM.toast.className = 'toast';
    }, 2800);
  }

  // ==================== INITIALIZATION ====================
  async function init() {
    setupEventListeners();
    updateCartUI();
    updateWishlistUI();
    updateSoundUI();
    await fetchProducts();

    // Check URL parameters for direct product or order tracking
    const urlParams = new URLSearchParams(window.location.search);
    const trackId = urlParams.get('track');
    if (trackId) {
      openTrackModal(trackId);
    }
  }

  // ==================== PRODUCTS & FILTERING ====================
  async function fetchProducts() {
    state.isLoading = true;
    renderSkeletons();

    try {
      const data = await API.getProducts({
        category: state.category,
        search: state.search,
        sort: state.sort,
        badge: state.badge
      });

      state.products = data.products || [];
      // Keep local reference for fallback
      if (!window.__LOCAL_PRODUCTS || window.__LOCAL_PRODUCTS.length === 0) {
        window.__LOCAL_PRODUCTS = state.products;
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
      showToast('Connecting to local catalog...', 'warning');
    } finally {
      state.isLoading = false;
      renderProducts();
    }
  }

  function renderSkeletons() {
    if (!DOM.productGrid) return;
    DOM.productGrid.innerHTML = Array(8).fill(0).map(() => `
      <div class="product-card skeleton-card">
        <div class="skeleton-image"></div>
        <div class="skeleton-line" style="width: 70%; margin-top: 12px;"></div>
        <div class="skeleton-line" style="width: 40%; margin-top: 6px;"></div>
      </div>
    `).join('');
  }

  function renderProducts() {
    if (!DOM.productGrid) return;

    if (DOM.productCount) {
      DOM.productCount.textContent = `${state.products.length} PIECES`;
    }

    if (state.products.length === 0) {
      DOM.productGrid.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">✳</span>
          <h3>No matching pieces found</h3>
          <p>Try refining your search keyword or clearing active filters.</p>
          <button class="pill-btn" id="resetFiltersBtn">Reset all filters</button>
        </div>
      `;
      const resetBtn = document.getElementById('resetFiltersBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          state.category = 'all';
          state.search = '';
          state.badge = '';
          state.sort = 'featured';
          document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('active', c.dataset.filter === 'all'));
          if (DOM.sortSelect) DOM.sortSelect.value = 'featured';
          fetchProducts();
        });
      }
      return;
    }

    DOM.productGrid.className = `product-grid ${state.viewMode === 'focus' ? 'view-focus' : 'view-grid'}`;

    DOM.productGrid.innerHTML = state.products.map((item, idx) => {
      const isWishlisted = state.wishlist.includes(item.id);
      const categoryLabel = item.category === 'Slides_Slippers' ? 'Slides' : item.category;
      const isLowStock = item.stock && item.stock <= 5;

      return `
        <article class="product-card" data-id="${item.id}" style="--stagger: ${idx * 0.04}s">
          <div class="product-card-inner">
            <div class="product-image-wrap">
              <img src="${item.image}" alt="${item.name}" loading="lazy" />
              
              <!-- Glare Overlay for 3D Specular Light -->
              <div class="card-glare"></div>

              ${item.badge ? `<span class="product-badge badge-${item.badge.toLowerCase()}">${item.badge}</span>` : ''}
              ${isLowStock ? `<span class="stock-badge">Only ${item.stock} left</span>` : ''}

              <!-- Card Action Overlays -->
              <div class="card-actions">
                <button class="action-btn wishlist-toggle-btn ${isWishlisted ? 'active' : ''}" data-wishlist="${item.id}" aria-label="Save to Wishlist" title="Save to Wishlist">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="${isWishlisted ? '#ef6b45' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                </button>
                <button class="action-btn quick-view-btn" data-quickview="${item.id}" aria-label="Quick View" title="Quick View">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </button>
              </div>

              <button class="quick-add-btn" data-add="${item.id}" aria-label="Add ${item.name} to Bag">
                <span>+ ADD TO BAG</span>
              </button>
            </div>

            <div class="product-info">
              <div class="info-meta">
                <p class="product-category">${categoryLabel}</p>
                <h3 class="product-name">${item.name}</h3>
                <div class="product-rating">
                  <span class="stars">★</span>
                  <span class="rating-val">${item.rating ? item.rating.toFixed(1) : '4.8'}</span>
                  <span class="review-count">(${item.reviewCount || 18})</span>
                </div>
              </div>
              <div class="info-pricing">
                <span class="product-price">${formatPrice(item.price)}</span>
                ${item.originalPrice ? `<span class="original-price">${formatPrice(item.originalPrice)}</span>` : ''}
              </div>
            </div>
          </div>
        </article>
      `;
    }).join('');

    attach3DCardTilt();
  }

  // ==================== 3D CARD TILT WITH SPECULAR GLARE ====================
  function attach3DCardTilt() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.innerWidth < 768) {
      return;
    }

    const cards = document.querySelectorAll('.product-card');
    cards.forEach(card => {
      const inner = card.querySelector('.product-card-inner');
      const glare = card.querySelector('.card-glare');
      if (!inner) return;

      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = -((y - centerY) / centerY) * 12; // tilt max 12 deg
        const rotateY = ((x - centerX) / centerX) * 12;

        inner.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;

        if (glare) {
          const glareX = (x / rect.width) * 100;
          const glareY = (y / rect.height) * 100;
          glare.style.opacity = '0.35';
          glare.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 65%)`;
        }
      });

      card.addEventListener('mouseleave', () => {
        inner.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)';
        if (glare) {
          glare.style.opacity = '0';
        }
      });
    });
  }

  // ==================== BAG (CART) LOGIC ====================
  function addToCart(productId, size = null, quantity = 1) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    // Default size selection if not specified
    const selectedSize = size || (product.sizes && product.sizes.length ? product.sizes[0] : 'Standard');

    const existingIndex = state.cart.findIndex(item => item.id === productId && item.size === selectedSize);
    if (existingIndex > -1) {
      state.cart[existingIndex].quantity += quantity;
    } else {
      state.cart.push({
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
        image: product.image,
        size: selectedSize,
        quantity: quantity
      });
    }

    saveCart();
    updateCartUI();
    playSound('add');
    showToast(`Added ${product.name} (${selectedSize}) to bag`, 'success');

    // Trigger bounce animation on cart button
    const btn = document.getElementById('cartButton');
    if (btn) {
      btn.classList.add('bounce');
      setTimeout(() => btn.classList.remove('bounce'), 400);
    }
  }

  function updateCartQuantity(productId, size, change) {
    const index = state.cart.findIndex(item => item.id === productId && item.size === size);
    if (index === -1) return;

    const newQty = state.cart[index].quantity + change;
    if (newQty <= 0) {
      state.cart.splice(index, 1);
      showToast('Item removed from bag');
    } else {
      state.cart[index].quantity = newQty;
    }

    saveCart();
    updateCartUI();
    playSound('click');
  }

  function removeFromCart(productId, size) {
    state.cart = state.cart.filter(item => !(item.id === productId && item.size === size));
    saveCart();
    updateCartUI();
    playSound('click');
    showToast('Item removed from bag');
  }

  function saveCart() {
    localStorage.setItem('og_cart', JSON.stringify(state.cart));
  }

  function calculateCartTotals() {
    const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    let discount = 0;
    let freeShippingPromo = false;

    if (state.appliedPromo) {
      if (state.appliedPromo.type === 'percentage') {
        discount = Math.round((subtotal * state.appliedPromo.value) / 100);
      } else if (state.appliedPromo.type === 'fixed') {
        discount = Math.min(subtotal, state.appliedPromo.value);
      } else if (state.appliedPromo.type === 'free_shipping') {
        freeShippingPromo = true;
      }
    }

    const qualifyFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD || freeShippingPromo;
    const shipping = subtotal > 0 ? (qualifyFreeShipping ? 0 : 150) : 0;
    const total = Math.max(0, subtotal - discount + shipping);

    return { subtotal, discount, shipping, total, qualifyFreeShipping };
  }

  function updateCartUI() {
    const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    if (DOM.cartCount) DOM.cartCount.textContent = totalItems;

    const { subtotal, discount, shipping, total, qualifyFreeShipping } = calculateCartTotals();

    // Free Shipping Progress
    if (DOM.shippingProgressBar && DOM.shippingProgressText) {
      if (subtotal === 0) {
        DOM.shippingProgressBar.style.width = '0%';
        DOM.shippingProgressText.innerHTML = `Add <b>₹${FREE_SHIPPING_THRESHOLD}</b> for Free Standard Shipping`;
      } else if (qualifyFreeShipping) {
        DOM.shippingProgressBar.style.width = '100%';
        DOM.shippingProgressText.innerHTML = `🎉 <b>You've unlocked FREE Shipping!</b>`;
      } else {
        const remaining = FREE_SHIPPING_THRESHOLD - subtotal;
        const pct = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));
        DOM.shippingProgressBar.style.width = `${pct}%`;
        DOM.shippingProgressText.innerHTML = `Add <b>${formatPrice(remaining)}</b> more to unlock <b>FREE Shipping</b>`;
      }
    }

    // Cart Items Listing
    if (DOM.cartItemsList) {
      if (state.cart.length === 0) {
        DOM.cartItemsList.innerHTML = `
          <div class="cart-empty-message">
            <span class="empty-bag-icon">🛍️</span>
            <h4>Your shopping bag is empty</h4>
            <p>Everyday essentials are waiting for you.</p>
            <button class="pill-btn" id="startShoppingBtn">Explore Collection</button>
          </div>
        `;
        const startBtn = document.getElementById('startShoppingBtn');
        if (startBtn) {
          startBtn.addEventListener('click', () => {
            closeCartDrawer();
            const shopSec = document.getElementById('shop');
            if (shopSec) shopSec.scrollIntoView({ behavior: 'smooth' });
          });
        }
      } else {
        DOM.cartItemsList.innerHTML = state.cart.map(item => `
          <div class="cart-item">
            <div class="cart-item-image">
              <img src="${item.image}" alt="${item.name}" />
            </div>
            <div class="cart-item-details">
              <div class="cart-item-header">
                <div>
                  <h4 class="cart-item-title">${item.name}</h4>
                  <span class="cart-item-size">Size: ${item.size}</span>
                </div>
                <button class="cart-item-remove" data-remove-id="${item.id}" data-remove-size="${item.size}" aria-label="Remove item">✕</button>
              </div>
              <div class="cart-item-footer">
                <div class="quantity-stepper">
                  <button class="qty-btn" data-step="-1" data-id="${item.id}" data-size="${item.size}" aria-label="Decrease quantity">-</button>
                  <span class="qty-display">${item.quantity}</span>
                  <button class="qty-btn" data-step="1" data-id="${item.id}" data-size="${item.size}" aria-label="Increase quantity">+</button>
                </div>
                <span class="cart-item-price">${formatPrice(item.price * item.quantity)}</span>
              </div>
            </div>
          </div>
        `).join('');
      }
    }

    // Pricing Breakdown
    if (DOM.cartSubtotal) DOM.cartSubtotal.textContent = formatPrice(subtotal);
    if (DOM.cartDiscount) {
      DOM.cartDiscount.textContent = discount > 0 ? `-${formatPrice(discount)}` : '₹0';
      DOM.cartDiscount.parentElement.style.display = discount > 0 ? 'flex' : 'none';
    }
    if (DOM.cartShipping) {
      DOM.cartShipping.textContent = subtotal > 0 ? (shipping === 0 ? 'FREE' : formatPrice(shipping)) : '₹0';
      if (shipping === 0 && subtotal > 0) DOM.cartShipping.className = 'free-badge';
      else DOM.cartShipping.className = '';
    }
    if (DOM.cartTotal) DOM.cartTotal.textContent = formatPrice(total);

    // Promo UI
    if (DOM.appliedPromoTag) {
      if (state.appliedPromo) {
        DOM.appliedPromoTag.style.display = 'inline-flex';
        DOM.appliedPromoTag.innerHTML = `
          <span>🏷️ ${state.appliedPromo.code} (${state.appliedPromo.description})</span>
          <button id="clearPromoBtn" aria-label="Remove promo">✕</button>
        `;
        const clearBtn = document.getElementById('clearPromoBtn');
        if (clearBtn) {
          clearBtn.addEventListener('click', () => {
            state.appliedPromo = null;
            localStorage.removeItem('og_promo');
            updateCartUI();
            showToast('Promo code removed');
          });
        }
      } else {
        DOM.appliedPromoTag.style.display = 'none';
      }
    }

    const checkoutBtn = document.getElementById('proceedCheckoutBtn');
    if (checkoutBtn) {
      checkoutBtn.disabled = state.cart.length === 0;
    }
  }

  function openCartDrawer() {
    if (!DOM.cartDrawer || !DOM.cartOverlay) return;
    DOM.cartDrawer.classList.add('open');
    DOM.cartOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    playSound('click');
  }

  function closeCartDrawer() {
    if (!DOM.cartDrawer || !DOM.cartOverlay) return;
    DOM.cartDrawer.classList.remove('open');
    DOM.cartOverlay.classList.remove('open');
    document.body.style.overflow = '';
    playSound('click');
  }

  // ==================== PROMO CODE APPLICATION ====================
  async function applyPromoCode(code) {
    if (!code || !code.trim()) {
      showToast('Please enter a coupon code', 'warning');
      return;
    }

    const { subtotal } = calculateCartTotals();
    if (subtotal === 0) {
      showToast('Add items to your bag before applying codes', 'warning');
      return;
    }

    try {
      const res = await API.validatePromo(code, subtotal);
      if (res.valid) {
        state.appliedPromo = res;
        localStorage.setItem('og_promo', JSON.stringify(res));
        updateCartUI();
        playSound('success');
        showToast(`Promo ${res.code} applied! Saved ${formatPrice(res.discountAmount)}`, 'success');
        if (DOM.promoInput) DOM.promoInput.value = '';
      } else {
        playSound('click');
        showToast(res.error || 'Invalid promo code', 'error');
      }
    } catch (err) {
      showToast('Failed to validate promo code', 'error');
    }
  }

  // ==================== WISHLIST LOGIC ====================
  function toggleWishlist(productId) {
    const idx = state.wishlist.indexOf(productId);
    if (idx > -1) {
      state.wishlist.splice(idx, 1);
      showToast('Removed from saved pieces');
    } else {
      state.wishlist.push(productId);
      playSound('add');
      showToast('Saved to your wishlist ✳', 'success');
    }
    localStorage.setItem('og_wishlist', JSON.stringify(state.wishlist));
    updateWishlistUI();
    renderProducts();
  }

  function updateWishlistUI() {
    if (DOM.wishlistCount) {
      DOM.wishlistCount.textContent = state.wishlist.length;
      DOM.wishlistCount.style.display = state.wishlist.length > 0 ? 'inline-block' : 'none';
    }

    const listContainer = document.getElementById('wishlistItemsList');
    if (!listContainer) return;

    if (state.wishlist.length === 0) {
      listContainer.innerHTML = `
        <div class="cart-empty-message">
          <span class="empty-bag-icon">♡</span>
          <h4>Your wishlist is waiting</h4>
          <p>Tap the heart on pieces you want to keep an eye on.</p>
        </div>
      `;
    } else {
      const savedProducts = state.products.filter(p => state.wishlist.includes(p.id));
      listContainer.innerHTML = savedProducts.map(item => `
        <div class="cart-item">
          <div class="cart-item-image">
            <img src="${item.image}" alt="${item.name}" />
          </div>
          <div class="cart-item-details">
            <div class="cart-item-header">
              <div>
                <h4 class="cart-item-title">${item.name}</h4>
                <span class="cart-item-size">${formatPrice(item.price)}</span>
              </div>
              <button class="cart-item-remove" data-unwish="${item.id}">✕</button>
            </div>
            <div class="cart-item-footer" style="margin-top: 10px;">
              <button class="pill-btn-small" data-wish-to-bag="${item.id}">Move to Bag</button>
            </div>
          </div>
        </div>
      `).join('');
    }
  }

  function openWishlistDrawer() {
    if (!DOM.wishlistDrawer || !DOM.cartOverlay) return;
    updateWishlistUI();
    DOM.wishlistDrawer.classList.add('open');
    DOM.cartOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    playSound('click');
  }

  function closeWishlistDrawer() {
    if (!DOM.wishlistDrawer || !DOM.cartOverlay) return;
    DOM.wishlistDrawer.classList.remove('open');
    DOM.cartOverlay.classList.remove('open');
    document.body.style.overflow = '';
    playSound('click');
  }

  // ==================== QUICK VIEW MODAL ====================
  async function openQuickView(productId) {
    playSound('click');
    const product = state.products.find(p => p.id === productId);
    if (!product || !DOM.quickViewModal || !DOM.quickViewContent) return;

    state.activeProduct = product;
    DOM.quickViewContent.innerHTML = `
      <div class="quick-view-grid">
        <div class="quick-view-gallery">
          <div class="quick-view-main-img-wrap" id="zoomWrap">
            <img id="quickViewImg" src="${product.image}" alt="${product.name}" />
            <div class="zoom-lens" id="zoomLens"></div>
          </div>
          <div class="quick-view-badges">
            ${product.badge ? `<span class="product-badge badge-${product.badge.toLowerCase()}">${product.badge}</span>` : ''}
            <span class="stock-pill">${product.stock > 0 ? `In Stock (${product.stock} units)` : 'Made to Order'}</span>
          </div>
        </div>
        <div class="quick-view-info">
          <p class="eyebrow">OG GALLERY / ${product.category.toUpperCase()}</p>
          <h2 class="qv-title">${product.name}</h2>
          <div class="qv-pricing">
            <span class="qv-price">${formatPrice(product.price)}</span>
            ${product.originalPrice ? `<span class="qv-original">${formatPrice(product.originalPrice)}</span>` : ''}
            <span class="tax-tag">Inclusive of all taxes</span>
          </div>
          
          <p class="qv-desc">${product.description || 'Crafted with premium materials and designed to be worn on repeat.'}</p>
          
          <div class="qv-section">
            <div class="qv-section-header">
              <label>Select Size</label>
              <button type="button" class="text-link-btn" id="sizeGuideBtn">Size Guide</button>
            </div>
            <div class="size-selector" id="sizeSelector">
              ${(product.sizes || ['S', 'M', 'L', 'XL']).map((size, idx) => `
                <button type="button" class="size-chip ${idx === 0 ? 'selected' : ''}" data-size="${size}">${size}</button>
              `).join('')}
            </div>
          </div>

          <div class="qv-section">
            <label>Quantity</label>
            <div class="quantity-stepper qv-qty">
              <button type="button" id="qvQtyMinus">-</button>
              <span id="qvQtyVal">1</span>
              <button type="button" id="qvQtyPlus">+</button>
            </div>
          </div>

          <div class="qv-actions">
            <button class="pill-btn qv-add-btn" id="qvAddToCartBtn">
              <span>Add to Bag</span> • <span id="qvAddPrice">${formatPrice(product.price)}</span>
            </button>
            <button class="icon-btn-large" id="qvWishlistBtn" aria-label="Save to Wishlist">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="${state.wishlist.includes(product.id) ? '#ef6b45' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
          </div>

          <!-- Product Details Tabs -->
          <div class="qv-tabs">
            <details open>
              <summary>Fabric & Care</summary>
              <p><b>Material:</b> ${product.material || '100% Premium Cotton'}</p>
              <p><b>Care:</b> ${product.care || 'Machine wash cold with like colors.'}</p>
            </details>
            <details>
              <summary>Shipping & Returns</summary>
              <p>Free express delivery on orders over ₹2,500. Standard delivery in 3-5 business days. Hassle-free 7-day exchanges.</p>
            </details>
            <details id="qvReviewsDetails">
              <summary>Customer Reviews (${product.reviewCount || 0})</summary>
              <div id="qvReviewsList">Loading verified reviews...</div>
              <form id="addReviewForm" class="review-form">
                <h4>Share your fit experience</h4>
                <div class="form-row">
                  <input type="text" id="reviewAuthor" placeholder="Your name" required />
                  <select id="reviewRating">
                    <option value="5">★★★★★ (5/5)</option>
                    <option value="4">★★★★☆ (4/5)</option>
                    <option value="3">★★★☆☆ (3/5)</option>
                  </select>
                </div>
                <textarea id="reviewText" placeholder="How does it fit? Comfort and quality review..." rows="3" required></textarea>
                <button type="submit" class="pill-btn-small">Submit Review</button>
              </form>
            </details>
          </div>
        </div>
      </div>
    `;

    DOM.quickViewModal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Interactive Size selection
    let selectedSize = (product.sizes && product.sizes[0]) || 'M';
    let qty = 1;
    const sizeChips = DOM.quickViewContent.querySelectorAll('.size-chip');
    sizeChips.forEach(chip => {
      chip.addEventListener('click', () => {
        sizeChips.forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        selectedSize = chip.dataset.size;
        playSound('click');
      });
    });

    // Quantity buttons
    const qtyVal = document.getElementById('qvQtyVal');
    const addPrice = document.getElementById('qvAddPrice');
    document.getElementById('qvQtyMinus').addEventListener('click', () => {
      if (qty > 1) {
        qty--;
        qtyVal.textContent = qty;
        addPrice.textContent = formatPrice(product.price * qty);
        playSound('click');
      }
    });
    document.getElementById('qvQtyPlus').addEventListener('click', () => {
      if (qty < 10) {
        qty++;
        qtyVal.textContent = qty;
        addPrice.textContent = formatPrice(product.price * qty);
        playSound('click');
      }
    });

    // Add to Cart from Quick View
    document.getElementById('qvAddToCartBtn').addEventListener('click', () => {
      addToCart(product.id, selectedSize, qty);
      closeQuickView();
      openCartDrawer();
    });

    // Wishlist Toggle
    const qvWishBtn = document.getElementById('qvWishlistBtn');
    qvWishBtn.addEventListener('click', () => {
      toggleWishlist(product.id);
      const isSaved = state.wishlist.includes(product.id);
      qvWishBtn.querySelector('svg').setAttribute('fill', isSaved ? '#ef6b45' : 'none');
    });

    // Size Guide modal prompt
    document.getElementById('sizeGuideBtn').addEventListener('click', () => {
      showToast('Standard true to size cut. For an oversized boxy streetwear silhouette, size up one step.');
    });

    // Load Reviews
    loadProductReviews(product.id);

    // Review Form Submission
    const reviewForm = document.getElementById('addReviewForm');
    if (reviewForm) {
      reviewForm.addEventListener('submit', async e => {
        e.preventDefault();
        const author = document.getElementById('reviewAuthor').value.trim();
        const rating = Number(document.getElementById('reviewRating').value);
        const comment = document.getElementById('reviewText').value.trim();

        try {
          await API.addReview({ productId: product.id, author, rating, comment });
          showToast('Thank you! Your review has been published.', 'success');
          reviewForm.reset();
          loadProductReviews(product.id);
        } catch (err) {
          showToast('Failed to post review. Please try again.', 'error');
        }
      });
    }
  }

  async function loadProductReviews(productId) {
    const list = document.getElementById('qvReviewsList');
    if (!list) return;

    try {
      const res = await API.getProductById(productId);
      const reviews = (res && res.reviews) || [];
      if (reviews.length === 0) {
        list.innerHTML = '<p class="muted-note">No reviews yet. Be the first to review this piece!</p>';
      } else {
        list.innerHTML = reviews.map(r => `
          <div class="review-item">
            <div class="review-header">
              <span class="review-stars">${'★'.repeat(r.rating)}</span>
              <span class="review-author">${r.author} ${r.verified ? '<span class="verified-tag">✓ Verified Buyer</span>' : ''}</span>
              <span class="review-date">${r.date}</span>
            </div>
            <p class="review-text">${r.comment}</p>
          </div>
        `).join('');
      }
    } catch (err) {
      list.innerHTML = '<p class="muted-note">Verified OG customer feedback available in-store.</p>';
    }
  }

  function closeQuickView() {
    if (!DOM.quickViewModal) return;
    DOM.quickViewModal.classList.remove('open');
    document.body.style.overflow = '';
    state.activeProduct = null;
    playSound('click');
  }

  // ==================== CHECKOUT FLOW ====================
  function openCheckout() {
    if (state.cart.length === 0) {
      showToast('Your bag is empty!', 'warning');
      return;
    }
    closeCartDrawer();
    const { subtotal, discount, shipping, total } = calculateCartTotals();

    // Populate checkout summary
    const summaryItems = document.getElementById('checkoutSummaryItems');
    if (summaryItems) {
      summaryItems.innerHTML = state.cart.map(item => `
        <div class="checkout-summary-row">
          <span>${item.name} (${item.size}) × ${item.quantity}</span>
          <b>${formatPrice(item.price * item.quantity)}</b>
        </div>
      `).join('');
    }

    document.getElementById('checkoutSummarySubtotal').textContent = formatPrice(subtotal);
    document.getElementById('checkoutSummaryDiscount').textContent = discount > 0 ? `-${formatPrice(discount)}` : '₹0';
    document.getElementById('checkoutSummaryShipping').textContent = shipping === 0 ? 'FREE' : formatPrice(shipping);
    document.getElementById('checkoutSummaryTotal').textContent = formatPrice(total);

    if (DOM.checkoutModal) {
      DOM.checkoutModal.classList.add('open');
      document.body.style.overflow = 'hidden';
      playSound('click');
    }
  }

  function closeCheckout() {
    if (DOM.checkoutModal) {
      DOM.checkoutModal.classList.remove('open');
      document.body.style.overflow = '';
      playSound('click');
    }
  }

  async function handleCheckoutSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('placeOrderBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Processing Order...</span>';

    const customer = {
      name: document.getElementById('checkoutName').value,
      email: document.getElementById('checkoutEmail').value,
      phone: document.getElementById('checkoutPhone').value
    };

    const shipping = {
      address: document.getElementById('checkoutAddress').value,
      city: document.getElementById('checkoutCity').value,
      state: document.getElementById('checkoutState').value,
      pincode: document.getElementById('checkoutPincode').value
    };

    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'Cash on Delivery';

    const orderPayload = {
      customer,
      shipping,
      items: state.cart,
      paymentMethod,
      promoCode: state.appliedPromo ? state.appliedPromo.code : null
    };

    try {
      const result = await API.createOrder(orderPayload);
      if (result.success && result.order) {
        // Clear Bag
        state.cart = [];
        state.appliedPromo = null;
        saveCart();
        localStorage.removeItem('og_promo');
        updateCartUI();

        closeCheckout();
        openOrderConfirmation(result.order);
        playSound('success');
      } else {
        throw new Error(result.error || 'Checkout failed');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      showToast(err.message || 'Error processing order. Please check your information.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Confirm & Place Order</span> <span>→</span>';
    }
  }

  function openOrderConfirmation(order) {
    if (!DOM.orderConfirmModal) return;
    document.getElementById('confirmOrderId').textContent = order.orderId;
    document.getElementById('confirmCustomerName').textContent = order.customer.name;
    document.getElementById('confirmAddress').textContent = `${order.shipping.address}, ${order.shipping.city} - ${order.shipping.pincode}`;
    document.getElementById('confirmTotal').textContent = formatPrice(order.pricing.total);
    document.getElementById('confirmPayment').textContent = order.paymentMethod;
    document.getElementById('confirmDeliveryDate').textContent = order.estimatedDelivery;

    DOM.orderConfirmModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeOrderConfirmation() {
    if (!DOM.orderConfirmModal) return;
    DOM.orderConfirmModal.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ==================== ORDER TRACKING MODAL ====================
  function openTrackModal(orderId = '') {
    if (!DOM.trackOrderModal) return;
    const input = document.getElementById('trackOrderInput');
    if (input && orderId) input.value = orderId;
    DOM.trackOrderModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    playSound('click');

    if (orderId) {
      trackOrderById(orderId);
    }
  }

  function closeTrackModal() {
    if (!DOM.trackOrderModal) return;
    DOM.trackOrderModal.classList.remove('open');
    document.body.style.overflow = '';
    playSound('click');
  }

  async function trackOrderById(orderId) {
    const statusBox = document.getElementById('trackOrderStatus');
    if (!statusBox) return;

    statusBox.innerHTML = '<div class="loading-spinner"></div><p>Querying fulfillment network...</p>';

    try {
      const order = await API.trackOrder(orderId);
      statusBox.innerHTML = `
        <div class="track-result-card">
          <div class="track-header">
            <div>
              <span class="order-badge">ORDER #${order.orderId}</span>
              <h3>${order.status}</h3>
            </div>
            <div class="track-est">
              <span>Estimated Delivery</span>
              <b>${order.estimatedDelivery}</b>
            </div>
          </div>

          <!-- 5-stage tracking timeline -->
          <div class="tracking-timeline">
            ${(order.timeline || []).map(step => `
              <div class="timeline-step ${step.done ? 'completed' : 'pending'}">
                <div class="step-marker"></div>
                <div class="step-content">
                  <div class="step-title-row">
                    <b>${step.status}</b>
                    <small>${step.time}</small>
                  </div>
                  <p>${step.detail}</p>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="track-items-summary">
            <h4>Ordered Items</h4>
            ${order.items.map(item => `
              <div class="track-item-row">
                <span>${item.name} (${item.size}) × ${item.quantity}</span>
                <b>${formatPrice(item.price * item.quantity)}</b>
              </div>
            `).join('')}
            <div class="track-item-row total-row">
              <span>Grand Total</span>
              <b>${formatPrice(order.pricing.total)}</b>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      statusBox.innerHTML = `
        <div class="track-error">
          <span class="warning-icon">⚠️</span>
          <h4>Order Not Found</h4>
          <p>${err.message || 'Please check that you entered the correct Order ID (e.g. OG-78419).'}</p>
        </div>
      `;
    }
  }

  // ==================== SEARCH OVERLAY ====================
  function openSearch() {
    if (!DOM.searchOverlay || !DOM.searchInput) return;
    DOM.searchOverlay.classList.add('open');
    DOM.searchInput.value = '';
    DOM.searchInput.focus();
    renderLiveSearchResults('');
    document.body.style.overflow = 'hidden';
    playSound('click');
  }

  function closeSearch() {
    if (!DOM.searchOverlay) return;
    DOM.searchOverlay.classList.remove('open');
    document.body.style.overflow = '';
    playSound('click');
  }

  function renderLiveSearchResults(keyword) {
    if (!DOM.searchResults) return;
    const q = (keyword || '').toLowerCase().trim();

    const matches = q === '' 
      ? state.products.slice(0, 6)
      : state.products.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));

    if (matches.length === 0) {
      DOM.searchResults.innerHTML = `
        <div class="no-search-results">
          <p>No results found for "${keyword}".</p>
        </div>
      `;
      return;
    }

    DOM.searchResults.innerHTML = `
      <p class="search-results-heading">${q === '' ? 'Popular Styles' : `Found ${matches.length} matches`}</p>
      <div class="search-results-grid">
        ${matches.map(item => `
          <div class="search-result-item" data-search-id="${item.id}">
            <img src="${item.image}" alt="${item.name}" />
            <div>
              <h4>${item.name}</h4>
              <p class="res-category">${item.category === 'Slides_Slippers' ? 'Slides' : item.category} • ${formatPrice(item.price)}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    DOM.searchResults.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.searchId;
        closeSearch();
        openQuickView(id);
      });
    });
  }

  // ==================== SOUND UI ====================
  function updateSoundUI() {
    if (!DOM.soundToggleBtn) return;
    const isMuted = !window.soundFX || !window.soundFX.enabled;
    DOM.soundToggleBtn.innerHTML = isMuted 
      ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg><span>Audio Off</span>`
      : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg><span>Audio On</span>`;
    DOM.soundToggleBtn.classList.toggle('active', !isMuted);
  }

  // ==================== EVENT LISTENERS ====================
  function setupEventListeners() {
    // Cart open & close
    const cartBtn = document.getElementById('cartButton');
    if (cartBtn) cartBtn.addEventListener('click', openCartDrawer);

    const closeCartBtn = document.getElementById('closeCartBtn');
    if (closeCartBtn) closeCartBtn.addEventListener('click', closeCartDrawer);

    if (DOM.cartOverlay) {
      DOM.cartOverlay.addEventListener('click', () => {
        closeCartDrawer();
        closeWishlistDrawer();
      });
    }

    // Wishlist open & close
    const wishlistBtn = document.getElementById('wishlistButton');
    if (wishlistBtn) wishlistBtn.addEventListener('click', openWishlistDrawer);

    const closeWishlistBtn = document.getElementById('closeWishlistBtn');
    if (closeWishlistBtn) closeWishlistBtn.addEventListener('click', closeWishlistDrawer);

    // Track order triggers
    const trackOrderLinks = document.querySelectorAll('.track-order-trigger');
    trackOrderLinks.forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        openTrackModal();
      });
    });

    const closeTrackBtn = document.getElementById('closeTrackBtn');
    if (closeTrackBtn) closeTrackBtn.addEventListener('click', closeTrackModal);

    const trackForm = document.getElementById('trackOrderForm');
    if (trackForm) {
      trackForm.addEventListener('submit', e => {
        e.preventDefault();
        const id = document.getElementById('trackOrderInput').value.trim();
        if (id) trackOrderById(id);
      });
    }

    // Search overlay triggers
    const searchToggles = document.querySelectorAll('.search-toggle');
    searchToggles.forEach(btn => btn.addEventListener('click', openSearch));

    const closeSearchBtn = document.getElementById('closeSearchBtn');
    if (closeSearchBtn) closeSearchBtn.addEventListener('click', closeSearch);

    if (DOM.searchInput) {
      DOM.searchInput.addEventListener('input', e => {
        renderLiveSearchResults(e.target.value);
      });
    }

    // Keyboard shortcuts (ESC to close modals, / to open search)
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeCartDrawer();
        closeWishlistDrawer();
        closeQuickView();
        closeCheckout();
        closeOrderConfirmation();
        closeTrackModal();
        closeSearch();
      } else if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        openSearch();
      }
    });

    // Sound toggle
    if (DOM.soundToggleBtn) {
      DOM.soundToggleBtn.addEventListener('click', () => {
        if (window.soundFX) {
          window.soundFX.toggle();
          updateSoundUI();
          showToast(window.soundFX.enabled ? 'Audio feedback enabled' : 'Audio muted');
        }
      });
    }

    // View Mode Switcher (Grid vs Focus)
    if (DOM.viewGridBtn) {
      DOM.viewGridBtn.addEventListener('click', () => {
        state.viewMode = 'grid';
        DOM.viewGridBtn.classList.add('active');
        if (DOM.viewFocusBtn) DOM.viewFocusBtn.classList.remove('active');
        renderProducts();
        playSound('click');
      });
    }
    if (DOM.viewFocusBtn) {
      DOM.viewFocusBtn.addEventListener('click', () => {
        state.viewMode = 'focus';
        DOM.viewFocusBtn.classList.add('active');
        if (DOM.viewGridBtn) DOM.viewGridBtn.classList.remove('active');
        renderProducts();
        playSound('click');
      });
    }

    // Category Filter Chips
    document.querySelectorAll('.filter-chip').forEach(button => {
      button.addEventListener('click', () => {
        state.category = button.dataset.filter;
        document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.toggle('active', chip === button));
        document.querySelectorAll('.main-nav a[data-nav]').forEach(link => link.classList.toggle('selected', link.dataset.nav === state.category));
        playSound('click');
        fetchProducts();
      });
    });

    // Nav Links
    document.querySelectorAll('.main-nav a').forEach(link => {
      link.addEventListener('click', () => {
        if (link.dataset.nav) {
          state.category = link.dataset.nav;
          document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.toggle('active', chip.dataset.filter === state.category));
          document.querySelectorAll('.main-nav a').forEach(item => item.classList.toggle('selected', item === link));
          fetchProducts();
        }
        if (DOM.mainNav) DOM.mainNav.classList.remove('open');
      });
    });

    // Mobile Hamburger
    if (DOM.menuToggle && DOM.mainNav) {
      DOM.menuToggle.addEventListener('click', () => {
        DOM.mainNav.classList.toggle('open');
        playSound('click');
      });
    }

    // Sorting Dropdown
    if (DOM.sortSelect) {
      DOM.sortSelect.addEventListener('change', e => {
        state.sort = e.target.value;
        playSound('click');
        fetchProducts();
      });
    }

    // Grid Delegation for Quick View, Add to Bag & Wishlist
    if (DOM.productGrid) {
      DOM.productGrid.addEventListener('click', e => {
        const addBtn = e.target.closest('[data-add]');
        if (addBtn) {
          e.stopPropagation();
          addToCart(addBtn.dataset.add);
          return;
        }

        const wishBtn = e.target.closest('[data-wishlist]');
        if (wishBtn) {
          e.stopPropagation();
          toggleWishlist(wishBtn.dataset.wishlist);
          return;
        }

        const qvBtn = e.target.closest('[data-quickview]');
        if (qvBtn) {
          e.stopPropagation();
          openQuickView(qvBtn.dataset.quickview);
          return;
        }

        const card = e.target.closest('.product-card');
        if (card && card.dataset.id) {
          openQuickView(card.dataset.id);
        }
      });
    }

    // Cart Items Delegation (stepper, remove)
    if (DOM.cartItemsList) {
      DOM.cartItemsList.addEventListener('click', e => {
        const removeBtn = e.target.closest('[data-remove-id]');
        if (removeBtn) {
          removeFromCart(removeBtn.dataset.removeId, removeBtn.dataset.removeSize);
          return;
        }

        const stepBtn = e.target.closest('[data-step]');
        if (stepBtn) {
          const step = Number(stepBtn.dataset.step);
          updateCartQuantity(stepBtn.dataset.id, stepBtn.dataset.size, step);
          return;
        }
      });
    }

    // Promo Code Application
    if (DOM.applyPromoBtn && DOM.promoInput) {
      DOM.applyPromoBtn.addEventListener('click', () => {
        applyPromoCode(DOM.promoInput.value);
      });
      DOM.promoInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          applyPromoCode(DOM.promoInput.value);
        }
      });
    }

    // Checkout Flow Buttons
    const proceedCheckoutBtn = document.getElementById('proceedCheckoutBtn');
    if (proceedCheckoutBtn) proceedCheckoutBtn.addEventListener('click', openCheckout);

    const closeCheckoutBtn = document.getElementById('closeCheckoutBtn');
    if (closeCheckoutBtn) closeCheckoutBtn.addEventListener('click', closeCheckout);

    if (DOM.checkoutForm) {
      DOM.checkoutForm.addEventListener('submit', handleCheckoutSubmit);
    }

    // Order Confirmation Modal Close
    const closeConfirmBtn = document.getElementById('closeConfirmBtn');
    if (closeConfirmBtn) closeConfirmBtn.addEventListener('click', closeOrderConfirmation);

    const trackNewOrderBtn = document.getElementById('trackNewOrderBtn');
    if (trackNewOrderBtn) {
      trackNewOrderBtn.addEventListener('click', () => {
        const id = document.getElementById('confirmOrderId').textContent;
        closeOrderConfirmation();
        openTrackModal(id);
      });
    }

    // Wishlist Drawer Delegation
    const wishListContainer = document.getElementById('wishlistItemsList');
    if (wishListContainer) {
      wishListContainer.addEventListener('click', e => {
        const unwishBtn = e.target.closest('[data-unwish]');
        if (unwishBtn) {
          toggleWishlist(unwishBtn.dataset.unwish);
          return;
        }

        const moveBtn = e.target.closest('[data-wish-to-bag]');
        if (moveBtn) {
          const id = moveBtn.dataset.wishToBag;
          addToCart(id);
          toggleWishlist(id);
          closeWishlistDrawer();
          openCartDrawer();
          return;
        }
      });
    }

    // Quick View Modal Close
    const closeQvBtn = document.getElementById('closeQuickViewBtn');
    if (closeQvBtn) closeQvBtn.addEventListener('click', closeQuickView);

    if (DOM.quickViewModal) {
      DOM.quickViewModal.addEventListener('click', e => {
        if (e.target === DOM.quickViewModal) closeQuickView();
      });
    }

    // Newsletter Form
    const newsletterForm = document.getElementById('newsletterForm');
    if (newsletterForm) {
      newsletterForm.addEventListener('submit', async e => {
        e.preventDefault();
        const input = document.getElementById('emailInput');
        const email = input.value.trim();
        const msgEl = document.getElementById('newsletterMessage');

        try {
          const res = await API.subscribeNewsletter(email);
          playSound('success');
          showToast(res.message, 'success');
          if (msgEl) msgEl.textContent = 'Welcome to the OG Gallery community ✳';
          input.value = '';
        } catch (err) {
          showToast(err.message || 'Error subscribing. Please try again.', 'error');
        }
      });
    }

    // Hero 3D Stage Interactive Parallax
    const heroStage = document.getElementById('heroStage');
    if (heroStage) {
      heroStage.addEventListener('pointermove', e => {
        if (window.innerWidth < 768) return;
        const rect = heroStage.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        heroStage.style.transform = `perspective(1000px) rotateY(${x * 14}deg) rotateX(${-y * 10}deg)`;
      });
      heroStage.addEventListener('pointerleave', () => {
        heroStage.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg)';
      });
    }
  }

  // Start app
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
