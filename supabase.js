import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/+esm';

// ── Production Supabase project (ค่าเดิม) ──
const PROD_URL = 'https://vfihczafjrkcyncnosgj.supabase.co';
const PROD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmaWhjemFmanJrY3luY25vc2dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjEzODIsImV4cCI6MjA5MTMzNzM4Mn0.x2XF1GzfAUu_o-l6acRQtl6k6DTY-GsG_JHnEOm-eLA';

// ── Staging Supabase project แยกต่างหาก (project ใหม่ ไม่ใช่ production) ──
// TODO: สร้างโปรเจกต์ Supabase ใหม่สำหรับ staging แล้วแทนค่า URL/anon key ตรงนี้
// ตราบใดที่ยังเป็นค่าว่าง โค้ดจะ fallback ไปใช้ PROD ให้อัตโนมัติ (กันพลาดจนดันไป prod DB)
const STAGING_URL = '';
const STAGING_KEY = '';

// Vercel preview deployment ของ branch develop จะได้โดเมนรูปแบบ
// awesome-aqua-git-develop-<team>.vercel.app หรือ awesome-aqua-<hash>.vercel.app
// production คือ awesome-aqua.vercel.app (โดเมนตรงเป๊ะเท่านั้น) — ที่เหลือถือเป็น preview/staging ทั้งหมด
const PROD_HOSTNAME = 'awesome-aqua.vercel.app';

function isPreviewDeployment() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  // localhost/127.0.0.1 ถือเป็น dev เครื่องตัวเอง ให้ใช้ staging ด้วยถ้ามีค่าตั้งไว้
  return host !== PROD_HOSTNAME;
}

const useStaging = isPreviewDeployment() && STAGING_URL && STAGING_KEY;

const SUPABASE_URL = useStaging ? STAGING_URL : PROD_URL;
const SUPABASE_KEY = useStaging ? STAGING_KEY : PROD_KEY;

if (useStaging && typeof console !== 'undefined') {
  console.info('[AwesomeAqua] ใช้ Supabase staging project (preview deployment) — ไม่ใช่ production DB');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);