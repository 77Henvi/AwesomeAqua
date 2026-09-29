# ตั้งค่า view `fish_sales_stats` (สำหรับป้าย HOT / ลดหนัก และ "ขายแล้ว X+")

หน้าร้านต้องรู้ยอดขายของปลาแต่ละตัว แต่ยอดขายอยู่ในตาราง `finance` ซึ่งฝั่งลูกค้า (anon) **อ่านไม่ได้** (RLS)
จึงสร้าง view ที่สรุปเป็นตัวเลขรวม (ไม่มีชื่อลูกค้า ไม่มียอดเงิน ไม่มีต้นทุน) แล้วเปิดให้อ่านเฉพาะ view นี้

> ถ้ายังไม่รัน SQL นี้ หน้าร้านจะยังใช้งานได้ปกติ — แค่จะไม่มีป้ายและไม่มียอดขายแสดง
> (ระบบตั้งใจไม่ติดป้าย "ลดหนัก" เมื่อไม่มีข้อมูลยอดขาย เพื่อกันปลาทั้งร้านถูกติดป้ายผิดพลาด)

## 1) รัน SQL ใน Supabase → SQL Editor

```sql
create or replace view public.fish_sales_stats as
select
  f.id                              as fish_id,
  coalesce(s.sold_total, 0)::int    as sold_total,     -- ขายรวมทั้งหมด (ตัว)
  coalesce(s.sold_30d,   0)::int    as sold_30d,       -- ขายใน 30 วันล่าสุด (ตัว)
  s.last_sold_at,                                      -- วันที่ขายล่าสุด
  r.last_restock_at                                    -- วันที่รับปลาเข้า/เติมสต็อกล่าสุด
from public.fish f
left join lateral (
  select
    sum(x.q)                                              as sold_total,
    sum(x.q) filter (where x.d >= current_date - 30)      as sold_30d,
    max(x.d)                                              as last_sold_at
  from (
    select
      -- จำนวนตัวอ่านจากชื่อรายการ เช่น "ขายปลา: ... x3 ตัว" (กติกาเดียวกับ extractSaleQty ใน calc.js; ไม่เจอ = 1)
      coalesce((regexp_match(fi.name, 'x(\d+)\s*ตัว'))[1]::int, 1) as q,
      fi.date::date                                                 as d
    from public.finance fi
    where fi.fish_id = f.id
      and fi.type = 'income'
  ) x
) s on true
left join lateral (
  select max(fi.date::date) as last_restock_at
  from public.finance fi
  where fi.fish_id = f.id
    and fi.type = 'expense'
    and (fi.name like 'เติมสต็อก%' or fi.name like 'ซื้อปลา%')
) r on true
where coalesce(f.is_archived, false) = false;

grant select on public.fish_sales_stats to anon, authenticated;
```

**หมายเหตุ**
- view นี้รันด้วยสิทธิ์เจ้าของ (จึงอ่าน `finance` ได้ทั้งที่ anon อ่านตรงๆ ไม่ได้) และเปิดเผยแค่ตัวเลขสรุปต่อปลา
  Supabase Linter อาจเตือนเรื่อง "Security Definer View" — ในกรณีนี้เป็นความตั้งใจ
- ช่วง "30 วัน" ของ `sold_30d` กำหนดอยู่ใน SQL ด้านบน (`current_date - 30`) ถ้าจะเปลี่ยนช่วงต้องแก้ทั้งที่นี่
  และคำอธิบายใน `SALES_CONFIG` (`scripts/shared/fishSales.js`)

## 2) ปรับเกณฑ์ "ระบบกำหนด"

แก้ที่เดียวใน `scripts/shared/fishSales.js` → `SALES_CONFIG`

| ค่า | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `hotMinSold30d` | 5 | ขายได้ ≥ กี่ตัวใน 30 วัน จึงได้ป้าย **ยอดนิยม / HOT** (Case A) |
| `slowDaysAfterSale` | 30 | เคยขายได้ แต่ไม่มีใครซื้อเกินกี่วัน จึงได้ป้าย **ลดหนัก** (Case B2) |
| `slowDaysNeverSold` | 21 | ยังไม่เคยขายได้เลย และค้างสต็อกเกินกี่วัน จึงได้ป้าย **ลดหนัก** (Case C2) |
| `markupMinPct` / `markupMaxPct` | 10 / 20 | ราคาก่อนลด (ขีดฆ่า) = ราคาจริง + 10–20% |
| `showReferencePrice` | true | `false` = ปิดราคาขีดฆ่า แต่ยังโชว์ป้ายลดหนัก |

## กติกาการจัดประเภท

| Case | เงื่อนไข | ผลที่แสดง |
|---|---|---|
| A | ขายใน 30 วัน ≥ `hotMinSold30d` | ป้าย ยอดนิยม / HOT |
| B1 | เคยขายได้ ขายกลางๆ ไม่นิ่งเกินกำหนด | ไม่มีป้าย |
| B2 | เคยขายได้ แต่ไม่มีการขายเกิน `slowDaysAfterSale` วัน | ป้าย ลดหนัก + ราคาขีดฆ่า |
| C1 | ยังไม่เคยขาย แต่เพิ่งลงขาย/เพิ่งรีสต็อก | ไม่มีป้าย |
| C2 | ยังไม่เคยขาย และค้างเกิน `slowDaysNeverSold` วัน | ป้าย ลดหนัก + ราคาขีดฆ่า |

- "จำนวนวันที่นิ่ง" นับจาก **วันที่ล่าสุดของ (วันขายล่าสุด, วันรีสต็อกล่าสุด, วันที่ลงปลา)** — ดังนั้นถ้าเพิ่งรับปลาล็อตใหม่เข้ามา
  ปลาตัวนั้นจะไม่ถูกติดป้ายลดหนักทันที แม้ขายล่าสุดจะนานแล้ว
- ปลาที่หมดสต็อกจะไม่ติดป้ายลดหนัก (ไม่มีของให้ลด) แต่ยังติด HOT ได้
- ราคาก่อนลด (จำลอง) คำนวณจากรหัสปลา จึงคงที่ต่อปลาแต่ละตัว ไม่เปลี่ยนทุกครั้งที่โหลดหน้า
