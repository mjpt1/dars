import axios from 'axios';

// آدرس سرور مرکزی روی شبکه محلی. کاربر باید این مقدار را در فایل تنظیمات
// یا از طریق localStorage به IP سیستم سرور تغییر بدهد.
const DEFAULT_BASE_URL = localStorage.getItem('anbar_api_base') || 'http://localhost:4500/api';

export const api = axios.create({ baseURL: DEFAULT_BASE_URL });

export function setApiBaseUrl(url) {
  localStorage.setItem('anbar_api_base', url);
  api.defaults.baseURL = url;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('anbar_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('anbar_token');
      localStorage.removeItem('anbar_user');
      window.location.hash = '#/login';
    }
    return Promise.reject(err);
  }
);
