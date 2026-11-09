// Uygulama: ekranlar, yönlendirme ve kullanıcı etkileşimleri.

import {
  addDays, formatDayMonth, formatLong, formatShort, isValidKey, parseKey, startOfWeek, todayKey,
  watchDayChange, weekdayIndex, weekdayName, AYLAR_KISA, GUNLER_KISA,
} from './dates.js';
import {
  challengeStatus, computeStreaks, daySummary, endDate, formatPct, habitStats, isFinished, isInArchive,
  monthComparison, monthlySeries, rankHabits, streakLeader, weekComparison, weeklySeries,
} from './stats.js';
import { bookProgress, parsePageNumber, sortBooks } from './books.js';
import {
  MASTERY, formatAmount, formatPercent, formatSpan, formatWithUnit, isMasteryType, masteryStatus,
} from './mastery.js';
import {
  BackupError, MAX_BACKUP_BYTES, MAX_DURATION, countOps, createBackup, parseBackup, planRestore,
} from './backup.js';
import { PALETTE, displayColor, inkOn } from './colors.js';
import {
  formatNumber, measureComparison, measureMonths, monthName, parseMeasure,
} from './measure.js';
import { Store, errorMessage } from './store.js';
import {
  MAX_EXAMPLE, MAX_MEANING, MAX_WORD, STUDY_SETS, cleanText, filterWords, findDuplicate, groupByDay, shuffle,
  sortWords, studyPool, wordCounts,
} from './words.js';
import {
  h, icon, singleMark,
} from './ui.js';

const store = new Store();
const app = document.getElementById('app');

const state = {
  day: todayKey(),
  heatYear: 'son',
  heatCell: null,
  signingIn: false,
  signInError: null,
  wordDraft: { word: '', meaning: '', example: '' },
  wordQuery: '',
  wordStatus: 'all',
  wordLimit: 50,
  study: null,
  studySet: 'learning',
  studyFront: 'word',
};

let dayWatcher = null;

// Tema

const THEME_KEY = 'cetele-tema';
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function savedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function activeTheme() {
  const saved = savedTheme();
  if (saved === 'light' || saved === 'dark') return saved;
  return systemDark.matches ? 'dark' : 'light';
}

function applyTheme() {
  const saved = savedTheme();
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
  else delete document.documentElement.dataset.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', activeTheme() === 'dark' ? '#141416' : '#FFFFFF');
}

function setTheme(value) {
  try {
    if (value === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, value);
  } catch {
    toast('Tema tercihi bu tarayıcıda saklanamadı.');
  }
  applyTheme();
  render();
}

systemDark.addEventListener('change', () => {
  applyTheme();
  render();
});

const habitVars = (color) => {
  const shown = displayColor(color, activeTheme());
  return { '--c': shown, '--on': inkOn(shown) };
};

// Bildirim

function toast(message, kind = 'info') {
  const box = document.getElementById('toasts');
  const item = h('div', { class: `toast toast-${kind}`, role: kind === 'error' ? 'alert' : 'status' }, message);
  box.append(item);
  setTimeout(() => item.remove(), kind === 'error' ? 7000 : 3500);
}

// Pencereler

function openDialog(content, { onClose } = {}) {
  const dialog = h('dialog', { class: 'sheet' }, content);
  document.body.append(dialog);
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (onClose) onClose();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close('cancel');
  });
  dialog.showModal();
  return dialog;
}

function confirmDialog({ title, body, confirmLabel, danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const dialog = openDialog(h('div', { class: 'sheet-body' },
      h('h2', null, title),
      h('p', null, body),
      h('div', { class: 'sheet-actions' },
        h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => dialog.close() }, 'Vazgeç'),
        h('button', {
          type: 'button',
          class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
          onclick: () => { result = true; dialog.close(); },
        }, confirmLabel))), {
      onClose: () => resolve(result),
    });
  });
}

// Alışkanlık formu

function habitForm(habit = null) {
  const isEdit = Boolean(habit);
  let color = habit ? habit.color : PALETTE[0].hex;

  const error = h('p', { class: 'field-error', role: 'alert', hidden: true });
  const warning = h('p', { class: 'field-note', hidden: true });
  const name = h('input', {
    id: 'habit-name', type: 'text', maxlength: 80, required: true, autocomplete: 'off',
    value: habit?.name || '', placeholder: 'Örneğin: 20 sayfa kitap oku',
  });
  const description = h('textarea', {
    id: 'habit-desc', rows: 2, maxlength: 200, placeholder: 'İstersen kısa bir not ekle',
  });
  description.value = habit?.description || '';
  const unit = h('input', {
    id: 'habit-unit', type: 'text', maxlength: 20, autocomplete: 'off',
    value: habit?.unit || '', placeholder: 'Örneğin: sayfa, dakika, km',
  });
  const masterySelect = h('select', { id: 'habit-mastery' },
    h('option', { value: '' }, 'Yok'),
    h('option', { value: 'hours' }, 'Bir işte uzmanlaşma: 10.000 saat'),
    h('option', { value: 'words' }, 'Dil öğrenimi: 5.000 kelime'));
  masterySelect.value = habit?.mastery || '';
  const daily = h('input', {
    id: 'habit-daily', type: 'text', inputmode: 'decimal', autocomplete: 'off',
    value: habit?.dailyDefault ? String(habit.dailyDefault).replace('.', ',') : '',
  });
  const dailyLabel = h('span');
  const dailyField = h('label', { class: 'field', for: 'habit-daily' },
    dailyLabel,
    daily,
    h('small', { class: 'field-note' }, 'İşaretleyip kutuya sayı yazmadığın günlerde bu sayı eklenir.'));
  // Uzmanlık seçilince birim sabitlenir (dakika ya da kelime); kaldırılınca elle yazılan birim geri gelir.
  let manualUnit = habit?.mastery ? '' : unit.value;
  unit.addEventListener('input', () => { manualUnit = unit.value; });
  const syncMastery = () => {
    const kind = MASTERY[masterySelect.value];
    dailyField.hidden = !kind;
    unit.readOnly = Boolean(kind);
    if (kind) {
      unit.value = kind.unit;
      dailyLabel.textContent = kind.ask;
      daily.placeholder = `Örneğin: ${kind.defaultDaily}`;
      // Önceki türün hazır değeri duruyorsa yeni türün hazır değeriyle değiştir.
      const autoValues = Object.values(MASTERY).map((k) => String(k.defaultDaily));
      if (!daily.value || (!habit?.mastery && autoValues.includes(daily.value))) daily.value = String(kind.defaultDaily);
    } else {
      unit.value = manualUnit;
    }
  };
  masterySelect.addEventListener('change', syncMastery);
  syncMastery();
  const startDate = h('input', {
    id: 'habit-start', type: 'date', required: true, value: habit?.startDate || todayKey(),
  });
  const duration = h('input', {
    id: 'habit-duration', type: 'text', inputmode: 'numeric', autocomplete: 'off',
    value: habit?.duration ? String(habit.duration) : '', placeholder: 'Örneğin: 40',
  });
  const durationNote = h('small', { class: 'field-note' });
  const parseDuration = () => {
    const text = duration.value.trim();
    if (text === '') return { ok: true, value: null };
    if (!/^\d{1,4}$/.test(text)) return { ok: false };
    const value = Number(text);
    return value >= 1 && value <= MAX_DURATION ? { ok: true, value } : { ok: false };
  };
  const refreshDuration = () => {
    const parsed = parseDuration();
    durationNote.textContent = parsed.ok && parsed.value && isValidKey(startDate.value)
      ? `Son gün: ${formatLong(endDate({ startDate: startDate.value, duration: parsed.value }))}. Süre bitince Bugün listesinden kalkar, sonucu sayfasında kalır.`
      : 'Boş bırakırsan süresiz olur. 40 günlük bir deneme için 40 yaz.';
  };
  duration.addEventListener('input', refreshDuration);
  startDate.addEventListener('input', refreshDuration);
  refreshDuration();

  const custom = h('input', {
    type: 'color', class: 'swatch-custom', 'aria-label': 'Özel renk seç',
    value: color.toLowerCase(),
    oninput: (event) => { color = event.target.value; syncSwatches(); },
  });
  const swatches = PALETTE.map((option) => h('button', {
    type: 'button',
    class: 'swatch',
    style: { '--swatch': displayColor(option.hex, activeTheme()) },
    'aria-label': option.name,
    title: option.name,
    onclick: () => { color = option.hex; syncSwatches(); },
    dataset: { hex: option.hex },
  }));
  function syncSwatches() {
    swatches.forEach((el) => {
      const on = el.dataset.hex.toLowerCase() === color.toLowerCase();
      el.setAttribute('aria-pressed', String(on));
    });
    custom.value = color.toLowerCase();
  }
  syncSwatches();

  const refreshWarning = () => {
    if (!isEdit || !isValidKey(startDate.value)) {
      warning.hidden = true;
      return;
    }
    const days = store.done.get(habit.id) || new Set();
    const before = [...days].filter((d) => d < startDate.value).length;
    warning.hidden = before === 0;
    warning.textContent = `Bu tarihten önce ${before} günlük kayıt var. Kayıtlar silinmez, ama istatistiklere girmez.`;
  };
  startDate.addEventListener('input', refreshWarning);
  refreshWarning();

  const submit = (event) => {
    event.preventDefault();
    const fail = (message, field) => {
      error.textContent = message;
      error.hidden = false;
      field.focus();
    };
    const cleanName = name.value.trim();
    if (!cleanName) return fail('Alışkanlığa bir ad ver.', name);
    if (!isValidKey(startDate.value)) return fail('Geçerli bir başlangıç tarihi seç.', startDate);
    const masteryType = isMasteryType(masterySelect.value) ? masterySelect.value : null;
    const parsedDaily = parseMeasure(daily.value);
    if (masteryType && (!parsedDaily.ok || !parsedDaily.value)) return fail('Günlük sayı 0\'dan büyük olmalı.', daily);
    const parsedDuration = parseDuration();
    if (!parsedDuration.ok) return fail(`Gün sayısı 1 ile ${MAX_DURATION} arasında bir tam sayı olmalı.`, duration);
    const fields = {
      name: cleanName,
      description: description.value.trim(),
      color,
      startDate: startDate.value,
      unit: unit.value.trim(),
      duration: parsedDuration.value,
      mastery: masteryType,
      dailyDefault: masteryType ? parsedDaily.value : null,
    };
    if (isEdit) {
      store.updateHabit(habit.id, fields);
      toast('Değişiklikler kaydedildi.');
    } else {
      store.addHabit(fields);
      toast('Alışkanlık eklendi.');
    }
    dialog.close();
    return undefined;
  };

  const dialog = openDialog(h('form', { class: 'sheet-body', onsubmit: submit, novalidate: true },
    h('h2', null, isEdit ? 'Alışkanlığı düzenle' : 'Yeni alışkanlık'),
    error,
    h('label', { class: 'field', for: 'habit-name' }, h('span', null, 'Ad'), name),
    h('label', { class: 'field', for: 'habit-desc' }, h('span', null, 'Açıklama (isteğe bağlı)'), description),
    h('label', { class: 'field', for: 'habit-unit' },
      h('span', null, 'Ölçü birimi (isteğe bağlı)'),
      unit,
      h('small', { class: 'field-note' }, 'Sayı kutusunda görünür. Boş bırakabilirsin.')),
    h('label', { class: 'field', for: 'habit-mastery' },
      h('span', null, 'Uzmanlık takibi (isteğe bağlı)'),
      masterySelect,
      h('small', { class: 'field-note' }, 'Seçersen Uzmanlık sekmesinde toplamın ve hedefe kalan süre görünür.')),
    dailyField,
    h('div', { class: 'field' },
      h('span', { id: 'color-label' }, 'Renk'),
      h('div', { class: 'swatches', role: 'group', 'aria-labelledby': 'color-label' }, swatches,
        h('label', { class: 'swatch-custom-wrap' }, custom, h('span', null, 'Özel')))),
    h('label', { class: 'field', for: 'habit-start' }, h('span', null, 'Başlangıç tarihi'), startDate),
    warning,
    h('label', { class: 'field', for: 'habit-duration' },
      h('span', null, 'Kaç gün sürecek? (isteğe bağlı)'),
      duration,
      durationNote),
    h('div', { class: 'sheet-actions' },
      h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => dialog.close() }, 'Vazgeç'),
      h('button', { type: 'submit', class: 'btn btn-primary' }, isEdit ? 'Kaydet' : 'Ekle'))));
  name.focus();
}

