# ตั้งค่า Error Monitoring (แจ้งเตือนแอดมินเมื่อระบบพัง)

ตอนนี้ `api/messenger-webhook.js`, `api/notify-restock.js`, และ `api/data-deletion.js`
มีระบบดักจับ error ที่ไม่คาดคิด (DB ล่ม, Graph API error, bug ที่หลุดมา) แล้วแจ้งแอดมิน
อัตโนมัติ แทนที่จะเงียบหายไปจน backend พังโดยไม่มีใครรู้

**ไม่ตั้งค่าอะไรเลยก็ใช้งานได้ปกติ** — error จะยัง log ไว้ใน Vercel Logs เหมือนเดิม
แค่ไม่มีการแจ้งเตือนแบบ real-time เท่านั้น เปิดใช้ช่องทางไหนก็ได้ (หรือทั้งคู่พร้อมกัน)

## วิธีที่ 1 — Discord (แนะนำ ทำง่ายสุด)

1. เปิด Discord server ของคุณ (หรือสร้าง server ใหม่ไว้รับแจ้งเตือนโดยเฉพาะก็ได้)
2. คลิกขวาที่ channel ที่ต้องการรับแจ้งเตือน → **Edit Channel → Integrations → Webhooks**
3. กด **New Webhook** → ตั้งชื่อ เช่น "AwesomeAqua Alerts" → **Copy Webhook URL**
4. ไปที่ Vercel → Project Settings → Environment Variables → เพิ่ม:
   ```
   DISCORD_ERROR_WEBHOOK_URL = https://discord.com/api/webhooks/xxxxx/xxxxx
   ```

## วิธีที่ 2 — Line Notify

1. เข้า [notify-bot.line.me/my](https://notify-bot.line.me/my/) (ล็อกอินด้วย Line account)
2. กด **Generate token** → เลือกกลุ่ม/แชทที่จะรับแจ้งเตือน (แนะนำสร้างกลุ่ม Line แยกไว้เฉพาะ)
3. Copy token ที่ได้
4. ไปที่ Vercel → Environment Variables → เพิ่ม:
   ```
   LINE_NOTIFY_TOKEN = xxxxxxxxxxxxxxxxxxxxxxxxx
   ```

## เช็คว่าทำงานถูกต้อง

ลองแกล้งทำให้ error เกิดขึ้น (เช่น ปิด Supabase ชั่วคราว หรือใส่ URL ผิดใน env var ทดสอบ
บน preview deployment เท่านั้น อย่าทำกับ production) แล้วดูว่ามีข้อความแจ้งเตือนโผล่มาไหม

ข้อความที่ได้จะมีรูปแบบ:
```
🚨 [AwesomeAqua Error] messenger-webhook
<รายละเอียด error/stack trace>
```

## หมายเหตุ

- ระบบไม่ throw error ซ้ำถ้าการแจ้งเตือนเองพัง (เช่น Discord webhook URL ผิด) — กันไม่ให้
  ปัญหาซ้อนปัญหา
- Messenger webhook จะตอบ `200 EVENT_RECEIVED` กลับให้ Meta เสมอ ไม่ว่าข้างในจะ error หรือไม่
  (สำคัญมาก — ถ้า Meta ได้ status code อื่นต่อเนื่องหลายครั้ง จะปิดใช้งาน webhook อัตโนมัติ)
  ดังนั้นการแจ้งเตือนนี้มีไว้ให้ "แอดมินรู้ตัวก่อนลูกค้าจะมาบ่น" ไม่ใช่กลไกที่ Meta มองเห็น
