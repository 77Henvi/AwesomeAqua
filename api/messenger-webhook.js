const { createHmac } = require('crypto');

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
    `พิมพ์ "เพิ่ม" เพื่อใส่ตะกร้า 🛒\n` +
    `พิมพ์ "สั่งซื้อ" เพื่อสั่งตัวนี้เลย ⚡\n` +
    `พิมพ์ "ดูปลา" เพื่อดูปลาตัวอื่น 🐠\n` +
    `พิมพ์ "ตะกร้า" เพื่อดูตะกร้า 🧺\n` +
    `พิมพ์ "ติดต่อ" เพื่อคุยกับแอดมิน 👨‍💼`
  );
}

// ── ข้อความทักทาย/fallback ──
async function sendGreeting(psid) {
  await sendText(psid,
    `สวัสดีครับ! 🐟 Awesome Aqua ยินดีให้บริการ\n\n` +
    `🐠 "ดูปลา" — ดูปลาทั้งหมด\n➕ "เพิ่ม" — ใส่ตะกร้า\n🧺 "ตะกร้า" — ดูตะกร้า\n🛒 "สั่งซื้อ" — ยืนยันสั่งซื้อ\n👨‍💼 "ติดต่อ" — คุยกับแอดมิน\n\n` +
    `${SITE}`
  );
}

// ── สรุปตะกร้าเป็นข้อความ (คืนราคาปัจจุบันของแต่ละตัวเสมอ ไม่ cache ราคาเก่า) ──
async function cartSummaryText(cart) {
  if (!cart || !cart.length) return '🧺 ตะกร้าว่างเปล่าครับ\n\nลองเลือกปลาที่สนใจแล้วพิมพ์ "เพิ่ม" ได้เลย';

  let total = 0;
  const lines = [];
  for (const item of cart) {
    const fish = await dbGet(`fish?id=eq.${item.fish_id}&limit=1`);
    if (!fish) continue;
    const sub = unitPrice(fish) * item.qty;
    total += sub;
    lines.push(`• ${fish.name_th} x${item.qty} ตัว = ฿${sub.toLocaleString('th-TH')}`);
  }

  return `🧺 ตะกร้าของคุณ:\n${lines.join('\n')}\n\n💰 รวม: ฿${total.toLocaleString('th-TH')}\n\n` +
    `พิมพ์ "สั่งซื้อ" เพื่อยืนยัน หรือ "ล้างตะกร้า" เพื่อเริ่มใหม่`;
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

// ── จัดการข้อความ text ──
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

  if (['สั่ง', 'จอง', 'สั่งซื้อ', 'ยืนยัน', 'เช็คเอาท์', 'checkout'].includes(text)) {
    await checkout(psid);
    return;
  }

  await sendGreeting(psid);
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
  await Promise.all(events.map(handleEvent));

  res.status(200).send('EVENT_RECEIVED');
};