const db = getSupabaseClient();

let currentDashTab = "current";
let currentSettingsView = "home";
let allOrders = [];
let allProducts = [];
let allCategories = [];
let lastOrderId = null;
let firstLoadDone = false;
let soundEnabled = false;

document.addEventListener("click", () => {
  soundEnabled = true;
}, { once: true });

function setDashTab(tab) {
  currentDashTab = tab;

  document.getElementById("tabCurrentBtn")?.classList.toggle("active", tab === "current");
  document.getElementById("tabHistoryBtn")?.classList.toggle("active", tab === "history");
  document.getElementById("tabProductsBtn")?.classList.toggle("active", tab === "products");
  document.getElementById("tabSettingsBtn")?.classList.toggle("active", tab === "settings");

  document.getElementById("currentSection")?.classList.toggle("active", tab === "current");
  document.getElementById("historySection")?.classList.toggle("active", tab === "history");
  document.getElementById("productsSection")?.classList.toggle("active", tab === "products");
  document.getElementById("settingsSection")?.classList.toggle("active", tab === "settings");

  if (tab === "settings") renderSettingsView();
}

function setSettingsView(view) {
  currentSettingsView = view;

  document.querySelectorAll(".settings-btn").forEach(btn => btn.classList.remove("active"));

  const activeMap = {
    home: "settingsHomeBtn",
    hero: "settingsHeroBtn",
    addProduct: "settingsAddProductBtn",
    editProduct: "settingsEditProductBtn",
    category: "settingsCategoryBtn",
    stockPicker: "settingsStockPickerBtn"
  };

  document.getElementById(activeMap[view])?.classList.add("active");
  renderSettingsView();
}

function playNewOrderSound() {
  if (!soundEnabled) return;

  const sound = document.getElementById("notifySound");
  if (sound) {
    sound.volume = 0.45;
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }
}

function renderDashboardStats() {
  const activeOrders = allOrders.filter(order => order.status !== "done");
  const businessDay = getBusinessDayKey();
  const todayOrders = allOrders.filter(order => order.business_day === businessDay);

  document.getElementById("currentCount").textContent = activeOrders.length;
  document.getElementById("todayCount").textContent = todayOrders.length;
  document.getElementById("businessDayText").textContent = businessDay;
}

function renderOrderCard(order, isHistory = false) {
  const status = order.status || "preparing";
  const items = order.items || [];
  const displayNumber = getOrderDisplayNumber(order);

  const actions = isHistory ? "" : `
    <div class="action-row">
      ${status !== "preparing" ? `<button class="action-btn btn-preparing" onclick="changeStatus(${order.id}, 'preparing')">Preparing</button>` : ""}
      ${status !== "ready" ? `<button class="action-btn btn-ready" onclick="changeStatus(${order.id}, 'ready')">Ready</button>` : ""}
      <button class="action-btn btn-done" onclick="changeStatus(${order.id}, 'done')">Done</button>
    </div>
  `;

  return `
    <div class="order">
      <div class="order-head">
        <div>
          <h3 class="order-title">#${displayNumber} - ${order.customer_name || "بدون اسم"}</h3>
        </div>
        <div class="status ${status}">${getOrderStatusLabel(status, "ar")}</div>
      </div>

      <div class="order-info">
        Internal ID: ${order.id}<br>
        Business Day: ${order.business_day || "-"}<br>
        Table: ${order.table_number || "-"}<br>
        Total: TRY ${Number(order.total || 0).toFixed(2)}<br>
        Time: ${new Date(order.created_at).toLocaleString("ar-SA")}
      </div>

      <div class="items-box">
        ${items.map(item => `
          <div class="item">
            ${item.name}${item.size ? ` (${item.size})` : ""} × ${item.qty}
            = TRY ${Number(item.subtotal || 0).toFixed(2)}
          </div>
        `).join("")}
      </div>

      ${actions}
    </div>
  `;
}

