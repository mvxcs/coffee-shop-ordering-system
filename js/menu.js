const supabaseClient = getSupabaseClient();

const urlParams = new URLSearchParams(window.location.search);
const isViewOnly = urlParams.get("mode") === "view";
const tableFromUrl = urlParams.get("table");

let currentLang = "ar";
let currentTab = "all";
let cart = {};
let selectedSizes = {};
let stockMap = {};
let customerOrders = JSON.parse(localStorage.getItem("PALMUCustomerOrders") || "[]");
let currentSlide = 0;
let sliderTimer = null;
let sendingOrder = false;

let products = typeof PRODUCTS !== "undefined" ? PRODUCTS : [];
let categories = typeof CATEGORIES !== "undefined" ? CATEGORIES : [];
let homeProductIds = typeof HOME_PRODUCT_IDS !== "undefined" ? HOME_PRODUCT_IDS : [];
let heroItems = typeof HERO_ITEMS !== "undefined" ? HERO_ITEMS : [];

const texts = {
  ar: {
    brandTitle: CONFIG.APP_NAME,
    brandSubtitle: "تجربة فاخرة مستوحاة من القهوة والتمور",
    sectionSub: "عرض Palmu",
    add: "أضف",
    cart: "السلة",
    cartButton: "السلة",
    order: "ارسل الطلب",
    sending: "جاري الإرسال...",
    items: "عدد المنتجات",
    total: "الإجمالي",
    each: "سعر الوحدة",
    qty: "الكمية",
    subtotal: "المجموع الفرعي",
    remove: "حذف",
    emptyCart: "السلة فارغة",
    orderEmpty: "السلة فارغة، أضف منتج أول",
    nameRequired: "اكتب الاسم أول",
    orderError: "صار خطأ",
    orderSent: "تم إرسال الطلب",
    sizeLabel: "الحجم",
    soldOut: "غير متوفر",
    customerInfoTitle: "معلومات الطلب",
    customerNamePlaceholder: "الاسم الكامل",
    myOrders: "طلباتي",
    myOrdersTitle: "طلباتك",
    emptyOrders: "ما عندك طلبات إلى الآن"
  },
  en: {
    brandTitle: CONFIG.APP_NAME,
    brandSubtitle: "A premium experience inspired by coffee and dates",
    sectionSub: "Palmu preview",
    add: "Add",
    cart: "Cart",
    cartButton: "Cart",
    order: "Send order",
    sending: "Sending...",
    items: "Items",
    total: "Total",
    each: "Unit Price",
    qty: "Qty",
    subtotal: "Subtotal",
    remove: "Remove",
    emptyCart: "Cart is empty",
    orderEmpty: "Cart is empty, add an item first",
    nameRequired: "Please enter your name",
    orderError: "Something went wrong",
    orderSent: "Order sent",
    sizeLabel: "Size",
    soldOut: "Sold Out",
    customerInfoTitle: "Order info",
    customerNamePlaceholder: "Full name",
    myOrders: "My Orders",
    myOrdersTitle: "My Orders",
    emptyOrders: "You have no orders yet"
  },
  tr: {
    brandTitle: CONFIG.APP_NAME,
    brandSubtitle: "Kahve ve hurmadan ilham alan premium deneyim",
    sectionSub: "Palmu önizleme",
    add: "Ekle",
    cart: "Sepet",
    cartButton: "Sepet",
    order: "Sipariş Gönder",
    sending: "Gönderiliyor...",
    items: "Ürün Sayısı",
    total: "Toplam",
    each: "Birim Fiyat",
    qty: "Adet",
    subtotal: "Ara Toplam",
    remove: "Sil",
    emptyCart: "Sepet boş",
    orderEmpty: "Sepet boş, önce ürün ekleyin",
    nameRequired: "Lütfen isim yazın",
    orderError: "Bir hata oluştu",
    orderSent: "Sipariş gönderildi",
    sizeLabel: "Boyut",
    soldOut: "Tükendi",
    customerInfoTitle: "Sipariş Bilgisi",
    customerNamePlaceholder: "Ad Soyad",
    myOrders: "Siparişlerim",
    myOrdersTitle: "Siparişlerim",
    emptyOrders: "Henüz siparişiniz yok"
  }
};

