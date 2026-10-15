const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// No CORS: the shop is served from this same origin, so other sites
// should not be able to post orders from your visitors' browsers.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper to safely read and write JSON files
const DATA_DIR = path.join(__dirname, 'data');
function readJson(filename, defaultValue = []) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
    return defaultValue;
  }
}

function writeJson(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filename}:`, err);
    return false;
  }
}

// Serve Three.js build files (copied into public/vendor so Vercel serves them too)
app.use('/vendor/three', express.static(path.join(__dirname, 'public', 'vendor', 'three')));

// Serve static assets. Only public/ is exposed plus an explicit allow-list of
// root files — data/, node_modules/ and server.js are never web-reachable.
app.use('/public', express.static(path.join(__dirname, 'public')));
for (const file of ['styles.css', 'favicon.svg', 'robots.txt']) {
  app.get('/' + file, (req, res) => res.sendFile(path.join(__dirname, file)));
}

// ---------------- API ROUTES ----------------

// Health & System Info
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    store: 'OG Gallery',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Categories summary
app.get('/api/categories', (req, res) => {
  const products = readJson('products.json', []);
  const categories = {};
  products.forEach(p => {
    if (!categories[p.category]) {
      categories[p.category] = { count: 0, minPrice: p.price, maxPrice: p.price };
    }
    categories[p.category].count += 1;
    categories[p.category].minPrice = Math.min(categories[p.category].minPrice, p.price);
    categories[p.category].maxPrice = Math.max(categories[p.category].maxPrice, p.price);
  });
  res.json({
    totalProducts: products.length,
    categories
  });
});

// Products Listing with Filtering, Search & Sorting
app.get('/api/products', (req, res) => {
  const products = readJson('products.json', []);
  const { category, search, sort, badge, minPrice, maxPrice } = req.query;

  let filtered = [...products];

  if (category && category !== 'all') {
    filtered = filtered.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }

  if (badge) {
    filtered = filtered.filter(p => p.badge && p.badge.toLowerCase() === badge.toLowerCase());
  }

  if (search) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.material && p.material.toLowerCase().includes(q))
    );
  }

  if (minPrice) {
    filtered = filtered.filter(p => p.price >= Number(minPrice));
  }
  if (maxPrice) {
    filtered = filtered.filter(p => p.price <= Number(maxPrice));
  }

  if (sort === 'low') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sort === 'high') {
    filtered.sort((a, b) => b.price - a.price);
  } else if (sort === 'rating') {
    filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (sort === 'new') {
    filtered.sort((a, b) => (b.badge === 'New' ? 1 : 0) - (a.badge === 'New' ? 1 : 0));
  }

  res.json({
    total: filtered.length,
    products: filtered
  });
});

// Single Product Details + Related Products
app.get('/api/products/:id', (req, res) => {
  const products = readJson('products.json', []);
  const product = products.find(p => p.id === req.params.id);

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const reviewsMap = readJson('reviews.json', {});
  const productReviews = reviewsMap[product.id] || [];

  const related = products
    .filter(p => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  res.json({
    ...product,
    reviews: productReviews,
    related
  });
});

// Promo code validation
app.post('/api/promo/validate', (req, res) => {
  const { code, subtotal } = req.body || {};
  if (!code) {
    return res.status(400).json({ error: 'Promo code is required' });
  }

  const promos = readJson('promos.json', {});
  const promo = promos[code.trim().toUpperCase()];

  if (!promo) {
    return res.status(404).json({ valid: false, error: 'Invalid promo code' });
  }

  const cartSubtotal = Number(subtotal) || 0;
  if (promo.minOrder && cartSubtotal < promo.minOrder) {
    return res.status(400).json({
      valid: false,
      error: `This code requires a minimum order of ₹${promo.minOrder}`
    });
  }

  let discountAmount = 0;
  if (promo.type === 'percentage') {
    discountAmount = Math.round((cartSubtotal * promo.value) / 100);
  } else if (promo.type === 'fixed') {
    discountAmount = Math.min(cartSubtotal, promo.value);
  } else if (promo.type === 'free_shipping') {
    discountAmount = 0; // handled in shipping logic
  }

  res.json({
    valid: true,
    code: promo.code,
    type: promo.type,
    value: promo.value,
    discountAmount,
    description: promo.description
  });
});

// Place Order
app.post('/api/orders', (req, res) => {
  const { customer, shipping, items, paymentMethod, promoCode } = req.body || {};

  if (!customer || !customer.name || !customer.email || !customer.phone) {
    return res.status(400).json({ error: 'Customer name, email, and phone are required.' });
  }

  if (!shipping || !shipping.address || !shipping.city || !shipping.pincode) {
    return res.status(400).json({ error: 'Complete shipping address is required.' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item.' });
  }

  const products = readJson('products.json', []);
  const orders = readJson('orders.json', []);
  const promos = readJson('promos.json', {});

  // Price every line from our own catalog and refuse anything we cannot
  // sell: unknown products, or more units than we actually hold in stock.
  let subtotal = 0;
  const verifiedItems = [];
  for (const item of items) {
    const catalogItem = products.find(p => p.id === item.id);
    if (!catalogItem) {
      return res.status(400).json({ error: 'That product is no longer in the catalogue.' });
    }

    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    if (quantity > catalogItem.stock) {
      return res.status(400).json({
        error: catalogItem.stock === 0
          ? `${catalogItem.name} is sold out.`
          : `Only ${catalogItem.stock} left of ${catalogItem.name}.`
      });
    }

    subtotal += catalogItem.price * quantity;
    catalogItem.stock -= quantity;

    verifiedItems.push({
      id: catalogItem.id,
      name: catalogItem.name,
      price: catalogItem.price,
      size: item.size || 'Standard',
      quantity,
      image: catalogItem.image
    });
  }

  // Calculate discounts & shipping
  let discount = 0;
  let freeShippingApplied = subtotal >= 2500;
  let appliedPromo = null;

  if (promoCode) {
    const promo = promos[promoCode.trim().toUpperCase()];
    // A code only counts when the cart reaches its minimum spend.
    if (promo && (!promo.minOrder || subtotal >= promo.minOrder)) {
      appliedPromo = promo;
      if (promo.type === 'percentage') {
        discount = Math.round((subtotal * promo.value) / 100);
      } else if (promo.type === 'fixed') {
        discount = Math.min(subtotal, promo.value);
      } else if (promo.type === 'free_shipping') {
        freeShippingApplied = true;
      }
    }
  }

  const shippingFee = freeShippingApplied ? 0 : 150;
  const total = Math.max(0, subtotal - discount + shippingFee);

  // A duplicate ID would send tracking to the wrong order.
  let orderId;
  do {
    orderId = `OG-${Math.floor(10000 + Math.random() * 90000)}`;
  } while (orders.some(o => o.orderId === orderId));
  const now = new Date();
  const estimatedDate = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

  const newOrder = {
    orderId,
    createdAt: now.toISOString(),
    customer: {
      name: customer.name.trim(),
      email: customer.email.trim(),
      phone: customer.phone.trim()
    },
    shipping: {
      address: shipping.address.trim(),
      city: shipping.city.trim(),
      state: shipping.state ? shipping.state.trim() : 'Maharashtra',
      pincode: shipping.pincode.trim()
    },
    items: verifiedItems,
    pricing: {
      subtotal,
      discount,
      promoCode: appliedPromo ? appliedPromo.code : null,
      shipping: shippingFee,
      total
    },
    paymentMethod: paymentMethod || 'Cash on Delivery',
    status: 'Order Placed',
    estimatedDelivery: estimatedDate.toISOString().split('T')[0],
    timeline: [
      {
        status: 'Order Placed',
        time: now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }),
        detail: 'Order received and confirmed',
        done: true
      },
      {
        status: 'Quality Check & Packing',
        time: 'Estimated within 24 hrs',
        detail: 'Inspected at Baramati fulfillment studio',
        done: false
      },
      {
        status: 'In Transit',
        time: 'Pending dispatch',
        detail: 'Handed over to express courier',
        done: false
      },
      {
        status: 'Out for Delivery',
        time: 'Pending',
        detail: 'Delivery agent assigned',
        done: false
      },
      {
        status: 'Delivered',
        time: `Expected by ${estimatedDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`,
        detail: 'Delivered to your doorstep',
        done: false
      }
    ]
  };

  orders.unshift(newOrder);
  writeJson('orders.json', orders);
  writeJson('products.json', products); // persist stock updates

  res.status(201).json({
    success: true,
    message: 'Order placed successfully',
    order: newOrder
  });
});

// Tracking steps advance on their own at 0/25/50/75/100% of the four days
// between the order and its delivery date, so old orders don't sit on "Pending".
const STEP_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];
const STEP_ESTIMATES = ['Estimated within 24 hrs', 'Pending dispatch', 'Pending'];

function stampTimeline(order) {
  const created = Date.parse(order.createdAt);
  if (!Array.isArray(order.timeline) || !Number.isFinite(created)) return order;
  const span = 4 * 24 * 60 * 60 * 1000;
  const f = Math.min(1, Math.max(0, (Date.now() - created) / span));
  order.timeline.forEach((step, i) => {
    const reached = f >= STEP_FRACTIONS[i];
    step.done = reached;
    if (reached) {
      step.time = new Date(created + STEP_FRACTIONS[i] * span).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short'
      });
    } else if (STEP_ESTIMATES[i - 1]) {
      step.time = STEP_ESTIMATES[i - 1];
    }
  });
  order.status = order.timeline.filter(s => s.done).pop().status;
  return order;
}

// Track Order by ID
app.get('/api/orders/:orderId', (req, res) => {
  const orders = readJson('orders.json', []);
  const orderId = req.params.orderId.toUpperCase().trim();
  const order = orders.find(o => o.orderId.toUpperCase() === orderId);

  if (!order) {
    return res.status(404).json({ error: `Order #${orderId} not found. Please check your order ID.` });
  }

  res.json(stampTimeline(order));
});

