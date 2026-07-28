const { createHmac } = require('crypto');
const { parseRemoveCommand, findCartRemovalIndex } = require('./_shared/cart.js');
const { searchFish } = require('./_shared/fishSearch.js');
const { STATUS_LABEL, STATUS_EMOJI, formatOrderDate } = require('./_shared/orderHelpers.js');
const { notifyError } = require('./_shared/errorNotify.js');
const { checkRateLimit } = require('./_shared/rateLimiter.js');

const {
  MESSENGER_PAGE_TOKEN:  TOKEN,     // Page Access Token จากขั้นตอน "สร้างโทเค็นการเข้าถึง"
  MESSENGER_VERIFY_TOKEN: VERIFY,   // string ที่ตั้งเองตอนกรอก Webhooks (เช่น awesomeaqua_verify_2026)
  MESSENGER_APP_SECRET:  APP_SECRET, // App Secret จากหน้า "การตั้งค่าแอพ > ขั้นพื้นฐาน"
  MESSENGER_OWNER_PSID:  OWNER_ID,  // PSID ของแอดมิน ไว้ push แจ้งเตือนออเดอร์ใหม่ (หาได้หลังแอดมินทักบอทครั้งแรก)
  SUPABASE_URL:               DB_URL,
  SUPABASE_SERVICE_ROLE_KEY:  DB_KEY, // ⚠️ ต้องเป็น Service Role Key เท่านั้น (bypass RLS) ห้ามใช้ anon key
} = process.env;

const GRAPH_API = 'https://graph.facebook.com/v21.0/me/messages';
const DB_HEADS  = { apikey: DB_KEY, Authorization: `Bearer ${DB_KEY}` };
const SITE      = 'https://awesome-aqua.vercel.app';

// ── ส่งข้อความผ่าน Send API ──
const sendMessage = (psid, message) =>
  fetch(`${GRAPH_API}?access_token=${TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: psid }, message })
  });

const sendText = (psid, text) => sendMessage(psid, { text });

const sendImage = (psid, url) =>
  sendMessage(psid, { attachment: { type: 'image', payload: { url, is_reusable: true } } });

// ── Supabase REST helpers ──
const dbGet = async (path) => {
  const res  = await fetch(`${DB_URL}/rest/v1/${path}`, { headers: DB_HEADS });
  const data = await res.json();
  return data[0] || null;
};

// เหมือน dbGet แต่คืนมาทั้ง array (ใช้ตอนค้นหาปลาหลายตัว / ดึงประวัติออเดอร์หลายรายการ)
const dbList = async (path) => {
  const res  = await fetch(`${DB_URL}/rest/v1/${path}`, { headers: DB_HEADS });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
};

const dbUpsert = (path, body) =>
  fetch(`${DB_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...DB_HEADS, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(body)
  });

