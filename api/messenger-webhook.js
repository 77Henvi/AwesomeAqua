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

// ── Supabase helpers (เหมือนกับ webhook LINE เดิม) ──
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

const price = (f) => (!f.price_max || f.price_max === f.price_min)
  ? `฿${f.price_min}`
  : `฿${f.price_min} – ฿${f.price_max}`;

// ── ส่งรายละเอียดปลา 1 ตัว พร้อมบันทึก session ──
async function sendFishDetail(psid, fishId) {
  const fish = await dbGet(`fish?id=eq.${fishId}&limit=1`);
  if (!fish) { await sendText(psid, 'ขออภัยครับ ไม่พบข้อมูลปลา'); return; }

  // "messenger_sessions" ต้องสร้างในตาราง Supabase ก่อน (schema เหมือน line_sessions เดิม)
  await dbUpsert('messenger_sessions', { user_id: psid, fish_id: fishId, updated_at: new Date().toISOString() });

  if (fish.image) await sendImage(psid, fish.image);
  await sendText(psid,
    `🐟 ${fish.name_th}\n📋 ${fish.species || ''}\n` +
    `💰 ราคา: ${price(fish)}\n` +
    `📦 ${fish.stock === 0 ? '❌ หมดสต็อก' : `✅ ${fish.stock} ตัว`}\n\n` +
    `${fish.desc_th || ''}\n\n──────────────\n` +
    `พิมพ์ "สั่ง" เพื่อสั่งซื้อตัวนี้ 🛒\n` +
    `พิมพ์ "ดูปลา" เพื่อดูปลาตัวอื่น 🐠\n` +
    `พิมพ์ "ติดต่อ" เพื่อคุยกับแอดมิน 👨‍💼`
  );
}

// ── ข้อความทักทาย/fallback ──
async function sendGreeting(psid) {
  await sendText(psid,
    `สวัสดีครับ! 🐟 Awesome Aqua ยินดีให้บริการ\n\n` +
    `🐠 "ดูปลา" — ดูปลาทั้งหมด\n🛒 "สั่ง" — สั่งซื้อ\n👨‍💼 "ติดต่อ" — คุยกับแอดมิน\n\n` +
    `${SITE}`
  );
}

// ── จัดการข้อความ text (คำสั่งเดียวกับฝั่ง LINE เดิม) ──
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

  if (['สั่ง', 'จอง', 'สั่งซื้อ'].includes(text)) {
    const session = await dbGet(`messenger_sessions?user_id=eq.${psid}&limit=1`);

    let isExpired = false;
    if (session && session.updated_at) {
      const hoursDiff = (new Date() - new Date(session.updated_at)) / (1000 * 60 * 60);
      if (hoursDiff > 24) isExpired = true;
    }

    if (!session || isExpired) {
      await sendText(psid, `ขออภัยครับ เซสชันการทำรายการหมดอายุแล้ว ⏱️\nรบกวนคุณลูกค้ากดเลือกปลาที่สนใจจากหน้าเว็บใหม่อีกครั้งนะครับ 🐟\n${SITE}`);
      return;
    }

    const fish = await dbGet(`fish?id=eq.${session.fish_id}&limit=1`);
    if (!fish || fish.stock === 0) {
      await sendText(psid, '😢 ขออภัยครับ ปลาตัวนี้หมดสต็อกแล้ว\nลองเลือกตัวอื่นได้เลยครับ');
      return;
    }

    await sendText(psid,
      `✅ ยืนยันสั่งซื้อ "${fish.name_th}"\n💰 ราคา: ${price(fish)}\n\n` +
      `📲 ช่องทางชำระเงิน:\n• พร้อมเพย์: 082-237-2512\n• ธนาคารกสิกร: 136-3-82691-8\n\n` +
      `โอนแล้วส่งสลิปมาในแชทนี้ได้เลยครับ 🙏`
    );
    await sendImage(psid, `${SITE}/images/qr-payment.png`);

    if (OWNER_ID) await sendText(OWNER_ID, `🔔 มีออเดอร์ใหม่!\n🐟 ${fish.name_th}\n💰 ${price(fish)}\n👤 Messenger PSID: ${psid}`);
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

  // m.me link พร้อม ?ref= (ก่อนพิมพ์ข้อความใดๆ)
  if (event.referral) { await handleReferral(psid, event.referral); return; }

  // postback (ปุ่ม Get Started ฯลฯ) ที่อาจแนบ referral มาด้วย
  if (event.postback) {
    if (event.postback.referral) { await handleReferral(psid, event.postback.referral); return; }
    await sendGreeting(psid);
    return;
  }

  // ข้อความปกติ (อาจมี referral แนบมาด้วยถ้าเป็นข้อความแรกจากลิงก์ ref)
  if (event.message) {
    if (event.message.is_echo) return; // ข้าม event ที่บอทส่งเอง
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
  if (!APP_SECRET) return true; // ถ้ายังไม่ตั้งค่า APP_SECRET จะข้ามการตรวจ (ควรตั้งค่าก่อนใช้งานจริง)
  if (!sig) return false;
  const hash = 'sha256=' + createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');
  return hash === sig;
}

// ปิด body parser อัตโนมัติของ Vercel เพื่อให้เราอ่าน raw body เองได้
module.exports.config = { api: { bodyParser: false } };

// ── main ──
module.exports = async (req, res) => {
  // ── Meta เรียก GET มาตอน verify webhook ──
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