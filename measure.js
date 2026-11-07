// Gerçek gelişim: günlük ölçü (sayfa, dakika...) hesapları. Saf hesaplardır.
//
// - Sayı yalnızca yapılmış günlerde ve başlangıç ile bugün arasında hesaba girer.
// - İşaret kaldırılırsa sayı silinmez, yalnızca hesaba girmez.
// - Ortalama, sayı girilen günlerden hesaplanır; girilmeyen gün 0 sayılmaz.

import { AYLAR, addMonths, parseKey } from './dates.js';

export const MIN_ENTRIES = 3;
export const MAX_VALUE = 1000000;
const EMPTY = new Set();

export const monthKey = (key) => key.slice(0, 7);
export const isValidMonth = (m) => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) && Number(m.slice(0, 4)) >= 1970;
export const isValidScore = (n) => Number.isInteger(n) && n >= 1 && n <= 10;

export function monthName(month) {
  const { y, m } = parseKey(`${month}-01`);
  return `${AYLAR[m - 1]} ${y}`;
}

export function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  return String(Math.round(value * 10) / 10).replace('.', ',');
}

// Kullanıcının yazdığı sayıyı okur. Boş metin sayıyı temizlemek demektir.
export function parseMeasure(text) {
  const clean = String(text).trim().replace(',', '.');
  if (clean === '') return { ok: true, value: null };
  if (!/^\d+(\.\d+)?$/.test(clean)) return { ok: false };
  const value = Number(clean);
  if (!Number.isFinite(value) || value > MAX_VALUE) return { ok: false };
  return { ok: true, value };
}

export function monthAverage(habit, done = EMPTY, values = {}, month, today) {
  let sum = 0;
  let count = 0;
  for (const [key, value] of Object.entries(values)) {
    if (monthKey(key) !== month || key < habit.startDate || key > today || !done.has(key)) continue;
    sum += value;
    count += 1;
  }
  return { count, average: count > 0 ? sum / count : null };
}

export function measureMonths(habit, done, values, today, count = 6) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const from = addMonths(today, -i);
    const month = monthKey(from);
    const row = monthAverage(habit, done, values, month, today);
    if (row.count > 0) rows.push({ month, title: i === 0 ? 'Bu ay' : monthName(month), ...row });
  }
  return rows;
}

// Yeterli girişi olan son iki ayı karşılaştırır. Az veriyle yüzde üretmez.
export function measureComparison(habit, done, values, today) {
  const months = new Set(Object.keys(values || {}).map(monthKey));
  const usable = [...months].sort()
    .map((month) => ({ month, ...monthAverage(habit, done, values, month, today) }))
    .filter((row) => row.count >= MIN_ENTRIES);
  if (usable.length < 2) return { state: 'not-enough', latest: usable[usable.length - 1] || null };
  const previous = usable[usable.length - 2];
  const latest = usable[usable.length - 1];
  const diff = latest.average - previous.average;
  if (previous.average === 0) return { state: 'from-zero', previous, latest, diff, relative: null };
  return { state: 'ok', previous, latest, diff, relative: (diff / previous.average) * 100 };
}
