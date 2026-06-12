export function calcPricePreview() {
  const min  = parseFloat(document.getElementById('newPriceMin').value) || 0;
  const max  = parseFloat(document.getElementById('newPriceMax').value) || 0;
  const cost = parseFloat(document.getElementById('newCost')?.value) || 0;
  const el   = document.getElementById('pricePreview');
  if (!el) return;
  if (!min) { el.textContent = '—'; el.className = 'price-preview'; return; }

  // คำนวณกำไร
  const profitTxt = (() => {
    if (!cost) return '';
    const pMin = min - cost;
    const pMax = (max || min) - cost;
    const marginMin = ((pMin / min) * 100).toFixed(0);
    const marginMax = max ? (((pMax) / max) * 100).toFixed(0) : marginMin;
    if (max && max !== min) {
      return ` | กำไร ฿${pMin.toLocaleString('th-TH')}–฿${pMax.toLocaleString('th-TH')} (${marginMin}–${marginMax}%)`;
    }
    return ` | กำไร ฿${pMin.toLocaleString('th-TH')} (${marginMin}%)`;
  })();

  if (max && max < min) {
    el.textContent = '⚠️ ราคาสูงสุดน้อยกว่าต่ำสุด';
    el.className = 'price-preview bad'; return;
  }
  if (max > min) {
    const spread = ((max - min) / min * 100).toFixed(0);
    el.innerHTML = `฿${min.toLocaleString('th-TH')} – ฿${max.toLocaleString('th-TH')} <span style="font-size:0.78rem;font-weight:400;">(+${spread}%)</span>${profitTxt}`;
    el.className = 'price-preview good';
  } else {
    el.innerHTML = `฿${min.toLocaleString('th-TH')} (ราคาเดียว)${profitTxt}`;
    el.className = 'price-preview warn';
  }

  // ถ้าต้นทุน >= ราคาขาย ให้เตือนสีแดง
  if (cost && cost >= min) {
    el.className = 'price-preview bad';
  }
}

/**
 * สร้าง HTML สำหรับคอลัมน์ "ต้นทุน / กำไร" ในตารางปลา (admin)
 * @param {object} f - รายการปลา ที่มี priceMin และ cost
 * @returns {string} HTML string สำหรับใส่ใน <td>
 */
export function profitCell(f) {
  if (!f.cost) return '—';

  const profit = (f.priceMin || 0) - f.cost;
  const color  = profit >= 0 ? '#059669' : '#dc2626';

  return `
    <span style="color:var(--gray);font-size:0.78rem;">ต้นทุน ฿${f.cost.toLocaleString('th-TH')}</span><br>
    <span style="color:${color};">กำไร ฿${profit.toLocaleString('th-TH')}</span>
  `;
}