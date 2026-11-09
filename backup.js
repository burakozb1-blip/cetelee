// JSON yedek biçimi, doğrulama ve geri yükleme planı. Firebase bilgisi içermez.

import { isValidKey, parseKey } from './dates.js';
import { MAX_VALUE, isValidMonth, isValidScore } from './measure.js';
import { MAX_PAGES } from './books.js';
import {
  MAX_EXAMPLE, MAX_MEANING, MAX_WORD, cleanText, isValidWordId, wordDocId,
} from './words.js';

export const BACKUP_APP = 'cetele';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

const ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export class BackupError extends Error {}

export const logDocId = (habitId, year) => `${habitId}_${year}`;

export const MAX_DURATION = 1000;

export function createBackup(habits, doneMap, now = new Date(), valuesMap = new Map(), books = [], words = []) {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    habits: habits.map((h) => ({
      id: h.id,
      name: h.name,
      description: h.description || '',
      color: h.color,
      startDate: h.startDate,
      archived: Boolean(h.archived),
      archivedRanges: h.archivedRanges || [],
      createdAt: h.createdAt || '',
      unit: h.unit || '',
      duration: h.duration ?? null,
      mastery: h.mastery ?? null,
      dailyDefault: h.dailyDefault ?? null,
      target: h.target ?? null,
      floor: h.floor ?? null,
      selfScores: h.selfScores || {},
      values: valuesMap.get(h.id) || {},
      completions: [...(doneMap.get(h.id) || [])].sort(),
    })),
    books: books.map((b) => ({ id: b.id, ...bookFields(b) })),
    words: [...words].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
      .map((w) => ({ id: w.id, habitId: w.habitId, ...wordFields(w) })),
  };
}

