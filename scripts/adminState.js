// ไฟล์ scripts/adminState.js
export const state = {
  fishData: [],
  financeData: [],
  profitMap: {},
  stockFilter: 'all',
  finFilter: 'all',
  selectedFinMonth: new Date().toLocaleDateString('en-CA').slice(0, 7)
};