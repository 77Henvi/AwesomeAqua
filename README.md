# 🐠 AwesomeAqua

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

**Admin**
* CRUD ปลา + จัดการสต็อก พร้อมไซส์/ราคาคู่ (min–max)
* ระบบ "เลิกขาย" (soft-delete) — ไม่ลบประวัติการเงินทิ้งไปด้วย
* บันทึกการขาย พร้อมเลือกไซส์ที่ขายได้จริง
* Dashboard การเงิน: KPI รายปี, กราฟรายรับ-รายจ่าย, ดูย้อนหลังรายเดือน
* Real-time sync กับ Supabase DB

---

## Security

* Row Level Security (RLS) เปิดใช้งานทุกตาราง — public อ่านได้เฉพาะข้อมูลปลาที่เผยแพร่ ส่วนเขียน/แก้/ลบจำกัดเฉพาะ authenticated admin
* Messenger webhook ใช้ Supabase **Service Role Key** (ฝั่ง server เท่านั้น ไม่เคยส่งเข้า client)
* View สาธารณะ (`fish_public`) ไม่เปิดเผยข้อมูลภายใน (ต้นทุน/ราคาขายพิเศษ)
* ดูสคริปต์ตรวจสอบ/ตั้งค่าความปลอดภัยได้ที่โฟลเดอร์ `supabase/`

---

## Testing & CI

```bash
node --test tests/
```

ทุก push ขึ้น `main` จะรัน GitHub Actions อัตโนมัติ (`.github/workflows/ci.yml`):
1. ตรวจ syntax ไฟล์ JS ทั้งหมด
2. รัน automated test ของฟังก์ชันคำนวณหลัก (`scripts/shared/calc.js`)

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