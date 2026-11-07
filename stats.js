// İstatistik hesapları. Bu dosya saf fonksiyonlardan oluşur: "bugün" her zaman
// parametre olarak gelir, Firebase veya arayüz bilgisi içermez.
//
// Sayım kuralları:
// - Bir alışkanlığın sayılan günleri başlangıç tarihi (dahil) ile bugün (dahil) arasındadır.
// - Başlangıçtan önceki ve gelecekteki işaretler hiçbir hesaba girmez, ama silinmez.
// - Arşivde geçen günler yapılmamış sayılmaz. O günlerde işaret varsa yapılmış sayılır.
// - Veri yoksa oran null döner; 0'a bölme yapılmaz.

import {
  addDays, addMonths, endOfMonth, endOfWeek, formatShort, keyToNum, numToKey,
  parseKey, startOfMonth, startOfWeek, AYLAR_KISA, formatDayMonth,
} from './dates.js';

export const MIN_RANK_DAYS = 3;
const EMPTY = new Set();

export function pct(done, total) {
  return total > 0 ? (done / total) * 100 : null;
}

export function roundPct(value) {
  return value === null || value === undefined ? null : Math.round(value);
}

export function formatPct(value) {
  return value === null || value === undefined ? '—' : `%${Math.round(value)}`;
}

export function isInArchive(habit, key) {
  return (habit.archivedRanges || []).some((r) => key >= r.from && (r.to == null || key <= r.to));
}

export function isCounted(habit, key, done, today) {
  if (key < habit.startDate || key > today) return false;
  if (done.has(key)) return true;
  return !isInArchive(habit, key);
}

export function windowStats(habit, done, from, to, today) {
  const lo = Math.max(keyToNum(from), keyToNum(habit.startDate));
  const hi = Math.min(keyToNum(to), keyToNum(today));
  let total = 0;
  let count = 0;
  for (let n = lo; n <= hi; n += 1) {
    const key = numToKey(n);
    if (!isCounted(habit, key, done, today)) continue;
    total += 1;
    if (done.has(key)) count += 1;
  }
  return { done: count, total, rate: pct(count, total) };
}

export function computeStreaks(habit, done, today) {
  const start = keyToNum(habit.startDate);
  const end = keyToNum(today);
  let longest = 0;
  let run = 0;
  for (let n = start; n <= end; n += 1) {
    const key = numToKey(n);
    if (!isCounted(habit, key, done, today)) continue;
    if (done.has(key)) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }

  // Bugün henüz bitmediği için, işaretlenmemiş bugün mevcut seriyi bozmaz.
  let current = 0;
  for (let n = end; n >= start; n -= 1) {
    const key = numToKey(n);
    if (!isCounted(habit, key, done, today)) continue;
    if (done.has(key)) current += 1;
    else if (key !== today) break;
  }
  return { current, longest };
}

export function habitStats(habit, done = EMPTY, today) {
  const overall = windowStats(habit, done, habit.startDate, today, today);
  const last = (days) => windowStats(habit, done, addDays(today, -(days - 1)), today, today);
  const { current, longest } = computeStreaks(habit, done, today);
  return {
    overall,
    last7: last(7),
    last30: last(30),
    last365: last(365),
    currentStreak: current,
    longestStreak: longest,
    totalDone: overall.done,
  };
}

// Seçilen gün listesinde görünecek alışkanlıklar.
export function habitsForDay(habits, doneMap, day, today) {
  return habits.filter((h) => {
    if (day < h.startDate || day > today) return false;
    if (h.archived && day === today) return false;
    const done = doneMap.get(h.id) || EMPTY;
    return done.has(day) || !isInArchive(h, day);
  });
}

export function daySummary(habits, doneMap, day, today) {
  const list = habitsForDay(habits, doneMap, day, today);
  const done = list.filter((h) => (doneMap.get(h.id) || EMPTY).has(day)).length;
  return { list, done, total: list.length, rate: pct(done, list.length) };
}

// Birden çok alışkanlığın bir dönemdeki ortak oranı. Bugün henüz bitmediği için
// yapılmamış bugünkü işler bu hesapta aleyhe sayılmaz; yapılanlar sayılır.
export function periodRate(habits, doneMap, from, to, today) {
  let total = 0;
  let count = 0;
  for (const habit of habits) {
    const done = doneMap.get(habit.id) || EMPTY;
    const lo = Math.max(keyToNum(from), keyToNum(habit.startDate));
    const hi = Math.min(keyToNum(to), keyToNum(today));
    for (let n = lo; n <= hi; n += 1) {
      const key = numToKey(n);
      if (!isCounted(habit, key, done, today)) continue;
      if (key === today && !done.has(key)) continue;
      total += 1;
      if (done.has(key)) count += 1;
    }
  }
  return { done: count, total, rate: pct(count, total) };
}

