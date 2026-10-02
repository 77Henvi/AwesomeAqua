# 🌍 AQUA WORLD — Database & Setup Guide

เอกสารแนะนำการตั้งค่าฐานข้อมูล Supabase สำหรับฟีเจอร์ **Aqua World (โลกของปลา)**

---

## 1. คำสั่ง SQL สำหรับอัปเกรดตาราง `fish`

รันคำสั่ง SQL ด้านล่างใน **Supabase SQL Editor** เพื่อเพิ่มฟิลด์เกี่ยวกับแหล่งกำเนิดทางภูมิศาสตร์:

```sql
-- 1. เพิ่มคอลัมน์แหล่งกำเนิดในตาราง fish
ALTER TABLE fish ADD COLUMN IF NOT EXISTS continent text;
ALTER TABLE fish ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE fish ADD COLUMN IF NOT EXISTS origin_region text;

-- 2. เพิ่ม Index เพื่อความรวดเร็วในการกรองข้อมูลตามทวีป
CREATE INDEX IF NOT EXISTS idx_fish_continent ON fish(continent);
```

---

## 2. อัปเดต View `fish_public` (ความปลอดภัยหน้าร้าน)

อัปเดต view `fish_public` เพื่อให้หน้าร้านและหน้า Aqua World ดึงฟิลด์ `continent`, `country`, `origin_region` ไปแสดงผลได้อย่างถูกต้อง โดยไม่เปิดเผยฟิลด์ต้นทุน (`cost`) หรือข้อมูลภายใน:

```sql
DROP VIEW IF EXISTS fish_public CASCADE;

CREATE VIEW fish_public AS
SELECT
  id,
  name_th,
  name_en,
  desc_th,
  desc_en,
  species,
  price_min,
  price_max,
  stock,
  level,
  image,
  tags_th,
  tags_en,
  size_min,
  size_max,
  color,
  body_shape,
  feeding_behavior,
  is_premium,
  premium_factors,
  is_archived,
  created_at,
  continent,
  country,
  origin_region
FROM fish
WHERE is_archived IS NOT TRUE;

-- กำหนดสิทธิ์ให้ Public / Anon เข้าถึง view ได้ตามเดิม
GRANT SELECT ON fish_public TO anon, authenticated;
```

---

## 3. รายการทวีปมาตรฐาน (Controlled Vocabulary)

ฟิลด์ `continent` รองรับ 6 ทวีปหลักดังนี้:

| ค่าภาษาอังกฤษ (Canonical) | ภาษาไทย | ตัวอย่างปลา |
| :--- | :--- | :--- |
| `South America` | อเมริกาใต้ | ปอมปาดัวร์ (Discus), ปลาเทวดา (Angelfish), ปลาซัคเกอร์ (Pleco) |
| `Asia` | เอเชีย | ปลากัด (Betta), ปลามังกร (Arowana), ปลาซิว (Rasbora) |
| `Africa` | แอฟริกา | ปลาหมอสีมาลาวี (Malawi Cichlid), คองโกเตตร้า (Congo Tetra) |
| `North America` | อเมริกาเหนือ | ปลาหางนกยูง (Guppy), ปลาสอด (Platy/Swordtail), ปลาการ์ (Gar) |
| `Europe` | ยุโรป | ปลาสเตอร์เจียน (Sturgeon), ปลาบู่ยุโรป (European Loach) |
| `Oceania` | โอเชียเนีย / ออสเตรเลีย | ปลาเรนโบว์ (Rainbowfish), ปลาบู่บลูการิบาลดี (Gobies) |

---

## 4. ตัวอย่าง SQL อัปเดตข้อมูลปลาตั้งต้น (Seed Data)

```sql
-- กำหนดแหล่งกำเนิดให้ปลาที่มีอยู่แล้วในระบบ
UPDATE fish
SET continent = 'South America', country = 'Brazil', origin_region = 'Amazon River Basin'
WHERE species ILIKE '%discus%' OR name_th ILIKE '%ปอม%' OR name_en ILIKE '%discus%';

UPDATE fish
SET continent = 'Asia', country = 'Thailand', origin_region = 'Chao Phraya & Mekong Basins'
WHERE species ILIKE '%betta%' OR name_th ILIKE '%ปลากัด%' OR name_en ILIKE '%betta%';

UPDATE fish
SET continent = 'Africa', country = 'Malawi', origin_region = 'Lake Malawi'
WHERE species ILIKE '%cichlid%' OR name_th ILIKE '%มาลาวี%' OR name_en ILIKE '%cichlid%';
```