async function loadCategoriesFromSupabase() {
  const { data, error } = await supabaseClient
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data || !data.length) {
    if (error) console.error("loadCategoriesFromSupabase error:", error);
    return;
  }

  categories = [
    {
      id: "all",
      label: { ar: "الكل", en: "All", tr: "Tümü" }
    },
    ...data.map(category => ({
      id: category.slug,
      label: {
        ar: category.name_ar || category.slug,
        en: category.name_en || category.name_ar || category.slug,
        tr: category.name_tr || category.name_ar || category.slug
      }
    }))
  ];
}

async function loadProductsFromSupabase() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data || !data.length) {
    if (error) console.error("loadProductsFromSupabase error:", error);
    return;
  }

  products = data.map(p => ({
    id: Number(p.id),
    category: p.category_slug,
    price: Number(p.price || 0),
    image: p.image || "./images/fallback.jpg",
    heroImage: p.hero_image || p.image || "./images/fallback.jpg",
    rating: p.rating || "4.8/5",
    hasSizes: Boolean(p.has_sizes),
    sizes: Array.isArray(p.sizes) ? p.sizes : [],
    modifiers: Array.isArray(p.modifiers) ? p.modifiers : [],
    trackStock: Boolean(p.track_stock),

    name: {
      ar: p.name_ar || "",
      en: p.name_en || p.name_ar || "",
      tr: p.name_tr || p.name_ar || ""
    },

    sub: {
      ar: p.sub_ar || p.name_ar || "",
      en: p.sub_en || p.name_en || p.name_ar || "",
      tr: p.sub_tr || p.name_tr || p.name_ar || ""
    },

    description: {
      ar: p.description_ar || "",
      en: p.description_en || p.description_ar || "",
      tr: p.description_tr || p.description_ar || ""
    },

    isAvailable: p.is_available !== false
  }));

  stockMap = {};
  products.forEach(product => {
    stockMap[product.id] = product.isAvailable;
  });
}

async function loadHomeSettingsFromSupabase() {
  const { data, error } = await supabaseClient
    .from("home_settings")
    .select("*")
    .eq("is_active", true)
    .order("slot_number", { ascending: true });

  if (error || !data || !data.length) {
    if (error) console.error("loadHomeSettingsFromSupabase error:", error);
    return;
  }

  homeProductIds = data.map(row => Number(row.product_id)).filter(Boolean);
}

async function loadHeroSettingsFromSupabase() {
  const { data, error } = await supabaseClient
    .from("hero_settings")
    .select("*")
    .eq("is_active", true)
    .order("slot_number", { ascending: true });

  if (error || !data || !data.length) {
    if (error) console.error("loadHeroSettingsFromSupabase error:", error);
    return;
  }

  heroItems = data.map(row => ({
    productId: Number(row.product_id),
    badge: {
      ar: row.badge_ar || "مميز",
      en: row.badge_en || row.badge_ar || "Featured",
      tr: row.badge_tr || row.badge_ar || "Özel"
    }
  }));
}

function getProductById(id) {
  return products.find(product => Number(product.id) === Number(id));
}

function getCategoryLabel(categoryId) {
  return categories.find(category => category.id === categoryId)?.label?.[currentLang] || categoryId;
}

function isProductAvailable(productId) {
  return stockMap[Number(productId)] !== false;
}

function getQty(productId) {
  return cart[productId]?.qty || 0;
}

function getSelectedSize(productId) {
  const product = getProductById(productId);
  if (!product || !product.hasSizes) return null;
  return selectedSizes[productId] || product.sizes[0];
}

function getCartItems() {
  return Object.keys(cart).map(id => {
    const product = getProductById(id);
    const item = cart[id];

    if (!product) return null;

    return {
      ...product,
      qty: item.qty,
      size: item.size || null,
      subtotal: item.qty * product.price
    };
  }).filter(Boolean);
}

function getTotalItems() {
  return getCartItems().reduce((sum, item) => sum + item.qty, 0);
}

function getTotalPrice() {
  return getCartItems().reduce((sum, item) => sum + item.subtotal, 0);
}

function saveCustomerOrders() {
  localStorage.setItem("PALMUCustomerOrders", JSON.stringify(customerOrders));
}

function openOrdersDrawer() {
  document.getElementById("ordersTopOverlay")?.classList.add("show");
  document.getElementById("ordersDrawer")?.classList.add("show");
}

function closeOrdersDrawer() {
  document.getElementById("ordersTopOverlay")?.classList.remove("show");
  document.getElementById("ordersDrawer")?.classList.remove("show");
}

