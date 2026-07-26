// api/data-deletion.js
// Meta "Data Deletion Request Callback URL" — เอาไปกรอกในหน้า
// Meta App Dashboard → การตั้งค่าแอพ → ขั้นสูง → "อนุญาต URL การเรียกกลับ" (Data Deletion Callback URL)
//
// เวลาลูกค้ากด "ลบข้อมูล/แอปนี้" จากฝั่ง Facebook Settings ของเขาเอง Meta จะ POST มาที่ URL นี้
// พร้อมฟิลด์ signed_request (base64url(signature).base64url(payload) เซ็นด้วย App Secret)
//
// เอกสารทางการของ Meta: ต้องตอบกลับเป็น JSON แบบนี้เสมอ (แม้ user_id จะไม่ตรงกับระบบเราก็ตาม)
//   { "url": "<ลิงก์เช็คสถานะการลบ>", "confirmation_code": "<รหัสอ้างอิง>" }

const { parseSignedRequest } = require('./_shared/signedRequest.js');

const {
  MESSENGER_APP_SECRET: APP_SECRET, // ตัวเดียวกับที่ใช้ verify webhook ปกติ
  SUPABASE_URL:              DB_URL,
  SUPABASE_SERVICE_ROLE_KEY: DB_KEY,
} = process.env;

const SITE     = 'https://awesome-aqua.vercel.app';
const DB_HEADS = { apikey: DB_KEY, Authorization: `Bearer ${DB_KEY}` };

// ── อ่าน raw body (Meta ส่งมาแบบ application/x-www-form-urlencoded: signed_request=xxx) ──
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ── ลบข้อมูลของ user ออกจากตารางที่เก็บข้อมูลลูกค้าไว้ (best-effort ตาม id ที่ Meta ส่งมา) ──
async function deleteUserData(userId) {
  if (!DB_URL || !DB_KEY || !userId) return;

  // messenger_sessions เก็บตะกร้า + fish_id ล่าสุดที่ดู ผูกกับ user_id (PSID)
  await fetch(`${DB_URL}/rest/v1/messenger_sessions?user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: DB_HEADS,
  }).catch(() => {}); // ไม่ throw ถ้าลบไม่ได้ ไม่ให้ endpoint ล่มเพราะเหตุนี้

  // orders ผูกกับ psid โดยตรง — ลบแถวที่เป็น PII แต่เก็บ finance ไว้ (ประวัติบัญชี ไม่ใช่ข้อมูลส่วนตัว)
  await fetch(`${DB_URL}/rest/v1/orders?psid=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { ...DB_HEADS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ psid: null }), // ตัดการเชื่อมโยงกับตัวบุคคล แต่ยังนับยอดขายในระบบบัญชีได้
  }).catch(() => {});
}

module.exports.config = { api: { bodyParser: false } };

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const rawBody = await getRawBody(req);
  const params  = new URLSearchParams(rawBody);
  const signedRequest = params.get('signed_request');

  const payload = parseSignedRequest(signedRequest, APP_SECRET);
  if (!payload || !payload.user_id) {
    res.status(400).json({ error: 'Invalid signed_request' });
    return;
  }

  const userId = payload.user_id;
  const confirmationCode = `del_${userId.slice(0, 8)}_${Date.now()}`;

  await deleteUserData(userId);

  // Meta ต้องการ JSON รูปแบบนี้เป๊ะๆ — url ให้ลูกค้าเช็คสถานะได้เอง
  res.status(200).json({
    url: `${SITE}/data-deletion-status.html?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
};
