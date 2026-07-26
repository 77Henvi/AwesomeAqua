// scripts/shared/signedRequest.js
// ถอดรหัส + ตรวจสอบ "signed_request" ตามสเปกของ Meta (ใช้ใน Data Deletion Callback
// และ deauthorize callback) — แยกเป็น pure function เพื่อให้เทสได้โดยไม่ต้องมี APP_SECRET จริง

const { createHmac } = require('crypto');

// base64url decode (Facebook ใช้ base64url ไม่ใช่ base64 มาตรฐาน ต้องแปลงอักขระ + เติม padding ก่อน)
function base64UrlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

// ตรวจ + ถอดรหัส signed_request → คืน payload object ถ้า signature ถูกต้อง, null ถ้าไม่ผ่าน
function parseSignedRequest(signedRequest, appSecret) {
  if (!signedRequest || !appSecret) return null;

  const parts = String(signedRequest).split('.');
  if (parts.length !== 2) return null;
  const [encodedSig, encodedPayload] = parts;
  if (!encodedSig || !encodedPayload) return null;

  const expectedSig = createHmac('sha256', appSecret).update(encodedPayload).digest();

  let actualSig;
  try {
    actualSig = base64UrlDecode(encodedSig);
  } catch {
    return null;
  }
  if (actualSig.length !== expectedSig.length || !expectedSig.equals(actualSig)) return null;

  try {
    return JSON.parse(base64UrlDecode(encodedPayload).toString('utf8'));
  } catch {
    return null;
  }
}

module.exports = { base64UrlDecode, parseSignedRequest };
