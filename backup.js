// JSON yedek biçimi, doğrulama ve geri yükleme planı. Firebase bilgisi içermez.

import { isValidKey, parseKey } from './dates.js';
import { MAX_VALUE, isValidMonth, isValidScore } from './measure.js';

export const BACKUP_APP = 'cetele';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

const ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export class BackupError extends Error {}

export const logDocId = (habitId, year) => `${habitId}_${year}`;

export function createBackup(habits, doneMap, now = new Date(), valuesMap = new Map()) {
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
      target: h.target ?? null,
      floor: h.floor ?? null,
      selfScores: h.selfScores || {},
      values: valuesMap.get(h.id) || {},
      completions: [...(doneMap.get(h.id) || [])].sort(),
    })),
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
        throw new BackupError(`${where}: hedef hatalı.`);
      }
      return value;
    };
    const target = goal('target');
    const floor = goal('floor');

    return {
      id: raw.id,
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

  return { habits, skippedFuture, exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : null };
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
  target: h.target ?? null,
  floor: h.floor ?? null,
  selfScores: Object.fromEntries(sortedEntries(h.selfScores || {})),
});

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sameValues = (a, b) => sameJson(sortedEntries(a), sortedEntries(b));
const sameDays = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

// Geri yükleme planı. Yalnızca farklı olan belgeler yazılır.
// mode 'merge': mevcut hiçbir kayıt silinmez, işaretler birleştirilir.
// mode 'replace': kullanıcı onayıyla, yedekte olmayan veriler silinir.
export function planRestore(currentHabits, currentLogs, backup, mode) {
  const ops = { habitSets: [], habitDeletes: [], logSets: [], logDeletes: [] };
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

  if (mode === 'replace') {
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
  return ops.habitSets.length + ops.habitDeletes.length + ops.logSets.length + ops.logDeletes.length;
}
