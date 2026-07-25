// scripts/shared/cart.js
// ฟังก์ชัน "ล้วน" (pure) ที่ใช้แยกวิเคราะห์ข้อความตะกร้าจาก Messenger
// แยกออกมาจาก api/messenger-webhook.js เพื่อให้ทดสอบอัตโนมัติได้โดยไม่ต้องพึ่ง Supabase/Graph API จริง

// จับข้อความแบบ "ลบ 1", "ลบตัวที่ 2", "ลบทีละชิ้น 3" ฯลฯ — คืนหมายเลข (1-based) หรือ null ถ้าไม่ match
function parseRemoveCommand(text) {
  const match = (text || '').trim().match(/^ลบ.*?(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : null;
}

// หา index จริงใน cart array ที่ตรงกับ "หมายเลขที่แสดงผล" (นับเฉพาะรายการที่ isValid(item) === true)
// เพราะบางรายการอาจหาข้อมูลปลาไม่เจอแล้ว (ถูกลบจาก DB) จึงไม่นับในลำดับที่โชว์ผู้ใช้
function findCartRemovalIndex(cart, displayIndex, isValid) {
  if (!Array.isArray(cart) || !displayIndex || displayIndex < 1) return -1;
  let seen = 0;
  for (let i = 0; i < cart.length; i++) {
    if (!isValid(cart[i])) continue;
    seen += 1;
    if (seen === displayIndex) return i;
  }
  return -1;
}

module.exports = { parseRemoveCommand, findCartRemovalIndex };