export function parseBackup(text, today) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('Bu dosya okunamadı. Geçerli bir JSON yedeği seç.');
  }
  if (!data || data.app !== BACKUP_APP || !Array.isArray(data.habits)) {
    throw new BackupError('Bu dosya Çetele yedeği değil.');
  }
  if (data.version !== BACKUP_VERSION) {
    throw new BackupError(`Bu yedeğin sürümü (${data.version}) desteklenmiyor.`);
  }

  const seen = new Set();
  let skippedFuture = 0;
  const habits = data.habits.map((raw, index) => {
    const where = `${index + 1}. alışkanlık`;
    if (!raw || typeof raw !== 'object') throw new BackupError(`${where} hatalı.`);
    if (typeof raw.id !== 'string' || !ID_RE.test(raw.id)) throw new BackupError(`${where}: kimlik hatalı.`);
    if (seen.has(raw.id)) throw new BackupError(`${where}: aynı kimlik iki kez kullanılmış.`);
    seen.add(raw.id);
    if (typeof raw.name !== 'string' || !raw.name.trim()) throw new BackupError(`${where}: ad boş olamaz.`);
    if (typeof raw.color !== 'string' || !COLOR_RE.test(raw.color)) throw new BackupError(`${where}: renk hatalı.`);
    if (!isValidKey(raw.startDate)) throw new BackupError(`${where}: başlangıç tarihi hatalı.`);
    if (!Array.isArray(raw.completions)) throw new BackupError(`${where}: kayıt listesi hatalı.`);

    const ranges = raw.archivedRanges === undefined ? [] : raw.archivedRanges;
    if (!Array.isArray(ranges) || !ranges.every((r) => r && isValidKey(r.from) && (r.to === null || isValidKey(r.to)))) {
      throw new BackupError(`${where}: arşiv tarihleri hatalı.`);
    }

    const completions = new Set();
    for (const key of raw.completions) {
      if (!isValidKey(key)) throw new BackupError(`${where}: "${String(key).slice(0, 20)}" geçerli bir tarih değil.`);
      if (key > today) skippedFuture += 1;
      else completions.add(key);
    }

    const rawValues = raw.values === undefined ? {} : raw.values;
    if (!rawValues || typeof rawValues !== 'object' || Array.isArray(rawValues)) throw new BackupError(`${where}: sayılar hatalı.`);
    const values = {};
    for (const [key, value] of Object.entries(rawValues)) {
      if (!isValidKey(key) || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_VALUE) {
        throw new BackupError(`${where}: sayılar hatalı.`);
      }
      if (key > today) skippedFuture += 1;
      else values[key] = value;
    }

    const rawScores = raw.selfScores === undefined ? {} : raw.selfScores;
    if (!rawScores || typeof rawScores !== 'object' || Array.isArray(rawScores)
      || !Object.entries(rawScores).every(([month, score]) => isValidMonth(month) && isValidScore(score))) {
      throw new BackupError(`${where}: değerlendirme puanları hatalı.`);
    }

    const goal = (field) => {
      const value = raw[field];
      if (value === undefined || value === null) return null;
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > MAX_VALUE) {
        throw new BackupError(`${where}: ${field === 'dailyDefault' ? 'günlük sayı' : 'hedef'} hatalı.`);
      }
      return value;
    };
    const target = goal('target');
    const floor = goal('floor');
    const mastery = raw.mastery === undefined || raw.mastery === null ? null : raw.mastery;
    if (mastery !== null && mastery !== 'hours' && mastery !== 'words') throw new BackupError(`${where}: uzmanlık türü hatalı.`);
    const dailyDefault = goal('dailyDefault');
    const duration = raw.duration === undefined || raw.duration === null ? null : raw.duration;
    if (duration !== null && !(Number.isInteger(duration) && duration >= 1 && duration <= MAX_DURATION)) {
      throw new BackupError(`${where}: gün sayısı hatalı.`);
    }

    return {
      id: raw.id,
      duration,
      mastery,
      dailyDefault,
      target,
      floor,
      unit: typeof raw.unit === 'string' ? raw.unit.trim().slice(0, 20) : '',
      selfScores: rawScores,
      values,
      name: raw.name.trim(),
      description: typeof raw.description === 'string' ? raw.description : '',
      color: raw.color,
      startDate: raw.startDate,
      archived: Boolean(raw.archived),
      archivedRanges: ranges.map((r) => ({ from: r.from, to: r.to })),
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
      completions: [...completions].sort(),
    };
  });

  if (data.books !== undefined && !Array.isArray(data.books)) throw new BackupError('Kitap listesi hatalı.');
  const bookIds = new Set();
  const books = (data.books || []).map((raw, index) => {
    const where = `${index + 1}. kitap`;
    if (!raw || typeof raw !== 'object') throw new BackupError(`${where} hatalı.`);
    if (typeof raw.id !== 'string' || !ID_RE.test(raw.id)) throw new BackupError(`${where}: kimlik hatalı.`);
    if (bookIds.has(raw.id)) throw new BackupError(`${where}: aynı kimlik iki kez kullanılmış.`);
    bookIds.add(raw.id);
    if (typeof raw.title !== 'string' || !raw.title.trim()) throw new BackupError(`${where}: kitap adı boş olamaz.`);
    const total = raw.totalPages === undefined ? null : raw.totalPages;
    if (total !== null && !(Number.isInteger(total) && total > 0 && total <= MAX_PAGES)) throw new BackupError(`${where}: sayfa sayısı hatalı.`);
    if (raw.status !== 'reading' && raw.status !== 'done') throw new BackupError(`${where}: durum hatalı.`);
    const startPage = raw.startPage === undefined ? null : raw.startPage;
    if (startPage !== null && !(Number.isInteger(startPage) && startPage >= 0 && startPage <= MAX_PAGES)) throw new BackupError(`${where}: başlangıç sayfası hatalı.`);
    if (raw.startDate !== undefined && raw.startDate !== '' && !isValidKey(raw.startDate)) throw new BackupError(`${where}: başlangıç tarihi hatalı.`);
    if (raw.finishedAt !== undefined && raw.finishedAt !== null && !isValidKey(raw.finishedAt)) throw new BackupError(`${where}: bitiş tarihi hatalı.`);
    const rawPages = raw.pages === undefined ? {} : raw.pages;
    if (!rawPages || typeof rawPages !== 'object' || Array.isArray(rawPages)) throw new BackupError(`${where}: sayfa kayıtları hatalı.`);
    const pages = {};
    for (const [key, value] of Object.entries(rawPages)) {
      if (!isValidKey(key) || !Number.isInteger(value) || value < 0 || value > MAX_PAGES) throw new BackupError(`${where}: sayfa kayıtları hatalı.`);
      if (key > today) skippedFuture += 1;
      else pages[key] = value;
    }
    return {
      id: raw.id,
      title: raw.title.trim(),
      author: typeof raw.author === 'string' ? raw.author.trim() : '',
      totalPages: total,
      startPage,
      status: raw.status,
      startDate: raw.startDate || '',
      finishedAt: raw.finishedAt || null,
      pages,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
    };
  });

  if (data.words !== undefined && !Array.isArray(data.words)) throw new BackupError('Kelime listesi hatalı.');
  const wordIds = new Set();
  const words = [];
  (data.words || []).forEach((raw, index) => {
    const where = `${index + 1}. kelime`;
    if (!raw || typeof raw !== 'object') throw new BackupError(`${where} hatalı.`);
    if (!isValidWordId(raw.id)) throw new BackupError(`${where}: kimlik hatalı.`);
    if (typeof raw.habitId !== 'string' || !seen.has(raw.habitId)) throw new BackupError(`${where}: alışkanlığı yedekte yok.`);
    const uniq = `${raw.habitId}/${raw.id}`;
    if (wordIds.has(uniq)) throw new BackupError(`${where}: aynı kimlik iki kez kullanılmış.`);
    wordIds.add(uniq);
    if (typeof raw.word !== 'string' || !raw.word.trim()) throw new BackupError(`${where}: kelime boş olamaz.`);
    if (!isValidKey(raw.date)) throw new BackupError(`${where}: tarih hatalı.`);
    if (raw.date > today) {
      skippedFuture += 1;
      return;
    }
    words.push({
      id: raw.id,
      habitId: raw.habitId,
      word: cleanText(raw.word, MAX_WORD),
      meaning: cleanText(raw.meaning, MAX_MEANING),
      example: cleanText(raw.example, MAX_EXAMPLE),
      date: raw.date,
      learned: raw.learned === true,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
    });
  });

  return {
    habits, books, words, skippedFuture, exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : null,
  };
}

