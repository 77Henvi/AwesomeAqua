// scripts/modules/fishArchive.js
// จัดการสถานะ "เลิกขาย" ของปลา — แยกออกจาก admin.js (ก้าวแรกของการแตกไฟล์ใหญ่เป็นโมดูลย่อย)
import { supabase } from '../../supabase.js';
import { showToast } from '../shared/utils.js';

const ICON_OK   = '<i class="ph-fill ph-check-circle" style="color:#10b981; font-size:1.1em; vertical-align:-2px;"></i>';
const ICON_ERR  = '<i class="ph-fill ph-x-circle" style="color:#ef4444; font-size:1.1em; vertical-align:-2px;"></i>';
const ICON_ARCH = '<i class="ph-fill ph-archive" style="color:#6b7280; font-size:1.1em; vertical-align:-2px;"></i>';
const ICON_TRASH = '<i class="ph-fill ph-trash" style="color:#6b7280; font-size:1.1em; vertical-align:-2px;"></i>';

/**
 * "เลิกขาย" — ซ่อนปลาจากหน้าร้าน/ตารางหลัก แต่ไม่ลบข้อมูล
 * รายรับ/รายจ่ายเดิมที่ผูกกับปลาตัวนี้จะไม่หายไป และสามารถกลับมาเปิดขายใหม่ได้ทีหลัง
 * @param {string} id fish id
 * @param {Function} onDone callback หลังทำสำเร็จ (ปกติคือ loadFishFromDB)
 */
export async function archiveFish(id, onDone) {
  if (!confirm('เลิกขายปลาตัวนี้เลยไหม?\n\nปลาจะหายจากหน้าร้านและตาราง "ขายอยู่" แต่ประวัติรายรับ/รายจ่ายเดิมจะไม่หายไป และกลับมาเปิดขายใหม่ได้ทีหลังจากแท็บ "เลิกขายแล้ว"')) return;

  const { error } = await supabase.from('fish').update({ is_archived: true }).eq('id', id);

  if (error) {
    showToast(`${ICON_ERR} เลิกขายไม่สำเร็จ`);
    return;
  }

  showToast(`${ICON_ARCH} เลิกขายเรียบร้อย`);
  onDone?.();
}

/** "เปิดขายอีกครั้ง" — เอาปลากลับมาแสดงในหน้าร้าน/ตารางหลักตามปกติ */
export async function restoreFish(id, onDone) {
  const { error } = await supabase.from('fish').update({ is_archived: false }).eq('id', id);

  if (error) {
    showToast(`${ICON_ERR} เปิดขายไม่สำเร็จ`);
    return;
  }

  showToast(`${ICON_OK} เปิดขายอีกครั้งเรียบร้อย`);
  onDone?.();
}

/**
 * "ลบถาวร" — ใช้เฉพาะกรณีกรอกผิด/ไม่เคยขายจริง เพราะจะลบข้อมูลทิ้งกู้คืนไม่ได้
 * (รายรับ/รายจ่ายเดิมที่ผูกกับปลานี้จะกลายเป็น fish_id = null แทนที่จะถูกลบไปด้วย
 *  ถ้าตั้ง FK constraint เป็น ON DELETE SET NULL ตามคำแนะนำใน supabase/archive-migration.sql)
 * @param {Function} onDone callback หลังทำสำเร็จ (ปกติคือเรียกทั้ง loadFishFromDB + loadFinanceFromDB)
 */
export async function hardDeleteFish(id, onDone) {
  if (!confirm('⚠️ ลบถาวร ไม่สามารถกู้คืนได้!\n\nยืนยันว่าจะลบปลานี้ทิ้งจริงๆ ใช่ไหม? (แนะนำให้ใช้ "เลิกขาย" แทน ถ้าเคยมีการขายปลาตัวนี้ไปแล้ว)')) return;

  const { error } = await supabase.from('fish').delete().eq('id', id);

  if (error) {
    showToast(`${ICON_ERR} ลบไม่ได้`);
    return;
  }

  showToast(`${ICON_TRASH} ลบปลาถาวรเรียบร้อย`);
  onDone?.();
}