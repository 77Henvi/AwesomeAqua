import { supabase } from '../supabase.js';
import * as UI from './adminUI.js';
import * as Actions from './adminActions.js';
import { toggleTag } from './shared/tags.js'; 
import { previewNewImage, previewEditImage } from './shared/image.js';
import { calcPricePreview } from './modules/profit.js';

// ── Expose everything to window for HTML inline onclick ──
Object.assign(window, UI);
Object.assign(window, Actions);
window.toggleTag        = toggleTag;
window.toggleSyncTag    = toggleSyncTag;
window.previewNewImage  = previewNewImage;
window.previewEditImage = previewEditImage;
window.calcPricePreview = calcPricePreview;

window.hideLoader = function() {
  const loader = document.getElementById('global-loader');
  if (loader) loader.classList.add('hidden');
};
setTimeout(() => hideLoader(), 3000);

window.showDashboard = function() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminDashboard').style.display = 'block';
  UI.setDateHeaders();
  Actions.loadFishFromDB();
  Actions.loadFinanceFromDB();
};

window.adminLogin = () => Actions.adminLogin(window.showDashboard);

// Auto Finance Events (Trigger on DOM Ready)
document.addEventListener('DOMContentLoaded', () => {
  const newCostInput = document.getElementById('newCost');
  const newStockInput = document.getElementById('newStock');
  const submitBtn = document.getElementById('submitAddFishBtn');
  
  if (newCostInput) newCostInput.addEventListener('input', UI.updateAddFishTotal);
  if (newStockInput) newStockInput.addEventListener('input', UI.updateAddFishTotal);
  if (submitBtn) submitBtn.addEventListener('click', Actions.addFish);
});

// Init Session
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    window.showDashboard();
  } else {
    hideLoader();
    document.getElementById('loginScreen').style.display = 'flex';
  }
})();