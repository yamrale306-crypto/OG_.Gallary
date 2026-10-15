const source = {
  Shirts: [
    ['WhatsApp Image 2026-10-15 at 10.58.57 AM.jpeg','The Everyday Shirt',1290,'New'],
    ['WhatsApp Image 2026-10-15 at 10.59.04 AM.jpeg','Soft Cotton Poplin',1490,'Bestseller'],
    ['WhatsApp Image 2026-10-15 at 10.58.12 AM.jpeg','After Hours Shirt',1690,'Limited'],
    ['WhatsApp Image 2026-10-15 at 10.59.02 AM.jpeg','Colour Study Shirt',1290,''],
    ['WhatsApp Image 2026-10-15 at 10.58.15 AM.jpeg','Easy Day Shirt',1490,'New']
  ],
  Jeans: [
    ['WhatsApp Image 2026-10-15 at 10.59.12 AM.jpeg','The Weekender Jean',2190,'Bestseller'],
    ['WhatsApp Image 2026-10-15 at 10.59.16 AM.jpeg','Straight Up Denim',2290,''],
    ['WhatsApp Image 2026-10-15 at 10.59.18 AM.jpeg','Everyday Straight Jean',2290,'New'],
    ['WhatsApp Image 2026-10-15 at 10.59.19 AM.jpeg','Blue Hour Denim',2190,''],
    ['WhatsApp Image 2026-10-15 at 10.59.20 AM.jpeg','The Off-Duty Jean',2390,'Limited'],
    ['WhatsApp Image 2026-10-15 at 11.06.22 AM.jpeg','Classic Blue Jean',2290,''],
    ['WhatsApp Image 2026-10-15 at 11.06.22 AM (1).jpeg','The Relaxed Fit',2390,'Bestseller'],
    ['WhatsApp Image 2026-10-15 at 11.06.22 AM (2).jpeg','Stonewash Straight',2190,''],
    ['WhatsApp Image 2026-10-15 at 11.06.23 AM.jpeg','Easy Fit Denim',2290,''],
    ['WhatsApp Image 2026-10-15 at 11.06.23 AM (1).jpeg','The Everyday Jean',2190,'New'],
    ['WhatsApp Image 2026-10-15 at 11.06.24 AM.jpeg','Weekend Blue Jean',2290,'']
  ],
  Slides_Slippers: [
    ['WhatsApp Image 2026-10-15 at 10.59.02 AM (1).jpeg','Poolside Slide',690,'New'],
    ['WhatsApp Image 2026-10-15 at 10.59.03 AM.jpeg','Cloud Nine Slide',790,'Bestseller'],
    ['WhatsApp Image 2026-10-15 at 10.59.04 AM (1).jpeg','Easy Street Slide',790,''],
    ['WhatsApp Image 2026-10-15 at 10.59.07 AM.jpeg','The Sunday Slide',690,''],
    ['WhatsApp Image 2026-10-15 at 10.59.09 AM.jpeg','Weekend Runner Slide',890,''],
    ['WhatsApp Image 2026-10-15 at 10.59.10 AM.jpeg','Off Duty Slide',790,'New'],
    ['WhatsApp Image 2026-10-15 at 10.59.11 AM.jpeg','Everyday Comfort Slide',790,''],
    ['WhatsApp Image 2026-10-15 at 10.59.14 AM.jpeg','Slow Morning Slide',890,'']
  ]
};
const products = Object.entries(source).flatMap(([category, items]) => items.map(([file,name,price,badge], index) => ({
  category, name, price, badge, id:`${category}-${index}`, image:`public/products/${category}/${encodeURIComponent(file).replaceAll("'",'%27')}`
})));

const grid = document.querySelector('#productGrid');
const toast = document.querySelector('#toast');
let activeFilter = 'all';
let searchQuery = '';
let cartCount = 0;
let toastTimer;

