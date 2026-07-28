# 🐠 AwesomeAqua

[![CI](https://github.com/77Henvi/AwesomeAqua/actions/workflows/ci.yml/badge.svg)](https://github.com/77Henvi/AwesomeAqua/actions/workflows/ci.yml)

> Aquarium fish marketplace — simple, direct, real

---

## Overview

A Fullstack Fish Shop web platform for buying and selling aquarium fish,
connected directly through **Messenger**.

| Layer | Tech |
|---|---|
| Auth | Supabase |
| DB | Supabase (Postgres + RLS) |
| Storage | Supabase Storage |
| Frontend | Vanilla JS (ES Modules) |
| Admin | CRUD + Dashboard + Finance |
| Chat/Order | Facebook Messenger (webhook) |
| Hosting | Vercel |
| CI | GitHub Actions |

---

## Features

**หน้าร้าน (Storefront)**
* Browse available fish with search + filter chips
* Wishlist 
* Multi-language (TH/EN)
* Contact/order seller via Messenger instantly (auto-fills fish reference)
* Skeleton loading, accessible (keyboard navigable, aria-labeled)

**Reliability & Ops**
* Error monitoring — แจ้งเตือนแอดมินอัตโนมัติผ่าน Discord/Line เมื่อ webhook หรือ API function พัง (`api/_shared/errorNotify.js`, ดู [`docs/ERROR_MONITORING_SETUP.md`](docs/ERROR_MONITORING_SETUP.md))
* Rate limiting — จำกัดไม่เกิน 20 ข้อความ/นาทีต่อ PSID บน Messenger webhook กันสแปม/abuse (`api/_shared/rateLimiter.js`)
* CI status badge บน README (ดูด้านบนสุดของไฟล์นี้)

**Messenger Bot**
* ตะกร้าสินค้า — สั่งหลายปลาต่อออเดอร์ ปรับจำนวนได้
* ลบทีละชิ้นจากตะกร้า (`"ลบ 1"`) หรือล้างตะกร้าทั้งหมด (`"ล้างตะกร้า"`)
* ลบข้อมูลตัวเอง (`"ลบข้อมูลฉัน"`) + Meta Data Deletion Callback (`api/data-deletion.js`)
* Auto-alert สต็อกใกล้หมด แจ้งเตือนแอดมินอัตโนมัติ
* **ค้นหาปลาแบบ fuzzy** — พิมพ์ชื่อปลาแบบไม่ต้องตรงเป๊ะ (พิมพ์ผิด/สะกดใกล้เคียงก็เจอ) บอทจะโชว์ผลลัพธ์ให้เลือก
* **แจ้งเตือนเมื่อของกลับมามีสต็อก** (`"แจ้งเตือน"`) — สมัครรับแจ้งเตือนตอนดูปลาที่หมดสต็อก แล้วบอทจะทักอัตโนมัติทันทีที่แอดมินเติมสต็อก (ต้องตั้งค่าตาราง `restock_alerts` ก่อน ดู [`docs/RESTOCK_ALERTS_SETUP.md`](docs/RESTOCK_ALERTS_SETUP.md))
* **ประวัติคำสั่งซื้อของตัวเอง** (`"ประวัติ"`) — ลูกค้าดูออเดอร์ 5 รายการล่าสุดของตัวเองได้เอง

**Admin**
* CRUD ปลา + จัดการสต็อก พร้อมไซส์/ราคาคู่ (min–max)
* ระบบ "เลิกขาย" (soft-delete) — ไม่ลบประวัติการเงินทิ้งไปด้วย
* บันทึกการขาย พร้อมเลือกไซส์ที่ขายได้จริง
* Dashboard การเงิน: KPI รายปี, กราฟรายรับ-รายจ่าย, ดูย้อนหลังรายเดือน
* ตารางปลา/รายการการเงิน แบ่งหน้า (pagination) รองรับข้อมูลจำนวนมาก
* หน้า Orders — ดูออเดอร์จากตะกร้า Messenger, filter สถานะ, อัปเดต pending → paid/cancelled
* Multi-admin (role owner/staff) + Dashboard วิเคราะห์เชิงลึก (ปลาขายดี, แนะนำรีสต็อค)
* Real-time sync กับ Supabase DB

---

## Security

* Row Level Security (RLS) เปิดใช้งานทุกตาราง — public อ่านได้เฉพาะข้อมูลปลาที่เผยแพร่ ส่วนเขียน/แก้/ลบจำกัดเฉพาะ authenticated admin
* Messenger webhook ใช้ Supabase **Service Role Key** (ฝั่ง server เท่านั้น ไม่เคยส่งเข้า client)
* View สาธารณะ (`fish_public`) ไม่เปิดเผยข้อมูลภายใน (ต้นทุน/ราคาขายพิเศษ)
* Backup อัตโนมัติรายวันผ่าน GitHub Actions (`.github/workflows/backup.yml`, `scripts/backup/backup-db.mjs`) — เพราะ Supabase Free Plan ไม่มี backup ในตัว

---

## Testing & CI

```bash
node --test tests/*.test.mjs
```

ทุก push ขึ้น `main` จะรัน GitHub Actions อัตโนมัติ (`.github/workflows/ci.yml`):
1. ตรวจ syntax ไฟล์ JS ทั้งหมด (`scripts/`, `api/`)
2. รัน automated test ทั้งหมด:
   - `tests/calc.test.mjs` — ฟังก์ชันคำนวณราคา/ไซส์/กราฟ (`scripts/shared/calc.js`)
   - `tests/orders.test.mjs` — filter/group/format ของแท็บ Orders (`scripts/shared/orders.js`)
   - `tests/orderHelpersSync.test.mjs` — กันไม่ให้ `scripts/shared/orders.js` (ฝั่ง admin browser) กับ `api/_shared/orderHelpers.js` (ฝั่ง server) พฤติกรรมเพี้ยนไปคนละทาง (ไฟล์ทั้งสองมีเนื้อหาซ้ำกันโดยตั้งใจ เพราะ `/api` บน Vercel ไม่ได้เสิร์ฟเป็น static file ให้เบราว์เซอร์ดึงได้)
   - `tests/pagination.test.mjs` — ตัวแบ่งหน้าที่ใช้ร่วมกันในตารางปลา/รายการการเงิน (`scripts/shared/utils.js`)
   - `tests/cart.test.mjs` — parse คำสั่งลบของในตะกร้า Messenger (`api/_shared/cart.js`)
   - `tests/signedRequest.test.mjs` — ตรวจลายเซ็น Meta Data Deletion Callback (`api/_shared/signedRequest.js`)
   - `tests/fishSearch.test.mjs` — fuzzy search หาปลาจากข้อความอิสระ (`api/_shared/fishSearch.js`)
   - `tests/rateLimiter.test.mjs` — sliding-window rate limiter กันสแปม webhook (`api/_shared/rateLimiter.js`)

---

## Staging

Branch `develop` + Vercel preview deployment ใช้ทดสอบก่อนขึ้น production
รายละเอียดการแยก Supabase project จริงจังสำหรับ staging (ไม่ปนกับ DB จริง) อยู่ที่
[`docs/STAGING_SETUP.md`](docs/STAGING_SETUP.md)

## Messenger App Review

ตอนนี้บอทเปิดให้คุยได้แค่ tester/admin ของแอป — ขั้นตอนเปิดให้ลูกค้าทั่วไปคุยได้จริง
(Business Verification, Live Mode, Privacy Policy ฯลฯ) สรุปไว้ที่
[`docs/MESSENGER_APP_REVIEW.md`](docs/MESSENGER_APP_REVIEW.md)

---

## Live

https://awesome-aqua.vercel.app/

---

## Purpose

Built to keep things simple:

* No unnecessary features
* No complicated checkout
* Just connect and trade

---

## Philosophy

> Simple sells
> Fast wins
> Direct works

---

## Author

Rapeepat Nitakorn
GitHub: [77Henvi](https://github.com/77Henvi)