async function askDelete(habit) {
  const count = (store.done.get(habit.id) || new Set()).size;
  const words = store.words.filter((w) => w.habitId === habit.id).length;
  const ok = await confirmDialog({
    title: 'Alışkanlık silinsin mi?',
    body: `"${habit.name}" ve ${count} günlük kaydı${words > 0 ? `, kelime arşivindeki ${words} kelimeyle birlikte,` : ''} kalıcı olarak silinecek. Bu işlem geri alınamaz. Geçmişini korumak istersen arşivle.`,
    confirmLabel: 'Kalıcı olarak sil',
    danger: true,
  });
  if (!ok) return;
  store.deleteHabit(habit.id);
  toast('Alışkanlık silindi.');
  if (location.hash.startsWith('#/aliskanlik/')) location.hash = '#/aliskanliklar';
}

// Ortak parçalar

function emptyState(title, text, action) {
  return h('div', { class: 'empty' }, h('h2', null, title), h('p', null, text), action);
}

const addButton = (label = 'Alışkanlık ekle') => h('button', {
  type: 'button', class: 'btn btn-primary', onclick: () => habitForm(),
}, icon('plus', 20), label);

// Bugün ekranı

function goToDay(key) {
  state.day = key;
  render();
}

const doneSet = (habit) => store.done.get(habit.id) || new Set();

function weekStrip(day, today) {
  const monday = startOfWeek(day);
  const cells = [];
  for (let i = 0; i < 7; i += 1) {
    const key = addDays(monday, i);
    const future = key > today;
    const summary = future ? null : daySummary(store.habits, store.done, key, today);
    const classes = ['week-day'];
    if (key === day) classes.push('is-selected');
    if (key === today) classes.push('is-today');
    if (summary?.rate === 100) classes.push('is-full');
    cells.push(h('button', {
      type: 'button',
      class: classes.join(' '),
      disabled: future,
      'aria-current': key === day ? 'date' : null,
      'aria-label': `${formatLong(key)}${future ? ', gelecek gün' : `, ${formatPct(summary.rate)}`}`,
      dataset: { fk: `week-${key}` },
      onclick: () => goToDay(key),
    },
    h('span', { class: 'week-name' }, GUNLER_KISA[i]),
    h('span', { class: 'week-num' }, String(parseKey(key).d))));
  }
  return h('div', { class: 'week', role: 'group', 'aria-label': 'Bu hafta' }, cells);
}

// Bahçe sahnesi: her alışkanlık bir bitkidir, güneş o günün tamamlanma oranıyla yükselir.
function viewToday(today) {
  if (state.day > today) state.day = today;
  const day = state.day;
  const isToday = day === today;
  const summary = daySummary(store.habits, store.done, day, today);
  const hasHabits = store.habits.length > 0;

  const head = h('section', { class: 'day-hero', 'aria-label': 'Seçili gün' },
    h('div', { class: 'day-head' },
      h('div', { class: 'day-heading' },
        h('h1', { class: 'day-title' }, formatDayMonth(day)),
        h('p', { class: 'day-sub' }, isToday ? `Bugün, ${weekdayName(day)}, ${parseKey(day).y}` : `${weekdayName(day)}, ${parseKey(day).y}`)),
      summary.total > 0 && h('p', { class: 'day-pct' },
        h('strong', null, formatPct(summary.rate)),
        h('span', null, `${summary.done} / ${summary.total}`))),
    hasHabits && h('div', { class: 'day-nav' },
      h('button', {
        type: 'button', class: 'icon-btn', 'aria-label': 'Önceki gün', dataset: { fk: 'prev' },
        onclick: () => goToDay(addDays(state.day, -1)),
      }, icon('left', 20)),
      weekStrip(day, today),
      h('button', {
        type: 'button', class: 'icon-btn', 'aria-label': 'Sonraki gün', disabled: isToday, dataset: { fk: 'next' },
        onclick: () => { if (state.day < todayKey()) goToDay(addDays(state.day, 1)); },
      }, icon('right', 20)),
      h('label', { class: 'icon-btn date-pick', title: 'Tarihe git' },
        icon('calendar', 20),
        h('span', { class: 'sr-only' }, 'Tarihe git'),
        h('input', {
          type: 'date', max: today, value: day, dataset: { fk: 'pick' },
          onclick: (event) => { try { event.target.showPicker(); } catch { /* tarayıcı kendi açar */ } },
          onchange: (event) => {
            const { value } = event.target;
            if (!isValidKey(value)) return;
            if (value > todayKey()) {
              toast('Gelecek günler işaretlenemez.');
              event.target.value = state.day;
              return;
            }
            goToDay(value);
          },
        }))),
    !isToday && h('div', { class: 'past-note' },
      h('span', null, 'Geçmiş bir gün.'),
      h('button', {
        type: 'button', class: 'link-btn', dataset: { fk: 'back-today' }, onclick: () => goToDay(todayKey()),
      }, 'Bugüne dön')));

  let body;
  if (!hasHabits) {
    body = emptyState('Henüz alışkanlık yok', 'Takip etmek istediğin ilk alışkanlığı ekle.', addButton('İlk alışkanlığını ekle'));
  } else if (summary.total === 0) {
    const anyActive = store.habits.some((habit) => !habit.archived && !isFinished(habit, today));
    body = emptyState(
      isToday ? 'Bugün için alışkanlık yok' : 'Bu tarihte alışkanlık yok',
      isToday && !anyActive
        ? 'Tüm alışkanlıkların arşivde ya da süresi bitti.'
        : 'Alışkanlıklar başlangıç tarihlerinden itibaren burada görünür.',
      isToday ? addButton() : null,
    );
  } else {
    body = h('section', { class: 'habit-list', 'aria-label': 'Alışkanlıklar' },
      summary.list.map((habit) => habitRow(habit, day, today)),
      isToday && h('button', { type: 'button', class: 'btn-add-row', onclick: () => habitForm() }, icon('plus', 18), 'Alışkanlık ekle'));
  }

  return h('div', { class: 'today' }, head, h('div', { class: 'today-main' }, body, isToday && todayLinks(today)));
}

function todayLinks(today) {
  const { reading } = sortBooks(store.books);
  const books = reading.map((book) => {
    const p = bookProgress(book, today);
    return h('a', { class: 'reading-link', href: '#/kitaplar' },
      h('span', { class: 'reading-label' }, 'Okuduğun kitap'),
      h('span', { class: 'reading-title' }, book.title),
      h('span', { class: 'reading-page' }, book.totalPages ? `${p.page} / ${book.totalPages}` : `${p.page}. sayfa`),
      icon('right', 18));
  });
  const words = store.habits.filter((habit) => habit.mastery === 'words' && !habit.archived).map((habit) => {
    const counts = wordCounts(wordsOf(habit.id), today);
    return h('a', { class: 'reading-link word-link', href: `#/kelimeler/${habit.id}` },
      h('span', { class: 'reading-label' }, 'Kelime arşivi'),
      h('span', { class: 'reading-title' }, habit.name),
      h('span', { class: 'reading-page' }, counts.today > 0 ? `bugün ${counts.today}` : `${counts.total} kelime`),
      icon('right', 18));
  });
  if (books.length === 0 && words.length === 0) return null;
  return h('section', { class: 'reading', 'aria-label': 'Kitaplar ve kelimeler' }, books, words);
}

function changeWord(value, suffix = '') {
  if (Math.round(value) === 0) return 'değişim yok';
  return `${value > 0 ? 'artış' : 'düşüş'}${suffix}`;
}

function withUnit(value, habit) {
  return habit.unit ? `${formatNumber(value)} ${habit.unit}` : formatNumber(value);
}

function measureSummary(habit, today) {
  const cmp = measureComparison(habit, doneSet(habit), store.values.get(habit.id), today);
  if (cmp.state === 'not-enough') {
    return {
      text: cmp.latest
        ? `${monthName(cmp.latest.month)}: ortalama ${withUnit(cmp.latest.average, habit)}.`
        : null,
      note: `Karşılaştırma için iki ayda en az 3'er giriş gerekir.`,
      delta: null,
    };
  }
  const base = `${monthName(cmp.previous.month)}: ${withUnit(cmp.previous.average, habit)}. ${monthName(cmp.latest.month)}: ${withUnit(cmp.latest.average, habit)}.`;
  if (cmp.state === 'from-zero') {
    return { text: base, delta: `${withUnit(Math.abs(cmp.diff), habit)} ${cmp.diff > 0 ? 'artış' : 'düşüş'}`, dir: cmp.diff };
  }
  const amount = Math.round(Math.abs(cmp.relative));
  return { text: base, delta: amount === 0 ? 'Değişim yok' : `%${amount} ${changeWord(cmp.relative)}`, dir: amount === 0 ? 0 : cmp.relative };
}

function measureSection(habit, today) {
  const values = store.values.get(habit.id);
  const months = measureMonths(habit, doneSet(habit), values, today);
  if (months.length === 0) return null;
  const measure = measureSummary(habit, today);
  return h('section', { class: 'block' },
    h('h2', null, 'Sayıların'),
    measure.delta && h('p', null, measure.text, ' ', h('strong', null, `${measure.delta}.`)),
    h('table', { class: 'plain-table' },
      h('thead', null, h('tr', null,
        h('th', { scope: 'col' }, 'Ay'),
        h('th', { scope: 'col' }, 'Giriş'),
        h('th', { scope: 'col' }, 'Günlük ortalama'))),
      h('tbody', null, months.map((row) => h('tr', null,
        h('th', { scope: 'row' }, row.title),
        h('td', null, `${row.count} gün`),
        h('td', null, withUnit(row.average, habit)))))));
}

function habitMeta(habit, day, streak) {
  const parts = [];
  const challenge = challengeStatus(habit, new Set(), day);
  if (challenge) parts.push(`Gün ${challenge.dayNumber} / ${challenge.total}`);
  if (streak > 0) parts.push(`${streak} gün seri`);
  return parts.join(', ');
}

function habitRow(habit, day, today) {
  const isDone = store.isDone(habit.id, day);
  const streak = computeStreaks(habit, doneSet(habit), today).current;
  return h('article', {
    class: `habit-card${isDone ? ' is-done' : ''}`,
    style: habitVars(habit.color),
  },
  h('button', {
    type: 'button',
    class: 'habit',
    'aria-pressed': String(isDone),
    dataset: { fk: `habit-${habit.id}` },
    onclick: () => handleToggle(habit, day),
  },
  h('span', { class: 'habit-check', 'aria-hidden': 'true' }, isDone && icon('check', 20)),
  h('span', { class: 'habit-text' },
    h('span', { class: 'habit-name' }, habit.name),
    habit.description && h('span', { class: 'habit-desc' }, habit.description),
    habit.archived && h('span', { class: 'habit-desc' }, 'Arşivde'),
    habitMeta(habit, day, streak) && h('span', { class: 'habit-desc' }, habitMeta(habit, day, streak)))),
  measureInput(habit, day, isDone),
  h('a', {
    class: 'habit-more',
    href: `#/aliskanlik/${habit.id}`,
    'aria-label': `${habit.name} ayrıntıları`,
  }, icon('right', 18)));
}

