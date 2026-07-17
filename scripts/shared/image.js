export function compressImage(file, callback) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
        else        { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

export function previewNewImage(input) {
  if (input.files[0]) {
    const p = document.getElementById('newImagePreview');
    p.src = URL.createObjectURL(input.files[0]);
    p.style.display = 'block';
  }
}

export function previewEditImage(input) {
  if (input.files[0]) {
    const p = document.getElementById('editImagePreview');
    p.src = URL.createObjectURL(input.files[0]);
    p.style.display = 'block';
  }
}