export function compareRates(current, previous) {
  if (current.rate === null) return { state: 'no-current', current, previous, relative: null, points: null };
  if (previous.rate === null) return { state: 'no-previous', current, previous, relative: null, points: null };
  const points = current.rate - previous.rate;
  if (previous.rate === 0) return { state: 'from-zero', current, previous, relative: null, points };
  return { state: 'ok', current, previous, relative: (points / previous.rate) * 100, points };
}

export function weekComparison(habits, doneMap, today) {
  const from = startOfWeek(today);
  return compareRates(
    periodRate(habits, doneMap, from, endOfWeek(today), today),
    periodRate(habits, doneMap, addDays(from, -7), addDays(from, -1), today),
  );
}

export function monthComparison(habits, doneMap, today) {
  const from = startOfMonth(today);
  const prev = addMonths(today, -1);
  return compareRates(
    periodRate(habits, doneMap, from, endOfMonth(today), today),
    periodRate(habits, doneMap, prev, endOfMonth(prev), today),
  );
}

export function weeklySeries(habits, doneMap, today, count = 8) {
  const thisWeek = startOfWeek(today);
  const series = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const from = addDays(thisWeek, -7 * i);
    const to = addDays(from, 6);
    series.push({
      from, to, isCurrent: i === 0,
      label: formatShort(from),
      title: `${formatDayMonth(from)} – ${formatDayMonth(to)}`,
      ...periodRate(habits, doneMap, from, to, today),
    });
  }
  return series;
}

export function monthlySeries(habits, doneMap, today, count = 12) {
  const series = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const from = addMonths(today, -i);
    const to = endOfMonth(from);
    const { y, m } = parseKey(from);
    series.push({
      from, to, isCurrent: i === 0,
      label: AYLAR_KISA[m - 1],
      title: `${AYLAR_KISA[m - 1]} ${y}`,
      ...periodRate(habits, doneMap, from, to, today),
    });
  }
  return series;
}

// En istikrarlı ve en çok geliştirilmesi gereken alışkanlık: son 30 günün oranı.
// Karar verecek kadar veri olması için en az MIN_RANK_DAYS sayılan gün gerekir.
export function rankHabits(habits, doneMap, today) {
  const rows = habits
    .filter((h) => !h.archived)
    .map((habit) => {
      const done = doneMap.get(habit.id) || EMPTY;
      const stats = windowStats(habit, done, addDays(today, -29), today, today);
      return { habit, stats, streak: computeStreaks(habit, done, today).current };
    })
    .filter((row) => row.stats.total >= MIN_RANK_DAYS);

  if (rows.length === 0) return { state: 'no-data', best: null, worst: null };
  const order = (a, b) => (b.stats.rate - a.stats.rate) || (b.streak - a.streak)
    || a.habit.name.localeCompare(b.habit.name, 'tr');
  rows.sort(order);
  const best = rows[0];
  const worst = rows[rows.length - 1];
  if (rows.length === 1) return { state: 'single', best, worst: null };
  if (best.stats.rate === worst.stats.rate) return { state: 'tied', best, worst: null };
  return { state: 'ok', best, worst };
}

function comparisonSentence(cmp, thisLabel, prevDative, prevPlain) {
  if (cmp.state === 'ok') {
    const amount = Math.round(Math.abs(cmp.relative));
    if (amount === 0) return `${thisLabel} ${prevPlain} kadar istikrarlısın.`;
    return cmp.relative > 0
      ? `${thisLabel} ${prevDative} göre %${amount} daha istikrarlısın.`
      : `${thisLabel} ${prevDative} göre %${amount} daha az istikrarlısın.`;
  }
  if (cmp.state === 'from-zero') {
    const rate = Math.round(cmp.current.rate);
    if (rate === 0) return null;
    return `${thisLabel} oranın %${rate}. Bir önceki dönemde %0 idi.`;
  }
  return null;
}

// Etkin alışkanlıklar içinde en uzun süren güncel seri (en az 2 gün).
export function streakLeader(habits, doneMap, today) {
  let leader = null;
  for (const habit of habits) {
    if (habit.archived) continue;
    const streak = computeStreaks(habit, doneMap.get(habit.id) || EMPTY, today).current;
    if (streak >= 2 && (!leader || streak > leader.streak)) leader = { habit, streak };
  }
  return leader;
}

// Verilere dayanan kısa ilerleme yorumu.
export function progressComment(habits, doneMap, today) {
  const month = monthComparison(habits, doneMap, today);
  const week = weekComparison(habits, doneMap, today);
  const first = comparisonSentence(month, 'Bu ay', 'geçen aya', 'geçen ay')
    || comparisonSentence(week, 'Bu hafta', 'geçen haftaya', 'geçen hafta');

  const leader = streakLeader(habits, doneMap, today);
  const second = leader ? `En uzun süren serin ${leader.streak} gün: ${leader.habit.name}.` : null;

  if (first) return second ? `${first} ${second}` : first;
  if (month.current.rate !== null) {
    const base = `Bu ay tamamlama oranın %${Math.round(month.current.rate)}. Karşılaştırma için önceki dönemin verisi henüz yok.`;
    return second ? `${base} ${second}` : base;
  }
  if (second) return second;
  return null;
}
