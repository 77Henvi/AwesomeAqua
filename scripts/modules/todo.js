// scripts/modules/todo.js
// To-do List สำหรับหน้า admin — คัดลอก logic มาจากโปรเจกต์ LadyVenice.sheets (js/app.js)
// แล้วปรับให้เข้ากับ pattern ของ AwesomeAqua: import supabase จาก '../../supabase.js',
// ใช้ .modal-overlay/.modal เดิมของโปรเจกต์นี้แทน bottom-sheet, ใช้ Phosphor icon แทน lucide
//
// หมายเหตุ: ตัดพฤติกรรม "รอบเดือนเริ่มวันที่ 2" ของ LadyVenice ออก (เป็น business logic
// เฉพาะของร้านนั้น ไม่เกี่ยวกับ AwesomeAqua) เปลี่ยนเป็นรอบปฏิทินปกติ (เดือนนี้ทั้งเดือน) แทน
// ฟังก์ชันอื่นทั้งหมด (add/toggle/delete/render/archive/date-picker/time-picker) คงพฤติกรรมเดิมไว้ครบ

import { supabase } from '../../supabase.js';
import { adminEmpty } from '../shared/utils.js';

// ── STATE ──
let todos = [];
let timePickerHour = null;
let timePickerMinute = null;

// ── DATE HELPERS ──
function todayStr() {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD ตาม timezone เครื่อง (เหมือนที่ไฟล์อื่นในโปรเจกต์นี้ใช้)
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
}

// รอบปัจจุบัน = วันที่ 1 ถึงวันสุดท้ายของเดือนนี้ (ปฏิทินปกติ ต่างจาก LadyVenice ที่เริ่มวันที่ 2)
function currentCycleStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function currentCycleEnd() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

// ── LOAD ──
export async function loadTodos() {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  if (!error) todos = data || [];
  renderTodos();
}

// ── ADD ──
async function addTodo() {
  const textEl = document.getElementById('todoText');
  const text = textEl.value.trim();
  if (!text) return;

  const time = document.getElementById('todoTime').value || '';
  const date = document.getElementById('todoDate').value || todayStr();

  await supabase.from('todos').insert([{ text, time, date, done: false }]);

  textEl.value = '';
  setTimePickerValue('');
  setDatePickerValue(todayStr());
  await loadTodos();
}

async function toggleTodo(id, current) {
  await supabase.from('todos').update({ done: current !== true }).eq('id', id);
  await loadTodos();
}

async function deleteTodo(id) {
  await supabase.from('todos').delete().eq('id', id);
  await loadTodos();
}

// ── RENDER: รายการหลัก (เฉพาะรอบเดือนปัจจุบันขึ้นไป) ──
function renderTodos() {
  const cycleStart = currentCycleStart();
  const list = todos
    .filter(t => t.date >= cycleStart)
    .sort((a, b) =>
      (a.date || '').localeCompare(b.date || '') ||
      (a.time || '').localeCompare(b.time || '')
    );

  const el = document.getElementById('todoList');
  if (!el) return;

  if (!list.length) {
    el.innerHTML = adminEmpty('<i class="ph ph-check-square"></i>', 'ยังไม่มีงานในเดือนนี้');
    return;
  }

  el.innerHTML = list.map(t => `
    <div class="todo-item ${t.done ? 'done' : ''}">
      <div class="todo-checkbox ${t.done ? 'checked' : ''}" onclick="toggleTodo(${t.id}, ${t.done === true})"></div>
      <div class="todo-content">
        <div class="todo-text">${t.text}</div>
        ${t.date !== todayStr()
          ? `<div class="todo-time" style="opacity:.7;">${fmtDate(t.date)}${t.time ? ' · ' + t.time : ''}</div>`
          : (t.time ? `<div class="todo-time"><i class="ph ph-clock"></i> ${t.time}</div>` : '')}
      </div>
      <button class="btn-icon danger" onclick="deleteTodo(${t.id})"><i class="ph ph-trash"></i></button>
    </div>
  `).join('');
}