function measureInput(habit, day, isDone) {
  const stored = store.values.get(habit.id)?.[day];
  const hasValue = isDone && stored !== undefined;
  const question = habit.unit ? `Kaç ${habit.unit}?` : 'Kaç?';
  const save = (event) => {
    const parsed = parseMeasure(event.target.value);
    if (!parsed.ok) {
      toast('Geçerli bir sayı yaz. Örneğin 20 veya 2,5.', 'error');
      event.target.value = hasValue ? formatNumber(stored) : '';
      return;
    }
    holdRender();
    if (parsed.value === null && !isDone) return;
    if (!store.setValue(habit.id, day, parsed.value)) {
      toast('Bu gün için sayı girilemez.');
      return;
    }
    // Sayı yazmak o işi yaptığın anlamına gelir, bu yüzden gün de işaretlenir.
    if (parsed.value !== null && parsed.value > 0 && !store.isDone(habit.id, day)) {
      handleToggle(habit, day, { deferRender: true });
    } else {
      requestRender();
    }
  };
  return h('input', {
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    enterkeyhint: 'done',
    class: 'measure-input',
    placeholder: habit.unit || 'Sayı',
    value: hasValue ? String(stored).replace('.', ',') : '',
    'aria-label': `${habit.name}: ${question}`,
    dataset: { fk: `measure-${habit.id}`, draft: '1' },
    onchange: save,
    onkeydown: (event) => { if (event.key === 'Enter') event.target.blur(); },
  });
}

function handleToggle(habit, day, { deferRender = false } = {}) {
  if (dayWatcher) dayWatcher.check();
  if (state.day !== day) return;
  if (!store.toggle(habit.id, day)) {
    toast('Bu gün işaretlenemez.');
    return;
  }
  if (deferRender) requestRender();
  else render();
}

// İlerleme ekranı

function rankBlock(today) {
  const rank = rankHabits(store.habits, store.done, today);
  const row = (label, item, variant) => h('a', {
    class: `rank rank-${variant}`, href: `#/aliskanlik/${item.habit.id}`,
  },
  singleMark(displayColor(item.habit.color, activeTheme())),
  h('span', { class: 'rank-text' }, h('span', { class: 'rank-label' }, label), h('strong', null, item.habit.name)),
  h('span', { class: 'rank-value' }, formatPct(item.stats.rate)));

  let items;
  if (rank.state === 'no-data') {
    items = h('p', { class: 'muted' }, 'Karşılaştırma için bir alışkanlıkta en az 3 gün veri gerekiyor.');
  } else if (rank.state === 'single') {
    items = [row('En istikrarlı', rank.best, 'best'),
      h('p', { class: 'muted' }, 'Geliştirilecek alışkanlığı görmek için ikinci bir alışkanlıkta da 3 gün veri gerekiyor.')];
  } else if (rank.state === 'tied') {
    items = h('p', { class: 'muted' }, `Tüm alışkanlıkların son 30 günde ${formatPct(rank.best.stats.rate)} ile aynı seviyede.`);
  } else {
    items = [row('En istikrarlı', rank.best, 'best'), row('En çok geliştirilmesi gereken', rank.worst, 'worst')];
  }
  return h('section', { class: 'block' }, h('h2', null, 'Son 30 günde'), items);
}

// Haftalık ve aylık değişimi tek cümleyle anlatır. Karşılaştırma için iki oran da yazılır.
function changeLine(cmp, thisLabel, prevLabel) {
  const now = cmp.current.rate;
  const before = cmp.previous.rate;
  if (cmp.state === 'no-current') return `${thisLabel} henüz işaret yok.`;
  if (cmp.state === 'no-previous') return `${thisLabel} ${formatPct(now)}. ${prevLabel} için veri yok.`;
  const base = `${thisLabel} ${formatPct(now)}, ${prevLabel.toLowerCase()} ${formatPct(before)}.`;
  if (cmp.state === 'from-zero') return base;
  const amount = Math.round(Math.abs(cmp.relative));
  if (amount === 0) return `${base} Değişim yok.`;
  return `${base} ${cmp.relative > 0 ? `%${amount} daha iyi.` : `%${amount} daha az.`}`;
}

function periodTable(title, firstHeader, rows) {
  if (rows.length === 0) return null;
  return h('section', { class: 'block' },
    h('h2', null, title),
    h('table', { class: 'plain-table' },
      h('thead', null, h('tr', null,
        h('th', { scope: 'col' }, firstHeader),
        h('th', { scope: 'col' }, 'Yapılan'),
        h('th', { scope: 'col' }, 'Oran'))),
      h('tbody', null, rows.map((row) => h('tr', null,
        h('th', { scope: 'row' }, row.label),
        h('td', null, `${row.done} / ${row.total}`),
        h('td', null, h('strong', null, formatPct(row.rate))))))));
}

function viewProgress(today) {
  if (store.habits.length === 0) {
    return h('div', { class: 'page' },
      h('h1', { class: 'page-title' }, 'İlerleme'),
      emptyState('Gösterilecek veri yok', 'İstatistikler alışkanlık ekleyip işaretlemeye başladığında burada oluşur.', addButton()));
  }

  const summary = daySummary(store.habits, store.done, today, today);
  const week = weekComparison(store.habits, store.done, today);
  const month = monthComparison(store.habits, store.done, today);
  const leader = streakLeader(store.habits, store.done, today);
  const active = store.habits.filter((habit) => !habit.archived && !isFinished(habit, today));
  const finished = store.habits.filter((habit) => !habit.archived && isFinished(habit, today));
  const archived = store.habits.filter((habit) => habit.archived);

  const weeks = [...weeklySeries(store.habits, store.done, today, 4)].reverse()
    .filter((point) => point.rate !== null)
    .map((point) => ({ ...point, label: point.isCurrent ? 'Bu hafta' : point.title }));
  const months = [...monthlySeries(store.habits, store.done, today, 6)].reverse()
    .filter((point) => point.rate !== null)
    .map((point) => ({ ...point, label: point.isCurrent ? 'Bu ay' : monthName(point.from.slice(0, 7)) }));

  return h('div', { class: 'page' },
    h('h1', { class: 'page-title' }, 'İlerleme'),
    h('ul', { class: 'summary-list', 'aria-label': 'Özet' },
      h('li', null, summary.total === 0 ? 'Bugün için alışkanlık yok.' : `Bugün ${summary.done} / ${summary.total} tamamlandı.`),
      h('li', null, changeLine(week, 'Bu hafta', 'Geçen hafta')),
      h('li', null, changeLine(month, 'Bu ay', 'Geçen ay')),
      leader && h('li', null, `En uzun süren serin ${leader.streak} gün: ${leader.habit.name}.`)),
    periodTable('Haftalar', 'Hafta', weeks),
    periodTable('Aylar', 'Ay', months),
    rankBlock(today),
    h('section', { class: 'block' },
      h('h2', null, 'Alışkanlıklar'),
      active.length > 0
        ? h('div', { class: 'stat-list' }, active.map((habit) => statRow(habit, today)))
        : h('p', { class: 'muted' }, 'Etkin alışkanlık yok.')),
    finished.length > 0 && h('section', { class: 'block' },
      h('h2', null, 'Süresi bitenler'),
      h('div', { class: 'stat-list' }, finished.map((habit) => statRow(habit, today)))),
    archived.length > 0 && h('section', { class: 'block' },
      h('h2', null, 'Arşiv'),
      h('div', { class: 'stat-list' }, archived.map((habit) => statRow(habit, today)))),
    h('p', { class: 'footnote' }, 'Oran, yapılması gereken günlerin yüzde kaçını yaptığını gösterir. Bugün henüz yapmadıkların haftalık ve aylık oranı düşürmez.'));
}

function statSmall(habit, stats, notStarted, today) {
  if (notStarted) return `${formatShort(habit.startDate)} başlıyor`;
  const challenge = challengeStatus(habit, doneSet(habit), today);
  if (challenge?.finished) return `Bitti: ${challenge.total} günün ${challenge.done} gününde yapıldı`;
  if (challenge) return `Gün ${challenge.dayNumber} / ${challenge.total}, ${stats.currentStreak} gün seri`;
  return `${stats.currentStreak} gün seri`;
}

function statRow(habit, today) {
  const stats = habitStats(habit, store.done.get(habit.id), today);
  const notStarted = stats.overall.total === 0;
  return h('a', { class: 'stat-row', href: `#/aliskanlik/${habit.id}` },
    singleMark(displayColor(habit.color, activeTheme())),
    h('span', { class: 'stat-main' },
      h('span', { class: 'stat-name' }, habit.name),
      h('span', { class: 'stat-small' }, statSmall(habit, stats, notStarted, today))),
    h('span', { class: 'stat-value' }, formatPct(stats.overall.rate)));
}

// Alışkanlık ayrıntısı

function statLine(label, win) {
  return h('tr', null,
    h('th', { scope: 'row' }, label),
    h('td', null, win.total === 0 ? '—' : `${win.done} / ${win.total} gün`),
    h('td', null, h('strong', null, formatPct(win.rate))));
}

function heatmap(habit, today) {
  const done = store.done.get(habit.id) || new Set();
  const firstYear = Math.min(parseKey(habit.startDate).y, ...[...done].map((d) => parseKey(d).y));
  const thisYear = parseKey(today).y;
  const years = [];
  for (let y = thisYear; y >= Math.min(firstYear, thisYear); y -= 1) years.push(y);

  const selected = state.heatYear;
  const from = selected === 'son' ? addDays(startOfWeek(today), -52 * 7) : startOfWeek(`${selected}-01-01`);
  const lastDay = selected === 'son' ? today : (`${selected}-12-31` > today ? today : `${selected}-12-31`);

  const inView = (key) => selected === 'son' || parseKey(key).y === Number(selected);
  const status = (key) => {
    if (key < habit.startDate) return 'out';
    if (done.has(key)) return 'done';
    if (isInArchive(habit, key)) return 'out';
    return 'miss';
  };
  const statusText = { done: 'Yapıldı', miss: 'Yapılmadı', out: 'Sayılmıyor' };

  const cells = [];
  const monthMarks = [];
  let lastMonth = null;
  let col = 0;
  let cursor = from;
  while (cursor <= lastDay) {
    const row = weekdayIndex(cursor);
    if (row === 0 && cursor !== from) col += 1;
    if (inView(cursor)) {
      const st = status(cursor);
      cells.push(h('span', {
        class: `cell cell-${st}${state.heatCell === cursor ? ' is-picked' : ''}`,
        style: { 'grid-column': col + 1, 'grid-row': row + 1 },
        title: `${formatLong(cursor)}: ${statusText[st]}`,
        dataset: { date: cursor, st },
      }));
      const { m, d } = parseKey(cursor);
      if (m !== lastMonth && d <= 7 && row === 0) {
        monthMarks.push(h('span', { style: { 'grid-column': col + 1 } }, AYLAR_KISA[m - 1]));
        lastMonth = m;
      }
    }
    cursor = addDays(cursor, 1);
  }
  const columns = col + 1;

  const readout = h('div', { class: 'heat-readout', 'aria-live': 'polite' });
  const pick = (key) => {
    state.heatCell = key;
    grid.querySelectorAll('.is-picked').forEach((el) => el.classList.remove('is-picked'));
    const el = grid.querySelector(`[data-date="${key}"]`);
    if (el) el.classList.add('is-picked');
    readout.textContent = '';
    if (!key) return;
    const st = status(key);
    readout.append(
      h('span', null,
        h('strong', null, `${formatLong(key)}, ${weekdayName(key)}: `),
        statusText[st],
        st === 'done' && habit.unit && store.values.get(habit.id)?.[key] !== undefined
          && `, ${formatNumber(store.values.get(habit.id)[key])} ${habit.unit}`),
      key >= habit.startDate && h('button', {
        type: 'button', class: 'link-btn',
        onclick: () => {
          state.day = key;
          location.hash = '#/';
        },
      }, 'Bu güne git'),
    );
  };

  const grid = h('div', {
    class: 'heat-grid',
    style: { '--cols': columns },
    tabindex: 0,
    role: 'group',
    'aria-label': `${habit.name} yıllık takvim. Ok tuşlarıyla günler arasında gezebilirsin.`,
    onclick: (event) => {
      const key = event.target.dataset?.date;
      if (key) pick(key);
    },
    onkeydown: (event) => {
      const moves = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 };
      const step = moves[event.key];
      if (!step) return;
      event.preventDefault();
      const base = state.heatCell && grid.querySelector(`[data-date="${state.heatCell}"]`) ? state.heatCell : lastDay;
      const next = addDays(base, state.heatCell ? step : 0);
      if (grid.querySelector(`[data-date="${next}"]`)) pick(next);
    },
  }, cells);

  const yearSelect = h('select', {
    'aria-label': 'Takvim dönemi',
    dataset: { fk: 'heat-year' },
    onchange: (event) => {
      state.heatYear = event.target.value;
      state.heatCell = null;
      render();
    },
  },
  h('option', { value: 'son', selected: selected === 'son' }, 'Son 12 ay'),
  years.map((y) => h('option', { value: String(y), selected: String(selected) === String(y) }, String(y))));

  const wrap = h('div', { class: 'heat-scroll' },
    h('div', { class: 'heat', style: { '--cols': columns } },
      h('div', { class: 'heat-months', style: { '--cols': columns } }, monthMarks),
      h('div', { class: 'heat-days', 'aria-hidden': 'true' },
        [0, 2, 4].map((i) => h('span', { style: { 'grid-row': i + 1 } }, GUNLER_KISA[i]))),
      grid));

  requestAnimationFrame(() => { wrap.scrollLeft = wrap.scrollWidth; });
  if (state.heatCell && inView(state.heatCell)) requestAnimationFrame(() => pick(state.heatCell));

  return h('section', { class: 'block' },
    h('div', { class: 'block-head' }, h('h2', null, 'Yıllık takvim'), yearSelect),
    wrap,
    h('div', { class: 'heat-legend' },
      h('span', null, h('i', { class: 'cell cell-done' }), 'Yapıldı'),
      h('span', null, h('i', { class: 'cell cell-miss' }), 'Yapılmadı'),
      h('span', null, h('i', { class: 'cell cell-out' }), 'Sayılmıyor')),
    readout);
}

