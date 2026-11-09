// Uzmanlık takibi: bir işte 10.000 saat, dil öğreniminde 5.000 kelime.
// Ayrı bir kayıt tutulmaz; Bugün ekranında yapılan işaretlerden hesaplanır.
// İşaretli günde kutuya sayı yazıldıysa o sayı, yazılmadıysa alışkanlıktaki günlük sayı eklenir.

import { addDays, diffDays, startOfMonth } from './dates.js';
import { isCounted } from './stats.js';

const EMPTY = new Set();

export const MASTERY = {
  hours: {
    target: 10000, unit: 'dakika', goalUnit: 'saat', name: '10.000 saat', factor: 60,
    ask: 'Bir günde genelde kaç dakika?', defaultDaily: 60,
  },
  words: {
    target: 5000, unit: 'kelime', goalUnit: 'kelime', name: '5.000 kelime', factor: 1,
    ask: 'Bir günde genelde kaç kelime?', defaultDaily: 10,
  },
};

export const isMasteryType = (type) => Object.prototype.hasOwnProperty.call(MASTERY, type);

function amountOn(habit, key, values) {
  const value = values ? values[key] : undefined;
  return typeof value === 'number' ? value : (habit.dailyDefault || 0);
}

export function masteryStatus(habit, done = EMPTY, values = {}, today) {
  const kind = MASTERY[habit.mastery];
  if (!kind) return null;
  const windowStart = addDays(today, -29);
  const monthStart = startOfMonth(today);
  let total = 0;
  let days = 0;
  let last30 = 0;
  let month = 0;
  for (const key of done) {
    if (!isCounted(habit, key, done, today)) continue;
    const amount = amountOn(habit, key, values);
    total += amount;
    days += 1;
    if (key >= windowStart) last30 += amount;
    if (key >= monthStart) month += amount;
  }
  // Hız: son 30 takvim günündeki toplamın güne bölümü. Yapılmayan günler de paydaya girer.
  const from = habit.startDate > windowStart ? habit.startDate : windowStart;
  const windowDays = today >= from ? diffDays(today, from) + 1 : 0;
  const perDay = windowDays > 0 ? last30 / windowDays / kind.factor : 0;
  const current = total / kind.factor;
  const remaining = Math.max(0, kind.target - current);
  let daysLeft = null;
  if (remaining === 0) daysLeft = 0;
  else if (perDay > 0) daysLeft = Math.ceil(remaining / perDay);
  return {
    kind,
    current,
    target: kind.target,
    percent: Math.min(100, (current / kind.target) * 100),
    days,
    month: month / kind.factor,
    perDay,
    daysLeft,
  };
}

const numberFormat = (digits) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: digits });

export function formatAmount(value) {
  if (value >= 100) return numberFormat(0).format(Math.round(value));
  return numberFormat(1).format(Math.round(value * 10) / 10);
}

// Birimiyle yazar. Saat hedefinde 1 saatin altı dakika olarak gösterilir.
export function formatWithUnit(value, kind) {
  if (kind.factor === 60 && value > 0 && value < 1) return `${Math.max(1, Math.round(value * 60))} dakika`;
  return `${formatAmount(value)} ${kind.goalUnit}`;
}

export function formatPercent(value) {
  if (value > 0 && value < 1) return `%${numberFormat(2).format(Math.round(value * 100) / 100)}`;
  if (value < 10) return `%${numberFormat(1).format(Math.round(value * 10) / 10)}`;
  return `%${Math.floor(value)}`;
}

// Gün sayısını yıl, ay veya gün olarak yazar.
export function formatSpan(days) {
  if (days < 31) return `${days} gün`;
  if (days < 365) return `${Math.max(1, Math.round(days / 30.44))} ay`;
  let years = Math.floor(days / 365.25);
  let months = Math.round((days - years * 365.25) / 30.44);
  if (months === 12) {
    years += 1;
    months = 0;
  }
  return months > 0 ? `${years} yıl ${months} ay` : `${years} yıl`;
}