function updateMyOrdersCount() {
  const countEl = document.getElementById("myOrdersCount");
  if (countEl) countEl.textContent = customerOrders.length;
}

function renderLanguages() {
  const box = document.getElementById("langSwitcher");
  if (!box) return;

  const langs = [
    { code: "ar", label: "العربية" },
    { code: "en", label: "English" },
    { code: "tr", label: "Türkçe" }
  ];

  box.innerHTML = langs.map(lang => `
    <button class="lang-btn ${currentLang === lang.code ? "active" : ""}" onclick="setLanguage('${lang.code}')">
      ${lang.label}
    </button>
  `).join("");
}

function renderTabs() {
  const box = document.getElementById("tabs");
  if (!box) return;

  box.innerHTML = categories.map(category => `
    <button class="tab-btn ${currentTab === category.id ? "active" : ""}" onclick="setTab('${category.id}')">
      ${category.label[currentLang]}
    </button>
  `).join("");
}

function renderStaticTexts() {
  document.documentElement.lang = currentLang;
  document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";

  document.getElementById("brandTitle").textContent = texts[currentLang].brandTitle;
  document.getElementById("brandSubtitle").textContent = texts[currentLang].brandSubtitle;
  document.getElementById("sectionTitle").textContent =
    categories.find(c => c.id === currentTab)?.label[currentLang] || "";
  document.getElementById("sectionSub").textContent = texts[currentLang].sectionSub;
  document.getElementById("cartTitle").textContent = texts[currentLang].cart;
  document.getElementById("orderBtn").textContent = texts[currentLang].order;
  document.getElementById("myOrdersText").textContent = texts[currentLang].myOrders;
  document.getElementById("ordersDrawerTitle").textContent = texts[currentLang].myOrdersTitle;
  document.getElementById("customerInfoTitle").textContent = texts[currentLang].customerInfoTitle;
  document.getElementById("customerName").placeholder = texts[currentLang].customerNamePlaceholder;

  const developerLink = document.getElementById("developerLink");
  if (developerLink) {
  developerLink.textContent = `Powered by ${CONFIG.DEV.name}`;
  developerLink.href = CONFIG.DEV.whatsapp;
  developerLink.target = "_blank";
}

  updateCartInfo();
  updateCartButton();
  renderCustomerOrders();
}

function renderHero() {
  const container = document.getElementById("heroContainer");
  const dotsBox = document.getElementById("slideDots");

  if (!container || !dotsBox) return;

  const heroProducts = heroItems
    .map(item => {
      const product = getProductById(item.productId);
      if (!product) return null;
      return { ...item, product };
    })
    .filter(Boolean);

  container.innerHTML = heroProducts.map((item, index) => `
    <article class="slide ${index === 0 ? "active" : ""}">
      <img src="${item.product.heroImage || item.product.image}" alt="${item.product.name[currentLang]}" onerror="this.src='./images/fallback.jpg'">
      <div class="slide-overlay">
        <div class="slide-badge">${item.badge[currentLang]}</div>
        <h2>${item.product.name[currentLang]}</h2>
        <p>${item.product.description[currentLang]}</p>
        <div class="slide-price">TRY ${Number(item.product.price).toFixed(0)}</div>
      </div>
    </article>
  `).join("");

  dotsBox.innerHTML = heroProducts.map((_, index) => `
    <div class="dot ${index === 0 ? "active" : ""}"></div>
  `).join("");

  currentSlide = 0;
}

function initSlider() {
  clearInterval(sliderTimer);

  const slides = document.querySelectorAll(".slide");
  const dots = document.querySelectorAll(".dot");

  if (slides.length <= 1 || dots.length <= 1) return;

  sliderTimer = setInterval(() => {
    const currentSlides = document.querySelectorAll(".slide");
    const currentDots = document.querySelectorAll(".dot");

    if (!currentSlides.length || !currentDots.length) return;

    currentSlides[currentSlide]?.classList.remove("active");
    currentDots[currentSlide]?.classList.remove("active");

    currentSlide = (currentSlide + 1) % currentSlides.length;

    currentSlides[currentSlide]?.classList.add("active");
    currentDots[currentSlide]?.classList.add("active");
  }, 3000);
}

