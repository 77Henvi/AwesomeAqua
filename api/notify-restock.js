// api/notify-restock.js
// เรียกจากฝั่ง admin (scripts/modules/restock.js, scripts/modules/fishForm.js) หลังอัปเดตสต็อกปลา
// จาก 0 -> มากกว่า 0 สำเร็จ — ดึงรายชื่อลูกค้าที่กด "แจ้งเตือน" ไว้ ส่งข้อความแจ้งทุกคน แล้วลบ
// รายการแจ้งเตือนที่ส่งไปแล้วทิ้ง (กันส่งซ้ำ)
//
// Body: { fish_id: string }
// ไม่ต้อง verify signature แบบ Messenger เพราะเรียกจาก admin.js (มี Supabase auth ของแอดมินอยู่แล้ว)
// แต่ยังใช้ Service Role Key ฝั่ง server เท่านั้น ไม่เปิด endpoint ให้ทำอะไรได้เกินขอบเขตนี้

const { notifyError } = require('./_shared/errorNotify.js');

const {
  MESSENGER_PAGE_TOKEN: TOKEN,
  SUPABASE_URL:              DB_URL,
  SUPABASE_SERVICE_ROLE_KEY: DB_KEY,
} = process.env;

const GRAPH_API = 'https://graph.facebook.com/v21.0/me/messages';
const DB_HEADS  = { apikey: DB_KEY, Authorization: `Bearer ${DB_KEY}` };

async function getJson(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const sendText = (psid, text) =>
  fetch(`${GRAPH_API}?access_token=${TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: psid }, message: { text } }),
  });

module.exports.config = { api: { bodyParser: false } };

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }
  if (!DB_URL || !DB_KEY) { res.status(500).json({ error: 'Missing Supabase config' }); return; }

  let body;
  try {
    body = await getJson(req);
  } catch {
    res.status(400).json({ error: 'Bad Request' });
    return;
  }

  const fishId = body?.fish_id;
  if (!fishId) { res.status(400).json({ error: 'fish_id is required' }); return; }

  try {
    const fishRes = await fetch(`${DB_URL}/rest/v1/fish?id=eq.${fishId}&limit=1`, { headers: DB_HEADS });
    const fishArr = await fishRes.json();
    const fish = fishArr[0];

    if (!fish || fish.stock <= 0) {
      res.status(200).json({ notified: 0, reason: 'fish not found or still out of stock' });
      return;
    }

    const alertsRes = await fetch(`${DB_URL}/rest/v1/restock_alerts?fish_id=eq.${fishId}`, { headers: DB_HEADS });
    const alerts = await alertsRes.json();

    if (!Array.isArray(alerts) || !alerts.length) {
      res.status(200).json({ notified: 0 });
      return;
    }

    await Promise.all(
      alerts.map((a) =>
        sendText(a.psid, `🎉 ข่าวดี! "${fish.name_th}" กลับมามีสต็อกแล้วครับ (${fish.stock} ตัว)\n\nพิมพ์คุยกับบอทเพื่อสั่งซื้อได้เลยครับ 🐟`)
          .catch(() => {}) // psid บางคนอาจ block บอทไปแล้ว ไม่ให้กระทบคนอื่น
      )
    );

    // ลบรายการแจ้งเตือนที่ส่งไปแล้วทิ้ง กันแจ้งซ้ำรอบหน้า
    await fetch(`${DB_URL}/rest/v1/restock_alerts?fish_id=eq.${fishId}`, {
      method: 'DELETE',
      headers: DB_HEADS,
    }).catch(() => {});

    res.status(200).json({ notified: alerts.length });
  } catch (err) {
    await notifyError('notify-restock', err);
    res.status(500).json({ error: 'Internal error, admin has been notified' });
  }
};
