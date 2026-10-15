function getSupabaseClient() {
  if (!window.__PALMU_SUPABASE__) {
    window.__PALMU_SUPABASE__ = supabase.createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_KEY
    );
  }

  return window.__PALMU_SUPABASE__;
}

function getTurkeyParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: CONFIG.TIMEZONE || "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const parts = {};
  formatter.formatToParts(date).forEach(part => {
    if (part.type !== "literal") parts[part.type] = part.value;
  });

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

function formatBusinessDayKeyFromParts(parts) {
  const y = String(parts.year).padStart(4, "0");
  const m = String(parts.month).padStart(2, "0");
  const d = String(parts.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getBusinessDayKey(date = new Date()) {
  const parts = getTurkeyParts(date);
  const startHour = CONFIG.BUSINESS_DAY_START_HOUR ?? 2;

  if (parts.hour >= startHour) {
    return formatBusinessDayKeyFromParts(parts);
  }

  const previousDayDate = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  return formatBusinessDayKeyFromParts(getTurkeyParts(previousDayDate));
}

async function getNextDailyOrderNumber() {
  const db = getSupabaseClient();
  const businessDay = getBusinessDayKey();

  const { count, error } = await db
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("business_day", businessDay);

  if (error) {
    console.error("getNextDailyOrderNumber error:", error);
    return {
      businessDay,
      dailyOrderNumber: null
    };
  }

  return {
    businessDay,
    dailyOrderNumber: Number(count || 0) + 1
  };
}

function getOrderDisplayNumber(order) {
  if (order?.daily_order_number) return order.daily_order_number;
  return order?.id || "-";
}

function getOrderStatusLabel(status, lang = "ar") {
  const labels = {
    ar: {
      new: "جاري التحضير",
      preparing: "جاري التحضير",
      ready: "جاهز",
      done: "تم التسليم"
    },
    en: {
      new: "Preparing",
      preparing: "Preparing",
      ready: "Ready",
      done: "Completed"
    },
    tr: {
      new: "Hazırlanıyor",
      preparing: "Hazırlanıyor",
      ready: "Hazır",
      done: "Teslim edildi"
    }
  };

  return labels[lang]?.[status] || status;
}

async function createOrder(payload) {
  const db = getSupabaseClient();
  const numbering = await getNextDailyOrderNumber();

  const finalPayload = {
    ...payload,
    status: payload.status || "preparing",
    business_day: numbering.businessDay,
    daily_order_number: numbering.dailyOrderNumber
  };

  const { data, error } = await db
    .from("orders")
    .insert(finalPayload)
    .select()
    .single();

  return { data, error };
}

async function updateOrderStatus(orderId, status) {
  const db = getSupabaseClient();

  return db
    .from("orders")
    .update({ status })
    .eq("id", orderId);
}