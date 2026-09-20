const panel = document.getElementById('loading-panel');
const bar = document.getElementById('loading-bar');
const label = document.getElementById('loading-label');
const detail = document.getElementById('loading-detail');
const fill = document.getElementById('loading-fill');
export function showLoading(stage, message, percent = null) {
  panel.hidden = false;
  document.getElementById('viewport').setAttribute('aria-busy', 'true');
  label.textContent = stage;
  detail.textContent = message;
  bar.setAttribute('aria-valuetext', stage);
  bar.classList.toggle('indeterminate', percent === null);
  if (percent === null) {
    bar.removeAttribute('aria-valuenow');
    fill.style.width = '35%';
  } else {
    const value = Math.max(0, Math.min(100, Math.round(percent)));
    bar.setAttribute('aria-valuenow', String(value));
    fill.style.width = value + '%';
  }
}
export function hideLoading() {
  panel.hidden = true;
  document.getElementById('viewport').setAttribute('aria-busy', 'false');
}
// Yield through a painted frame before CPU-intensive PDF parsing starts.
export const paintLoading = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
export function readPDFFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = e => {
      if (e.lengthComputable) {
        const percent = e.loaded / e.total * 100;
        showLoading('1 / 3 · 讀取檔案', `${Math.round(percent)}% · ${file.name}`, percent);
      }
    };
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(reader.error || new Error('讀取失敗'));
    reader.onabort = () => reject(new Error('讀取已取消'));
    reader.readAsArrayBuffer(file);
  });
}
