const { createHmac } = require('crypto');

const {
  LINE_CHANNEL_SECRET:       SECRET,
  LINE_CHANNEL_ACCESS_TOKEN: TOKEN,
  SUPABASE_URL:              DB_URL,
  SUPABASE_KEY:              DB_KEY,
  LINE_NOTIFY_USER_ID:       OWNER_ID,
} = process.env;

const LINE_REPLY = 'https://api.line.me/v2/bot/message/reply';
const LINE_PUSH  = 'https://api.line.me/v2/bot/message/push';
const LINE_HEADS = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` };
const DB_HEADS   = { 'apikey': DB_KEY, 'Authorization': `Bearer ${DB_KEY}` };

// ── helpers ──
const reply = (token, messages) =>
  fetch(LINE_REPLY, { method: 'POST', headers: LINE_HEADS, body: JSON.stringify({ replyToken: token, messages }) });

const push = (to, messages) =>
  fetch(LINE_PUSH,  { method: 'POST', headers: LINE_HEADS, body: JSON.stringify({ to, messages }) });

const dbGet = async (path) => {
  const res  = await fetch(`${DB_URL}/rest/v1/${path}`, { headers: DB_HEADS });
  const data = await res.json();
  return data[0] || null;
};

const dbUpsert = (path, body) =>
  fetch(`${DB_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...DB_HEADS, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(body)
  });

const price = (f) => f.price_min === f.price_max
  ? `฿${f.price_min}`
  : `฿${f.price_min} – ฿${f.price_max}`;

const SITE = 'https://awesome-aqua.vercel.app';

// ── event handler ──
async function handleEvent({ type, message, source, replyToken }) {
  if (type !== 'message' || message.type !== 'text') return;

  const userId = source.userId;
  const text   = message.text.trim();

  // ── ดูปลา:ID — จาก LIFF ──
  if (text.startsWith('ดูปลา:')) {
    const fishId = text.split(':')[1];
    const fish   = await dbGet(`fish?id=eq.${fishId}&limit=1`);
    if (!fish) { await reply(replyToken, [{ type: 'text', text: 'ขออภัยครับ ไม่พบข้อมูลปลา' }]); return; }

    await dbUpsert('line_sessions', { user_id: userId, fish_id: fishId, updated_at: new Date().toISOString() });

    await reply(replyToken, [
      ...(fish.image ? [{ type: 'image', originalContentUrl: fish.image, previewImageUrl: fish.image }] : []),
      { type: 'text', text:
        `🐟 ${fish.name}\n📋 ${fish.species || ''}\n` +
        `💰 ราคา: ${price(fish)}\n` +
        `📦 ${fish.stock === 0 ? '❌ หมดสต็อก' : `✅ ${fish.stock} ตัว`}\n\n` +
        `${fish.desc || ''}\n\n──────────────\n` +
        `พิมพ์ "สั่ง" เพื่อสั่งซื้อตัวนี้ 🛒\n` +
        `พิมพ์ "ดูปลา" เพื่อดูปลาตัวอื่น 🐠\n` +
        `พิมพ์ "ติดต่อ" เพื่อคุยกับแอดมิน 👨‍💼`
      }
    ]);
    return;
  }

  // ── ดูปลาทั้งหมด ──
  if (['ดูปลา', 'ปลา', 'ดูปลาทั้งหมด'].includes(text)) {
    await reply(replyToken, [{ type: 'text', text: `🐟 ดูปลาทั้งหมดได้ที่:\n${SITE}\n\nกดปุ่ม LINE ที่ปลาที่สนใจได้เลยครับ 😊` }]);
    return;
  }

  // ── ติดต่อแอดมิน ──
  if (['ติดต่อ', 'แอดมิน', 'ติดต่อแอดมิน'].includes(text)) {
    await reply(replyToken, [{ type: 'text', text:
      `👨‍💼 ติดต่อแอดมินได้เลยครับ!\n\n` +
      `📞 โทร: 082-237-2512\n💬 LINE: @955ppjio\n` +
      `📘 Facebook: ฟีฟ่า คนชนตู้ปลา\n🎵 TikTok: @fifahaka\n\n` +
      `ยินดีให้คำปรึกษาทุกเรื่องครับ 🙏`
    }]);
    return;
  }

  // ── สั่งซื้อ ──
  if (['สั่ง', 'จอง', 'สั่งซื้อ'].includes(text)) {
    const session = await dbGet(`line_sessions?user_id=eq.${userId}&limit=1`);
    if (!session) {
      await reply(replyToken, [{ type: 'text', text: `กรุณาเลือกปลาที่สนใจจากเว็บก่อนนะครับ 🐟\n${SITE}` }]);
      return;
    }
    const fish = await dbGet(`fish?id=eq.${session.fish_id}&limit=1`);
    if (!fish || fish.stock === 0) {
      await reply(replyToken, [{ type: 'text', text: '😢 ขออภัยครับ ปลาตัวนี้หมดสต็อกแล้ว\nลองเลือกตัวอื่นได้เลยครับ' }]);
      return;
    }

    await reply(replyToken, [
      { type: 'text', text:
        `✅ ยืนยันสั่งซื้อ "${fish.name}"\n💰 ราคา: ${price(fish)}\n\n` +
        `📲 ช่องทางชำระเงิน:\n• พร้อมเพย์: 082-237-2512\n• ธนาคารกสิกร: 123-4-56789-0\n\n` +
        `โอนแล้วส่งสลิปมาในแชทนี้ได้เลยครับ 🙏`
      },
      { type: 'image',
        originalContentUrl: `${SITE}/images/qr-payment.png`,
        previewImageUrl:    `${SITE}/images/qr-payment.png`
      }
    ]);

    if (OWNER_ID) await push(OWNER_ID, [{ type: 'text', text:
      `🔔 มีออเดอร์ใหม่!\n🐟 ${fish.name}\n💰 ${price(fish)}\n👤 LINE: ${userId}`
    }]);
    return;
  }

  // ── fallback ──
  await reply(replyToken, [{ type: 'text', text:
    `สวัสดีครับ! 🐟 Awesome Aqua ยินดีให้บริการ\n\n` +
    `🐠 "ดูปลา" — ดูปลาทั้งหมด\n🛒 "สั่ง" — สั่งซื้อ\n👨‍💼 "ติดต่อ" — คุยกับแอดมิน\n\n` +
    `${SITE}`
  }]);
}

// ── main ──
module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(200).send('OK'); return; }

  const sig  = req.headers['x-line-signature'];
  const hash = createHmac('SHA256', SECRET).update(JSON.stringify(req.body)).digest('base64');
  if (hash !== sig) { res.status(401).send('Unauthorized'); return; }

  await Promise.all((req.body.events || []).map(handleEvent));
  res.status(200).send('OK');
};