function groupByYear(days) {
  const years = new Map();
  for (const key of days) {
    const { y } = parseKey(key);
    if (!years.has(y)) years.set(y, []);
    years.get(y).push(key);
  }
  return years;
}

const sortedEntries = (o) => Object.entries(o).sort((x, y) => (x[0] < y[0] ? -1 : 1));

const habitFields = (h) => ({
  name: h.name,
  description: h.description || '',
  color: h.color,
  startDate: h.startDate,
  archived: Boolean(h.archived),
  archivedRanges: h.archivedRanges || [],
  createdAt: h.createdAt || '',
  unit: h.unit || '',
  duration: h.duration ?? null,
  mastery: h.mastery ?? null,
  dailyDefault: h.dailyDefault ?? null,
  target: h.target ?? null,
  floor: h.floor ?? null,
  selfScores: Object.fromEntries(sortedEntries(h.selfScores || {})),
});

function bookFields(b) {
  return {
    title: b.title,
    author: b.author || '',
    totalPages: b.totalPages ?? null,
    startPage: b.startPage ?? null,
    status: b.status === 'done' ? 'done' : 'reading',
    startDate: b.startDate || '',
    finishedAt: b.finishedAt || null,
    pages: Object.fromEntries(sortedEntries(b.pages || {})),
    createdAt: b.createdAt || '',
  };
}

function wordFields(w) {
  return {
    word: w.word,
    meaning: w.meaning || '',
    example: w.example || '',
    date: w.date,
    learned: w.learned === true,
    createdAt: w.createdAt || '',
  };
}

// Kelimeleri ay belgelerine göre gruplar: belge -> { habitId, month, items }
function wordDocs(list, docOf) {
  const docs = new Map();
  for (const w of list) {
    const id = docOf(w);
    if (!docs.has(id)) docs.set(id, { habitId: w.habitId, month: id.slice(-7), items: {} });
    docs.get(id).items[w.id] = wordFields(w);
  }
  return docs;
}

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sameValues = (a, b) => sameJson(sortedEntries(a), sortedEntries(b));
const sameDays = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