function viewHabit(id, today) {
  const habit = store.habits.find((item) => item.id === id);
  if (!habit) {
    return h('div', { class: 'page' }, emptyState(
      'Alışkanlık bulunamadı',
      'Silinmiş olabilir.',
      h('a', { class: 'btn btn-primary', href: '#/ilerleme' }, 'İlerlemeye dön'),
    ));
  }
  const done = doneSet(habit);
  const stats = habitStats(habit, done, today);
  const notStarted = habit.startDate > today;

  return h('div', { class: 'page', style: habitVars(habit.color) },
    h('a', { class: 'back', href: '#/ilerleme' }, icon('left', 18), 'İlerleme'),
    h('header', { class: 'habit-head' },
      h('h1', { class: 'page-title' }, singleMark(displayColor(habit.color, activeTheme())), habit.name),
      habit.description && h('p', { class: 'muted' }, habit.description),
      h('p', { class: 'muted' }, `Başlangıç: ${formatLong(habit.startDate)}${habit.archived ? '. Arşivde.' : ''}`)),
    challengeSection(habit, today),
    notStarted
      ? (!habit.duration && emptyState('Henüz başlamadı', `Bu alışkanlık ${formatLong(habit.startDate)} tarihinde başlıyor.`, null))
      : [
        h('dl', { class: 'habit-facts' },
          h('div', null, h('dt', null, 'Mevcut seri'), h('dd', null, `${stats.currentStreak} gün`)),
          h('div', null, h('dt', null, 'En uzun seri'), h('dd', null, `${stats.longestStreak} gün`)),
          h('div', null, h('dt', null, 'Toplam'), h('dd', null, `${stats.totalDone} gün`))),
        h('table', { class: 'plain-table' },
          h('thead', null, h('tr', null,
            h('th', { scope: 'col' }, 'Dönem'),
            h('th', { scope: 'col' }, 'Yapılan'),
            h('th', { scope: 'col' }, 'Oran'))),
          h('tbody', null,
            statLine('Başlangıçtan beri', stats.overall),
            statLine('Son 7 gün', stats.last7),
            statLine('Son 30 gün', stats.last30),
            statLine('Son 365 gün', stats.last365))),
        heatmap(habit, today),
        measureSection(habit, today),
      ],
    h('div', { class: 'habit-actions' }, habitActions(habit)));
}

function challengeSection(habit, today) {
  const c = challengeStatus(habit, doneSet(habit), today);
  if (!c) return null;
  let summary;
  if (c.notStarted) summary = `${formatLong(habit.startDate)} tarihinde başlıyor. ${c.total} gün sürecek, son gün ${formatLong(c.end)}.`;
  else if (c.finished) summary = `Bitti. ${c.total} günün ${c.done} gününde yaptın, ${c.missed} gün kaçırdın.`;
  else summary = `Gün ${c.dayNumber} / ${c.total}. ${c.done} gün yapıldı, ${c.missed} gün kaçırıldı, ${c.left} gün kaldı.`;
  const label = { done: 'Yapıldı', miss: 'Yapılmadı', today: 'Bugün, henüz yapılmadı', future: 'Henüz gelmedi', out: 'Arşivde' };
  return h('section', { class: 'block' },
    h('h2', null, `${c.total} günlük tablo`),
    h('p', null, summary),
    h('div', { class: 'challenge', role: 'list' }, c.days.map((d) => h('button', {
      type: 'button',
      role: 'listitem',
      class: `challenge-day is-${d.state}`,
      disabled: d.state === 'future',
      'aria-label': `${d.n}. gün, ${formatLong(d.key)}: ${label[d.state]}`,
      title: `${formatLong(d.key)}: ${label[d.state]}`,
      onclick: () => {
        state.day = d.key;
        location.hash = '#/';
      },
    }, String(d.n)))),
    h('p', { class: 'field-note' }, 'Dolu kutu yapıldı, boş kutu yapılmadı demek. Bir güne dokunarak o günü düzeltebilirsin.'));
}

function habitActions(habit) {
  const hasWords = habit.mastery === 'words' || store.words.some((w) => w.habitId === habit.id);
  return [
    hasWords && h('a', { class: 'btn btn-quiet btn-small', href: `#/kelimeler/${habit.id}` }, icon('cards', 18), 'Kelime arşivi'),
    h('button', { type: 'button', class: 'btn btn-quiet btn-small', onclick: () => habitForm(habit) }, icon('edit', 18), 'Düzenle'),
    habit.archived
      ? h('button', {
        type: 'button', class: 'btn btn-quiet btn-small',
        onclick: () => { store.unarchiveHabit(habit.id); toast('Alışkanlık arşivden çıkarıldı.'); },
      }, icon('restore', 18), 'Arşivden çıkar')
      : h('button', {
        type: 'button', class: 'btn btn-quiet btn-small',
        onclick: () => { store.archiveHabit(habit.id); toast('Alışkanlık arşivlendi. Geçmişi korunuyor.'); },
      }, icon('archive', 18), 'Arşivle'),
    h('button', { type: 'button', class: 'btn btn-quiet btn-small btn-danger-text', onclick: () => askDelete(habit) }, icon('trash', 18), 'Sil'),
  ];
}

// Alışkanlık yönetimi

function manageSheet(habit) {
  const close = (action) => () => { dialog.close(); action(); };
  const dialog = openDialog(h('div', { class: 'sheet-body' },
    h('h2', null, habit.name),
    h('div', { class: 'sheet-list' },
      h('button', { type: 'button', class: 'btn btn-quiet', onclick: close(() => habitForm(habit)) }, icon('edit', 20), 'Düzenle'),
      habit.archived
        ? h('button', {
          type: 'button', class: 'btn btn-quiet',
          onclick: close(() => { store.unarchiveHabit(habit.id); toast('Alışkanlık arşivden çıkarıldı.'); }),
        }, icon('restore', 20), 'Arşivden çıkar')
        : h('button', {
          type: 'button', class: 'btn btn-quiet',
          onclick: close(() => { store.archiveHabit(habit.id); toast('Alışkanlık arşivlendi. Geçmişi korunuyor.'); }),
        }, icon('archive', 20), 'Arşivle'),
      h('button', { type: 'button', class: 'btn btn-quiet btn-danger-text', onclick: close(() => askDelete(habit)) }, icon('trash', 20), 'Sil')),
    h('div', { class: 'sheet-actions' },
      h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => dialog.close() }, 'Kapat'))));
}

function manageRow(habit, today) {
  const count = habitStats(habit, doneSet(habit), today).totalDone;
  return h('div', { class: 'manage-row' },
    singleMark(displayColor(habit.color, activeTheme())),
    h('a', { class: 'manage-text', href: `#/aliskanlik/${habit.id}` },
      h('strong', null, habit.name),
      h('span', null, habit.startDate > today
        ? `${formatLong(habit.startDate)} tarihinde başlıyor`
        : `${count} gün tamamlandı${habit.duration ? `, ${habit.duration} günlük` : ''}`)),
    h('button', {
      type: 'button', class: 'icon-btn', 'aria-label': `${habit.name} seçenekleri`,
      dataset: { fk: `manage-${habit.id}` }, onclick: () => manageSheet(habit),
    }, icon('more', 22)));
}

function viewManage(today) {
  const active = store.habits.filter((habit) => !habit.archived && !isFinished(habit, today));
  const finished = store.habits.filter((habit) => !habit.archived && isFinished(habit, today));
  const archived = store.habits.filter((habit) => habit.archived);
  return h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('h1', { class: 'page-title' }, 'Alışkanlıklar'),
      store.habits.length > 0 && addButton('Ekle')),
    store.habits.length === 0
      ? emptyState('Liste boş', 'Takip etmek istediğin ilk alışkanlığı ekleyerek başla.', addButton('İlk alışkanlığını ekle'))
      : [
        active.length > 0
          ? h('section', { class: 'manage-list' }, active.map((habit) => manageRow(habit, today)))
          : h('p', { class: 'muted' }, 'Etkin alışkanlık yok.'),
        finished.length > 0 && h('section', { class: 'block' },
          h('h2', null, 'Süresi bitenler'),
          h('p', { class: 'muted' }, 'Süreyi uzatmak için Düzenle\'ye girip gün sayısını değiştir ya da sil.'),
          h('div', { class: 'manage-list' }, finished.map((habit) => manageRow(habit, today)))),
        archived.length > 0 && h('section', { class: 'block' },
          h('h2', null, 'Arşiv'),
          h('p', { class: 'muted' }, 'Arşivdeki alışkanlıklar günlük listede görünmez, geçmişleri korunur.'),
          h('div', { class: 'manage-list' }, archived.map((habit) => manageRow(habit, today)))),
      ]);
}

// Uzmanlık

function masteryCard(habit, today) {
  const m = masteryStatus(habit, doneSet(habit), store.values.get(habit.id), today);
  const unit = m.kind.goalUnit;
  let pace;
  if (m.daysLeft === 0) pace = `${m.kind.name} hedefine ulaştın.`;
  else if (m.perDay > 0) {
    pace = `Son 30 günde günde ortalama ${formatWithUnit(m.perDay, m.kind)}. Bu hızla hedefe yaklaşık ${formatSpan(m.daysLeft)} kaldı.`;
  } else pace = 'Son 30 günde kayıt yok, bu yüzden kalan süre hesaplanamıyor.';
  const status = [];
  if (habit.archived) status.push('Arşivde.');
  else if (isFinished(habit, today)) status.push('Süresi bitti.');
  return h('article', { class: 'book', style: habitVars(habit.color) },
    h('div', { class: 'book-head' },
      h('a', { class: 'book-name', href: `#/aliskanlik/${habit.id}` },
        h('strong', null, habit.name),
        h('span', { class: 'muted' }, `Hedef: ${m.kind.name}${status.length ? `. ${status.join(' ')}` : ''}`))),
    h('p', { class: 'book-progress' },
      h('span', null, `${formatAmount(m.current)} / ${formatAmount(m.target)} ${unit}`),
      h('strong', null, formatPercent(m.percent))),
    h('div', { class: 'meter-track', 'aria-hidden': 'true' },
      h('span', { class: 'meter-fill mastery-fill', style: { width: `${Math.max(m.percent, m.current > 0 ? 0.6 : 0)}%` } })),
    h('ul', { class: 'plain-list mastery-lines' },
      h('li', null, `${m.days} gün çalıştın. Bu ay ${formatWithUnit(m.month, m.kind)}.`),
      h('li', null, pace)),
    habit.mastery === 'words' && wordButtons(habit));
}

