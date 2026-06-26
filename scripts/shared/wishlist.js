const STORAGE_KEY = 'aqua-wishlist';

export function getWishlist() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

export function toggleWishlist(id) {
  let list = getWishlist();
  const index = list.indexOf(id);
  let isLiked = false;

  if (index > -1) {
    list.splice(index, 1); // ลบออกถ้ามีอยู่แล้ว
  } else {
    list.push(id); // เพิ่มเข้าไปใหม่
    isLiked = true;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return isLiked;
}

export function isWishlisted(id) {
  return getWishlist().includes(id);
}