function renderProducts() {
  const grid = document.getElementById("grid");
  if (!grid) return;

  const filtered = currentTab === "all"
    ? homeProductIds.map(id => getProductById(id)).filter(Boolean)
    : products.filter(product => product.category === currentTab);

  grid.innerHTML = filtered.map(product => {
    const available = isProductAvailable(product.id);
    const selected = getSelectedSize(product.id);

    return `
      <article class="card ${available ? "" : "sold-out"}" data-product-id="${product.id}">
        <div class="card-image">
          <img src="${product.image || "./images/fallback.jpg"}" alt="${product.name[currentLang] || product.name.ar}" onerror="this.src='./images/fallback.jpg'">
          <div class="mini-pill">${getCategoryLabel(product.category)}</div>
          ${!available ? `<div class="sold-out-badge">${texts[currentLang].soldOut}</div>` : ""}
        </div>

        <div class="card-body">
          <div class="name-row">
            <h3 class="name">${product.name[currentLang] || product.name.ar}</h3>
            <div class="rating">⭐ ${product.rating}</div>
          </div>

          <p class="subname">${product.sub[currentLang] || product.sub.ar || ""}</p>
          <p class="price">TRY ${Number(product.price).toFixed(2)}</p>

          ${product.hasSizes ? `
            <div class="sizes">
              ${product.sizes.map(size => `
                <div class="size ${selected === size ? "active" : ""} ${available ? "" : "disabled"}"
                  onclick="setSize(${product.id}, '${String(size).replace(/'/g, "\\'")}')">
                  ${size}
                </div>
              `).join("")}
            </div>
          ` : ""}

          <p class="desc">${product.description[currentLang] || product.description.ar || ""}</p>

          <div class="action-row">
            <div class="qty">
              <button class="qty-btn ${available ? "" : "disabled"}" onclick="decreaseQty(${product.id})">−</button>
              <span>${getQty(product.id)}</span>
              <button class="qty-btn ${available ? "" : "disabled"}" onclick="increaseQty(${product.id})">+</button>
            </div>

            <button class="add-btn ${available ? "" : "disabled"}" onclick="increaseQty(${product.id})">
              ${available ? texts[currentLang].add : texts[currentLang].soldOut}
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function updateProductAvailabilityUI() {
  products.forEach(product => {
    const card = document.querySelector(`.card[data-product-id="${product.id}"]`);
    if (!card) return;

    const available = isProductAvailable(product.id);
    card.classList.toggle("sold-out", !available);

    const oldBadge = card.querySelector(".sold-out-badge");

    if (!available && !oldBadge) {
      card.querySelector(".card-image")?.insertAdjacentHTML(
        "beforeend",
        `<div class="sold-out-badge">${texts[currentLang].soldOut}</div>`
      );
    }

    if (available && oldBadge) oldBadge.remove();

    card.querySelectorAll(".qty-btn, .add-btn, .size").forEach(el => {
      el.classList.toggle("disabled", !available);
    });

    const addBtn = card.querySelector(".add-btn");
    if (addBtn) {
      addBtn.textContent = available ? texts[currentLang].add : texts[currentLang].soldOut;
    }
  });
}

function setSize(productId, size) {
  selectedSizes[productId] = size;
  renderProducts();
}

function increaseQty(productId) {
  if (!isProductAvailable(productId)) {
    showToast(texts[currentLang].soldOut);
    return;
  }

  const product = getProductById(productId);
  if (!product) return;

  const size = getSelectedSize(productId);

  if (!cart[productId]) {
    cart[productId] = { qty: 1, size };
  } else {
    cart[productId].qty += 1;
    cart[productId].size = size;
  }

  renderProducts();
  renderCart();
  updateCartInfo();
  updateCartButton();
  showToast(product.name[currentLang]);
}

function decreaseQty(productId) {
  if (!cart[productId]) return;

  cart[productId].qty -= 1;

  if (cart[productId].qty <= 0) {
    delete cart[productId];
  }

  renderProducts();
  renderCart();
  updateCartInfo();
  updateCartButton();
}

function removeItem(productId) {
  delete cart[productId];

  renderProducts();
  renderCart();
  updateCartInfo();
  updateCartButton();
}

function renderCart() {
  const body = document.getElementById("cartBody");
  if (!body) return;

  const items = getCartItems();

  if (!items.length) {
    body.innerHTML = `<div class="empty-cart">${texts[currentLang].emptyCart}</div>`;
    return;
  }

  let html = "";

  items.forEach(item => {
    html += `
      <div class="cart-item">
        <div class="cart-item-top">
          <div>
            <h4 class="cart-item-name">${item.name[currentLang]}</h4>
            <div class="cart-item-sub">
              ${item.size ? `${texts[currentLang].sizeLabel}: ${item.size} • ` : ""}
              ${texts[currentLang].each}: TRY ${Number(item.price).toFixed(2)}
            </div>
          </div>
          <button class="remove-btn" onclick="removeItem(${item.id})">${texts[currentLang].remove}</button>
        </div>

        <div class="summary">
          <div class="summary-line">
            <span>${texts[currentLang].qty}</span>
            <span>${item.qty}</span>
          </div>
          <div class="summary-line">
            <span>${texts[currentLang].subtotal}</span>
            <span>TRY ${Number(item.subtotal).toFixed(2)}</span>
          </div>
        </div>
      </div>
    `;
  });

  html += `
    <div class="summary">
      <div class="summary-line">
        <span>${texts[currentLang].items}</span>
        <span>${getTotalItems()}</span>
      </div>
      <div class="summary-line">
        <span>${texts[currentLang].total}</span>
        <span>TRY ${getTotalPrice().toFixed(2)}</span>
      </div>
    </div>
  `;

  body.innerHTML = html;
}

function updateCartInfo() {
  const cartInfo = document.getElementById("cartInfo");
  if (cartInfo) {
    cartInfo.textContent =
      `${texts[currentLang].items}: ${getTotalItems()} | ${texts[currentLang].total}: TRY ${getTotalPrice().toFixed(2)}`;
  }
}

function updateCartButton() {
  const cartBtn = document.getElementById("cartBtn");
  if (cartBtn) {
    cartBtn.textContent = `${texts[currentLang].cartButton} (${getTotalItems()})`;
  }
}

function renderCustomerOrders() {
  const box = document.getElementById("ordersDrawerBody");
  if (!box) return;

  if (!customerOrders.length) {
    box.innerHTML = `<div class="customer-empty-orders">${texts[currentLang].emptyOrders}</div>`;
    updateMyOrdersCount();
    return;
  }

  box.innerHTML = customerOrders.slice().reverse().map(order => `
    <div class="customer-order-card">
      <div class="customer-order-top">
        <div>
          <h4 class="customer-order-id">#${getOrderDisplayNumber(order)}</h4>
          <div class="customer-order-meta">
            ${order.customer_name || "-"}<br>
            ${new Date(order.created_at).toLocaleString()}
          </div>
        </div>

        <div class="customer-order-status ${order.status || "preparing"}">
          ${getOrderStatusLabel(order.status || "preparing", currentLang)}
        </div>
      </div>

      <div class="customer-order-items">
        ${(order.items || []).map(item => `
          <div class="customer-order-item">
            ${item.name}${item.size ? ` (${item.size})` : ""} × ${item.qty}
          </div>
        `).join("")}
      </div>

      <div class="customer-order-total">
        ${texts[currentLang].total}: TRY ${Number(order.total || 0).toFixed(2)}
      </div>
    </div>
  `).join("");

  updateMyOrdersCount();
}

async function refreshCustomerOrdersStatus() {
  if (!customerOrders.length) return;

  const ids = customerOrders.map(order => order.id);

  const { data, error } = await supabaseClient
    .from("orders")
    .select("*")
    .in("id", ids)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("refreshCustomerOrdersStatus error:", error);
    return;
  }

  if (data) {
    customerOrders = data;
    cleanOldCustomerOrders();
    saveCustomerOrders();
    renderCustomerOrders();
  }
}

async function loadStockStatus() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("id,is_available")
    .eq("is_active", true);

  if (error) {
    console.error("loadStockStatus error:", error);
    return;
  }

  (data || []).forEach(item => {
    stockMap[Number(item.id)] = item.is_available;
  });

  let cartChanged = false;

  Object.keys(cart).forEach(id => {
    if (!isProductAvailable(Number(id))) {
      delete cart[id];
      cartChanged = true;
    }
  });

  updateProductAvailabilityUI();

  if (cartChanged) {
    updateProductAvailabilityUI();
    updateCartInfo();
    updateCartButton();
    showToast(currentLang === "ar"
      ? "تم حذف منتج غير متوفر من السلة"
      : currentLang === "tr"
        ? "Tükenen ürün sepetten kaldırıldı"
        : "Unavailable item removed from cart"
    );
  }
}

function openCart() {
  document.getElementById("cartOverlay")?.classList.add("show");
  document.getElementById("cartPanel")?.classList.add("show");
}

function closeCart() {
  document.getElementById("cartOverlay")?.classList.remove("show");
  document.getElementById("cartPanel")?.classList.remove("show");
}

function setLanguage(lang) {
  currentLang = lang;

  renderLanguages();
  renderTabs();
  renderStaticTexts();
  renderHero();
  initSlider();
  renderProducts();
  renderCart();
}

function setTab(tab) {
  currentTab = tab;

  renderTabs();
  renderStaticTexts();
  renderProducts();
}

function resetOrderButton() {
  const orderBtn = document.getElementById("orderBtn");
  if (!orderBtn) return;

  orderBtn.disabled = false;
  orderBtn.style.opacity = "1";
  orderBtn.style.pointerEvents = "auto";
  orderBtn.textContent = texts[currentLang].order;
}

async function sendOrder() {
  if (sendingOrder) return;

  const items = getCartItems();

  if (!items.length) {
    showToast(texts[currentLang].orderEmpty);
    return;
  }

  const customerName = document.getElementById("customerName")?.value.trim() || "";

  if (!customerName) {
    showToast(texts[currentLang].nameRequired);
    return;
  }

  sendingOrder = true;

  const orderBtn = document.getElementById("orderBtn");
  if (orderBtn) {
    orderBtn.disabled = true;
    orderBtn.style.opacity = "0.6";
    orderBtn.style.pointerEvents = "none";
    orderBtn.textContent = texts[currentLang].sending;
  }

  const requestId = crypto.randomUUID();

  const payloadItems = items.map(item => ({
    id: item.id,
    name: item.name[currentLang],
    size: item.size,
    qty: item.qty,
    unit_price: item.price,
    subtotal: item.subtotal
  }));

  const payload = {
    customer_name: customerName,
    phone: null,
    order_type: tableFromUrl ? "dine-in" : "qr-menu",
    table_number: tableFromUrl || null,
    items: payloadItems,
    total: getTotalPrice(),
    status: "preparing",
    request_id: requestId
  };

  let data = null;
  let error = null;

  try {
    const result = await createOrder(payload);
    data = result.data;
    error = result.error;
  } catch (err) {
    console.error(err);
    error = err;
  }

  sendingOrder = false;
  resetOrderButton();

  if (error) {
    console.error(error);

    if (error.message?.includes("duplicate") || error.code === "23505") {
      showToast("تم إرسال الطلب مسبقًا");
      return;
    }

    showToast(texts[currentLang].orderError);
    return;
  }

  customerOrders.push(data);
  cleanOldCustomerOrders();
  saveCustomerOrders();
  renderCustomerOrders();
  updateMyOrdersCount();
  openOrdersDrawer();

  showToast(`${texts[currentLang].orderSent} #${getOrderDisplayNumber(data)}`);

  cart = {};
  renderProducts();
  renderCart();
  updateCartInfo();
  updateCartButton();

  const nameInput = document.getElementById("customerName");
  if (nameInput) nameInput.value = "";
}

function cleanOldCustomerOrders() {
  const currentBusinessDay = getBusinessDayKey();

  customerOrders = customerOrders.filter(order => {
    return order.business_day === currentBusinessDay && order.status !== "done";
  });

  saveCustomerOrders();
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => toast.classList.remove("show"), 1400);
}

async function initMenu() {
  if (isViewOnly) {
    document.body.classList.add("view-only");
  }

  const tableBadge = document.getElementById("tableBadge");
  if (tableFromUrl && tableBadge) {
    tableBadge.textContent = `طاولة رقم ${tableFromUrl}`;
  }

  cleanOldCustomerOrders();

  await loadCategoriesFromSupabase();
  await loadProductsFromSupabase();
  await loadHomeSettingsFromSupabase();
  await loadHeroSettingsFromSupabase();

  renderLanguages();
  renderTabs();
  renderStaticTexts();
  renderHero();
  initSlider();
  renderProducts();
  renderCart();
  renderCustomerOrders();
  updateMyOrdersCount();

  loadStockStatus();

  setInterval(refreshCustomerOrdersStatus, 3000);
  setInterval(loadStockStatus, 5000);
}

initMenu();

window.addEventListener("load", () => {
  setTimeout(() => {
    document.getElementById("intro")?.classList.add("hide");
  }, 1200);
});