function wordButtons(habit) {
  const total = store.words.filter((w) => w.habitId === habit.id).length;
  return h('div', { class: 'button-row word-buttons' },
    h('a', { class: 'btn btn-quiet btn-small', href: `#/kelimeler/${habit.id}` }, icon('cards', 18), `Kelime arşivi (${total})`),
    total > 0 && h('a', { class: 'btn btn-quiet btn-small', href: `#/calis/${habit.id}` }, 'Çalış'));
}

function viewMastery(today) {
  const list = store.habits.filter((habit) => habit.mastery)
    .sort((a, b) => Number(a.archived) - Number(b.archived));
  return h('div', { class: 'page' },
    h('h1', { class: 'page-title' }, 'Uzmanlık'),
    list.length === 0
      ? emptyState(
        'Henüz uzmanlık takibi yok',
        'Bir alışkanlığı düzenleyip "Uzmanlık takibi" alanından 10.000 saat ya da 5.000 kelime seç. Bugün ekranında işaretledikçe burada birikir.',
        h('a', { class: 'btn btn-primary', href: '#/aliskanliklar' }, 'Alışkanlıklara git'),
      )
      : [
        h('p', { class: 'muted' }, 'Bugün ekranında işaretlediğin günler buraya eklenir. Kutuya sayı yazdıysan o sayı, yazmadıysan alışkanlıktaki günlük sayı sayılır.'),
        h('div', { class: 'books' }, list.map((habit) => masteryCard(habit, today))),
      ]);
}

// Kelime arşivi

const WORD_PAGE = 50;
const STUDY_SIZE = 20;
const canSpeak = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance === 'function';

const wordsOf = (habitId) => sortWords(store.words.filter((w) => w.habitId === habitId));

function speak(text) {
  try {
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  } catch {
    toast('Sesli okuma bu tarayıcıda çalışmadı.');
  }
}

function speakButton(text, size = 20) {
  if (!canSpeak) return null;
  return h('button', {
    type: 'button', class: 'icon-btn speak-btn', 'aria-label': `${text} sesli oku`, title: 'Sesli oku',
    onclick: (event) => {
      event.stopPropagation();
      speak(text);
    },
  }, icon('sound', size));
}

function wordDayLabel(key, today) {
  if (key === today) return 'Bugün';
  if (key === addDays(today, -1)) return 'Dün';
  const year = parseKey(key).y === parseKey(today).y ? '' : ` ${parseKey(key).y}`;
  return `${formatDayMonth(key)}${year}, ${weekdayName(key)}`;
}

function wordInputs(prefix, values) {
  const make = (name, max, placeholder, extra) => h('input', {
    id: `${prefix}-${name}`, type: 'text', maxlength: max, autocomplete: 'off', value: values[name] || '', placeholder,
    dataset: { fk: `${prefix}-${name}` }, ...extra,
  });
  return {
    word: make('word', MAX_WORD, 'Örneğin: improve', {
      autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'next',
    }),
    meaning: make('meaning', MAX_MEANING, 'Örneğin: geliştirmek', { autocapitalize: 'off', enterkeyhint: 'done' }),
    example: make('example', MAX_EXAMPLE, 'Örneğin: I want to improve my English.', { spellcheck: 'false', enterkeyhint: 'done' }),
  };
}

function wordFields(inputs) {
  return [
    h('label', { class: 'field', for: inputs.word.id }, h('span', null, 'Kelime'), inputs.word),
    h('label', { class: 'field', for: inputs.meaning.id }, h('span', null, 'Anlamı'), inputs.meaning),
    h('label', { class: 'field', for: inputs.example.id }, h('span', null, 'Örnek cümle (isteğe bağlı)'), inputs.example),
  ];
}

function readWord(inputs, list, exceptId = null) {
  const word = cleanText(inputs.word.value, MAX_WORD);
  const meaning = cleanText(inputs.meaning.value, MAX_MEANING);
  const example = cleanText(inputs.example.value, MAX_EXAMPLE);
  if (!word) return { error: 'Kelimeyi yaz.', field: inputs.word };
  if (!meaning) return { error: 'Anlamını da yaz. Çalışırken kartın arkasında görünür.', field: inputs.meaning };
  const same = findDuplicate(list, word, exceptId);
  if (same) return { error: `"${same.word}" zaten arşivde. ${formatDayMonth(same.date)} tarihinde eklemişsin.`, field: inputs.word };
  return { fields: { word, meaning, example } };
}

// Kelime yazınca Enter anlam kutusuna geçer, anlamda Enter kaydeder.
function nextOnEnter(inputs) {
  inputs.word.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing || inputs.meaning.value.trim()) return;
    event.preventDefault();
    inputs.meaning.focus();
  });
}

function wordAddForm(habit, list) {
  const inputs = wordInputs('new', state.wordDraft);
  const error = h('p', { class: 'field-error', role: 'alert', hidden: true });
  Object.entries(inputs).forEach(([name, input]) => input.addEventListener('input', () => {
    state.wordDraft[name] = input.value;
    error.hidden = true;
  }));
  nextOnEnter(inputs);
  const submit = (event) => {
    event.preventDefault();
    const result = readWord(inputs, list);
    if (result.error) {
      error.textContent = result.error;
      error.hidden = false;
      result.field.focus();
      return;
    }
    // Ekran kayıttan hemen sonra yenilenebilir; kutular ve imleç önce hazırlanır.
    state.wordDraft = { word: '', meaning: '', example: '' };
    Object.values(inputs).forEach((input) => { input.value = ''; });
    inputs.word.focus();
    store.addWord(habit.id, result.fields);
    toast(`"${result.fields.word}" kaydedildi.`);
  };
  return h('form', { class: 'word-form', onsubmit: submit, novalidate: true },
    h('h2', null, 'Yeni kelime'),
    error,
    wordFields(inputs),
    h('button', { type: 'submit', class: 'btn btn-primary' }, icon('plus', 20), 'Kaydet'));
}

function wordEditForm(item) {
  const inputs = wordInputs('edit', item);
  const error = h('p', { class: 'field-error', role: 'alert', hidden: true });
  nextOnEnter(inputs);
  const submit = (event) => {
    event.preventDefault();
    const result = readWord(inputs, wordsOf(item.habitId), item.id);
    if (result.error) {
      error.textContent = result.error;
      error.hidden = false;
      result.field.focus();
      return;
    }
    store.updateWord(item, result.fields);
    toast('Değişiklikler kaydedildi.');
    dialog.close();
  };
  const dialog = openDialog(h('form', { class: 'sheet-body', onsubmit: submit, novalidate: true },
    h('h2', null, 'Kelimeyi düzenle'),
    error,
    wordFields(inputs),
    h('div', { class: 'sheet-actions' },
      h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => dialog.close() }, 'Vazgeç'),
      h('button', { type: 'submit', class: 'btn btn-primary' }, 'Kaydet'))));
  inputs.word.focus();
}

