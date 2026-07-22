// scripts/backup/backup-db.mjs
// สำรองข้อมูลทุกตารางสำคัญเป็นไฟล์ JSON — ใช้เพราะ Supabase Free Plan ไม่มี backup อัตโนมัติให้เลย
// รันผ่าน GitHub Actions ตามตารางเวลาใน .github/workflows/backup.yml
//
// รันเอง (ทดสอบในเครื่อง):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup/backup-db.mjs

import { writeFileSync, mkdirSync } from 'node:fs';

const { SUPABASE_URL: DB_URL, SUPABASE_SERVICE_ROLE_KEY: DB_KEY } = process.env;

if (!DB_URL || !DB_KEY) {
  console.error('❌ ต้องตั้งค่า SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ก่อนรัน');
  process.exit(1);
}

// รายชื่อตารางทั้งหมดที่ต้อง backup (เช็คจากทุกจุดในโค้ดที่เรียก supabase.from(...) จริง)
const TABLES = ['fish', 'finance', 'orders', 'messenger_sessions', 'ads', 'line_sessions'];

const HEADERS = { apikey: DB_KEY, Authorization: `Bearer ${DB_KEY}` };

async function fetchTable(table) {
  // ?select=* ดึงทุกคอลัมน์ ทุกแถว (ตารางเล็กพอสำหรับร้านขนาดนี้ ไม่ต้องแบ่งหน้า)
  const res = await fetch(`${DB_URL}/rest/v1/${table}?select=*`, { headers: HEADERS });
  if (!res.ok) {
    console.warn(`⚠️  ดึงตาราง "${table}" ไม่สำเร็จ (${res.status}) — ข้ามไปตารางถัดไป`);
    return null;
  }
  return res.json();
}

async function main() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const dir = `backups/${today}`;
  mkdirSync(dir, { recursive: true });

  let totalRows = 0;
  const summary = {};

  for (const table of TABLES) {
    const rows = await fetchTable(table);
    if (rows === null) { summary[table] = 'FAILED'; continue; }

    writeFileSync(`${dir}/${table}.json`, JSON.stringify(rows, null, 2));
    summary[table] = rows.length;
    totalRows += rows.length;
    console.log(`✅ ${table}: ${rows.length} แถว`);
  }

  writeFileSync(`${dir}/_summary.json`, JSON.stringify({ date: today, tables: summary, totalRows }, null, 2));
  console.log(`\n🎉 Backup เสร็จสิ้น: ${dir} (รวม ${totalRows} แถว)`);
}

main().catch(err => {
  console.error('❌ Backup ล้มเหลว:', err);
  process.exit(1);
});