// insert แถวใหม่ + คืนค่าแถวที่สร้างกลับมา (ใช้ตอนสร้าง order เพื่อเอา id)
const dbInsert = async (path, body) => {
  const res = await fetch(`${DB_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...DB_HEADS, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
};

const dbPatch = (path, body) =>
  fetch(`${DB_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { ...DB_HEADS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

const price = (f) => (!f.price_max || f.price_max === f.price_min)
  ? `฿${f.price_min}`
  : `฿${f.price_min} – ฿${f.price_max}`;

const unitPrice = (f) => (f.sale_price && f.sale_price > 0) ? f.sale_price : f.price_min;

const getSession = (psid) => dbGet(`messenger_sessions?user_id=eq.${psid}&limit=1`);

const isSessionExpired = (session) => {
  if (!session?.updated_at) return true;
  const hoursDiff = (new Date() - new Date(session.updated_at)) / (1000 * 60 * 60);
  return hoursDiff > 24;
};

// ── ส่งรายละเอียดปลา 1 ตัว พร้อมบันทึก session (ตัวที่กำลังดูล่าสุด) ──
async function sendFishDetail(psid, fishId) {
  const fish = await dbGet(`fish?id=eq.${fishId}&limit=1`);
  if (!fish) { await sendText(psid, 'ขออภัยครับ ไม่พบข้อมูลปลา'); return; }

  await dbUpsert('messenger_sessions', { user_id: psid, fish_id: fishId, updated_at: new Date().toISOString() });

  if (fish.image) await sendImage(psid, fish.image);
  await sendText(psid,
    `🐟 ${fish.name_th}\n📋 ${fish.species || ''}\n` +
    `💰 ราคา: ${price(fish)}\n` +
    `📦 ${fish.stock === 0 ? '❌ หมดสต็อก' : `✅ ${fish.stock} ตัว`}\n\n` +
    `${fish.desc_th || ''}\n\n──────────────\n` +
    (fish.stock === 0
      ? `🔔 พิมพ์ "แจ้งเตือน" เพื่อให้บอทแจ้งทันทีที่มีของ\n`
      : `พิมพ์ "เพิ่ม" เพื่อใส่ตะกร้า 🛒\nพิมพ์ "สั่งซื้อ" เพื่อสั่งตัวนี้เลย ⚡\n`) +
    `พิมพ์ "ดูปลา" เพื่อดูปลาตัวอื่น 🐠\n` +
    `พิมพ์ "ตะกร้า" เพื่อดูตะกร้า 🧺\n` +
    `พิมพ์ "ติดต่อ" เพื่อคุยกับแอดมิน 👨‍💼`
  );
}

// ── ข้อความทักทาย/fallback ──
async function sendGreeting(psid) {
  await sendText(psid,
    `สวัสดีครับ! 🐟 Awesome Aqua ยินดีให้บริการ\n\n` +
    `🐠 "ดูปลา" — ดูปลาทั้งหมด\n➕ "เพิ่ม" — ใส่ตะกร้า\n🧺 "ตะกร้า" — ดูตะกร้า\n🛒 "สั่งซื้อ" — ยืนยันสั่งซื้อ\n📋 "ประวัติ" — ดูออเดอร์ที่เคยสั่ง\n👨‍💼 "ติดต่อ" — คุยกับแอดมิน\n\n💡 หรือพิมพ์ชื่อปลาที่สนใจได้เลย บอทจะช่วยค้นหาให้ครับ\n\n🔒 พิมพ์ "ลบข้อมูลฉัน" ได้ทุกเมื่อถ้าต้องการลบข้อมูลของคุณออกจากระบบ\n\n` +
    `${SITE}`
  );
}

// ── สรุปตะกร้าเป็นข้อความ (คืนราคาปัจจุบันของแต่ละตัวเสมอ ไม่ cache ราคาเก่า) ──
async function cartSummaryText(cart) {
  if (!cart || !cart.length) return '🧺 ตะกร้าว่างเปล่าครับ\n\nลองเลือกปลาที่สนใจแล้วพิมพ์ "เพิ่ม" ได้เลย';

  let total = 0;
  const lines = [];
  let idx = 0;
  for (const item of cart) {
    const fish = await dbGet(`fish?id=eq.${item.fish_id}&limit=1`);
    if (!fish) continue;
    idx += 1;
    const sub = unitPrice(fish) * item.qty;
    total += sub;
    lines.push(`${idx}. ${fish.name_th} x${item.qty} ตัว = ฿${sub.toLocaleString('th-TH')}`);
  }

  return `🧺 ตะกร้าของคุณ:\n${lines.join('\n')}\n\n💰 รวม: ฿${total.toLocaleString('th-TH')}\n\n` +
    `พิมพ์ "สั่งซื้อ" เพื่อยืนยัน\nพิมพ์ "ลบ [เลข]" เพื่อลบทีละชิ้น เช่น "ลบ 1"\nพิมพ์ "ล้างตะกร้า" เพื่อเริ่มใหม่`;
}

// ── เพิ่มปลาที่กำลังดูอยู่ลงตะกร้า ──
async function addToCart(psid) {
  const session = await getSession(psid);
  if (!session?.fish_id) {
    await sendText(psid, `ยังไม่ได้เลือกปลาเลยครับ ลองกดดูปลาจากหน้าเว็บก่อนนะครับ 🐟\n${SITE}`);
    return;
  }

  const fish = await dbGet(`fish?id=eq.${session.fish_id}&limit=1`);
  if (!fish || fish.stock === 0) {
    await sendText(psid, '😢 ขออภัยครับ ปลาตัวนี้หมดสต็อกแล้ว เพิ่มลงตะกร้าไม่ได้ครับ');
    return;
  }

  const cart = session.cart || [];
  const existing = cart.find(c => c.fish_id === fish.id);
  if (existing) existing.qty += 1;
  else cart.push({ fish_id: fish.id, qty: 1 });

  await dbUpsert('messenger_sessions', { user_id: psid, cart, updated_at: new Date().toISOString() });

  await sendText(psid, `➕ เพิ่ม "${fish.name_th}" ลงตะกร้าแล้วครับ\n\n${await cartSummaryText(cart)}`);
}

// ── ล้างตะกร้า ──
async function clearCart(psid) {
  await dbUpsert('messenger_sessions', { user_id: psid, cart: [], updated_at: new Date().toISOString() });
  await sendText(psid, '🗑️ ล้างตะกร้าเรียบร้อยครับ');
}

// ── ลบปลาทีละชิ้นจากตะกร้า ตามหมายเลขที่แสดงใน cartSummaryText (นับเฉพาะรายการที่ยังพบข้อมูลปลาอยู่) ──
async function removeFromCart(psid, indexText) {
  const session = await getSession(psid);
  const cart = session?.cart || [];

  if (!cart.length) {
    await sendText(psid, '🧺 ตะกร้าว่างเปล่าครับ ไม่มีอะไรให้ลบ');
    return;
  }

  const targetIdx = parseInt(indexText, 10);
  if (!targetIdx || targetIdx < 1) {
    await sendText(psid, 'พิมพ์ "ลบ [เลข]" นะครับ เช่น "ลบ 1" (ดูเลขได้จากพิมพ์ "ตะกร้า")');
    return;
  }

  // นับเฉพาะรายการที่ยังหาปลาเจอ ให้ตรงกับเลขที่แสดงใน cartSummaryText
  const fishById = {};
  for (const item of cart) {
    fishById[item.fish_id] = await dbGet(`fish?id=eq.${item.fish_id}&limit=1`);
  }
  const removeAt = findCartRemovalIndex(cart, targetIdx, (item) => !!fishById[item.fish_id]);

  if (removeAt === -1) {
    await sendText(psid, `ไม่พบรายการหมายเลข ${targetIdx} ในตะกร้าครับ ลองพิมพ์ "ตะกร้า" เพื่อดูรายการปัจจุบัน`);
    return;
  }

  const removedFish = fishById[cart[removeAt].fish_id];
  cart.splice(removeAt, 1);

  await dbUpsert('messenger_sessions', { user_id: psid, cart, updated_at: new Date().toISOString() });

  const removedName = removedFish?.name_th || 'รายการ';
  await sendText(psid, `🗑️ ลบ "${removedName}" ออกจากตะกร้าแล้วครับ\n\n${await cartSummaryText(cart)}`);
}

// ── ยืนยันสั่งซื้อ: รองรับทั้งตะกร้าหลายชิ้น และเคสเดิม (ดูปลาตัวเดียวแล้วสั่งเลยโดยไม่ผ่านตะกร้า) ──
async function checkout(psid) {
  const session = await getSession(psid);

  if (isSessionExpired(session)) {
    await sendText(psid, `ขออภัยครับ เซสชันการทำรายการหมดอายุแล้ว ⏱️\nรบกวนคุณลูกค้ากดเลือกปลาที่สนใจจากหน้าเว็บใหม่อีกครั้งนะครับ 🐟\n${SITE}`);
    return;
  }

  let cart = session?.cart || [];
  // เข้ากันได้กับ flow เดิม: ถ้าตะกร้าว่างแต่กำลังดูปลาอยู่ ให้ถือว่าสั่งตัวนั้นตัวเดียว
  if (!cart.length && session?.fish_id) {
    cart = [{ fish_id: session.fish_id, qty: 1 }];
  }

  if (!cart.length) {
    await sendText(psid, `ยังไม่มีปลาในตะกร้าเลยครับ 🧺\nลองเลือกปลาที่สนใจจากหน้าเว็บก่อนนะครับ\n${SITE}`);
    return;
  }

  // ดึงข้อมูลปลาทุกตัว + เช็คสต็อก
  const items = [];
  for (const item of cart) {
    const fish = await dbGet(`fish?id=eq.${item.fish_id}&limit=1`);
    if (fish) items.push({ fish, qty: item.qty || 1 });
  }

  const outOfStock = items.filter(i => i.fish.stock < i.qty);
  if (outOfStock.length) {
    const names = outOfStock.map(i => `${i.fish.name_th} (เหลือ ${i.fish.stock} ตัว)`).join(', ');
    await sendText(psid, `😢 สต็อกไม่พอสำหรับ: ${names}\nลองปรับจำนวนหรือลบออกจากตะกร้าก่อนนะครับ (พิมพ์ "ล้างตะกร้า" แล้วเลือกใหม่)`);
    return;
  }

  const total = items.reduce((sum, i) => sum + unitPrice(i.fish) * i.qty, 0);

  const order = await dbInsert('orders', { psid, status: 'pending', total_amount: total });
  if (!order?.id) {
    await sendText(psid, 'เกิดข้อผิดพลาดในการสร้างออเดอร์ กรุณาลองใหม่อีกครั้งครับ 🙏');
    return;
  }

  const today = new Date().toLocaleDateString('en-CA');
  for (const { fish, qty } of items) {
    await dbInsert('finance', {
      type: 'income',
      name: `ขายปลา: ${fish.name_th} x${qty} ตัว (ออเดอร์ #${order.id.slice(0, 8)})`,
      amount: unitPrice(fish) * qty,
      date: today,
      fish_id: fish.id,
      order_id: order.id,
    });
    await dbPatch(`fish?id=eq.${fish.id}`, { stock: fish.stock - qty });
  }

  // ล้างตะกร้าหลังยืนยันสำเร็จ
  await dbUpsert('messenger_sessions', { user_id: psid, cart: [], updated_at: new Date().toISOString() });

  const itemLines = items.map(i => `• ${i.fish.name_th} x${i.qty} ตัว`).join('\n');

  await sendText(psid,
    `✅ ยืนยันคำสั่งซื้อแล้วครับ! (ออเดอร์ #${order.id.slice(0, 8)})\n\n${itemLines}\n\n` +
    `💰 ยอดรวม: ฿${total.toLocaleString('th-TH')}\n\n` +
    `📲 ช่องทางชำระเงิน:\n• พร้อมเพย์: 082-237-2512\n• ธนาคารกสิกร: 136-3-82691-8\n\n` +
    `โอนแล้วส่งสลิปมาในแชทนี้ได้เลยครับ 🙏`
  );
  await sendImage(psid, `${SITE}/images/qr-payment.png`);

  if (OWNER_ID) {
    await sendText(OWNER_ID, `🔔 มีออเดอร์ใหม่! #${order.id.slice(0, 8)}\n${itemLines}\n💰 รวม ฿${total.toLocaleString('th-TH')}\n👤 PSID: ${psid}`);
  }
}

// ── ค้นหาปลาแบบ fuzzy จากข้อความอิสระที่ลูกค้าพิมพ์ (ไม่ตรงคำสั่งไหนเลย) ──
async function searchAndReply(psid, query, preFetchedFish) {
  const allFish = preFetchedFish || await dbList('fish?is_archived=eq.false&select=id,name_th,name_en,species,stock,price_min,price_max,sale_price,image');
  const results = searchFish(query, allFish);

  if (!results.length) {
    await sendGreeting(psid);
    return;
  }

  if (results.length === 1) {
    await sendFishDetail(psid, results[0].id);
    return;
  }

  const lines = results.map((f, i) =>
    `${i + 1}. ${f.name_th}${f.stock === 0 ? ' (หมดสต็อก)' : ''} — ${price(f)}`
  ).join('\n');

  await dbUpsert('messenger_sessions', { user_id: psid, search_results: results.map(f => f.id), updated_at: new Date().toISOString() });

  await sendText(psid,
    `🔍 เจอปลาที่ใกล้เคียงกับ "${query}" ${results.length} ตัวครับ:\n\n${lines}\n\n` +
    `พิมพ์เลข (เช่น "1") เพื่อดูรายละเอียดตัวนั้น หรือดูทั้งหมดที่เว็บ:\n${SITE}`
  );
}

// ── สมัครรับแจ้งเตือนเมื่อปลาที่กำลังดู (หมดสต็อกอยู่) กลับมามีสต็อก ──
async function subscribeRestockAlert(psid) {
  const session = await getSession(psid);
  if (!session?.fish_id) {
    await sendText(psid, 'ยังไม่ได้เลือกปลาเลยครับ ลองดูปลาที่สนใจก่อนแล้วค่อยพิมพ์คำสั่งนี้นะครับ 🐟');
    return;
  }

  const fish = await dbGet(`fish?id=eq.${session.fish_id}&limit=1`);
  if (!fish) { await sendText(psid, 'ขออภัยครับ ไม่พบข้อมูลปลาตัวนี้แล้ว'); return; }

  if (fish.stock > 0) {
    await sendText(psid, `🐟 "${fish.name_th}" มีสต็อกอยู่แล้วครับ! พิมพ์ "เพิ่ม" เพื่อใส่ตะกร้าได้เลย 😊`);
    return;
  }

  await dbUpsert('restock_alerts', { fish_id: fish.id, psid });
  await sendText(psid, `🔔 รับทราบครับ! พอ "${fish.name_th}" กลับมามีสต็อก จะรีบแจ้งคุณลูกค้าทันทีเลยครับ 😊`);
}

// ── ดูประวัติคำสั่งซื้อของตัวเอง (5 รายการล่าสุด) ──
async function sendOrderHistory(psid) {
  const orders = await dbList(
    `orders?psid=eq.${encodeURIComponent(psid)}&order=created_at.desc&limit=5`
  );

  if (!orders.length) {
    await sendText(psid, `📋 ยังไม่มีประวัติคำสั่งซื้อครับ\n\nลองดูปลาที่สนใจแล้วสั่งซื้อได้เลยที่:\n${SITE}`);
    return;
  }

  const lines = orders.map((o) => {
    const emoji = STATUS_EMOJI[o.status] || '•';
    const label = STATUS_LABEL[o.status] || o.status;
    return `${emoji} #${o.id.slice(0, 8)} — ฿${(o.total_amount || 0).toLocaleString('th-TH')} (${label})\n   ${formatOrderDate(o.created_at)}`;
  }).join('\n\n');

  await sendText(psid, `📋 ประวัติคำสั่งซื้อล่าสุดของคุณ:\n\n${lines}\n\n👨‍💼 มีคำถามเกี่ยวกับออเดอร์ไหน พิมพ์ "ติดต่อ" ได้เลยครับ`);
}
async function handleText(psid, textRaw) {
  const text = textRaw.trim();

  if (['ดูปลา', 'ปลา', 'ดูปลาทั้งหมด'].includes(text)) {
    await sendText(psid, `🐟 ดูปลาทั้งหมดได้ที่:\n${SITE}\n\nกดปุ่ม Messenger ที่ปลาที่สนใจได้เลยครับ 😊`);
    return;
  }

  if (['ติดต่อ', 'แอดมิน', 'ติดต่อแอดมิน'].includes(text)) {
    await sendText(psid,
      `👨‍💼 ติดต่อแอดมินได้เลยครับ!\n\n` +
      `📞 โทร: 082-237-2512\n📘 Facebook: Awesome Aqua\n\n` +
      `ยินดีให้คำปรึกษาทุกเรื่องครับ 🙏`
    );
    return;
  }

  if (['เพิ่ม', 'หยิบใส่ตะกร้า', 'ใส่ตะกร้า'].includes(text)) {
    await addToCart(psid);
    return;
  }

  if (['ตะกร้า', 'ดูตะกร้า'].includes(text)) {
    const session = await getSession(psid);
    await sendText(psid, await cartSummaryText(session?.cart || []));
    return;
  }

  if (['ล้างตะกร้า', 'เคลียร์ตะกร้า'].includes(text)) {
    await clearCart(psid);
    return;
  }

  // "ลบ 1", "ลบตัวที่ 1", "ลบทีละชิ้น 1" ฯลฯ — จับหมายเลขท้ายข้อความ
  const removeIdx = parseRemoveCommand(text);
  if (removeIdx !== null) {
    await removeFromCart(psid, removeIdx);
    return;
  }

  if (['สั่ง', 'จอง', 'สั่งซื้อ', 'ยืนยัน', 'เช็คเอาท์', 'checkout'].includes(text)) {
    await checkout(psid);
    return;
  }

  // ── ลบข้อมูลตัวเอง (self-service data deletion — ตามข้อกำหนด Meta Data Deletion) ──
  if (['ลบข้อมูลฉัน', 'ลบข้อมูลของฉัน', 'ลบข้อมูลผม', 'ลบข้อมูลส่วนตัว'].includes(text)) {
    await deleteMyData(psid);
    return;
  }

  if (['ประวัติ', 'ประวัติการสั่งซื้อ', 'ประวัติออเดอร์', 'ออเดอร์ของฉัน', 'ดูออเดอร์'].includes(text)) {
    await sendOrderHistory(psid);
    return;
  }

  if (['แจ้งเตือน', 'แจ้งเมื่อมีของ', 'แจ้งเตือนสต็อก', 'แจ้งเตือนของ'].includes(text)) {
    await subscribeRestockAlert(psid);
    return;
  }

  // ── เลือกจากรายการค้นหา (เช่น พิมพ์ "1" หลังบอทโชว์ผลค้นหาหลายตัว) ──
  if (/^\d+$/.test(text)) {
    const session = await getSession(psid);
    const idx = parseInt(text, 10) - 1;
    const picked = session?.search_results?.[idx];
    if (picked) {
      await sendFishDetail(psid, picked);
      return;
    }
  }

  // ── ไม่ตรงคำสั่งไหนเลย: ลองค้นหาชื่อปลาแบบ fuzzy ก่อน ถ้าไม่เจอค่อย fallback เป็นทักทาย ──
  if (text.length >= 2) {
    const allFish = await dbList('fish?is_archived=eq.false&select=id,name_th,name_en,species,stock,price_min,price_max,sale_price,image&limit=200');
    const quickMatch = searchFish(text, allFish, { limit: 1 });
    if (quickMatch.length) {
      await searchAndReply(psid, text, allFish);
      return;
    }
  }

  await sendGreeting(psid);
}

// ── ลบข้อมูลของผู้ใช้เอง (ตะกร้า/session) + ตัดการเชื่อมโยง PSID ออกจากออเดอร์เดิม ──
// เก็บยอดขาย/บัญชีไว้เหมือนเดิม (ไม่ใช่ PII) แค่ตัดไม่ให้ผูกกับตัวบุคคลอีกต่อไป
async function deleteMyData(psid) {
  await fetch(`${DB_URL}/rest/v1/messenger_sessions?user_id=eq.${encodeURIComponent(psid)}`, {
    method: 'DELETE',
    headers: DB_HEADS,
  }).catch(() => {});

  await fetch(`${DB_URL}/rest/v1/restock_alerts?psid=eq.${encodeURIComponent(psid)}`, {
    method: 'DELETE',
    headers: DB_HEADS,
  }).catch(() => {});

  await fetch(`${DB_URL}/rest/v1/orders?psid=eq.${encodeURIComponent(psid)}`, {
    method: 'PATCH',
    headers: { ...DB_HEADS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ psid: null }),
  }).catch(() => {});

  await sendText(psid,
    '🗑️ ลบข้อมูลของคุณเรียบร้อยแล้วครับ (ตะกร้า + การเชื่อมโยงกับคำสั่งซื้อเดิม)\n\n' +
    'พิมพ์ "ดูปลา" เพื่อเริ่มดูสินค้าใหม่ได้เลยครับ 😊'
  );
}

// ── จัดการ referral จากลิงก์ m.me/PAGE?ref=fish_xxx (กดจากปุ่มบนเว็บ) ──
async function handleReferral(psid, referral) {
  const ref = referral?.ref || '';
  if (ref.startsWith('fish_')) {
    const fishId = ref.slice('fish_'.length);
    await sendFishDetail(psid, fishId);
  } else {
    await sendGreeting(psid);
  }
}

// ── event handler ต่อ 1 messaging item ──
async function handleEvent(event) {
  const psid = event.sender?.id;
  if (!psid) return;

  // ── กันสแปม: จำกัดไม่เกิน 20 ข้อความ/นาทีต่อคน (กันบอทถูกยิงรัวๆ จนเปลือง Graph API quota) ──
  const rl = checkRateLimit(psid, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) return; // เงียบไว้ ไม่ตอบอะไรเลย กันเปลืองโควต้าส่งข้อความไปเปล่าๆ

  if (event.referral) { await handleReferral(psid, event.referral); return; }

  if (event.postback) {
    if (event.postback.referral) { await handleReferral(psid, event.postback.referral); return; }
    await sendGreeting(psid);
    return;
  }

  if (event.message) {
    if (event.message.is_echo) return;
    if (event.message.referral) { await handleReferral(psid, event.message.referral); return; }
    if (event.message.text) { await handleText(psid, event.message.text); return; }
  }
}

// ── อ่าน raw body ดิบๆ จาก request stream (จำเป็นสำหรับตรวจ signature ให้ตรงกับที่ Meta เซ็นมา) ──
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ── verify signature: ต้องคำนวณจาก raw bytes ดิบ ไม่ใช่ JSON.stringify(req.body) ที่ parse ใหม่ ──
function isValidSignature(rawBody, sig) {
  if (!APP_SECRET) return true;
  if (!sig) return false;
  const hash = 'sha256=' + createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');
  return hash === sig;
}

module.exports.config = { api: { bodyParser: false } };

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY) {
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Forbidden');
    }
    return;
  }

  if (req.method !== 'POST') { res.status(200).send('OK'); return; }

  try {
    const rawBody = await getRawBody(req);
    const sig     = req.headers['x-hub-signature-256'];

    if (!isValidSignature(rawBody, sig)) { res.status(401).send('Unauthorized'); return; }

    let body;
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch (e) {
      res.status(400).send('Bad Request');
      return;
    }

    const entries = body?.entry || [];
    const events  = entries.flatMap(e => e.messaging || []);

    // ใช้ allSettled แทน all — event หนึ่งพังไม่ทำให้ event อื่นในชุดเดียวกันพังไปด้วย
    const results = await Promise.allSettled(events.map(handleEvent));

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length) {
      await notifyError('messenger-webhook', failed.map(f => f.reason?.stack || f.reason).join('\n---\n'));
    }

    // ตอบ 200 ให้ Meta เสมอไม่ว่าข้างในจะพังกี่ event ก็ตาม (สำคัญ: ถ้าไม่ตอบ 200
    // ต่อเนื่องหลายครั้ง Meta จะปิดใช้งาน webhook ของแอปอัตโนมัติ)
    res.status(200).send('EVENT_RECEIVED');
  } catch (err) {
    // safety net สุดท้าย เผื่อ error เกิดขึ้นก่อนถึงจุด allSettled (เช่น getRawBody พัง)
    await notifyError('messenger-webhook (top-level)', err);
    res.status(200).send('EVENT_RECEIVED'); // ตอบ 200 เสมอ กัน Meta ปิด webhook
  }
};