// Geri yükleme planı. Yalnızca farklı olan belgeler yazılır.
// mode 'merge': mevcut hiçbir kayıt silinmez, işaretler birleştirilir.
// mode 'replace': kullanıcı onayıyla, yedekte olmayan veriler silinir.
export function planRestore(currentHabits, currentLogs, backup, mode, currentBooks = [], currentWords = []) {
  const ops = {
    habitSets: [], habitDeletes: [], logSets: [], logDeletes: [], bookSets: [], bookDeletes: [], wordSets: [], wordDeletes: [],
  };
  const byId = new Map(currentHabits.map((h) => [h.id, h]));
  const wanted = new Set();

  for (const habit of backup.habits) {
    const fields = habitFields(habit);
    const existing = byId.get(habit.id);
    if (!existing || !sameJson(habitFields(existing), fields)) {
      ops.habitSets.push({ id: habit.id, data: fields });
    }
    const yearsOfDays = groupByYear(habit.completions);
    const backupValues = habit.values || {};
    const yearsOfValues = groupByYear(Object.keys(backupValues));
    for (const year of new Set([...yearsOfDays.keys(), ...yearsOfValues.keys()])) {
      const days = yearsOfDays.get(year) || [];
      const valuesOfYear = {};
      (yearsOfValues.get(year) || []).forEach((key) => { valuesOfYear[key] = backupValues[key]; });
      const id = logDocId(habit.id, year);
      wanted.add(id);
      const current = currentLogs.get(id);
      const merging = mode === 'merge' && current;
      const finalDays = merging ? [...new Set([...current.days, ...days])].sort() : days;
      const finalValues = merging ? { ...(current.values || {}), ...valuesOfYear } : valuesOfYear;
      const hasValues = Object.keys(finalValues).length > 0;
      if (!current || !sameDays(current.days, finalDays) || !sameValues(current.values || {}, finalValues)) {
        ops.logSets.push({
          id,
          data: { habitId: habit.id, year, days: finalDays, ...(hasValues ? { values: finalValues } : {}) },
        });
      }
    }
  }

  const booksById = new Map(currentBooks.map((b) => [b.id, b]));
  for (const book of backup.books || []) {
    const existing = booksById.get(book.id);
    const pages = mode === 'merge' && existing ? { ...existing.pages, ...book.pages } : book.pages;
    const fields = bookFields({ ...book, pages });
    if (!existing || !sameJson(bookFields(existing), fields)) ops.bookSets.push({ id: book.id, data: fields });
  }

  const currentDocs = wordDocs(currentWords, (w) => w.docId);
  const backupDocs = wordDocs(backup.words || [], (w) => wordDocId(w.habitId, w.date));
  const sortedItems = (items) => Object.fromEntries(sortedEntries(items));
  for (const [id, doc] of backupDocs) {
    const existing = currentDocs.get(id);
    const items = mode === 'merge' && existing ? { ...existing.items, ...doc.items } : doc.items;
    if (!existing || !sameJson(sortedItems(existing.items), sortedItems(items)) || existing.habitId !== doc.habitId) {
      ops.wordSets.push({ id, data: { habitId: doc.habitId, month: doc.month, items: sortedItems(items) } });
    }
  }

  if (mode === 'replace') {
    for (const id of currentDocs.keys()) {
      if (!backupDocs.has(id)) ops.wordDeletes.push(id);
    }
    const keepBooks = new Set((backup.books || []).map((b) => b.id));
    for (const book of currentBooks) {
      if (!keepBooks.has(book.id)) ops.bookDeletes.push(book.id);
    }
    const keep = new Set(backup.habits.map((h) => h.id));
    for (const habit of currentHabits) {
      if (!keep.has(habit.id)) ops.habitDeletes.push(habit.id);
    }
    for (const id of currentLogs.keys()) {
      if (!wanted.has(id)) ops.logDeletes.push(id);
    }
  }
  return ops;
}

export function countOps(ops) {
  return ops.habitSets.length + ops.habitDeletes.length + ops.logSets.length + ops.logDeletes.length
    + (ops.bookSets || []).length + (ops.bookDeletes || []).length
    + (ops.wordSets || []).length + (ops.wordDeletes || []).length;
}
