// API Client for OG Gallery Backend
const API_BASE = window.location.origin;

const API = {
  // Fetch all products with query parameters
  async getProducts(params = {}) {
    const query = new URLSearchParams();
    if (params.category && params.category !== 'all') query.set('category', params.category);
    if (params.search) query.set('search', params.search);
    if (params.sort) query.set('sort', params.sort);
    if (params.badge) query.set('badge', params.badge);
    if (params.minPrice) query.set('minPrice', params.minPrice);
    if (params.maxPrice) query.set('maxPrice', params.maxPrice);

    try {
      const res = await fetch(`${API_BASE}/api/products?${query.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('API error, using client fallback:', err);
      return API.fallbackProducts(params);
    }
  },

  // Fetch product by ID
  async getProductById(id) {
    try {
      const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('API getProductById error, fallback:', err);
      const all = await API.getProducts();
      return (all.products || []).find(p => p.id === id) || null;
    }
  },

  // Validate discount promo code
  async validatePromo(code, subtotal) {
    try {
      const res = await fetch(`${API_BASE}/api/promo/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal })
      });
      return await res.json();
    } catch (err) {
      console.error('Promo validation error:', err);
      // Client-side fallback for offline
      const upper = (code || '').trim().toUpperCase();
      if (upper === 'OGFIRST10') {
        const discountAmount = Math.round((subtotal * 10) / 100);
        return { valid: true, code: 'OGFIRST10', discountAmount, description: '10% off your first order' };
      }
      return { valid: false, error: 'Network error or invalid code' };
    }
  },

  // Create order (Checkout)
  async createOrder(orderPayload) {
    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place order');
      return data;
    } catch (err) {
      console.error('Create order error:', err);
      throw err;
    }
  },

  // Track order by Order ID
  async trackOrder(orderId) {
    try {
      const res = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(orderId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Order not found');
      return data;
    } catch (err) {
      console.error('Track order error:', err);
      throw err;
    }
  },

  // Submit product review
  async addReview(reviewPayload) {
    try {
      const res = await fetch(`${API_BASE}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewPayload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post review');
      return data;
    } catch (err) {
      console.error('Add review error:', err);
      throw err;
    }
  },

  // Subscribe to newsletter
  async subscribeNewsletter(email) {
    try {
      const res = await fetch(`${API_BASE}/api/newsletter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to subscribe');
      return data;
    } catch (err) {
      console.error('Newsletter error:', err);
      throw err;
    }
  },

  // Fallback for when running without active backend
  fallbackProducts(params = {}) {
    const raw = window.__LOCAL_PRODUCTS || [];
    let filtered = [...raw];
    if (params.category && params.category !== 'all') {
      filtered = filtered.filter(p => p.category.toLowerCase() === params.category.toLowerCase());
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }
    if (params.sort === 'low') filtered.sort((a,b) => a.price - b.price);
    if (params.sort === 'high') filtered.sort((a,b) => b.price - a.price);
    if (params.sort === 'rating') filtered.sort((a,b) => (b.rating || 0) - (a.rating || 0));
    return { total: filtered.length, products: filtered };
  }
};

window.API = API;
