// api/manage-admins.js
// จัดการรายชื่อแอดมิน — เฉพาะ owner เท่านั้นที่เพิ่ม/ลบได้
// ต้องใช้ Service Role Key เพราะการสร้าง auth user ใหม่ (Admin API) ทำจาก client ไม่ได้เลย

const {
  SUPABASE_URL: DB_URL,
  SUPABASE_ANON_KEY: DB_ANON_KEY,       // ใช้ตรวจสอบ session ผู้เรียก (เหมือน notify-low-stock.js)
  SUPABASE_SERVICE_ROLE_KEY: DB_KEY,    // ใช้สร้าง/ลบ user จริง (bypass RLS)
} = process.env;

const ADMIN_HEADS = { apikey: DB_KEY, Authorization: `Bearer ${DB_KEY}` };

// ── ตรวจสอบว่าใครเรียก endpoint นี้ และเป็นแอดมินระดับไหน ──
async function getCallerAdmin(req) {
  const auth  = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;

  const userRes = await fetch(`${DB_URL}/auth/v1/user`, {
    headers: { apikey: DB_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return null;
  const user = await userRes.json();

  const adminRes = await fetch(`${DB_URL}/rest/v1/admins?user_id=eq.${user.id}&select=*`, { headers: ADMIN_HEADS });
  const rows = await adminRes.json();
  return rows[0] || null;
}

module.exports = async (req, res) => {
  const caller = await getCallerAdmin(req);
  if (!caller) { res.status(401).json({ error: 'Unauthorized — ต้อง login แอดมินก่อน' }); return; }

  // ── ดูรายชื่อแอดมินทั้งหมด (แอดมินคนไหนก็ดูได้) ──
  if (req.method === 'GET') {
    const listRes = await fetch(`${DB_URL}/rest/v1/admins?select=*&order=created_at.asc`, { headers: ADMIN_HEADS });
    const list = await listRes.json();
    res.status(200).json({ admins: list });
    return;
  }

  // ── เพิ่ม/ลบแอดมิน เฉพาะ owner เท่านั้น ──
  if (caller.role !== 'owner') {
    res.status(403).json({ error: 'เฉพาะ owner เท่านั้นที่จัดการแอดมินคนอื่นได้' });
    return;
  }

  if (req.method === 'POST') {
    const { email, password, role } = req.body || {};
    if (!email || !password) { res.status(400).json({ error: 'ต้องกรอกอีเมลและรหัสผ่าน' }); return; }
    if (password.length < 8) { res.status(400).json({ error: 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร' }); return; }

    // 1) สร้าง auth user ใหม่ผ่าน Admin API
    const createRes = await fetch(`${DB_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { ...ADMIN_HEADS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const created = await createRes.json();

    if (!createRes.ok) {
      res.status(400).json({ error: created?.msg || created?.message || 'สร้างบัญชีไม่สำเร็จ (อีเมลอาจซ้ำ)' });
      return;
    }

    // 2) เพิ่มเข้าตาราง admins
    const insertRes = await fetch(`${DB_URL}/rest/v1/admins`, {
      method: 'POST',
      headers: { ...ADMIN_HEADS, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: created.id, email, role: role === 'owner' ? 'owner' : 'staff' }),
    });

    if (!insertRes.ok) {
      res.status(500).json({ error: 'สร้างบัญชีสำเร็จ แต่เพิ่มเข้าระบบแอดมินไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ' });
      return;
    }

    res.status(200).json({ ok: true, email });
    return;
  }

  if (req.method === 'DELETE') {
    const { user_id } = req.body || {};
    if (!user_id) { res.status(400).json({ error: 'ต้องระบุ user_id' }); return; }

    if (user_id === caller.user_id) {
      res.status(400).json({ error: 'ลบสิทธิ์ตัวเองไม่ได้' });
      return;
    }

    // ลบสิทธิ์แอดมิน (เข้าหลังบ้านไม่ได้ทันที) — ไม่ลบบัญชี auth user ทิ้ง เผื่ออยากคืนสิทธิ์ทีหลัง
    const delRes = await fetch(`${DB_URL}/rest/v1/admins?user_id=eq.${user_id}`, {
      method: 'DELETE',
      headers: ADMIN_HEADS,
    });

    if (!delRes.ok) { res.status(500).json({ error: 'ลบไม่สำเร็จ' }); return; }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).send('Method Not Allowed');
};