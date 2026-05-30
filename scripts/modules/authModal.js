import { showToast } from '../shared/utils.js';

export function openModal(tab) {
  document.getElementById('authModal').classList.add('open');
  switchTab(tab);
}

export function closeModal() {
  document.getElementById('authModal').classList.remove('open');
}

export function closeModalOutside(e) {
  if (e.target === document.getElementById('authModal')) closeModal();
}

export function switchTab(tab) {
  document.getElementById('loginForm').style.display  = tab === 'login'  ? 'flex' : 'none';
  document.getElementById('signupForm').style.display = tab === 'signup' ? 'flex' : 'none';
  document.getElementById('tabLogin').classList.toggle('active',  tab === 'login');
  document.getElementById('tabSignup').classList.toggle('active', tab === 'signup');
}

export function fakeLogin() {
  const email    = document.querySelector('#loginForm input[type="email"]').value;
  const password = document.querySelector('#loginForm input[type="password"]').value;
  if (email === 'admin' && password === 'aqua1234') {
    sessionStorage.setItem('isAdmin', 'true');
    showToast('🔐 เข้าสู่ระบบ Admin...');
    setTimeout(() => { window.location.href = 'admin.html'; }, 500);
    return;
  }
  closeModal();
  showToast('✅ เข้าสู่ระบบเรียบร้อย');
}
