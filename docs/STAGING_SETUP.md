# แยก Supabase Project สำหรับ Staging จริงจัง

ตอนนี้ preview deployment (branch `develop`) ยังใช้ Supabase DB ตัวเดียวกับ production
ทำให้เทสอะไรบน preview ก็กระทบข้อมูลจริงไปด้วย เอกสารนี้อธิบายวิธีแยกให้เด็ดขาด

โค้ดฝั่ง client (`supabase.js`) เตรียม hostname-based switch ไว้ให้แล้ว —
เหลือแค่ทำตามขั้นตอนด้านล่างเพื่อสร้าง Supabase project ใหม่ แล้วเสียบค่าเข้าไป

---

## 1) สร้าง Supabase Project ใหม่สำหรับ Staging

1. ไปที่ [supabase.com/dashboard](https://supabase.com/dashboard) → "New Project"
2. ตั้งชื่อ เช่น `awesomeaqua-staging`
3. เลือก region เดียวกับ production (ลดความหน่วง ไม่จำเป็นต้องตรงเป๊ะก็ได้)
4. รอ provision เสร็จ (~2 นาที)

## 2) Copy โครงสร้างตาราง (Schema) จาก Production

Supabase ไม่มีปุ่ม "clone project" ในแผน Free ต้องทำเอง:

1. เปิด production project → **Database → Backups** หรือใช้ Supabase CLI:
   ```
   supabase db dump --db-url <PROD_DB_URL> -f schema.sql --schema public
   ```
2. เปิด staging project → **SQL Editor** → วางเนื้อหา `schema.sql` แล้วรัน
   - ทำให้ได้ตาราง: `fish`, `finance`, `orders`, `messenger_sessions`, `ads`, `line_sessions`, `admins`
   - อย่าลืม RLS policies และ view `fish_public` (ดู Phase 0 ใน roadmap) — ต้องตั้งใหม่ในนี้ด้วย เพราะ dump บางทีไม่รวม policy
3. ใส่ข้อมูลตัวอย่าง (seed data) เข้าไปเล็กน้อย เพื่อให้ทดสอบหน้าร้าน/แอดมินได้จริง

> แนะนำ: หลังทำเสร็จ ให้ export `schema.sql` เก็บไว้ใน repo (เช่น `supabase/schema.sql`)
> จะได้ไม่ต้องทำมือซ้ำทุกครั้งที่ staging DB มีปัญหาต้องสร้างใหม่

## 3) ตั้งค่า Client-side (`supabase.js`)

ไฟล์ `supabase.js` มี `STAGING_URL` / `STAGING_KEY` เตรียมไว้ให้แล้ว (ค่าว่างตอนนี้ —
โค้ดจะ fallback ไปใช้ production โดยอัตโนมัติจนกว่าจะใส่ค่า):

```js
const STAGING_URL = 'https://<your-staging-ref>.supabase.co';
const STAGING_KEY = '<staging-anon-key>';
```

Logic การเลือกใช้: ถ้า hostname **ไม่ตรงกับ** `awesome-aqua.vercel.app` (production เป๊ะๆ)
ถือว่าเป็น preview/localhost → ใช้ staging โดยอัตโนมัติ ไม่ต้องตั้งค่าอะไรเพิ่มใน Vercel

## 4) ตั้งค่า Server-side (API functions บน Vercel)

`api/messenger-webhook.js`, `api/manage-admins.js`, `api/notify-low-stock.js` อ่านค่า
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` จาก `process.env` — Vercel รองรับการตั้งค่า
env var แยกตาม environment อยู่แล้วโดยไม่ต้องแก้โค้ดเลย:

1. Vercel Dashboard → Project → **Settings → Environment Variables**
2. เพิ่มตัวแปรเดิม (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) อีกชุด แต่ติ๊ก scope
   เฉพาะ **Preview** (ไม่ติ๊ก Production) แล้วใส่ค่าของ staging project
3. Push ขึ้น branch `develop` → Vercel จะ build preview โดยดึง env var ชุด Preview
   อัตโนมัติ ส่วน `main` (production) ยังใช้ค่าเดิม

> หมายเหตุ: webhook ของ Messenger (Facebook) ชี้ไป URL เดียว (production) เท่านั้น
> ทดสอบ flow ตะกร้า/checkout บน staging จึงทำได้แค่ผ่านหน้าเว็บ + Supabase โดยตรง
> ยังไม่ผ่าน Messenger จริง (ต้องมี webhook แยกถ้าอยากเทส flow บอทเต็มรูปแบบ — งานถัดไปที่อาจต้องทำ)

## 5) เช็คว่าใช้ถูก DB

เปิด browser console บน preview URL จะเห็น log:
```
[AwesomeAqua] ใช้ Supabase staging project (preview deployment) — ไม่ใช่ production DB
```
ถ้าไม่เห็น log นี้บน preview แปลว่ายังไม่ได้ใส่ `STAGING_URL`/`STAGING_KEY` ในขั้นตอนที่ 3

---

## สรุปสิ่งที่ต้องทำเอง (นอกเหนือจากโค้ดที่เตรียมไว้แล้ว)

- [ ] สร้าง Supabase project ใหม่ (`awesomeaqua-staging`)
- [ ] Copy schema + RLS policies จาก production
- [ ] ใส่ `STAGING_URL` / `STAGING_KEY` ใน `supabase.js`
- [ ] ตั้งค่า Preview env vars ใน Vercel dashboard
- [ ] (ถ้าต้องการ) export `schema.sql` เก็บใน repo กัน DB ล่ม/ต้องสร้างใหม่
