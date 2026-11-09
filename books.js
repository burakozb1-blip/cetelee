// Kitap takibi: hangi kitabın kaçıncı sayfasındasın. Saf hesaplardır.
//
// Her kitap tek belgedir: users/{uid}/books/{kitapId}
//   { title, author, totalPages, startPage, status, startDate, finishedAt, pages: { "YYYY-AA-GG": sayfa } }
// Aynı gün birden çok kez sayfa yazılırsa o günün son değeri kalır. Kitap eklenirkenki
// sayfa startPage olarak ayrıca saklanır; böylece ilk gün yapılan ilerleme kaybolmaz.

import { addDays, diffDays, isValidKey } from './dates.js';

export const MAX_PAGES = 100000;

// Kullanıcının yazdığı sayfa numarasını okur. Boş metin null döner.
export function parsePageNumber(text) {
  const clean = String(text ?? '').trim();
  if (clean === '') return { ok: true, value: null };
  if (!/^\d{1,6}$/.test(clean)) return { ok: false };
  const value = Number(clean);
  return value <= MAX_PAGES ? { ok: true, value } : { ok: false };
}

export function cleanPages(raw) {
  const pages = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return pages;
  for (const [key, value] of Object.entries(raw)) {
    if (isValidKey(key) && Number.isInteger(value) && value >= 0 && value <= MAX_PAGES) pages[key] = value;
  }
  return pages;
}

export function normalizeBook(id, data = {}) {
  const total = data.totalPages;
  return {
    id,
    title: typeof data.title === 'string' && data.title.trim() ? data.title : 'Adsız kitap',
    author: typeof data.author === 'string' ? data.author : '',
    totalPages: Number.isInteger(total) && total > 0 && total <= MAX_PAGES ? total : null,
    startPage: Number.isInteger(data.startPage) && data.startPage >= 0 && data.startPage <= MAX_PAGES ? data.startPage : null,
    status: data.status === 'done' ? 'done' : 'reading',
    startDate: isValidKey(data.startDate) ? data.startDate : '',
    finishedAt: isValidKey(data.finishedAt) ? data.finishedAt : null,
    pages: cleanPages(data.pages),
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
  };
}

// Bugüne kadarki en son kayıt. Kayıt yoksa sayfa 0.
export function latestPage(book, today) {
  let key = null;
  for (const k of Object.keys(book.pages)) {
    if (k <= today && (key === null || k > key)) key = k;
  }
  return key ? { page: book.pages[key], key } : { page: 0, key: null };
}

// Son 7 günde ilerlenen sayfa: bugünkü sayfa ile 7 gün önceki kayıt arasındaki fark.
// Kitap son 7 günde eklendiyse başlangıç sayfası esas alınır. Hesaplanacak bilgi yoksa null.
export function pagesLastWeek(book, today) {
  const keys = Object.keys(book.pages).filter((k) => k <= today).sort();
  if (keys.length === 0) return null;
  const latest = book.pages[keys[keys.length - 1]];
  const limit = addDays(today, -7);
  const before = keys.filter((k) => k <= limit);
  let base;
  if (before.length > 0) base = book.pages[before[before.length - 1]];
  else if (book.startPage !== null) base = book.startPage;
  else if (keys.length > 1) base = book.pages[keys[0]];
  else return null;
  if (before.length === 0 && keys.length === 1 && latest === base) return null;
  return Math.max(0, latest - base);
}

export function bookProgress(book, today) {
  const { page, key } = latestPage(book, today);
  const percent = book.totalPages ? Math.min(100, (page / book.totalPages) * 100) : null;
  const days = book.status === 'done' && book.finishedAt && book.startDate && book.finishedAt >= book.startDate
    ? diffDays(book.finishedAt, book.startDate) + 1
    : null;
  return { page, lastKey: key, percent, days, lastWeek: pagesLastWeek(book, today) };
}

export function sortBooks(books) {
  const reading = books.filter((b) => b.status === 'reading')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.title.localeCompare(b.title, 'tr'));
  const finished = books.filter((b) => b.status === 'done')
    .sort((a, b) => (b.finishedAt || '').localeCompare(a.finishedAt || '') || a.title.localeCompare(b.title, 'tr'));
  return { reading, finished };
}
