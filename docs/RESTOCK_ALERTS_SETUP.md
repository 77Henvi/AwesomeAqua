# ตั้งค่าตาราง `restock_alerts` (สำหรับฟีเจอร์ "แจ้งเตือนเมื่อมีของ")

ฟีเจอร์นี้ให้ลูกค้าพิมพ์ `"แจ้งเตือน"` ตอนดูปลาที่หมดสต็อกอยู่ แล้วบอทจะแจ้งอัตโนมัติทันทีที่
แอดมินเติมสต็อกกลับมา ต้องสร้างตารางใหม่ 1 ตารางใน Supabase ก่อนใช้งานได้

## SQL สร้างตาราง

รันใน Supabase → SQL Editor:

```sql
create table if not exists restock_alerts (
  id         uuid primary key default gen_random_uuid(),
  fish_id    uuid not null references fish(id) on delete cascade,
  psid       text not null,
  created_at timestamptz not null default now(),
  unique (fish_id, psid) -- กันลูกค้าคนเดียวกันกดแจ้งเตือนซ้ำหลายรอบสำหรับปลาตัวเดียวกัน
);

-- RLS: เปิดใช้งาน แต่ไม่มี public policy ใดๆ เลย
-- เข้าถึงได้เฉพาะผ่าน Service Role Key (จาก api/messenger-webhook.js และ api/notify-restock.js) เท่านั้น
alter table restock_alerts enable row level security;
```

> หมายเหตุ: `unique (fish_id, psid)` ทำให้ `dbUpsert` ใน `api/messenger-webhook.js`
> (ที่ใช้ `Prefer: resolution=merge-duplicates`) ทำงานถูกต้อง — ถ้าลูกค้ากด "แจ้งเตือน" ซ้ำ
> จะอัปเดตแถวเดิมแทนที่จะสร้างซ้ำ

## เช็คว่าทำงานถูกต้อง

1. เปิดหน้าเว็บ → เลือกปลาที่สต็อก = 0 → กดปุ่ม Messenger
2. ในแชท พิมพ์ `"แจ้งเตือน"` → ควรได้ข้อความยืนยัน "รับทราบครับ..."
3. ไปที่ Admin → เติมสต็อกปลาตัวนั้น (ผ่าน "เติมสต็อก" หรือแก้ไขปลาโดยตรง)
4. ลูกค้าควรได้รับข้อความแจ้งเตือนอัตโนมัติภายในไม่กี่วินาที
5. เช็คในตาราง `restock_alerts` ว่าแถวที่แจ้งไปแล้วถูกลบทิ้ง (กันแจ้งซ้ำ)
