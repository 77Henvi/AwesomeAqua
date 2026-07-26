# เปิด Messenger Bot ให้ลูกค้าทั่วไปคุยได้ (ไม่ใช่แค่ tester/admin)

งานนี้เป็นขั้นตอนฝั่ง Meta/Facebook Developer Console เป็นหลัก ไม่ใช่โค้ด — เอกสารนี้สรุป
สิ่งที่ต้องทำจริง อ้างอิงนโยบายปัจจุบันของ Meta (Messenger Platform, กรกฎาคม 2026)

## ทำไมตอนนี้คุยได้แค่ tester/admin

แอปที่สร้างใหม่บน Meta Developer Console จะอยู่ใน **Development Mode** โดยดีฟอลต์
ซึ่งจำกัดให้ใช้งานได้เฉพาะ Admin/Developer/Tester ที่ถูกเพิ่มไว้ในแอปเท่านั้น
ลูกค้าทั่วไปที่ไม่ได้อยู่ในรายชื่อนี้จะคุยกับบอทไม่ได้เลย (หรือเห็นเป็น error/ไม่ตอบกลับ)

## ข้อดีที่ AwesomeAqua มีอยู่แล้ว: ใช้แค่เพจของตัวเอง

ตามเอกสารทางการของ Messenger Platform: **App Review ไม่จำเป็น ถ้าแอปส่ง/รับข้อความ
เฉพาะเพจ Facebook ของตัวเอง** (ไม่ได้ทำแพลตฟอร์มให้ธุรกิจอื่นเชื่อมต่อเพจตัวเองเข้ามาใช้)
กรณี AwesomeAqua ตรงกับเงื่อนไขนี้พอดี (เพจเดียว ใช้เอง) ดังนั้นสิ่งที่ต้องทำหลักๆ คือ
**สลับแอปจาก Development Mode → Live Mode** ไม่ใช่ยื่น App Review เต็มรูปแบบเสมอไป

## ขั้นตอนที่ต้องทำ (เรียงตามลำดับ)

### 1) ตรวจสอบสิทธิ์ที่ใช้อยู่จริง
เข้า Meta Developer Console → App ของ AwesomeAqua → **Messenger → API Settings**
เช็คว่าตอนนี้ขอสิทธิ์อะไรไว้บ้าง (คาดว่าน่าจะเป็น `pages_messaging` เท่านั้น)

### 2) Business Verification (ถ้ายังไม่ทำ)
การสลับเป็น Live Mode มักต้องมี **Business Verification** ผูกกับแอปก่อน
(ยืนยันว่าเป็นธุรกิจจริง — ใช้เอกสารทะเบียนการค้า/บัตรประชาชนเจ้าของเพจ)
ทำที่ **App Settings → Business Verification**

### 3) เตรียมสิ่งที่ Meta ต้องการก่อนสลับ Live Mode
- **Privacy Policy URL** — ต้องมีหน้านโยบายความเป็นส่วนตัวที่อธิบายว่าเก็บข้อมูลอะไรบ้าง
  (PSID, ข้อความ, ตะกร้า/ออเดอร์) และใช้ทำอะไร — ยังไม่มีในเว็บตอนนี้ ต้องทำเพิ่ม
- **App Icon + Category** — กรอกให้ครบใน App Settings → Basic
- ✅ **Data Deletion Instructions** — ทำเสร็จแล้ว 2 ทาง:
  1. **Data Deletion Callback URL** (`api/data-deletion.js`) — กรอกในหน้า
     App Settings → Advanced → "อนุญาต URL การเรียกกลับ":
     ```
     https://awesome-aqua.vercel.app/api/data-deletion
     ```
     Meta จะ POST `signed_request` มาที่ endpoint นี้เวลาลูกค้ากดลบข้อมูลจากฝั่ง Facebook เอง
     ระบบจะตรวจลายเซ็น ลบ session/ตัดการเชื่อมโยง PSID ออกจากออเดอร์ แล้วตอบกลับลิงก์เช็คสถานะ
     (`data-deletion-status.html`) ตามฟอร์แมตที่ Meta กำหนด
  2. **คำสั่งในแชท** — ลูกค้าพิมพ์ `"ลบข้อมูลฉัน"` กับบอทได้เองทุกเมื่อ (self-service)

### 4) สลับ App Mode เป็น Live
Developer Console → มุมขวาบนของหน้าแอป จะมี toggle "Development / Live" → กดสลับ
ถ้า Business Verification ผ่านแล้ว ระบบจะยอมให้สลับได้เลยโดยไม่ต้องรอ review เพิ่ม
(เพราะ `pages_messaging` ใช้กับเพจตัวเองอย่างเดียว ไม่ต้องขอ Advanced Access)

### 5) ถ้า Meta ขอให้ยื่น App Review เพิ่ม (บางเคสยังโดนขอ)
เตรียม:
- **Screencast** วิดีโอสาธิต flow จริง: ลูกค้าทักบอท → ดูปลา → ใส่ตะกร้า → สั่งซื้อ →
  ได้ QR โอนเงิน (ใช้เคสจริงจาก flow ที่มีอยู่แล้วในโค้ดตอนนี้ได้เลย)
- **คำอธิบายการใช้สิทธิ์ `pages_messaging`** แบบเจาะจง เช่น:
  > "ใช้ส่งข้อความตอบกลับลูกค้าที่ทักเพจ AwesomeAqua เพื่อแจ้งรายละเอียดปลา/ตะกร้า/
  > สถานะคำสั่งซื้อ ภายใน 24 ชม. มาตรฐานของ Messenger Platform เท่านั้น ไม่มีการส่ง
  > ข้อความโฆษณาออกไปนอกช่วงเวลาที่อนุญาต"
- Test user account ที่ Meta reviewer ใช้ทดสอบเองได้ (ไม่ใช่ admin ของเพจ)

## สิ่งที่โค้ดปัจจุบันรองรับอยู่แล้ว (ไม่ต้องแก้)
- Webhook ตอบเฉพาะข้อความที่ user ทักเข้ามาก่อน (ไม่มีการส่งแบบ broadcast/ads นอก 24 ชม.)
- ไม่มีการเก็บข้อมูลอ่อนไหว เก็บแค่ PSID + ตะกร้า/ประวัติสั่งซื้อใน `messenger_sessions`/`orders`

## สิ่งที่ยังขาดและต้องเพิ่ม (เพื่อให้ยื่นได้/สลับ Live Mode ได้)
- [ ] หน้า Privacy Policy บนเว็บ (พร้อมลิงก์ในแอป Meta)
- [x] กลไก/ขั้นตอนให้ผู้ใช้ขอลบข้อมูลตัวเอง (Data Deletion Instructions) — เสร็จแล้ว
      (`api/data-deletion.js` + คำสั่ง "ลบข้อมูลฉัน" ในแชท) เหลือแค่ตั้งค่า env var
      `MESSENGER_APP_SECRET` บน Vercel (ตัวเดียวกับที่ webhook ปกติใช้) แล้วเอา URL
      ไปกรอกในหน้า App Settings → Advanced ตามข้างต้น
- [ ] Business Verification ผ่านแล้ว
- [ ] สลับ Development → Live Mode
- [ ] (ถ้าจำเป็น) ยื่น App Review พร้อม screencast ตามข้างต้น

> อ้างอิง: Meta for Developers — Messenger Platform Overview, "App Review (if your app
> needs Advanced Access). Not required if you only send and receive messages for your
> own Facebook Page." (developers.facebook.com/documentation/business-messaging/messenger-platform/overview)
