// api/_shared/rateLimiter.js
// ตัวช่วยจำกัดความถี่ (rate limit) แบบ sliding window ง่ายๆ ใช้กันสแปม/ยิง webhook รัวๆ
// เก็บ state ใน memory ของ instance (Vercel serverless function) — ไม่ต้องพึ่ง DB/Redis
// เพียงพอสำหรับสเกลของร้านขนาดนี้ (กันพฤติกรรมผิดปกติ ไม่ใช่ระบบ rate limit ระดับ enterprise)
//
// ข้อจำกัดที่ควรรู้: Vercel serverless อาจสร้าง instance ใหม่บ่อยๆ (cold start) ทำให้ state
// รีเซ็ตได้เป็นระยะ — ยอมรับได้สำหรับ use case นี้ (กันสแปมทั่วไป ไม่ใช่ป้องกัน DDoS จริงจัง)

// เก็บ timestamp ของ request ล่าสุดแต่ละ key (เช่น PSID) ไว้ใน Map เดียวที่อยู่ในหน่วยความจำ
const hits = new Map();

// ── เช็คว่า key นี้เกิน limit ในช่วงเวลา windowMs หรือยัง ──
// คืนค่า { allowed: boolean, remaining: number, retryAfterMs: number }
function checkRateLimit(key, { limit = 20, windowMs = 60_000 } = {}, store = hits, now = Date.now()) {
  if (!key) return { allowed: true, remaining: limit, retryAfterMs: 0 };

  const timestamps = (store.get(key) || []).filter((t) => now - t < windowMs);

  if (timestamps.length >= limit) {
    const oldest = timestamps[0];
    const retryAfterMs = windowMs - (now - oldest);
    store.set(key, timestamps); // เก็บ list ที่กรองแล้วกลับไป (ตัดของเก่าทิ้ง)
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(retryAfterMs, 0) };
  }

  timestamps.push(now);
  store.set(key, timestamps);
  return { allowed: true, remaining: limit - timestamps.length, retryAfterMs: 0 };
}

// ── ล้าง entry เก่าที่ไม่ active แล้วออกจาก store กัน memory leak สะสมยาวๆ ──
function pruneRateLimitStore(windowMs = 60_000, store = hits, now = Date.now()) {
  for (const [key, timestamps] of store.entries()) {
    const fresh = timestamps.filter((t) => now - t < windowMs);
    if (fresh.length === 0) store.delete(key);
    else store.set(key, fresh);
  }
}

module.exports = { checkRateLimit, pruneRateLimitStore, hits };
