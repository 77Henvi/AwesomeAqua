export function toggleTag(el) {
  el.classList.toggle('selected');
}

export function getSelectedTags(containerId) {
  return [...document.querySelectorAll(`#${containerId} .tag-option.selected`)]
    .map(el => el.textContent.trim());
}

export function setSelectedTags(containerId, tags) {
  document.querySelectorAll(`#${containerId} .tag-option`).forEach(el => {
    el.classList.toggle('selected', (tags || []).includes(el.textContent.trim()));
  });
}