async function askDeleteWord(item) {
  const ok = await confirmDialog({
    title: 'Kelime silinsin mi?',
    body: `"${item.word}" arşivden kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
    confirmLabel: 'Kalıcı olarak sil',
    danger: true,
  });
  if (!ok) return;
  store.deleteWord(item);
  toast('Kelime silindi.');
}

function toggleLearned(item) {
  store.setLearned([item], !item.learned);
  toast(item.learned ? 'Kelime yeniden çalışılacaklara alındı.' : 'Öğrendim olarak işaretlendi.');
}

function wordSheet(item) {
  const close = (action) => () => { dialog.close(); action(); };
  const dialog = openDialog(h('div', { class: 'sheet-body' },
    h('div', { class: 'word-sheet-head' }, h('h2', null, item.word), speakButton(item.word, 22)),
    h('p', null, item.meaning),
    item.example && h('p', { class: 'word-example' }, item.example),
    h('p', { class: 'field-note' }, `${formatLong(item.date)} tarihinde eklendi.${item.learned ? ' Öğrendim olarak işaretli.' : ''}`),
    h('div', { class: 'sheet-list' },
      h('button', { type: 'button', class: 'btn btn-quiet', onclick: close(() => wordEditForm(item)) }, icon('edit', 20), 'Düzenle'),
      h('button', { type: 'button', class: 'btn btn-quiet', onclick: close(() => toggleLearned(item)) },
        icon(item.learned ? 'restore' : 'check', 20), item.learned ? 'Yeniden öğreniyorum' : 'Öğrendim'),
      h('button', { type: 'button', class: 'btn btn-quiet btn-danger-text', onclick: close(() => askDeleteWord(item)) }, icon('trash', 20), 'Sil')),
    h('div', { class: 'sheet-actions' },
      h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => dialog.close() }, 'Kapat'))));
}

function wordRow(item) {
  return h('div', { class: `word-row${item.learned ? ' is-learned' : ''}` },
    h('button', {
      type: 'button', class: 'word-main', dataset: { fk: `w-${item.id}` }, onclick: () => wordSheet(item),
    },
    h('span', { class: 'word-text' }, item.word),
    h('span', { class: 'word-meaning' }, item.meaning),
    item.example && h('span', { class: 'word-example' }, item.example)),
    item.learned && h('span', { class: 'word-learned', title: 'Öğrendin' }, icon('check', 18), h('span', { class: 'sr-only' }, 'Öğrendin')),
    speakButton(item.word));
}

function missingHabit(title) {
  return h('div', { class: 'page' }, emptyState(title, 'Alışkanlık silinmiş olabilir.',
    h('a', { class: 'btn btn-primary', href: '#/uzmanlik' }, 'Uzmanlığa dön')));
}

function viewWords(id, today) {
  const habit = store.habits.find((item) => item.id === id);
  if (!habit) return missingHabit('Kelime arşivi bulunamadı');
  const all = wordsOf(id);
  const counts = wordCounts(all, today);
  const list = filterWords(all, { query: state.wordQuery, status: state.wordStatus });
  const shown = list.slice(0, state.wordLimit);
  const search = h('input', {
    type: 'search', class: 'word-search', placeholder: 'Kelimelerde ara', 'aria-label': 'Kelimelerde ara',
    autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', value: state.wordQuery, dataset: { fk: 'word-search' },
    oninput: (event) => {
      state.wordQuery = event.target.value;
      state.wordLimit = WORD_PAGE;
      render();
    },
  });
  const statusOption = (value, label) => h('button', {
    type: 'button', 'aria-pressed': String(state.wordStatus === value), dataset: { fk: `ws-${value}` },
    onclick: () => {
      state.wordStatus = value;
      state.wordLimit = WORD_PAGE;
      render();
    },
  }, label);
  let summary = 'Gün içinde öğrendiğin kelimeleri buraya yaz. Sonra "Çalış" ile kartlarla tekrar edersin.';
  if (counts.total > 0) {
    summary = `${counts.total} kelime. Bugün ${counts.today}, son 7 günde ${counts.week} kelime ekledin.`;
    if (counts.learned > 0) summary += ` ${counts.learned} kelimeyi öğrendin.`;
  }

  return h('div', { class: 'page', style: habitVars(habit.color) },
    h('a', { class: 'back', href: '#/uzmanlik' }, icon('left', 18), 'Uzmanlık'),
    h('div', { class: 'page-head' },
      h('div', { class: 'page-heading' },
        h('h1', { class: 'page-title' }, 'Kelime arşivi'),
        h('p', { class: 'muted' }, habit.name)),
      counts.total > 0 && h('a', { class: 'btn btn-primary', href: `#/calis/${habit.id}` }, icon('cards', 20), 'Çalış')),
    h('p', { class: 'word-summary' }, summary),
    wordAddForm(habit, all),
    counts.total > 0 && h('section', { class: 'block' },
      h('h2', null, 'Kelimelerim'),
      h('div', { class: 'word-tools' },
        search,
        h('div', { class: 'segmented segmented-fill', role: 'group', 'aria-label': 'Hangi kelimeler' },
          statusOption('all', 'Tümü'), statusOption('learning', 'Öğreniyorum'), statusOption('learned', 'Öğrendim'))),
      list.length === 0
        ? h('p', { class: 'muted' }, state.wordQuery.trim() ? 'Bu aramayla eşleşen kelime yok.' : 'Bu listede kelime yok.')
        : groupByDay(shown).map((group) => h('div', { class: 'word-group' },
          h('h3', { class: 'word-day' }, `${wordDayLabel(group.date, today)} · ${group.items.length} kelime`),
          h('div', { class: 'word-list' }, group.items.map(wordRow)))),
      list.length > shown.length && h('button', {
        type: 'button', class: 'btn btn-quiet', dataset: { fk: 'word-more' },
        onclick: () => {
          state.wordLimit += WORD_PAGE;
          render();
        },
      }, `Daha fazla göster (${list.length - shown.length} kelime daha)`)));
}

// Çalışma: kartın önü gösterilir, kişi aklından cevaplar, sonra arkasına bakar.

function startStudy(habitId, ids, set) {
  const queue = shuffle(ids).slice(0, STUDY_SIZE);
  state.study = {
    habitId, set, front: state.studyFront, queue, pos: 0, revealed: false, first: {}, done: new Set(), total: queue.length, finished: false, marked: false,
  };
  render();
}

function studyReveal() {
  const s = state.study;
  if (!s || s.finished || s.revealed) return;
  s.revealed = true;
  render();
}

function studyAnswer(knew) {
  const s = state.study;
  if (!s || s.finished || !s.revealed) return;
  const id = s.queue[s.pos];
  if (!(id in s.first)) s.first[id] = knew;
  if (knew) s.done.add(id);
  else s.queue.push(id);
  s.pos += 1;
  s.revealed = false;
  if (s.pos >= s.queue.length) s.finished = true;
  render();
}

function studySetup(habit, all, today) {
  const pools = Object.fromEntries(STUDY_SETS.map((set) => [set.id, studyPool(all, set.id, today)]));
  if (!pools[state.studySet] || pools[state.studySet].length === 0) {
    state.studySet = (STUDY_SETS.find((set) => pools[set.id].length > 0) || STUDY_SETS[3]).id;
  }
  const pool = pools[state.studySet];
  const count = Math.min(pool.length, STUDY_SIZE);
  const frontOption = (value, label) => h('button', {
    type: 'button', 'aria-pressed': String(state.studyFront === value), dataset: { fk: `front-${value}` },
    onclick: () => {
      state.studyFront = value;
      render();
    },
  }, label);
  return h('div', { class: 'page', style: habitVars(habit.color) },
    h('a', { class: 'back', href: `#/kelimeler/${habit.id}` }, icon('left', 18), 'Kelime arşivi'),
    h('div', { class: 'page-heading' },
      h('h1', { class: 'page-title' }, 'Çalış'),
      h('p', { class: 'muted' }, habit.name)),
    all.length === 0
      ? emptyState('Çalışacak kelime yok', 'Önce arşive birkaç kelime ekle.',
        h('a', { class: 'btn btn-primary', href: `#/kelimeler/${habit.id}` }, 'Kelime ekle'))
      : [
        h('section', { class: 'block' },
          h('h2', null, 'Hangi kelimeler?'),
          h('div', { class: 'option-list', role: 'radiogroup', 'aria-label': 'Hangi kelimeler' },
            STUDY_SETS.map((set) => h('button', {
              type: 'button', role: 'radio', class: 'option', 'aria-checked': String(state.studySet === set.id),
              disabled: pools[set.id].length === 0, dataset: { fk: `set-${set.id}` },
              onclick: () => {
                state.studySet = set.id;
                render();
              },
            }, h('span', { class: 'option-dot', 'aria-hidden': 'true' }), h('span', { class: 'option-label' }, set.label),
            h('span', { class: 'option-count' }, String(pools[set.id].length)))))),
        h('section', { class: 'block' },
          h('h2', null, 'Kartın önünde ne yazsın?'),
          h('div', { class: 'segmented', role: 'group', 'aria-label': 'Kartın önü' },
            frontOption('word', 'Kelime'), frontOption('meaning', 'Anlamı'))),
        h('div', { class: 'block' },
          h('button', {
            type: 'button', class: 'btn btn-primary btn-large', dataset: { fk: 'study-start' },
            onclick: () => startStudy(habit.id, pool.map((w) => w.id), state.studySet),
          }, `Başla (${count} kelime)`),
          h('p', { class: 'field-note' }, `Kelimeler karışık sırayla gelir, bir seferde en fazla ${STUDY_SIZE} kelime. Bilemediğin kelime sonra yeniden sorulur.`)),
      ]);
}

function studyCard(habit, item, s) {
  const front = s.front === 'meaning' ? item.meaning : item.word;
  const back = s.front === 'meaning' ? item.word : item.meaning;
  const percent = s.total ? (s.done.size / s.total) * 100 : 0;
  return h('div', { class: 'page study', style: habitVars(habit.color) },
    h('div', { class: 'study-top' },
      h('a', { class: 'back', href: `#/kelimeler/${habit.id}` }, icon('left', 18), 'Kelime arşivi'),
      h('span', { class: 'study-count' }, `${s.done.size} / ${s.total}`),
      h('button', {
        type: 'button', class: 'link-btn', dataset: { fk: 'study-stop' },
        onclick: () => {
          s.finished = true;
          render();
        },
      }, 'Bitir')),
    h('div', { class: 'meter-track', 'aria-hidden': 'true' }, h('span', { class: 'meter-fill mastery-fill', style: { width: `${percent}%` } })),
    h('section', { class: 'study-card', 'aria-live': 'polite' },
      h('p', { class: 'study-front' }, front),
      s.front === 'word' && speakButton(item.word, 26),
      s.revealed && h('div', { class: 'study-back' },
        h('p', { class: 'study-answer' }, back),
        s.front === 'meaning' && speakButton(item.word, 24),
        item.example && h('p', { class: 'word-example' }, item.example))),
    s.revealed
      ? h('div', { class: 'study-actions' },
        h('button', { type: 'button', class: 'btn btn-quiet btn-large', onclick: () => studyAnswer(false) }, 'Bilemedim'),
        h('button', { type: 'button', class: 'btn btn-primary btn-large', onclick: () => studyAnswer(true) }, 'Bildim'))
      : h('button', { type: 'button', class: 'btn btn-primary btn-large study-reveal', onclick: studyReveal },
        s.front === 'meaning' ? 'Kelimeyi göster' : 'Anlamını göster'),
    h('p', { class: 'study-keys' }, 'Klavyeyle: boşluk göster, → bildim, ← bilemedim.'));
}

function studyResult(habit, byId, s) {
  const answered = Object.keys(s.first).filter((id) => byId.has(id));
  const right = answered.filter((id) => s.first[id]).map((id) => byId.get(id));
  const missed = answered.filter((id) => !s.first[id]).map((id) => byId.get(id));
  const toMark = right.filter((w) => !w.learned);
  let text = 'Hiç kelime cevaplamadın.';
  if (answered.length > 0) {
    text = `${answered.length} kelimeden ${right.length} tanesini ilk seferde bildin.`;
    if (missed.length > 0) text += ` ${missed.length} kelimeyi tekrar ederek çalıştın.`;
  }
  return h('div', { class: 'page', style: habitVars(habit.color) },
    h('a', { class: 'back', href: `#/kelimeler/${habit.id}` }, icon('left', 18), 'Kelime arşivi'),
    h('h1', { class: 'page-title' }, 'Çalışma bitti'),
    h('p', { class: 'study-result' }, text),
    toMark.length > 0 && !s.marked && h('section', { class: 'block' },
      h('p', { class: 'muted' }, 'İlk seferde bildiğin kelimeleri "öğrendim" yaparsan "Öğreniyorum" çalışmasında artık sorulmaz. Arşivden istediğin zaman geri alabilirsin.'),
      h('button', {
        type: 'button', class: 'btn btn-quiet', dataset: { fk: 'study-mark' },
        onclick: () => {
          store.setLearned(toMark, true);
          s.marked = true;
          toast(`${toMark.length} kelime öğrendim olarak işaretlendi.`);
          render();
        },
      }, icon('check', 20), `Bildiğim ${toMark.length} kelimeyi öğrendim yap`)),
    missed.length > 0 && h('section', { class: 'block' },
      h('h2', null, 'Bilemediklerin'),
      h('div', { class: 'word-list' }, missed.map(wordRow))),
    h('div', { class: 'button-row' },
      missed.length > 0 && h('button', {
        type: 'button', class: 'btn btn-primary', dataset: { fk: 'study-missed' },
        onclick: () => startStudy(habit.id, missed.map((w) => w.id), s.set),
      }, 'Bilemediklerimi çalış'),
      h('button', {
        type: 'button', class: 'btn btn-quiet', dataset: { fk: 'study-new' },
        onclick: () => {
          state.study = null;
          render();
        },
      }, 'Yeni çalışma'),
      h('a', { class: 'btn btn-quiet', href: `#/kelimeler/${habit.id}` }, 'Arşive dön')));
}

function viewStudy(id, today) {
  const habit = store.habits.find((item) => item.id === id);
  if (!habit) return missingHabit('Çalışma bulunamadı');
  const all = wordsOf(id);
  const s = state.study && state.study.habitId === id ? state.study : null;
  if (!s) return studySetup(habit, all, today);
  const byId = new Map(all.map((w) => [w.id, w]));
  // Çalışırken silinen kelimeler atlanır.
  while (!s.finished && s.pos < s.queue.length && !byId.has(s.queue[s.pos])) {
    s.done.add(s.queue[s.pos]);
    s.pos += 1;
  }
  if (s.pos >= s.queue.length) s.finished = true;
  if (s.finished) return studyResult(habit, byId, s);
  return studyCard(habit, byId.get(s.queue[s.pos]), s);
}

document.addEventListener('keydown', (event) => {
  const s = state.study;
  if (!s || s.finished || !route().startsWith('calis/') || document.querySelector('dialog[open]')) return;
  if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
  const onControl = event.target?.closest?.('button, a, input, textarea, select');
  if (event.key === ' ' && !onControl && !s.revealed) {
    event.preventDefault();
    studyReveal();
  } else if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && s.revealed && !event.target.closest?.('input, textarea, select')) {
    event.preventDefault();
    studyAnswer(event.key === 'ArrowRight');
  }
});

// Kitaplar

