// api/notify-low-stock.js
// เรียกจากหน้า admin (หลังขายแล้วสต็อกเหลือน้อย) เพื่อส่งแจ้งเตือนไปหาแอดมินผ่าน Messenger
// แยกเป็น endpoint ต่างหาก เพราะ Page Access Token เป็นความลับ ห้ามอยู่ฝั่ง browser เด็ดขาด

const {
    MESSENGER_PAGE_TOKEN: TOKEN,
    MESSENGER_OWNER_PSID: OWNER_ID,
    SUPABASE_URL:  DB_URL,
    SUPABASE_ANON_KEY: DB_ANON_KEY, // ใช้ค่าเดียวกับใน supabase.js ฝั่ง frontend (public อยู่แล้ว ไม่ใช่ความลับ)
  } = process.env;
  
  const GRAPH_API = 'https://graph.facebook.com/v21.0/me/messages';
  
  async function sendText(psid, text) {
    return fetch(`${GRAPH_API}?access_token=${TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: psid }, message: { text } }),
    });
  }
  
  // ตรวจว่า request นี้มาจาก session ที่ login แอดมินจริง (ไม่ใช่ static secret ที่หลุดไปฝั่ง browser ได้)
  async function isLoggedInAdmin(req) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return false;
  
    const res = await fetch(`${DB_URL}/auth/v1/user`, {
      headers: { apikey: DB_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    return res.ok;
  }
  
  module.exports = async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
  
    if (!(await isLoggedInAdmin(req))) {
      res.status(401).json({ error: 'Unauthorized — ต้อง login แอดมินก่อน' });
      return;
    }
  
    if (!TOKEN || !OWNER_ID) {
      res.status(500).json({ error: 'ยังไม่ได้ตั้งค่า MESSENGER_PAGE_TOKEN หรือ MESSENGER_OWNER_PSID' });
      return;
    }
  
    const { fishName, stock, threshold } = req.body || {};
  
    if (!fishName || stock === undefined) {
      res.status(400).json({ error: 'ข้อมูลไม่ครบ (ต้องมี fishName และ stock)' });
      return;
    }
  
    const emoji = stock === 0 ? '🚨' : '⚠️';
    const text  = stock === 0
      ? `${emoji} "${fishName}" หมดสต็อกแล้ว!\n\nลูกค้าจะสั่งซื้อไม่ได้จนกว่าจะเติมสต็อกใหม่`
      : `${emoji} "${fishName}" สต็อกใกล้หมดแล้ว!\n\nเหลืออยู่ ${stock} ตัว (แจ้งเตือนที่ ${threshold ?? 3} ตัวหรือน้อยกว่า)`;
  
    try {
      const fbRes = await sendText(OWNER_ID, text);
      if (!fbRes.ok) {
        const body = await fbRes.text();
        console.error('Messenger send failed:', body);
        res.status(502).json({ error: 'ส่งข้อความ Messenger ไม่สำเร็จ' });
        return;
      }
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'เกิดข้อผิดพลาดภายใน' });
    }
  };