function renderOrders() {
  const ordersBox = document.getElementById("orders");
  const currentOrders = allOrders.filter(order => order.status !== "done");

  if (!currentOrders.length) {
    ordersBox.innerHTML = `<div class="empty">ما فيه طلبات حالية</div>`;
    return;
  }

  ordersBox.innerHTML = currentOrders.map(order => renderOrderCard(order, false)).join("");
}

function renderHistoryOrders() {
  const historyBox = document.getElementById("historyOrders");
  const historyOrders = allOrders
  .filter(order => order.status === "done")
  .slice()
  .reverse();

  if (!historyOrders.length) {
    historyBox.innerHTML = `<div class="empty">ما فيه طلبات سابقة</div>`;
    return;
  }

  historyBox.innerHTML = historyOrders.map(order => renderOrderCard(order, true)).join("");
}

async function loadOrders() {
  const { data, error } = await db
    .from("orders")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("loadOrders error:", error);
    document.getElementById("orders").innerHTML = `<div class="empty">صار خطأ في جلب الطلبات</div>`;
    return;
  }

  allOrders = data || [];
  const newestOrderId = allOrders[allOrders.length - 1]?.id ?? null;

  if (!firstLoadDone) {
    lastOrderId = newestOrderId;
    firstLoadDone = true;
  } else if (newestOrderId && newestOrderId !== lastOrderId) {
    playNewOrderSound();
    lastOrderId = newestOrderId;
  }

  renderDashboardStats();
  renderOrders();
  renderHistoryOrders();
}

async function loadProducts() {
  const { data, error } = await db
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("loadProducts error:", error);
    return;
  }

  allProducts = data || [];
}

async function loadCategories() {
  const { data, error } = await db
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("loadCategories error:", error);
    return;
  }

  allCategories = data || [];
}

function getProduct(productId) {
  return allProducts.find(product => Number(product.id) === Number(productId));
}

function renderProductPreview(productId) {
  const product = getProduct(productId);

  if (!product) {
    return `<div class="home-preview empty-preview">منتج غير موجود</div>`;
  }

  return `
    <div class="home-preview">
      <img src="${product.image || "./images/fallback.jpg"}" onerror="this.src='./images/fallback.jpg'">
      <div>
        <strong>${product.name_ar}</strong>
        <span>رقم المنتج: ${product.id} • TRY ${Number(product.price || 0).toFixed(2)}</span>
      </div>
    </div>
  `;
}

async function uploadProductImage(file) {
  if (!file) return null;

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

  const { data, error } = await db.storage
    .from("product-images")
    .upload(fileName, file);

  if (error) {
    console.error("UPLOAD ERROR:", error);
    alert("فشل رفع الصورة");
    return null;
  }

  const { data: publicUrlData } = db.storage
    .from("product-images")
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}

async function loadStockControls() {
  const stockBox = document.getElementById("stockControls");

  const { data, error } = await db
    .from("products")
    .select("*")
    .eq("is_active", true)
    .eq("track_stock", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("loadStockControls error:", error);
    stockBox.innerHTML = `<div class="empty">صار خطأ في تحميل حالة المنتجات</div>`;
    return;
  }

  const stockProducts = data || [];

  if (!stockProducts.length) {
    stockBox.innerHTML = `<div class="empty">ما فيه منتجات محددة للتحكم بالتوفر</div>`;
    return;
  }

  stockBox.innerHTML = stockProducts.map(product => {
    const isAvailable = product.is_available !== false;

    return `
      <div class="order">
        <div class="order-head">
          <div>
            <h3 class="order-title">${product.name_ar}</h3>
            <div class="order-info">
              رقم المنتج: ${product.id}<br>
              القائمة: ${product.category_slug || "-"}<br>
              السعر: TRY ${Number(product.price || 0).toFixed(2)}
            </div>
          </div>

          <div class="status ${isAvailable ? "ready" : "done"}">
            ${isAvailable ? "متوفر" : "غير متوفر"}
          </div>
        </div>

        <div class="stock-actions">
          <button class="stock-btn stock-off" onclick="setStock(${product.id}, false)">غير متوفر</button>
          <button class="stock-btn stock-on" onclick="setStock(${product.id}, true)">متوفر</button>
        </div>
      </div>
    `;
  }).join("");
}

