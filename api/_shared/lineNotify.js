// api/_shared/lineNotify.js
// ส่งข้อความแจ้งเตือนผ่าน Line Notify — ใช้เป็นช่องทางสำรอง เผื่อ Messenger ส่งไม่ถึงแอดมิน
// (เช่น แอดมิน block บอทเผลอ, Graph API ล่มชั่วคราว, Page Access Token หมดอายุ)
//
// ไม่ throw error ไม่ว่ากรณีใด — ถ้าไม่ได้ตั้งค่า LINE_NOTIFY_TOKEN ไว้ ก็แค่ไม่ส่ง เงียบไว้

const { LINE_NOTIFY_TOKEN: LINE_TOKEN } = process.env;

function truncate(str, max = 900) {
  const s = String(str || '');
  return s.length > max ? s.slice(0, max) + '…(ตัดข้อความ)' : s;
}

async function sendLineNotify(message) {
  if (!LINE_TOKEN) return false;

  try {
    const params = new URLSearchParams({ message: truncate(message) });
    const res = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LINE_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    return res.ok;
  } catch {
    return false;
  }
}

module.exports = { sendLineNotify };
