// Kelime arşivi. Firebase bilgisi içermez.
//
// Bir alışkanlığın bir aylık kelimeleri tek belgededir:
//   users/{uid}/words/{habitId}_{YYYY-AA}  { habitId, month, items: { kelimeId: { word, meaning, example, date, learned, createdAt } } }
// Böylece binlerce kelime birkaç düzine belgede durur; sayfa açılışında az okuma yapılır.

import { addDays, isValidKey } from './dates.js';

export const MAX_WORD = 80;
export const MAX_MEANING = 160;
export const MAX_EXAMPLE = 240;

const ID_RE = /^[A-Za-z0-9]{1,32}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const wordDocId = (habitId, date) => `${habitId}_${date.slice(0, 7)}`;

export function newWordId(now = Date.now(), random = Math.random) {
  return `${now.toString(36)}${Math.floor(random() * 36 ** 4).toString(36).padStart(4, '0')}`;
}

// Fazla boşlukları temizler ve uzunluğu sınırlar.
export function cleanText(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

// Arama ve tekrar kontrolü için: büyük-küçük harf ve Türkçe karakter farkını yok sayar.
export function fold(value) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');
}

export function isValidWordId(id) {
  return typeof id === 'string' && ID_RE.test(id);
}

export function isValidMonthKey(month) {
  return typeof month === 'string' && MONTH_RE.test(month);
}

// Bir belgeyi kelime listesine çevirir. Bozuk kayıtlar atlanır.
export function wordsFromDoc(docId, data) {
  if (!data || typeof data.habitId !== 'string') return [];
  const items = data.items && typeof data.items === 'object' ? data.items : {};
  const out = [];
  for (const [id, raw] of Object.entries(items)) {
    if (!raw || typeof raw !== 'object' || typeof raw.word !== 'string' || !raw.word.trim()) continue;
    out.push({
      id,
      docId,
      habitId: data.habitId,
      word: raw.word,
      meaning: typeof raw.meaning === 'string' ? raw.meaning : '',
      example: typeof raw.example === 'string' ? raw.example : '',
      date: isValidKey(raw.date) ? raw.date : (isValidMonthKey(data.month) ? `${data.month}-01` : '2000-01-01'),
      learned: raw.learned === true,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
    });
  }
  return out;
}

// Yeniden eskiye.
export function sortWords(list) {
  return [...list].sort((a, b) => (b.date.localeCompare(a.date)) || b.createdAt.localeCompare(a.createdAt) || a.word.localeCompare(b.word, 'tr'));
}

export function findDuplicate(list, word, exceptId = null) {
  const key = fold(cleanText(word, MAX_WORD));
  return list.find((item) => item.id !== exceptId && fold(item.word) === key) || null;
}

export function filterWords(list, { query = '', status = 'all' } = {}) {
  const q = fold(query.trim());
  return list.filter((item) => {
    if (status === 'learning' && item.learned) return false;
    if (status === 'learned' && !item.learned) return false;
    if (!q) return true;
    return fold(item.word).includes(q) || fold(item.meaning).includes(q) || fold(item.example).includes(q);
  });
}

// Günlere göre gruplar. Liste önceden sıralı olmalı.
export function groupByDay(list) {
  const groups = [];
  for (const item of list) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.date) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }
  return groups;
}

export function wordCounts(list, today) {
  const weekStart = addDays(today, -6);
  let learned = 0;
  let todayCount = 0;
  let week = 0;
  for (const item of list) {
    if (item.learned) learned += 1;
    if (item.date === today) todayCount += 1;
    if (item.date >= weekStart && item.date <= today) week += 1;
  }
  return { total: list.length, learned, learning: list.length - learned, today: todayCount, week };
}

// Çalışma seçenekleri: hangi kelimeler sorulacak.
export const STUDY_SETS = [
  { id: 'learning', label: 'Öğreniyorum' },
  { id: 'today', label: 'Bugün eklediklerim' },
  { id: 'week', label: 'Son 7 gün' },
  { id: 'all', label: 'Hepsi' },
];

export function studyPool(list, set, today) {
  if (set === 'learning') return list.filter((item) => !item.learned);
  if (set === 'today') return list.filter((item) => item.date === today);
  if (set === 'week') {
    const weekStart = addDays(today, -6);
    return list.filter((item) => item.date >= weekStart && item.date <= today);
  }
  return [...list];
}

export function shuffle(items, random = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Kelimeleri belgelerine göre gruplar (toplu yazma için).
export function byDoc(list) {
  const map = new Map();
  for (const item of list) {
    if (!map.has(item.docId)) map.set(item.docId, []);
    map.get(item.docId).push(item);
  }
  return map;
}
