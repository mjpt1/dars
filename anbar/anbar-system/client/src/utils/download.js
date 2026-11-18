import { api } from '../api/client';

// دانلود فایل (اکسل/بکاپ و ...) از سرور با در نظر گرفتن هدر احراز هویت
export async function downloadFile(url, filename) {
  const res = await api.get(url, { responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}