function bookForm(book = null) {
  const isEdit = Boolean(book);
  const error = h('p', { class: 'field-error', role: 'alert', hidden: true });
  const title = h('input', {
    id: 'book-title', type: 'text', maxlength: 120, autocomplete: 'off', value: book?.title || '', placeholder: 'Örneğin: Atomik Alışkanlıklar',
  });
  const author = h('input', {
    id: 'book-author', type: 'text', maxlength: 80, autocomplete: 'off', value: book?.author || '', placeholder: 'Örneğin: James Clear',
  });
  const total = h('input', {
    id: 'book-total', type: 'text', inputmode: 'numeric', autocomplete: 'off', value: book?.totalPages ? String(book.totalPages) : '', placeholder: 'Örneğin: 320',
  });
  const page = h('input', {
    id: 'book-page', type: 'text', inputmode: 'numeric', autocomplete: 'off', placeholder: 'Yeni başlıyorsan boş bırak',
  });

  const submit = (event) => {
    event.preventDefault();
    const fail = (message, field) => {
      error.textContent = message;
      error.hidden = false;
      field.focus();
    };
    const cleanTitle = title.value.trim();
    if (!cleanTitle) return fail('Kitabın adını yaz.', title);
    const parsedTotal = parsePageNumber(total.value);
    if (!parsedTotal.ok || parsedTotal.value === 0) return fail('Sayfa sayısı 0\'dan büyük bir tam sayı olmalı.', total);
    const parsedPage = isEdit ? { ok: true, value: null } : parsePageNumber(page.value);
    if (!parsedPage.ok) return fail('Sayfa numarası bir tam sayı olmalı.', page);
    if (parsedTotal.value && parsedPage.value && parsedPage.value > parsedTotal.value) {
      return fail(`Bu kitap ${parsedTotal.value} sayfa.`, page);
    }
    const fields = { title: cleanTitle, author: author.value.trim(), totalPages: parsedTotal.value };
    if (isEdit) {
      store.updateBook(book.id, fields);
      toast('Değişiklikler kaydedildi.');
    } else {
      store.addBook({ ...fields, page: parsedPage.value });
      toast('Kitap eklendi.');
    }
    dialog.close();
    return undefined;
  };

  const dialog = openDialog(h('form', { class: 'sheet-body', onsubmit: submit, novalidate: true },
    h('h2', null, isEdit ? 'Kitabı düzenle' : 'Yeni kitap'),
    error,
    h('label', { class: 'field', for: 'book-title' }, h('span', null, 'Kitabın adı'), title),
    h('label', { class: 'field', for: 'book-author' }, h('span', null, 'Yazar (isteğe bağlı)'), author),
    h('label', { class: 'field', for: 'book-total' }, h('span', null, 'Toplam sayfa (isteğe bağlı)'), total),
    !isEdit && h('label', { class: 'field', for: 'book-page' }, h('span', null, 'Şu an kaçıncı sayfadasın?'), page),
    h('div', { class: 'sheet-actions' },
      h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => dialog.close() }, 'Vazgeç'),
      h('button', { type: 'submit', class: 'btn btn-primary' }, isEdit ? 'Kaydet' : 'Ekle'))));
  title.focus();
}