// ── ARCHIVE (งานเดือนก่อนๆ) ──
function openArchiveModal() {
  renderArchive();
  document.getElementById('archiveModal').classList.add('open');
}

function closeArchiveModal() {
  document.getElementById('archiveModal').classList.remove('open');
}

function renderArchive() {
  const cycleStart = currentCycleStart();
  const past = todos
    .filter(t => t.date < cycleStart)
    .sort((a, b) => b.date.localeCompare(a.date) || (a.time || '').localeCompare(b.time || ''));

  const el = document.getElementById('archiveList');
  if (!el) return;

  if (!past.length) {
    el.innerHTML = adminEmpty('<i class="ph ph-archive"></i>', 'ยังไม่มีประวัติ');
    return;
  }

  const groups = {};
  past.forEach(t => {
    if (!groups[t.date]) groups[t.date] = [];
    groups[t.date].push(t);
  });

  el.innerHTML = Object.entries(groups).map(([date, items]) => `
    <div class="archive-day-group">
      <div class="archive-day-label">${fmtDate(date)}</div>
      ${items.map(t => `
        <div class="todo-item ${t.done ? 'done' : ''}" style="margin-bottom:6px;">
          <div class="todo-checkbox ${t.done ? 'checked' : ''}"></div>
          <div class="todo-content">
            <div class="todo-text">${t.text}</div>
            ${t.time ? `<div class="todo-time"><i class="ph ph-clock"></i> ${t.time}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

// ── CUSTOM DATE PICKER ──
function setDatePickerValue(dateStr) {
  const hidden = document.getElementById('todoDate');
  const label = document.getElementById('todoDateLabel');
  const native = document.getElementById('todoDatePickerNative');
  const hint = document.getElementById('todoDatePickerHint');

  hidden.value = dateStr;
  if (native) native.value = dateStr;

  const today = todayStr();
  const tmr = addDays(today, 1);

  if (dateStr === today) label.textContent = 'วันนี้';
  else if (dateStr === tmr) label.textContent = 'พรุ่งนี้';
  else label.textContent = fmtDate(dateStr);

  if (hint) hint.textContent = `เดือนนี้: ${fmtDate(currentCycleStart())} – ${fmtDate(currentCycleEnd())}`;
}

function setDatePickerToday() { setDatePickerValue(todayStr()); }

function setDatePickerTomorrow() {
  const tmr = addDays(todayStr(), 1);
  const cycleEnd = currentCycleEnd();
  setDatePickerValue(tmr > cycleEnd ? cycleEnd : tmr);
}

function onDatePickerNativeChange(val) {
  if (!val) return;
  setDatePickerValue(val);
}

function openDatePicker() {
  const native = document.getElementById('todoDatePickerNative');
  const current = document.getElementById('todoDate').value || todayStr();
  setDatePickerValue(current);
  document.getElementById('todoDatePickerModal').classList.add('open');
}

function closeDatePickerModal() {
  document.getElementById('todoDatePickerModal').classList.remove('open');
}

// ── CUSTOM TIME PICKER ──
function setTimePickerValue(hhmm) {
  const hidden = document.getElementById('todoTime');
  const btn = document.getElementById('todoTimeBtn');
  const label = document.getElementById('todoTimeLabel');
  hidden.value = hhmm || '';
  if (hhmm) {
    label.textContent = hhmm;
    btn.classList.add('has-value');
  } else {
    label.textContent = 'เวลา';
    btn.classList.remove('has-value');
  }
}

function buildTimePickerColumns() {
  const hoursEl = document.getElementById('timePickerHours');
  const minutesEl = document.getElementById('timePickerMinutes');

  hoursEl.innerHTML = Array.from({ length: 24 }, (_, h) =>
    `<div class="time-picker-item" data-hour="${h}" onclick="pickTimeHour(${h})">${String(h).padStart(2, '0')}</div>`
  ).join('');

  minutesEl.innerHTML = Array.from({ length: 12 }, (_, i) => i * 5).map(m =>
    `<div class="time-picker-item" data-minute="${m}" onclick="pickTimeMinute(${m})">${String(m).padStart(2, '0')}</div>`
  ).join('');
}

function refreshTimePickerHighlight() {
  document.querySelectorAll('#timePickerHours .time-picker-item').forEach(el => {
    el.classList.toggle('selected', Number(el.dataset.hour) === timePickerHour);
  });
  document.querySelectorAll('#timePickerMinutes .time-picker-item').forEach(el => {
    el.classList.toggle('selected', Number(el.dataset.minute) === timePickerMinute);
  });
  const display = document.getElementById('timePickerDisplay');
  display.textContent = (timePickerHour !== null && timePickerMinute !== null)
    ? `${String(timePickerHour).padStart(2, '0')}:${String(timePickerMinute).padStart(2, '0')}`
    : '--:--';
}

function scrollTimePickerIntoView() {
  const h = document.querySelector(`#timePickerHours .time-picker-item[data-hour="${timePickerHour}"]`);
  const m = document.querySelector(`#timePickerMinutes .time-picker-item[data-minute="${timePickerMinute}"]`);
  if (h) h.scrollIntoView({ block: 'center' });
  if (m) m.scrollIntoView({ block: 'center' });
}

function pickTimeHour(h) { timePickerHour = h; refreshTimePickerHighlight(); }
function pickTimeMinute(m) { timePickerMinute = m; refreshTimePickerHighlight(); }

function setTimePickerNow() {
  const now = new Date();
  timePickerHour = now.getHours();
  timePickerMinute = Math.round(now.getMinutes() / 5) * 5 % 60;
  refreshTimePickerHighlight();
  scrollTimePickerIntoView();
}

function clearTimePicker() {
  timePickerHour = null;
  timePickerMinute = null;
  refreshTimePickerHighlight();
}

function confirmTimePicker() {
  if (timePickerHour !== null && timePickerMinute !== null) {
    setTimePickerValue(`${String(timePickerHour).padStart(2, '0')}:${String(timePickerMinute).padStart(2, '0')}`);
  } else {
    setTimePickerValue('');
  }
  closeTimePickerModal();
}

function openTimePicker() {
  buildTimePickerColumns();

  const current = document.getElementById('todoTime').value;
  if (current) {
    const [h, m] = current.split(':').map(Number);
    timePickerHour = h;
    timePickerMinute = Math.round(m / 5) * 5 % 60;
  } else {
    timePickerHour = null;
    timePickerMinute = null;
  }

  refreshTimePickerHighlight();
  document.getElementById('todoTimePickerModal').classList.add('open');
  setTimeout(scrollTimePickerIntoView, 50);
}

function closeTimePickerModal() {
  document.getElementById('todoTimePickerModal').classList.remove('open');
}

// ── MODAL หลัก ──
function openTodoModal() {
  if (!document.getElementById('todoDate').value) setDatePickerValue(todayStr());
  document.getElementById('todoModal').classList.add('open');
  renderTodos();
}

function closeTodoModal() {
  document.getElementById('todoModal').classList.remove('open');
}

// ── ผูกฟังก์ชันเข้ากับ window (เรียกครั้งเดียวตอน init จาก admin.js) ──
export function bindTodoWindowFunctions() {
  window.openTodoModal = openTodoModal;
  window.closeTodoModal = closeTodoModal;
  window.addTodo = addTodo;
  window.toggleTodo = toggleTodo;
  window.deleteTodo = deleteTodo;

  window.openArchiveModal = openArchiveModal;
  window.closeArchiveModal = closeArchiveModal;

  window.openDatePicker = openDatePicker;
  window.closeDatePickerModal = closeDatePickerModal;
  window.setDatePickerToday = setDatePickerToday;
  window.setDatePickerTomorrow = setDatePickerTomorrow;
  window.onDatePickerNativeChange = onDatePickerNativeChange;

  window.openTimePicker = openTimePicker;
  window.closeTimePickerModal = closeTimePickerModal;
  window.pickTimeHour = pickTimeHour;
  window.pickTimeMinute = pickTimeMinute;
  window.setTimePickerNow = setTimePickerNow;
  window.clearTimePicker = clearTimePicker;
  window.confirmTimePicker = confirmTimePicker;
}