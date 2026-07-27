// api/_shared/fishSearch.js
// ค้นหาปลาแบบ fuzzy จากข้อความที่ลูกค้าพิมพ์ในแชท — ไม่ต้องพิมพ์ชื่อตรงเป๊ะ
// (เช่น พิมพ์ "ปลาทอง" "ปลาทอว" "ทอง" ก็ยังเจอ "ปลาทองคอเมท")
// ไม่ใช้ library ภายนอก เพื่อไม่ต้องเพิ่ม dependency ให้ Vercel serverless function

// ── Levenshtein distance (จำนวนตัวอักษรที่ต้องแก้ไขน้อยที่สุดให้ 2 คำเหมือนกัน) ──
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,      // insert
        prev[j] + 1,          // delete
        prev[j - 1] + cost    // substitute
      );
    }
    prev.splice(0, prev.length, ...curr);
  }
  return prev[b.length];
}

// ── normalize: ตัดช่องว่างซ้ำ/หัวท้าย + แปลงเป็นตัวพิมพ์เล็ก (เผื่อมีชื่ออังกฤษปน) ──
function normalize(str) {
  return String(str || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// ── ให้คะแนนความเหมือนของ query กับ 1 ปลา (0 = ไม่เหมือนเลย, 1 = ตรงเป๊ะ) ──
// เช็คทั้งชื่อไทย/อังกฤษ/ชนิดพันธุ์ (species) เอาคะแนนที่ดีที่สุด
function scoreFishMatch(query, fish) {
  const q = normalize(query);
  if (!q) return 0;

  const fields = [fish.name_th, fish.name_en, fish.species].filter(Boolean).map(normalize);
  if (!fields.length) return 0;

  let best = 0;
  for (const field of fields) {
    // ตรงเป๊ะ หรือเป็น substring ของกันและกัน -> คะแนนเต็ม/เกือบเต็ม
    if (field === q) return 1;
    if (field.includes(q) || q.includes(field)) {
      best = Math.max(best, 0.9);
      continue;
    }
    // fuzzy ด้วย Levenshtein distance เทียบกับความยาวคำที่ยาวกว่า
    const dist = levenshtein(q, field);
    const maxLen = Math.max(q.length, field.length);
    const similarity = maxLen === 0 ? 0 : 1 - dist / maxLen;
    best = Math.max(best, similarity);
  }
  return best;
}

// ── ค้นหาปลาที่เหมือน query มากที่สุด คืนเป็น array เรียงคะแนนมากไปน้อย ──
// threshold ค่าเริ่มต้น 0.45 กันคำที่ไม่เกี่ยวข้องเลยหลุดเข้ามา (เช่น "สวัสดี" ไม่ควร match "ปลาทอง")
function searchFish(query, fishList, { limit = 5, threshold = 0.45 } = {}) {
  if (!query || !Array.isArray(fishList)) return [];

  return fishList
    .map((fish) => ({ fish, score: scoreFishMatch(query, fish) }))
    .filter((r) => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.fish);
}

module.exports = { levenshtein, normalize, scoreFishMatch, searchFish };