async function askDeleteBook(book) {
  const ok = await confirmDialog({
    title: 'Kitap silinsin mi?',
    body: `"${book.title}" ve sayfa kayıtları kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
    confirmLabel: 'Kalıcı olarak sil',
    danger: true,
  });
  if (!ok) return;
  store.deleteBook(book.id);
  toast('Kitap silindi.');
}

function finishBook(book) {
  const today = todayKey();
  const fields = { status: 'done', finishedAt: today };
  store.updateBook(book.id, fields);
  if (book.totalPages && bookProgress(book, today).page < book.totalPages) store.setBookPage(book.id, book.totalPages);
  toast('Kitap bitirdiklerine taşındı.');
}

function bookSheet(book) {
  const close = (action) => () => { dialog.close(); action(); };
  const dialog = openDialog(h('div', { class: 'sheet-body' },
    h('h2', null, book.title),
    h('div', { class: 'sheet-list' },
      h('button', { type: 'button', class: 'btn btn-quiet', onclick: close(() => bookForm(book)) }, icon('edit', 20), 'Düzenle'),
      book.status === 'reading'
        ? h('button', { type: 'button', class: 'btn btn-quiet', onclick: close(() => finishBook(book)) }, icon('check', 20), 'Bitirdim')
        : h('button', {
          type: 'button', class: 'btn btn-quiet',
          onclick: close(() => {
            store.updateBook(book.id, { status: 'reading', finishedAt: null });
            toast('Kitap okuduklarına geri alındı.');
          }),
        }, icon('restore', 20), 'Okumaya devam et'),
      h('button', { type: 'button', class: 'btn btn-quiet btn-danger-text', onclick: close(() => askDeleteBook(book)) }, icon('trash', 20), 'Sil')),
    h('div', { class: 'sheet-actions' },
      h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => dialog.close() }, 'Kapat'))));
}

function lastEntryText(key, today) {
  if (!key) return 'Henüz sayfa girilmedi.';
  if (key === today) return 'Son kayıt: bugün.';
  if (key === addDays(today, -1)) return 'Son kayıt: dün.';
  return `Son kayıt: ${formatDayMonth(key)}.`;
}

function bookCard(book, today) {
  const p = bookProgress(book, today);
  const input = h('input', {
    id: `page-${book.id}`, type: 'text', inputmode: 'numeric', autocomplete: 'off', enterkeyhint: 'done',
    class: 'page-input', placeholder: String(p.page || ''), dataset: { fk: `page-${book.id}`, draft: '1' },
  });
  const save = (event) => {
    event.preventDefault();
    const parsed = parsePageNumber(input.value);
    if (!parsed.ok || parsed.value === null) {
      toast('Geçerli bir sayfa numarası yaz.', 'error');
      input.focus();
      return;
    }
    if (book.totalPages && parsed.value > book.totalPages) {
      toast(`Bu kitap ${book.totalPages} sayfa.`, 'error');
      input.focus();
      return;
    }
    input.value = '';
    store.setBookPage(book.id, parsed.value);
    if (book.totalPages && parsed.value === book.totalPages) {
      store.updateBook(book.id, { status: 'done', finishedAt: todayKey() });
      toast('Kitabı bitirdin. Bitirdiklerin listesine taşındı.');
    } else {
      toast(`${parsed.value}. sayfa kaydedildi.`);
    }
  };
  return h('article', { class: 'book' },
    h('div', { class: 'book-head' },
      h('div', { class: 'book-name' },
        h('strong', null, book.title),
        book.author && h('span', { class: 'muted' }, book.author)),
      h('button', {
        type: 'button', class: 'icon-btn', 'aria-label': `${book.title} seçenekleri`,
        dataset: { fk: `book-${book.id}` }, onclick: () => bookSheet(book),
      }, icon('more', 22))),
    h('p', { class: 'book-progress' },
      h('span', null, book.totalPages ? `Sayfa ${p.page} / ${book.totalPages}` : `Sayfa ${p.page}`),
      p.percent !== null && h('strong', null, `%${Math.floor(p.percent)}`)),
    p.percent !== null && h('div', { class: 'meter-track', 'aria-hidden': 'true' },
      h('span', { class: 'meter-fill', style: { width: `${p.percent}%` } })),
    h('p', { class: 'muted book-note' },
      lastEntryText(p.lastKey, today),
      p.lastWeek !== null && ` Son 7 günde ${p.lastWeek} sayfa ilerledin.`),
    h('form', { class: 'page-form', onsubmit: save },
      h('label', { for: `page-${book.id}` }, 'Kaçıncı sayfadasın?'),
      input,
      h('button', { type: 'submit', class: 'btn btn-primary btn-small' }, 'Kaydet')));
}

function finishedRow(book, today) {
  const p = bookProgress(book, today);
  const parts = [];
  if (book.finishedAt) parts.push(`Bitiş: ${formatLong(book.finishedAt)}.`);
  if (p.days) parts.push(`${p.days} günde okudun.`);
  return h('div', { class: 'manage-row book-done' },
    icon('check', 20),
    h('div', { class: 'manage-text' },
      h('strong', null, book.title),
      book.author && h('span', null, book.author),
      parts.length > 0 && h('span', null, parts.join(' '))),
    h('button', {
      type: 'button', class: 'icon-btn', 'aria-label': `${book.title} seçenekleri`,
      dataset: { fk: `book-${book.id}` }, onclick: () => bookSheet(book),
    }, icon('more', 22)));
}

function viewBooks(today) {
  const { reading, finished } = sortBooks(store.books);
  const addBook = (label) => h('button', { type: 'button', class: 'btn btn-primary', onclick: () => bookForm() }, icon('plus', 20), label);
  return h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('h1', { class: 'page-title' }, 'Kitaplar'),
      store.books.length > 0 && addBook('Ekle')),
    store.books.length === 0
      ? emptyState('Henüz kitap yok', 'Okuduğun kitabı ekle. Her gün kaçıncı sayfada olduğunu yazarsın, burada ilerlemen görünür.', addBook('Kitap ekle'))
      : [
        h('section', { class: 'block' },
          h('h2', null, 'Okuduklarım'),
          reading.length > 0
            ? h('div', { class: 'books' }, reading.map((book) => bookCard(book, today)))
            : h('p', { class: 'muted' }, 'Şu an okuduğun kitap yok.')),
        finished.length > 0 && h('section', { class: 'block' },
          h('h2', null, `Bitirdiklerim (${finished.length})`),
          h('div', { class: 'manage-list' }, finished.map((book) => finishedRow(book, today)))),
      ]);
}

// Ayarlar

function downloadBackup(prefix = 'cetele-yedek') {
  store.flush();
  const data = createBackup(store.habits, store.done, new Date(), store.values, store.books, store.words);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: `${prefix}-${todayKey()}.json` });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function runRestore(backup, mode) {
  if (!navigator.onLine) {
    toast('Geri yükleme için internet bağlantısı gerekli.', 'error');
    return;
  }
  const ops = planRestore(store.habits, store.logs, backup, mode, store.books, store.words);
  if (countOps(ops) === 0) {
    toast('Yedek zaten mevcut verilerle aynı. Yazma yapılmadı.');
    return;
  }
  const busy = openDialog(h('div', { class: 'sheet-body', role: 'status' },
    h('p', null, 'Yedek geri yükleniyor…')));
  busy.addEventListener('cancel', (event) => event.preventDefault());
  try {
    const finished = store.applyRestore(ops).then(() => true);
    const timeout = new Promise((resolve) => { setTimeout(() => resolve(false), 30000); });
    const inTime = await Promise.race([finished, timeout]);
    toast(inTime ? 'Yedek geri yüklendi.' : 'Bağlantı yavaş. Değişiklikler arka planda gönderiliyor.');
    finished.catch((error) => toast(errorMessage(error), 'error'));
  } catch (error) {
    console.error(error);
    toast(`Yedek geri yüklenemedi. ${errorMessage(error)}`, 'error');
  } finally {
    busy.close();
  }
}

async function handleFile(file) {
  if (file.size > MAX_BACKUP_BYTES) {
    toast('Dosya çok büyük. En fazla 10 MB olabilir.', 'error');
    return;
  }
  let backup;
  try {
    backup = parseBackup(await file.text(), todayKey());
  } catch (error) {
    const message = error instanceof BackupError ? error.message : 'Dosya okunamadı.';
    toast(message, 'error');
    return;
  }

  const records = backup.habits.reduce((sum, habit) => sum + habit.completions.length, 0);
  const date = backup.exportedAt ? new Date(backup.exportedAt) : null;
  const dateText = date && !Number.isNaN(date.getTime()) ? formatLong(todayKey(date)) : 'bilinmiyor';

  const dialog = openDialog(h('div', { class: 'sheet-body' },
    h('h2', null, 'Yedeği geri yükle'),
    h('p', null, `Yedek tarihi: ${dateText}. İçinde ${backup.habits.length} alışkanlık, ${records} günlük kayıt, ${backup.books.length} kitap ve ${backup.words.length} kelime var.`),
    backup.skippedFuture > 0 && h('p', { class: 'field-note' }, `Gelecek tarihli ${backup.skippedFuture} kayıt atlanacak.`),
    h('div', { class: 'choice' },
      h('button', {
        type: 'button', class: 'btn btn-primary',
        onclick: () => { dialog.close(); runRestore(backup, 'merge'); },
      }, 'Mevcut verilerle birleştir'),
      h('p', { class: 'muted' }, 'Yedekteki bilgiler geri gelir, mevcut hiçbir kayıt silinmez.')),
    h('div', { class: 'choice' },
      h('button', {
        type: 'button', class: 'btn btn-danger-outline',
        onclick: async () => {
          dialog.close();
          const ok = await confirmDialog({
            title: 'Mevcut veriler değiştirilsin mi?',
            body: 'Yedekte olmayan alışkanlık ve kayıtlar silinir. Önce şu anki verilerin ayrı bir dosya olarak indirilir.',
            confirmLabel: 'Yedekle değiştir',
            danger: true,
          });
          if (!ok) return;
          downloadBackup('cetele-degisiklik-oncesi');
          runRestore(backup, 'replace');
        },
      }, 'Mevcut verileri yedekle değiştir'),
      h('p', { class: 'muted' }, 'Hesabın, tam olarak yedekteki duruma döner.')),
    h('div', { class: 'sheet-actions' },
      h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => dialog.close() }, 'Vazgeç'))));
}

function viewSettings() {
  const current = savedTheme() || 'system';
  const themeOption = (value, label) => h('button', {
    type: 'button', 'aria-pressed': String(current === value), dataset: { fk: `theme-${value}` },
    onclick: () => setTheme(value),
  }, label);
  const fileInput = h('input', {
    type: 'file', accept: 'application/json,.json', hidden: true,
    onchange: (event) => {
      const [file] = event.target.files;
      if (file) handleFile(file);
      event.target.value = '';
    },
  });

  return h('div', { class: 'page' },
    h('h1', { class: 'page-title' }, 'Ayarlar'),
    h('section', { class: 'block' },
      h('h2', null, 'Tema'),
      h('div', { class: 'segmented', role: 'group', 'aria-label': 'Tema' },
        themeOption('system', 'Cihaz'), themeOption('light', 'Açık'), themeOption('dark', 'Koyu'))),
    h('section', { class: 'block' },
      h('h2', null, 'Yedekleme'),
      h('p', { class: 'muted' }, 'Tüm alışkanlıklarını ve kayıtlarını JSON dosyası olarak saklayabilir, sonra geri yükleyebilirsin.'),
      h('div', { class: 'button-row' },
        h('button', {
          type: 'button', class: 'btn btn-quiet',
          onclick: () => { downloadBackup(); toast('Yedek indirildi.'); },
        }, icon('download', 20), 'Yedeği indir'),
        h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => fileInput.click() }, icon('upload', 20), 'Yedeği geri yükle'),
        fileInput)),
    h('section', { class: 'block' },
      h('h2', null, 'Hesap'),
      h('p', { class: 'muted' }, store.user?.email || store.user?.displayName || 'Google hesabı'),
      h('button', {
        type: 'button', class: 'btn btn-quiet',
        onclick: async (event) => {
          event.currentTarget.disabled = true;
          try {
            await store.signOut();
          } catch (error) {
            toast(errorMessage(error), 'error');
            render();
          }
        },
      }, 'Çıkış yap')));
}

// Kabuk

const NAV = [
  { hash: '#/', label: 'Bugün', match: (r) => r === '' },
  { hash: '#/ilerleme', label: 'İlerleme', match: (r) => r === 'ilerleme' || r.startsWith('aliskanlik/') },
  { hash: '#/uzmanlik', label: 'Uzmanlık', match: (r) => r === 'uzmanlik' || r.startsWith('kelimeler/') || r.startsWith('calis/') },
  { hash: '#/kitaplar', label: 'Kitaplar', match: (r) => r === 'kitaplar' },
  { hash: '#/aliskanliklar', label: 'Alışkanlıklar', short: 'Alışkanlık', match: (r) => r === 'aliskanliklar' },
  { hash: '#/ayarlar', label: 'Ayarlar', match: (r) => r === 'ayarlar' },
];

const route = () => location.hash.replace(/^#\/?/, '');

function shell(view) {
  const current = route();
  return h('div', { class: 'shell' },
    h('nav', { class: 'nav', 'aria-label': 'Ana menü' },
      h('a', { class: 'brand', href: '#/' }, 'Çetele'),
      h('div', { class: 'nav-items' }, NAV.map((item) => h('a', {
        href: item.hash,
        class: 'nav-item',
        'aria-current': item.match(current) ? 'page' : null,
      }, item.short
        ? [h('span', { class: 'nav-full' }, item.label), h('span', { class: 'nav-short' }, item.short)]
        : item.label)))),
    h('main', { class: 'main', id: 'main', tabindex: -1 },
      !navigator.onLine && h('p', { class: 'banner', role: 'status' }, 'Çevrimdışısın. Değişikliklerin bu cihazda tutuluyor, bağlantı gelince gönderilecek.'),
      view));
}

function centerScreen(...children) {
  return h('div', { class: 'center' }, children);
}

function viewLoading(message) {
  return centerScreen(h('p', { role: 'status' }, message));
}

function viewSignIn() {
  return centerScreen(
    h('h1', { class: 'cover-title' }, 'Çetele'),
    h('p', { class: 'cover-text' }, 'Her gün yaptıklarını takip et.'),
    state.signInError && h('p', { class: 'form-error', role: 'alert' }, state.signInError),
    h('button', {
      type: 'button', class: 'btn btn-primary btn-large', disabled: state.signingIn, dataset: { fk: 'signin' },
      onclick: async () => {
        state.signingIn = true;
        state.signInError = null;
        render();
        try {
          await store.signIn();
        } catch (error) {
          const closed = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(error.code);
          if (!closed) {
            console.error(error);
            state.signInError = errorMessage(error);
          }
        } finally {
          state.signingIn = false;
          render();
        }
      },
    }, state.signingIn ? 'Giriş penceresi açık…' : 'Google ile giriş yap'),
  );
}

function viewConfig() {
  return centerScreen(
    h('h1', { class: 'cover-title' }, 'Çetele'),
    h('h2', null, 'Firebase ayarları eksik'),
    h('p', { class: 'cover-text' }, 'firebase-config.js dosyasındaki yer tutucuları kendi Firebase projenin değerleriyle değiştir, sonra sayfayı yenile. Adımlar README.md dosyasında.'),
  );
}

function viewFatal(title, text, action) {
  return centerScreen(h('h1', { class: 'cover-title' }, 'Çetele'), h('h2', null, title), h('p', { class: 'cover-text', role: 'alert' }, text), action);
}

function viewCurrent(today) {
  const current = route();
  if (current.startsWith('aliskanlik/')) return viewHabit(decodeURIComponent(current.slice('aliskanlik/'.length)), today);
  if (current.startsWith('kelimeler/')) return viewWords(decodeURIComponent(current.slice('kelimeler/'.length)), today);
  if (current.startsWith('calis/')) return viewStudy(decodeURIComponent(current.slice('calis/'.length)), today);
  if (current === 'ilerleme') return viewProgress(today);
  if (current === 'aliskanliklar') return viewManage(today);
  if (current === 'kitaplar') return viewBooks(today);
  if (current === 'uzmanlik') return viewMastery(today);
  if (current === 'ayarlar') return viewSettings();
  return viewToday(today);
}

let lastRouteRendered = null;

// Sayı kutusundan çıkarken veya dokunurken ekran yenilenirse dokunuş kaybolabilir.
// Bu yüzden veri kaynaklı yenilemeler kısa süre ertelenir.
let renderHoldUntil = 0;
let pointerDown = false;
let deferredRender = null;

// Cihaz saati değişse bile etkilenmemesi için her zaman ileri giden sayaç kullanılır.
const now = () => performance.now();

function holdRender(ms = 300) {
  renderHoldUntil = now() + ms;
}

function requestRender() {
  const wait = renderHoldUntil - now();
  if (!pointerDown && wait <= 0) {
    render();
    return;
  }
  clearTimeout(deferredRender);
  deferredRender = setTimeout(requestRender, Math.max(wait, 60));
}

document.addEventListener('pointerdown', () => { pointerDown = true; }, true);
window.addEventListener('blur', () => { pointerDown = false; });
['pointerup', 'pointercancel'].forEach((name) => {
  document.addEventListener(name, () => {
    holdRender(120);
    pointerDown = false;
  }, true);
});

function render() {
  const active = document.activeElement;
  const focusKey = active?.dataset?.fk;
  const draft = active?.dataset?.draft ? active.value : null;
  clearTimeout(deferredRender);
  let content;
  switch (store.phase) {
    case 'booting':
      content = viewLoading('Yükleniyor…');
      break;
    case 'config':
      content = viewConfig();
      break;
    case 'sdk-error':
      content = viewFatal(
        'Firebase yüklenemedi',
        'Gerekli dosyalar indirilemedi veya ayarlar hatalı. İnternet bağlantını ve firebase-config.js dosyasını kontrol edip sayfayı yenile.',
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => location.reload() }, 'Sayfayı yenile'),
      );
      break;
    case 'signed-out':
      content = viewSignIn();
      break;
    case 'loading':
      content = viewLoading('Verilerin yükleniyor…');
      break;
    case 'slow':
      content = viewFatal(
        'Sunucuya ulaşılamıyor',
        'Veriler hâlâ gelmedi. İnternet bağlantını kontrol et. Sorun sürerse Firebase konsolunda Firestore veritabanını oluşturduğundan emin ol.',
        h('div', { class: 'button-row button-row-center' },
          h('button', { type: 'button', class: 'btn btn-primary', onclick: () => store.retry() }, 'Yeniden dene'),
          h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => store.continueOffline() }, 'Çevrimdışı devam et')),
      );
      break;
    case 'load-error':
      content = viewFatal(
        'Veriler yüklenemedi',
        store.loadError || 'Beklenmeyen bir hata oluştu.',
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => store.retry() }, 'Yeniden dene'),
      );
      break;
    default:
      content = shell(viewCurrent(todayKey()));
  }
  app.replaceChildren(content);

  const currentRoute = route();
  if (store.phase === 'ready' && currentRoute !== lastRouteRendered) {
    if (lastRouteRendered !== null) window.scrollTo(0, 0);
    lastRouteRendered = currentRoute;
  }
  if (focusKey) {
    const target = app.querySelector(`[data-fk="${focusKey}"]`);
    target?.focus({ preventScroll: true });
    if (target && draft !== null) target.value = draft;
  }
  renderSync();
}

function renderSync() {
  const el = document.getElementById('sync');
  el.hidden = !(store.phase === 'ready' && store.hasPendingWrites && navigator.onLine);
}

// Başlangıç

async function start() {
  applyTheme();
  render();

  store.subscribe((event) => {
    if (event === 'sync') {
      renderSync();
      return;
    }
    if (event && event.error) {
      toast(event.error, 'error');
      return;
    }
    requestRender();
  });

  window.addEventListener('hashchange', () => {
    const next = route();
    if (!next.startsWith('aliskanlik/')) {
      state.heatYear = 'son';
      state.heatCell = null;
    }
    if (!next.startsWith('kelimeler/')) {
      state.wordQuery = '';
      state.wordStatus = 'all';
      state.wordLimit = WORD_PAGE;
    }
    if (!next.startsWith('calis/')) state.study = null;
    render();
  });
  window.addEventListener('online', render);
  window.addEventListener('offline', render);

  dayWatcher = watchDayChange((next, previous) => {
    if (state.day === previous || state.day > next) state.day = next;
    state.heatCell = null;
    if (store.phase === 'ready') render();
  });

  let config;
  try {
    ({ firebaseConfig: config } = await import('./firebase-config.js'));
  } catch (error) {
    console.error(error);
    store.setPhase('config');
    return;
  }
  await store.init(config);
}

window.addEventListener('unhandledrejection', (event) => {
  console.error(event.reason);
  toast('Beklenmeyen bir hata oluştu. Sayfayı yenileyip yeniden dene.', 'error');
});

start();
