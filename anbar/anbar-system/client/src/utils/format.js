export function money(n) {
  if (n === null || n === undefined) return '۰';
  return Number(n).toLocaleString('fa-IR');
}

export function dateFa(str) {
  if (!str) return '-';
  try {
    return new Date(str.replace(' ', 'T')).toLocaleDateString('fa-IR');
  } catch {
    return str;
  }
}

export const DOC_TYPE_LABELS = {
  receipt_purchase: 'رسید خرید',
  receipt_return: 'رسید مرجوعی از مشتری',
  receipt_transfer: 'رسید انتقال',
  issue_sale: 'حواله فروش',
  issue_project: 'حواله مصرف پروژه',
  issue_return: 'حواله مرجوعی به تامین‌کننده',
  issue_transfer: 'حواله انتقال',
  adjustment: 'اصلاح موجودی',
};

export const TASK_STATUS_LABELS = {
  todo: 'در انتظار',
  in_progress: 'در حال انجام',
  review: 'بازبینی',
  done: 'انجام‌شده',
  blocked: 'مسدود',
};

export const PROJECT_STATUS_LABELS = {
  planned: 'برنامه‌ریزی‌شده',
  active: 'فعال',
  on_hold: 'متوقف',
  completed: 'تکمیل‌شده',
  cancelled: 'لغوشده',
};
