import { supabase }  from '../../supabase.js';
import { showToast } from '../shared/utils.js';

export function openModal(tab) {
  document.getElementById('authModal').classList.add('open');
  switchAuthTab(tab);
}

export function closeModal() {
  document.getElementById('authModal').classList.remove('open');
}

export function closeModalOutside(e) {
  if (e.target === document.getElementById('authModal')) closeModal();
}

export function switchAuthTab(tab) {
  document.getElementById('loginForm').style.display  = tab === 'login'  ? 'flex' : 'none';
  document.getElementById('signupForm').style.display = tab === 'signup' ? 'flex' : 'none';
  document.getElementById('tabLogin').classList.toggle('active',  tab === 'login');
  document.getElementById('tabSignup').classList.toggle('active', tab === 'signup');
}

// alias เผื่อ app.js เรียกชื่อ switchTab
export const switchTab = switchAuthTab;

// ── Login ด้วย Supabase Auth ──
export async function fakeLogin() {
  const email    = document.querySelector('#loginForm input[type="email"]').value.trim();
  const password = document.querySelector('#loginForm input[type="password"]').value;
  const btn      = document.querySelector('#loginForm button[type="submit"], #loginForm .btn-primary');

  if (!email || !password) { showToast('⚠️ กรุณากรอกข้อมูลให้ครบ'); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'กำลังเข้าสู่ระบบ...'; }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (btn) { btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; }

  if (error) {
    showToast('❌ ' + (error.message === 'Invalid login credentials'
      ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
      : error.message));
    return;
  }

  showToast('✅ เข้าสู่ระบบสำเร็จ');
  setTimeout(() => { window.location.href = 'admin.html'; }, 400);
}