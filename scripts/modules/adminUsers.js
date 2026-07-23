// scripts/modules/adminUsers.js
// หน้า "จัดการแอดมิน" — เรียก api/manage-admins.js (ต้อง login แอดมินอยู่แล้วเสมอ)
import { supabase }  from '../../supabase.js';
import { showToast } from '../shared/utils.js';

async function _authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export async function renderAdminUsers() {
  const el = document.getElementById('admin-users-list');
  if (!el) return;

  el.innerHTML = `<div class="admin-empty-state"><div class="admin-empty-icon">⏳</div><div class="admin-empty-text">กำลังโหลด...</div></div>`;

  const { data: { session } } = await supabase.auth.getSession();
  const myId = session?.user?.id;

  const res = await fetch('/api/manage-admins', { headers: await _authHeader() });
  const body = await res.json();

  if (!res.ok) {
    el.innerHTML = `<div class="admin-empty-state"><div class="admin-empty-icon">⚠️</div><div class="admin-empty-text">${body.error || 'โหลดรายชื่อแอดมินไม่สำเร็จ'}</div></div>`;
    return;
  }

  const isOwner = body.admins.find(a => a.user_id === myId)?.role === 'owner';
  const addForm = document.getElementById('admin-users-add-form');
  if (addForm) addForm.style.display = isOwner ? 'block' : 'none';

  el.innerHTML = body.admins.map(a => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:white;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;">
      <div>
        <div style="font-weight:600;">${a.email}</div>
        <div style="font-size:0.78rem;color:var(--gray);">${a.role === 'owner' ? '👑 เจ้าของร้าน' : '👤 พนักงาน'}${a.user_id === myId ? ' (คุณ)' : ''}</div>
      </div>
      ${isOwner && a.user_id !== myId
        ? `<button onclick="removeAdminUser('${a.user_id}','${a.email}')" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:1.2rem;"><i class="ph ph-trash"></i></button>`
        : ''
      }
    </div>
  `).join('');
}

export async function addAdminUser() {
  const email    = document.getElementById('newAdminEmail').value.trim();
  const password = document.getElementById('newAdminPassword').value;
  const role     = document.getElementById('newAdminRole').value;

  if (!email || !password) {
    showToast('<i class="ph-fill ph-warning-circle" style="color:#f59e0b;"></i> กรุณากรอกอีเมลและรหัสผ่าน');
    return;
  }

  const res = await fetch('/api/manage-admins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await _authHeader()) },
    body: JSON.stringify({ email, password, role }),
  });
  const body = await res.json();

  if (!res.ok) {
    showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444;"></i> ' + (body.error || 'เพิ่มแอดมินไม่สำเร็จ'));
    return;
  }

  showToast(`<i class="ph-fill ph-check-circle" style="color:#10b981;"></i> เพิ่ม ${email} เป็นแอดมินแล้ว`);
  document.getElementById('newAdminEmail').value = '';
  document.getElementById('newAdminPassword').value = '';
  renderAdminUsers();
}

export async function removeAdminUser(userId, email) {
  if (!confirm(`ต้องการเอา "${email}" ออกจากระบบแอดมินไหม? (บัญชี login เดิมจะเข้าหลังบ้านไม่ได้อีก)`)) return;

  const res = await fetch('/api/manage-admins', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...(await _authHeader()) },
    body: JSON.stringify({ user_id: userId }),
  });
  const body = await res.json();

  if (!res.ok) {
    showToast('<i class="ph-fill ph-x-circle" style="color:#ef4444;"></i> ' + (body.error || 'ลบไม่สำเร็จ'));
    return;
  }

  showToast('<i class="ph-fill ph-check-circle" style="color:#10b981;"></i> เอาออกจากระบบแอดมินแล้ว');
  renderAdminUsers();
}