// Customer Reviews
app.get('/api/reviews/:productId', (req, res) => {
  const reviewsMap = readJson('reviews.json', {});
  const reviews = reviewsMap[req.params.productId] || [];
  res.json(reviews);
});

app.post('/api/reviews', (req, res) => {
  const { productId, author, rating, comment } = req.body || {};
  if (!productId || !author || !rating || !comment) {
    return res.status(400).json({ error: 'Product ID, author name, rating and comment are required.' });
  }
  if (!readJson('products.json', []).some(p => p.id === productId)) {
    return res.status(404).json({ error: 'That product does not exist.' });
  }
  if (String(comment).length > 600) {
    return res.status(400).json({ error: 'Please keep the review under 600 characters.' });
  }

  const reviewsMap = readJson('reviews.json', {});
  if (!reviewsMap[productId]) {
    reviewsMap[productId] = [];
  }

  const newReview = {
    id: `rev-${Date.now()}`,
    author: author.trim(),
    rating: Math.min(5, Math.max(1, Number(rating) || 5)),
    date: new Date().toISOString().split('T')[0],
    comment: comment.trim(),
    verified: true
  };

  reviewsMap[productId].unshift(newReview);
  writeJson('reviews.json', reviewsMap);

  // Update product average rating
  const products = readJson('products.json', []);
  const product = products.find(p => p.id === productId);
  if (product) {
    const allProductReviews = reviewsMap[productId];
    const avg = allProductReviews.reduce((sum, r) => sum + r.rating, 0) / allProductReviews.length;
    product.rating = Number(avg.toFixed(1));
    product.reviewCount = allProductReviews.length;
    writeJson('products.json', products);
  }

  res.status(201).json({
    success: true,
    review: newReview,
    updatedProduct: product
  });
});

// Newsletter Subscription
app.post('/api/newsletter', (req, res) => {
  const { email } = req.body || {};
  if (!email || !email.includes('@') || !email.includes('.')) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const subscribers = readJson('subscribers.json', []);
  const cleanEmail = email.trim().toLowerCase();

  const alreadySubscribed = subscribers.some(s => s.email.toLowerCase() === cleanEmail);
  if (alreadySubscribed) {
    return res.json({
      success: true,
      alreadySubscribed: true,
      message: 'You are already on the OG Gallery guest list. Welcome back!'
    });
  }

  subscribers.push({
    email: cleanEmail,
    subscribedAt: new Date().toISOString()
  });

  writeJson('subscribers.json', subscribers);
  res.json({
    success: true,
    message: 'Welcome to the OG Gallery community. Your 10% welcome code is OGFIRST10.'
  });
});

// Fallback to index.html for SPA routes
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Vercel requires the app via api/index.js; only listen when run directly.
module.exports = app;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[OG Gallery Server] Running smoothly on http://localhost:${PORT}`);
    console.log(`[API Endpoints] /api/products, /api/orders, /api/reviews, /api/newsletter`);
  });
}