function formatPrice(amount){return `₹${amount.toLocaleString('en-IN')}`;}
function renderProducts(){
  let shown = products.filter(item => (activeFilter === 'all' || item.category === activeFilter) && `${item.name} ${item.category}`.toLowerCase().includes(searchQuery));
  const sort = document.querySelector('#sortSelect').value;
  if(sort === 'low') shown = [...shown].sort((a,b) => a.price-b.price);
  if(sort === 'high') shown = [...shown].sort((a,b) => b.price-a.price);
  grid.innerHTML = shown.map((item,index) => `<article class="product-card" style="animation-delay:${Math.min(index%8,7)*.035}s">
    <div class="product-image-wrap"><img src="${item.image}" alt="${item.name}" loading="lazy">${item.badge ? `<span class="product-badge">${item.badge}</span>` : ''}<button class="quick-add" aria-label="Add ${item.name} to bag" data-add="${item.id}">+</button></div>
    <div class="product-info"><div><p class="product-name">${item.name}</p><p class="product-category">${item.category === 'Slides_Slippers' ? 'Slides' : item.category}</p></div><p class="product-price">${formatPrice(item.price)}</p></div></article>`).join('');
  document.querySelector('#loadMore').hidden = shown.length !== products.length;
}
function showToast(message){toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2300);}
document.querySelectorAll('.filter-chip').forEach(button => button.addEventListener('click',()=>{
  activeFilter=button.dataset.filter;
  document.querySelectorAll('.filter-chip').forEach(chip=>chip.classList.toggle('active',chip===button));
  document.querySelectorAll('.main-nav a').forEach(link=>link.classList.toggle('selected',link.dataset.nav===activeFilter));
  renderProducts();
}));
document.querySelectorAll('.main-nav a').forEach(link=>link.addEventListener('click',()=>{
  if(!link.dataset.nav){document.querySelector('.main-nav').classList.remove('open');return;}
  const filter=link.dataset.nav; activeFilter=filter;
  document.querySelectorAll('.filter-chip').forEach(chip=>chip.classList.toggle('active',chip.dataset.filter===filter));
  document.querySelectorAll('.main-nav a').forEach(item=>item.classList.toggle('selected',item===link));
  renderProducts(); document.querySelector('.main-nav').classList.remove('open');
}));
document.querySelector('#sortSelect').addEventListener('change',renderProducts);
grid.addEventListener('click',event=>{
  const button=event.target.closest('[data-add]'); if(!button)return;
  const item=products.find(product=>product.id===button.dataset.add);cartCount++;
  document.querySelector('#cartCount').textContent=cartCount;
  showToast(`${item.name} added to your bag`);
});
document.querySelector('#cartButton').addEventListener('click',()=>showToast(cartCount ? `Your bag has ${cartCount} ${cartCount===1?'item':'items'}` : 'Your bag is waiting for something good'));
document.querySelector('#menuToggle').addEventListener('click',()=>document.querySelector('.main-nav').classList.toggle('open'));
const searchPanel=document.querySelector('#searchPanel');
document.querySelector('.search-toggle').addEventListener('click',()=>{searchPanel.hidden=false;document.querySelector('#searchInput').focus();});
document.querySelector('#searchClose').addEventListener('click',()=>{searchPanel.hidden=true;document.querySelector('#searchInput').value='';searchQuery='';renderProducts();});
document.querySelector('#searchInput').addEventListener('input',event=>{searchQuery=event.target.value.trim().toLowerCase();activeFilter='all';document.querySelectorAll('.filter-chip').forEach(chip=>chip.classList.toggle('active',chip.dataset.filter==='all'));renderProducts();document.querySelector('#shop').scrollIntoView({behavior:'smooth',block:'start'});});
document.querySelector('#newsletterForm').addEventListener('submit',event=>{
  event.preventDefault(); const input=document.querySelector('#emailInput');
  document.querySelector('#newsletterMessage').textContent='You’re on the list. Talk soon ✳';input.value='';
});
const hero=document.querySelector('#heroStage');
hero.addEventListener('pointermove',event=>{
  if(matchMedia('(prefers-reduced-motion: reduce)').matches || innerWidth<700)return;
  const rect=hero.getBoundingClientRect();const x=(event.clientX-rect.left)/rect.width-.5;const y=(event.clientY-rect.top)/rect.height-.5;
  hero.style.transform=`rotateY(${x*5}deg) rotateX(${-y*4}deg)`;
});
hero.addEventListener('pointerleave',()=>hero.style.transform='');
renderProducts();
