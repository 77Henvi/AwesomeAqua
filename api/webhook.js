// ============================================
//   api/webhook.js — Vercel Serverless Function
//   LINE Messaging API Webhook
// ============================================

const CHANNEL_SECRET      = process.env.LINE_CHANNEL_SECRET;
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_KEY        = process.env.SUPABASE_KEY;
const NOTIFY_USER_ID      = process.env.LINE_NOTIFY_USER_ID; // LINE userId ของเจ้าของร้าน

// ── verify signature ──
const crypto = require('crypto');
function verifySignature(body, signature) {
  const hash = crypto
    .createHmac('SHA256', CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// ── LINE Reply ──
async function replyMessage(replyToken, messages) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({ replyToken, messages })
  });
}

// ── LINE Push (แจ้งเจ้าของร้าน) ──
async function pushMessage(to, messages) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({ to, messages })
  });
}

// ── ดึงข้อมูลปลาจาก Supabase ──
async function getFishById(fishId) {
  const res  = await fetch(`${SUPABASE_URL}/rest/v1/fish?id=eq.${fishId}&limit=1`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const data = await res.json();
  return data[0] || null;
}

// ── ดึง session ลูกค้า (ปลาที่กำลังดูอยู่) ──
async function getUserSession(userId) {
  const res  = await fetch(`${SUPABASE_URL}/rest/v1/line_sessions?user_id=eq.${userId}&limit=1`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  const data = await res.json();
  return data[0] || null;
}

async function setUserSession(userId, fishId) {
  // upsert session
  await fetch(`${SUPABASE_URL}/rest/v1/line_sessions`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({ user_id: userId, fish_id: fishId, updated_at: new Date().toISOString() })
  });
}

// ── handle event ──
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const userId   = event.source.userId;
  const text     = event.message.text.trim();
  const replyToken = event.replyToken;

  console.log('userId:', userId, '| text:', text);

  // ── ลูกค้ากดปุ่มมาจากเว็บ — format: "ดูปลา:FISH_ID" ──
  if (text.startsWith('ดูปลา:')) {
    const fishId = text.split(':')[1];
    const fish   = await getFishById(fishId);
    if (!fish) {
      await replyMessage(replyToken, [{ type: 'text', text: 'ขออภัยครับ ไม่พบข้อมูลปลา' }]);
      return;
    }

    await setUserSession(userId, fishId);

    const priceText = fish.price_min === fish.price_max
      ? `฿${fish.price_min}`
      : `฿${fish.price_min} – ฿${fish.price_max}`;

    const stockText = fish.stock === 0 ? '❌ หมดสต็อก' : `✅ มีในสต็อก ${fish.stock} ตัว`;

    await replyMessage(replyToken, [
      ...(fish.image ? [{
        type: 'image',
        originalContentUrl: fish.image,
        previewImageUrl:    fish.image
      }] : []),
      {
        type: 'text',
        text: `🐟 ${fish.name}\n` +
              `📋 ${fish.species || ''}\n` +
              `💰 ราคา: ${priceText}\n` +
              `📦 ${stockText}\n\n` +
              `${fish.desc || ''}\n\n` +
              `──────────────\n` +
              `พิมพ์ "สั่ง" เพื่อสั่งซื้อตัวนี้ 🛒\n` +
              `พิมพ์ "ดูปลา" เพื่อดูปลาตัวอื่น 🐠\n` +
              `พิมพ์ "ติดต่อ" เพื่อคุยกับแอดมิน 👨‍💼`
      }
    ]);
    return;
  }

  // ── ดูปลาทั้งหมด ──
  if (text === 'ดูปลา' || text === 'ปลา' || text === 'ดูปลาทั้งหมด') {
    await replyMessage(replyToken, [{
      type: 'text',
      text: `🐟 ดูปลาทั้งหมดได้ที่:\nhttps://awesome-aqua.vercel.app\n\nกดปุ่ม LINE ที่ปลาที่สนใจได้เลยครับ 😊`
    }]);
    return;
  }

  // ── ติดต่อแอดมิน ──
  if (text === 'ติดต่อ' || text === 'แอดมิน' || text === 'ติดต่อแอดมิน') {
    await replyMessage(replyToken, [{
      type: 'text',
      text: `👨‍💼 ติดต่อแอดมินได้เลยครับ!\n\n` +
            `📞 โทร: 082-237-2512\n` +
            `💬 LINE: @955ppjio\n` +
            `📘 Facebook: ฟีฟ่า คนชนตู้ปลา\n` +
            `🎵 TikTok: @fifahaka\n\n` +
            `ยินดีให้คำปรึกษาทุกเรื่องครับ 🙏`
    }]);
    return;
  }

  // ── ลูกค้าพิมพ์ "สั่ง" ──
  if (text === 'สั่ง' || text === 'จอง' || text === 'สั่งซื้อ') {
    const session = await getUserSession(userId);
    if (!session) {
      await replyMessage(replyToken, [{
        type: 'text',
        text: 'กรุณาเลือกปลาที่สนใจจากเว็บก่อนนะครับ 🐟\nhttps://awesome-aqua.vercel.app'
      }]);
      return;
    }

    const fish = await getFishById(session.fish_id);
    if (!fish || fish.stock === 0) {
      await replyMessage(replyToken, [{
        type: 'text',
        text: '😢 ขออภัยครับ ปลาตัวนี้หมดสต็อกแล้ว\nลองเลือกตัวอื่นได้เลยครับ'
      }]);
      return;
    }

    const priceText = fish.price_min === fish.price_max
      ? `฿${fish.price_min}`
      : `฿${fish.price_min} – ฿${fish.price_max}`;

    // ส่งช่องทางชำระเงิน + QR Code
    await replyMessage(replyToken, [
      {
        type: 'text',
        text: `✅ ยืนยันสั่งซื้อ "${fish.name}"\n` +
              `💰 ราคา: ${priceText}\n\n` +
              `📲 ช่องทางชำระเงิน:\n` +
              `• พร้อมเพย์: 082-237-2512\n` +
              `• ธนาคารกสิกร: 123-4-56789-0\n\n` +
              `โอนแล้วส่งสลิปมาในแชทนี้ได้เลยครับ 🙏`
      },
      {
        type: 'image',
        originalContentUrl: 'https://awesome-aqua.vercel.app/images/qr-payment.png',
        previewImageUrl:    'https://awesome-aqua.vercel.app/images/qr-payment.png'
      }
    ]);

    // แจ้งเจ้าของร้าน
    if (NOTIFY_USER_ID) {
      await pushMessage(NOTIFY_USER_ID, [{
        type: 'text',
        text: `🔔 มีออเดอร์ใหม่!\n` +
              `🐟 ปลา: ${fish.name}\n` +
              `💰 ราคา: ${priceText}\n` +
              `👤 LINE UserID: ${userId}`
      }]);
    }
    return;
  }

  // ── fallback ──
  await replyMessage(replyToken, [{
    type: 'text',
    text: `สวัสดีครับ! 🐟 Awesome Aqua ยินดีให้บริการ\n\n` +
          `พิมพ์คำสั่งได้เลยครับ:\n` +
          `🐠 "ดูปลา" — ดูปลาทั้งหมด\n` +
          `🛒 "สั่ง" — สั่งซื้อปลาที่เลือกไว้\n` +
          `👨‍💼 "ติดต่อ" — คุยกับแอดมิน\n\n` +
          `หรือกดปุ่ม LINE จากปลาที่สนใจในเว็บได้เลยครับ 😊\n` +
          `https://awesome-aqua.vercel.app`
  }]);
}

// ── main handler ──
module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(200).send('OK'); return; }

  const signature = req.headers['x-line-signature'];
  const rawBody   = JSON.stringify(req.body);

  if (!verifySignature(rawBody, signature)) {
    res.status(401).send('Unauthorized');
    return;
  }

  const events = req.body.events || [];
  await Promise.all(events.map(handleEvent));

  res.status(200).send('OK');
};