async function setStock(productId, isAvailable) {
  const { error } = await db
    .from("products")
    .update({
      is_available: isAvailable,
      updated_at: new Date().toISOString()
    })
    .eq("id", productId);

  if (error) {
    console.error("setStock error:", error);
    alert("صار خطأ");
    return;
  }

  await loadProducts();
  await loadStockControls();
  if (currentDashTab === "settings") renderSettingsView();
}

function renderSettingsView() {
  if (currentSettingsView === "home") renderHomeControls();
  if (currentSettingsView === "hero") renderHeroControls();
  if (currentSettingsView === "addProduct") renderAddProductForm();
  if (currentSettingsView === "editProduct") renderEditProductForm();
  if (currentSettingsView === "category") renderCategoryForm();
  if (currentSettingsView === "stockPicker") renderStockPicker();
}

async function renderHomeControls() {
  const settingsBox = document.getElementById("settingsContent");

  const { data, error } = await db
    .from("home_settings")
    .select("*")
    .order("slot_number", { ascending: true });

  if (error) {
    console.error("renderHomeControls error:", error);
    settingsBox.innerHTML = `<div class="empty">صار خطأ في تحميل الرئيسية</div>`;
    return;
  }

  const rows = data || [];

  settingsBox.innerHTML = `
    <div class="order">
      <div class="order-head">
        <div>
          <h3 class="order-title">التحكم بمنتجات الرئيسية</h3>
          <div class="order-info">اكتب رقم المنتج في كل خانة. المنتجات تظهر بالترتيب من 1 إلى 10.</div>
        </div>
      </div>

      <div class="home-grid">
        ${Array.from({ length: 10 }, (_, i) => {
          const slotNumber = i + 1;
          const row = rows.find(item => Number(item.slot_number) === slotNumber);
          const productId = row?.product_id || "";

          return `
            <div class="home-slot" id="homeSlot-${slotNumber}">
              <label>الخانة ${slotNumber}</label>

              <div class="home-input-row">
                <input
                  type="number"
                  value="${productId}"
                  placeholder="رقم المنتج"
                  oninput="previewHomeSlot(${slotNumber}, this.value)"
                >
                <button onclick="saveHomeSlot(${slotNumber})">حفظ</button>
                <button class="danger-btn small-danger" onclick="deleteHomeSlot(${slotNumber})">حذف</button>
              </div>

              <div class="home-preview-wrap" id="homePreview-${slotNumber}">
                ${productId ? renderProductPreview(productId) : `<div class="home-preview empty-preview">لم يتم اختيار منتج</div>`}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

async function deleteHomeSlot(slotNumber) {
  const ok = confirm(`حذف خانة رقم ${slotNumber}؟`);
  if (!ok) return;

  const { error } = await db
    .from("home_settings")
    .delete()
    .eq("slot_number", slotNumber);

  if (error) {
    console.error("deleteHomeSlot error:", error);
    alert("صار خطأ في الحذف");
    return;
  }

  alert("تم الحذف");
  renderHomeControls();
}

function previewHomeSlot(slotNumber, productId) {
  const previewBox = document.getElementById(`homePreview-${slotNumber}`);
  if (!previewBox) return;

  previewBox.innerHTML = productId
    ? renderProductPreview(productId)
    : `<div class="home-preview empty-preview">لم يتم اختيار منتج</div>`;
}

async function saveHomeSlot(slotNumber) {
  const slot = document.getElementById(`homeSlot-${slotNumber}`);
  const input = slot?.querySelector("input");
  const productId = Number(input?.value);

  if (!productId) {
    alert("اكتب رقم المنتج");
    return;
  }

  const product = getProduct(productId);
  if (!product) {
    alert("هذا المنتج غير موجود");
    return;
  }

  const { error } = await db
    .from("home_settings")
    .upsert({
      slot_number: slotNumber,
      product_id: productId,
      is_active: true,
      updated_at: new Date().toISOString()
    }, { onConflict: "slot_number" });

  if (error) {
    console.error("saveHomeSlot error:", error);
    alert("صار خطأ في الحفظ");
    return;
  }

  alert("تم الحفظ");
  renderHomeControls();
}

async function renderHeroControls() {
  const settingsBox = document.getElementById("settingsContent");

  const { data, error } = await db
    .from("hero_settings")
    .select("*")
    .order("slot_number", { ascending: true });

  if (error) {
    console.error("renderHeroControls error:", error);
    settingsBox.innerHTML = `<div class="empty">صار خطأ في تحميل الهيرو</div>`;
    return;
  }

  const rows = data || [];

  settingsBox.innerHTML = `
    <div class="order">
      <div class="order-head">
        <div>
          <h3 class="order-title">التحكم بالهيرو</h3>
          <div class="order-info">اختار رقم المنتج وصورة الهيرو لكل سلايد.</div>
        </div>
      </div>

      <div class="home-grid">
        ${Array.from({ length: 4 }, (_, i) => {
          const slotNumber = i + 1;
          const row = rows.find(item => Number(item.slot_number) === slotNumber);
          const productId = row?.product_id || "";

          return `
            <div class="home-slot" id="heroSlot-${slotNumber}">
              <label>الهيرو ${slotNumber}</label>

              <div class="form-grid single">
                <input type="number" value="${productId}" placeholder="رقم المنتج" oninput="previewHeroSlot(${slotNumber}, this.value)">
                <input type="text" value="${row?.badge_ar || ""}" placeholder="الشارة بالعربي">
                <input type="text" value="${row?.badge_en || ""}" placeholder="الشارة بالإنجليزي">
                <input type="text" value="${row?.badge_tr || ""}" placeholder="الشارة بالتركي">

                <input type="file" accept="image/*" id="heroImageFile-${slotNumber}">
                <input type="text" value="${row?.hero_image || ""}" placeholder="رابط صورة الهيرو اختياري">
                <button onclick="saveHeroSlot(${slotNumber})">حفظ الهيرو</button>
                <button class="danger-btn" onclick="deleteHeroSlot(${slotNumber})">حذف الهيرو</button>
              </div>

              <div class="home-preview-wrap" id="heroPreview-${slotNumber}">
                ${productId ? renderProductPreview(productId) : `<div class="home-preview empty-preview">لم يتم اختيار منتج</div>`}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

async function deleteHeroSlot(slotNumber) {
  const ok = confirm(`حذف الهيرو رقم ${slotNumber}؟`);
  if (!ok) return;

  const { error } = await db
    .from("hero_settings")
    .delete()
    .eq("slot_number", slotNumber);

  if (error) {
    console.error("deleteHeroSlot error:", error);
    alert("صار خطأ في حذف الهيرو");
    return;
  }

  alert("تم حذف الهيرو");
  renderHeroControls();
}

function previewHeroSlot(slotNumber, productId) {
  const previewBox = document.getElementById(`heroPreview-${slotNumber}`);
  if (!previewBox) return;

  previewBox.innerHTML = productId
    ? renderProductPreview(productId)
    : `<div class="home-preview empty-preview">لم يتم اختيار منتج</div>`;
}

async function saveHeroSlot(slotNumber) {
  const slot = document.getElementById(`heroSlot-${slotNumber}`);
  const inputs = slot?.querySelectorAll("input");

  const productId = Number(inputs?.[0]?.value);
  const badgeAr = inputs?.[1]?.value.trim() || "مميز";
  const badgeEn = inputs?.[2]?.value.trim() || "Featured";
  const badgeTr = inputs?.[3]?.value.trim() || "Özel";
  let heroImage = inputs?.[5]?.value.trim() || null;

  const heroFile = document.getElementById(`heroImageFile-${slotNumber}`)?.files?.[0];
  const uploadedHero = await uploadProductImage(heroFile);
  if (uploadedHero) heroImage = uploadedHero;

  if (!productId) {
    alert("اكتب رقم المنتج");
    return;
  }

  if (!getProduct(productId)) {
    alert("هذا المنتج غير موجود");
    return;
  }

  const { error } = await db
    .from("hero_settings")
    .upsert({
      slot_number: slotNumber,
      product_id: productId,
      badge_ar: badgeAr,
      badge_en: badgeEn,
      badge_tr: badgeTr,
      hero_image: heroImage,
      is_active: true,
      updated_at: new Date().toISOString()
    }, { onConflict: "slot_number" });

  if (error) {
    console.error("saveHeroSlot error:", error);
    alert("صار خطأ في حفظ الهيرو");
    return;
  }

  alert("تم حفظ الهيرو");
  renderHeroControls();
}

function categoryOptions(selectedSlug = "") {
  let source = allCategories;

  if (!source.length && typeof CATEGORIES !== "undefined") {
    source = CATEGORIES
      .filter(c => c.id !== "all")
      .map(c => ({
        slug: c.id,
        name_ar: c.label?.ar || c.id
      }));
  }

  return source.map(category => `
    <option value="${category.slug}" ${selectedSlug === category.slug ? "selected" : ""}>
      ${category.name_ar}
    </option>
  `).join("");
}

function renderAddProductForm() {
  const settingsBox = document.getElementById("settingsContent");

  settingsBox.innerHTML = `
    <div class="order">
      <div class="order-head">
        <div>
          <h3 class="order-title">إضافة منتج جديد</h3>
          <div class="order-info">عبّي البيانات الأساسية وارفع الصورة من الجهاز أو الجوال.</div>
        </div>
      </div>

      <div class="form-grid" id="addProductForm">
        <input placeholder="الاسم بالعربي" data-key="name_ar">
        <input placeholder="الاسم بالإنجليزي" data-key="name_en">
        <input placeholder="الاسم بالتركي" data-key="name_tr">

        <input placeholder="الاسم الفرعي بالعربي" data-key="sub_ar">
        <input placeholder="الاسم الفرعي بالإنجليزي" data-key="sub_en">
        <input placeholder="الاسم الفرعي بالتركي" data-key="sub_tr">

        <textarea placeholder="الوصف بالعربي" data-key="description_ar"></textarea>
        <textarea placeholder="الوصف بالإنجليزي" data-key="description_en"></textarea>
        <textarea placeholder="الوصف بالتركي" data-key="description_tr"></textarea>

        <input type="number" placeholder="السعر" data-key="price">

        <select data-key="category_slug">
          <option value="">اختر القائمة</option>
          ${categoryOptions()}
        </select>

        <input type="file" accept="image/*" id="addProductImageFile">
        <input placeholder="رابط الصورة أو ارفع صورة من الجهاز" data-key="image">

        <input type="file" accept="image/*" id="addProductHeroFile">
        <input placeholder="رابط صورة الهيرو اختياري" data-key="hero_image">

        <input placeholder="التقييم مثال 4.8/5" data-key="rating" value="4.8/5">
        <input type="number" placeholder="ترتيب المنتج" data-key="sort_order">

        <label class="check-line"><input type="checkbox" data-key="has_sizes"> له أحجام؟</label>
        <input placeholder='الأحجام مثال ["Small","Medium"]' data-key="sizes">

        <label class="check-line"><input type="checkbox" data-key="track_stock"> يظهر في التوفر؟</label>
        <label class="check-line"><input type="checkbox" data-key="is_available" checked> متوفر</label>

        <button class="full-btn" onclick="addProduct()">إضافة المنتج</button>
      </div>
    </div>
  `;
}

function getFormData(formId) {
  const form = document.getElementById(formId);
  const fields = form.querySelectorAll("[data-key]");
  const payload = {};

  fields.forEach(field => {
    const key = field.dataset.key;

    if (field.type === "checkbox") {
      payload[key] = field.checked;
      return;
    }

    const value = field.value.trim();

    if (!value || value.toUpperCase() === "EMPTY") {
      payload[key] = null;
    } else {
      payload[key] = value;
    }
  });

  payload.price = Number(payload.price || 0);
  payload.sort_order = Number(payload.sort_order || 0);

  try {
    payload.sizes = payload.sizes ? JSON.parse(payload.sizes) : [];
  } catch {
    payload.sizes = [];
  }

  payload.is_active = true;
  payload.updated_at = new Date().toISOString();

  return payload;
}

async function addProduct() {
  const payload = getFormData("addProductForm");

  if (!payload.name_ar) {
    alert("الاسم العربي مطلوب");
    return;
  }

  if (!payload.category_slug) {
    alert("اختر القائمة");
    return;
  }

  const imageFile = document.getElementById("addProductImageFile")?.files?.[0];

  if (imageFile) {
    const uploadedImage = await uploadProductImage(imageFile);

    if (!uploadedImage) {
      alert("فشل رفع الصورة");
      return;
    }

    payload.image = uploadedImage;
  }

  console.log("FINAL PAYLOAD:", payload);

  const { error } = await db
    .from("products")
    .insert(payload);

  if (error) {
    console.error("addProduct error:", error);
    alert("خطأ: " + error.message);
    return;
  }

  alert("تم إضافة المنتج فعليًا 🔥");
}

function renderEditProductForm() {
  const settingsBox = document.getElementById("settingsContent");

  settingsBox.innerHTML = `
    <div class="order">
      <div class="order-head">
        <div>
          <h3 class="order-title">تعديل منتج</h3>
          <div class="order-info">اكتب رقم المنتج ثم اضغط تحميل.</div>
        </div>
      </div>

      <div class="home-input-row">
        <input type="number" id="editProductId" placeholder="رقم المنتج">
        <button onclick="loadProductForEdit()">تحميل</button>
      </div>

      <div id="editProductArea"></div>
    </div>
  `;
}

function loadProductForEdit() {
  const id = Number(document.getElementById("editProductId")?.value);
  const product = getProduct(id);
  const area = document.getElementById("editProductArea");

  if (!product) {
    area.innerHTML = `<div class="empty">منتج غير موجود</div>`;
    return;
  }

  area.innerHTML = `
    ${renderProductPreview(id)}

    <div class="form-grid" id="editProductForm" data-id="${id}">
      <input value="${product.name_ar || ""}" placeholder="الاسم بالعربي" data-key="name_ar">
      <input value="${product.name_en || ""}" placeholder="الاسم بالإنجليزي" data-key="name_en">
      <input value="${product.name_tr || ""}" placeholder="الاسم بالتركي" data-key="name_tr">

      <input value="${product.sub_ar || ""}" placeholder="الاسم الفرعي بالعربي" data-key="sub_ar">
      <input value="${product.sub_en || ""}" placeholder="الاسم الفرعي بالإنجليزي" data-key="sub_en">
      <input value="${product.sub_tr || ""}" placeholder="الاسم الفرعي بالتركي" data-key="sub_tr">

      <textarea placeholder="الوصف بالعربي" data-key="description_ar">${product.description_ar || ""}</textarea>
      <textarea placeholder="الوصف بالإنجليزي" data-key="description_en">${product.description_en || ""}</textarea>
      <textarea placeholder="الوصف بالتركي" data-key="description_tr">${product.description_tr || ""}</textarea>

      <input type="number" value="${Number(product.price || 0)}" placeholder="السعر" data-key="price">
      <select data-key="category_slug">${categoryOptions(product.category_slug)}</select>

      <input type="file" accept="image/*" id="editProductImageFile">
      <input value="${product.image || ""}" placeholder="رابط الصورة" data-key="image">

      <input type="file" accept="image/*" id="editProductHeroFile">
      <input value="${product.hero_image || ""}" placeholder="رابط صورة الهيرو اختياري" data-key="hero_image">

      <input value="${product.rating || "4.8/5"}" placeholder="التقييم" data-key="rating">
      <input type="number" value="${Number(product.sort_order || 0)}" placeholder="ترتيب المنتج" data-key="sort_order">

      <label class="check-line"><input type="checkbox" data-key="has_sizes" ${product.has_sizes ? "checked" : ""}> له أحجام؟</label>
      <input value='${JSON.stringify(product.sizes || [])}' placeholder='الأحجام مثال ["Small","Medium"]' data-key="sizes">

      <label class="check-line"><input type="checkbox" data-key="track_stock" ${product.track_stock ? "checked" : ""}> يظهر في التوفر؟</label>
      <label class="check-line"><input type="checkbox" data-key="is_available" ${product.is_available !== false ? "checked" : ""}> متوفر</label>

      <button class="full-btn" onclick="updateProduct()">حفظ التعديل</button>
      <button class="danger-btn" onclick="deleteProduct()">حذف المنتج</button>
    </div>
  `;
}

async function updateProduct() {
  const form = document.getElementById("editProductForm");
  const productId = Number(form?.dataset.id);

  if (!productId) return;

  const payload = getFormData("editProductForm");

  const imageFile = document.getElementById("editProductImageFile")?.files?.[0];

  if (imageFile) {
    const uploadedImage = await uploadProductImage(imageFile);

    if (!uploadedImage) {
      alert("فشل رفع الصورة");
      return;
    }

    payload.image = uploadedImage;
  }

  console.log("UPDATE FINAL:", payload);

  const { error } = await db
    .from("products")
    .update(payload)
    .eq("id", productId);

  if (error) {
    console.error(error);
    alert("خطأ: " + error.message);
    return;
  }

  alert("تم التعديل 🔥");
}

async function deleteProduct() {
  const form = document.getElementById("editProductForm");
  const productId = Number(form?.dataset.id);
  const product = getProduct(productId);

  if (!product) return;

  const ok = confirm(`متأكد تبغى تحذف/تخفي المنتج؟\n${product.name_ar}`);
  if (!ok) return;

  const { error } = await db
    .from("products")
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq("id", productId);

  if (error) {
    console.error("deleteProduct error:", error);
    alert("صار خطأ في الحذف");
    return;
  }

  alert("تم إخفاء المنتج");
  await loadProducts();
  renderEditProductForm();
}

function renderCategoryForm() {
  const settingsBox = document.getElementById("settingsContent");

  settingsBox.innerHTML = `
    <div class="order">
      <div class="order-head">
        <div>
          <h3 class="order-title">إضافة قائمة جديدة</h3>
          <div class="order-info">مثال: breakfast / lunch / drinks</div>
        </div>
      </div>

      <div class="form-grid" id="categoryForm">
        <input placeholder="معرّف القائمة مثال breakfast" data-key="slug">
        <input placeholder="اسم القائمة بالعربي" data-key="name_ar">
        <input placeholder="اسم القائمة بالإنجليزي" data-key="name_en">
        <input placeholder="اسم القائمة بالتركي" data-key="name_tr">
        <input type="number" placeholder="ترتيب القائمة" data-key="sort_order">
        <button class="full-btn" onclick="addCategory()">إضافة القائمة</button>
      </div>

      <div class="items-box">
        ${allCategories.map(category => `
          <div class="item category-manage-row">
            <div>
              <strong>${category.name_ar}</strong> — ${category.slug}
            </div>

            <div class="category-actions">
              <input
                type="number"
                value="${Number(category.sort_order || 0)}"
                id="catSort-${category.slug}"
                placeholder="الترتيب"
              >
              <button onclick="updateCategorySort('${category.slug}')">حفظ الترتيب</button>
              <button class="danger-mini" onclick="deleteCategory('${category.slug}', '${category.name_ar}')">حذف</button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

async function updateCategorySort(slug) {
  const value = Number(document.getElementById(`catSort-${slug}`)?.value || 0);

  const { error } = await db
    .from("categories")
    .update({ sort_order: value })
    .eq("slug", slug);

  if (error) {
    alert("صار خطأ في حفظ الترتيب");
    console.error(error);
    return;
  }

  await loadCategories();
  renderCategoryForm();
}

async function deleteCategory(slug, name) {
  const ok = confirm(`حذف قائمة "${name}"؟\nالمنتجات داخلها لن تُحذف، لكن القائمة ستختفي.`);
  if (!ok) return;

  const { error } = await db
    .from("categories")
    .update({ is_active: false })
    .eq("slug", slug);

  if (error) {
    alert("صار خطأ في حذف القائمة");
    console.error(error);
    return;
  }

  await loadCategories();
  renderCategoryForm();
}

async function addCategory() {
  const form = document.getElementById("categoryForm");
  const payload = {};

  form.querySelectorAll("[data-key]").forEach(field => {
    payload[field.dataset.key] = field.value.trim();
  });

  payload.sort_order = Number(payload.sort_order || 0);
  payload.is_active = true;

  if (!payload.slug || !payload.name_ar) {
    alert("معرّف القائمة والاسم العربي مطلوبة");
    return;
  }

  const { error } = await db
    .from("categories")
    .insert(payload);

  if (error) {
    console.error("addCategory error:", error);
    alert("صار خطأ في إضافة القائمة");
    return;
  }

  alert("تم إضافة القائمة");
  await loadCategories();
  renderCategoryForm();
}

function renderStockPicker() {
  const settingsBox = document.getElementById("settingsContent");

  settingsBox.innerHTML = `
    <div class="order">
      <div class="order-head">
        <div>
          <h3 class="order-title">اختيار المنتجات التي تظهر في التوفر</h3>
          <div class="order-info">فعّل المنتجات التي تريد التحكم بها من تبويب التوفر.</div>
        </div>
      </div>

      <div class="stock-picker-list">
        ${allProducts.map(product => `
          <label class="stock-picker-item">
            <input type="checkbox" ${product.track_stock ? "checked" : ""} onchange="toggleTrackStock(${product.id}, this.checked)">
            <img src="${product.image || "./images/fallback.jpg"}" onerror="this.src='./images/fallback.jpg'">
            <div>
              <strong>${product.name_ar}</strong>
              <span>رقم المنتج: ${product.id} • ${product.category_slug || "-"}</span>
            </div>
          </label>
        `).join("")}
      </div>
    </div>
  `;
}

async function toggleTrackStock(productId, trackStock) {
  const { error } = await db
    .from("products")
    .update({
      track_stock: trackStock,
      updated_at: new Date().toISOString()
    })
    .eq("id", productId);

  if (error) {
    console.error("toggleTrackStock error:", error);
    alert("صار خطأ");
    return;
  }

  await loadProducts();
  await loadStockControls();
}

async function changeStatus(orderId, status) {
  const { error } = await updateOrderStatus(orderId, status);

  if (error) {
    console.error("changeStatus error:", error);
    alert("صار خطأ في تحديث الطلب");
    return;
  }

  refreshAll();
}

async function refreshAll() {
  await loadCategories();
  await loadProducts();
  await loadOrders();
  await loadStockControls();

  if (currentDashTab === "settings") {
    renderSettingsView();
  }
}

function initDashboard() {
  refreshAll();

  db
    .channel("orders-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      () => loadOrders()
    )
    .subscribe();

  db
    .channel("products-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "products" },
      async () => {
        await loadProducts();
        await loadStockControls();
      }
    )
    .subscribe();

  setInterval(() => {
    if (currentDashTab !== "settings") {
      refreshAll();
    } else {
      loadOrders();
      loadStockControls();
    }
  }, 10000);
}

initDashboard();