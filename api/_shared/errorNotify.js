// api/_shared/errorNotify.js
// แจ้งเตือนแอดมินอัตโนมัติเมื่อ serverless function (webhook/notify-restock/data-deletion) พัง
// รองรับ 2 ช่องทาง เปิดใช้อันไหนก็ได้ (หรือทั้งคู่พร้อมกัน) ผ่าน environment variable:
//   - DISCORD_ERROR_WEBHOOK_URL  → ส่งเข้า Discord channel ผ่าน webhook
//   - LINE_NOTIFY_TOKEN          → ส่งเข้า Line ส่วนตัว/กลุ่มผ่าน Line Notify
// ถ้าไม่ตั้งค่าตัวแปรไหนไว้เลย ฟังก์ชันนี้จะแค่ log ลง console (ยังเห็นใน Vercel Logs ได้)
// ไม่ throw error ไม่ว่ากรณีใด — กันไม่ให้การแจ้งเตือนพังไปกระทบ flow หลักของระบบ

const {
  DISCORD_ERROR_WEBHOOK_URL: DISCORD_URL,
  LINE_NOTIFY_TOKEN:         LINE_TOKEN,
} = process.env;

// ── ตัดข้อความยาวเกิน ไม่ให้ Discord/Line ปฏิเสธ request (Discord limit ~2000 ตัวอักษร) ──
function truncate(str, max = 1500) {
  const s = String(str || '');
  return s.length > max ? s.slice(0, max) + '…(ตัดข้อความ)' : s;
}

async function notifyDiscord(source, message) {
  if (!DISCORD_URL) return;
  await fetch(DISCORD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `🚨 **[AwesomeAqua Error]** \`${source}\`\n\`\`\`${truncate(message)}\`\`\``,
    }),
  }).catch(() => {});
}

async function notifyLine(source, message) {
  if (!LINE_TOKEN) return;
  const params = new URLSearchParams({ message: `🚨 [AwesomeAqua Error] ${source}\n${truncate(message, 900)}` });
  await fetch('https://notify-api.line.me/api/notify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LINE_TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  }).catch(() => {});
}

// ── เรียกอันนี้ตัวเดียวจากทุก endpoint — ยิงแจ้งเตือนทุกช่องทางที่ตั้งค่าไว้พร้อมกัน ──
// source: ชื่อ endpoint/ฟังก์ชันที่ error เกิดขึ้น (เช่น "messenger-webhook", "notify-restock")
// error: Error object หรือ string ก็ได้
async function notifyError(source, error) {
  const message = error?.stack || error?.message || String(error);

  // log ไว้ใน Vercel Logs เสมอ ไม่ว่าจะตั้งค่า Discord/Line หรือไม่
  console.error(`[${source}]`, message);

  await Promise.all([
    notifyDiscord(source, message),
    notifyLine(source, message),
  ]);
}

module.exports = { notifyError };
