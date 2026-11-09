// Çetele: bütün modüller bu tek dosyada birleştirildi. Ayrı ayrı kaynak dosyalar proje arşivindedir (cetele.zip).

// dates.js
var AYLAR = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık"
];
var AYLAR_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
var GUNLER = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
var GUNLER_KISA = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
var pad = (n) => String(n).padStart(2, "0");
var makeKey = (y, m, d) => `${String(y).padStart(4, "0")}-${pad(m)}-${pad(d)}`;
function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m, d };
}
function daysInMonth(y, m) {
  if (m === 2) return y % 4 === 0 && y % 100 !== 0 || y % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}
function isValidKey(key) {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const { y, m, d } = parseKey(key);
  return y >= 1970 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}
function keyToNum(key) {
  const { y, m, d } = parseKey(key);
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
function numToKey(num) {
  const z = num + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return makeKey(yoe + era * 400 + (m <= 2 ? 1 : 0), m, d);
}
function todayKey(now2 = /* @__PURE__ */ new Date()) {
  return makeKey(now2.getFullYear(), now2.getMonth() + 1, now2.getDate());
}
var addDays = (key, n) => numToKey(keyToNum(key) + n);
var diffDays = (a, b) => keyToNum(a) - keyToNum(b);
function weekdayIndex(key) {
  return ((keyToNum(key) + 3) % 7 + 7) % 7;
}
var startOfWeek = (key) => addDays(key, -weekdayIndex(key));
var endOfWeek = (key) => addDays(startOfWeek(key), 6);
function startOfMonth(key) {
  const { y, m } = parseKey(key);
  return makeKey(y, m, 1);
}
function endOfMonth(key) {
  const { y, m } = parseKey(key);
  return makeKey(y, m, daysInMonth(y, m));
}
function addMonths(key, n) {
  const { y, m } = parseKey(key);
  const total = y * 12 + (m - 1) + n;
  return makeKey(Math.floor(total / 12), total % 12 + 1, 1);
}
function msUntilNextDay(now2 = /* @__PURE__ */ new Date()) {
  const next = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate() + 1);
  return Math.max(0, next.getTime() - now2.getTime());
}
function formatLong(key) {
  const { y, m, d } = parseKey(key);
  return `${d} ${AYLAR[m - 1]} ${y}`;
}
function formatDayMonth(key) {
  const { m, d } = parseKey(key);
  return `${d} ${AYLAR[m - 1]}`;
}
function formatShort(key) {
  const { m, d } = parseKey(key);
  return `${d} ${AYLAR_KISA[m - 1]}`;
}
var weekdayName = (key) => GUNLER[weekdayIndex(key)];
function watchDayChange(onChange) {
  let current = todayKey();
  let timer = null;
  const check = () => {
    const next = todayKey();
    if (next !== current) {
      const previous = current;
      current = next;
      onChange(next, previous);
    }
  };
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      check();
      arm();
    }, msUntilNextDay() + 100);
  };
  const wake = () => {
    check();
    arm();
  };
  arm();
  const interval = setInterval(check, 3e4);
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("focus", wake);
  window.addEventListener("pageshow", wake);
  return {
    check,
    stop() {
      clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("pageshow", wake);
    }
  };
}

// stats.js
var MIN_RANK_DAYS = 3;
var EMPTY = /* @__PURE__ */ new Set();
function pct(done, total) {
  return total > 0 ? done / total * 100 : null;
}
function formatPct(value) {
  return value === null || value === void 0 ? "—" : `%${Math.round(value)}`;
}
function isInArchive(habit, key) {
  return (habit.archivedRanges || []).some((r) => key >= r.from && (r.to == null || key <= r.to));
}
function endDate(habit) {
  return Number.isInteger(habit.duration) && habit.duration > 0 ? addDays(habit.startDate, habit.duration - 1) : null;
}
function isFinished(habit, today) {
  const end = endDate(habit);
  return end !== null && today > end;
}
function isCounted(habit, key, done, today) {
  if (key < habit.startDate || key > today) return false;
  const end = endDate(habit);
  if (end !== null && key > end) return false;
  if (done.has(key)) return true;
  return !isInArchive(habit, key);
}
function windowStats(habit, done, from, to, today) {
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
function computeStreaks(habit, done, today) {
  const start2 = keyToNum(habit.startDate);
  const end = keyToNum(today);
  let longest = 0;
  let run = 0;
  for (let n = start2; n <= end; n += 1) {
    const key = numToKey(n);
    if (!isCounted(habit, key, done, today)) continue;
    if (done.has(key)) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }
  let current = 0;
  for (let n = end; n >= start2; n -= 1) {
    const key = numToKey(n);
    if (!isCounted(habit, key, done, today)) continue;
    if (done.has(key)) current += 1;
    else if (key !== today) break;
  }
  return { current, longest };
}
function habitStats(habit, done = EMPTY, today) {
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
    totalDone: overall.done
  };
}
function habitsForDay(habits, doneMap, day, today) {
  return habits.filter((h2) => {
    if (day < h2.startDate || day > today) return false;
    const end = endDate(h2);
    if (end !== null && day > end) return false;
    if (h2.archived && day === today) return false;
    const done = doneMap.get(h2.id) || EMPTY;
    return done.has(day) || !isInArchive(h2, day);
  });
}
function daySummary(habits, doneMap, day, today) {
  const list = habitsForDay(habits, doneMap, day, today);
  const done = list.filter((h2) => (doneMap.get(h2.id) || EMPTY).has(day)).length;
  return { list, done, total: list.length, rate: pct(done, list.length) };
}
function periodRate(habits, doneMap, from, to, today) {
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
function compareRates(current, previous) {
  if (current.rate === null) return { state: "no-current", current, previous, relative: null, points: null };
  if (previous.rate === null) return { state: "no-previous", current, previous, relative: null, points: null };
  const points = current.rate - previous.rate;
  if (previous.rate === 0) return { state: "from-zero", current, previous, relative: null, points };
  return { state: "ok", current, previous, relative: points / previous.rate * 100, points };
}
function weekComparison(habits, doneMap, today) {
  const from = startOfWeek(today);
  return compareRates(
    periodRate(habits, doneMap, from, endOfWeek(today), today),
    periodRate(habits, doneMap, addDays(from, -7), addDays(from, -1), today)
  );
}
function monthComparison(habits, doneMap, today) {
  const from = startOfMonth(today);
  const prev = addMonths(today, -1);
  return compareRates(
    periodRate(habits, doneMap, from, endOfMonth(today), today),
    periodRate(habits, doneMap, prev, endOfMonth(prev), today)
  );
}
function weeklySeries(habits, doneMap, today, count = 8) {
  const thisWeek = startOfWeek(today);
  const series = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const from = addDays(thisWeek, -7 * i);
    const to = addDays(from, 6);
    series.push({
      from,
      to,
      isCurrent: i === 0,
      label: formatShort(from),
      title: `${formatDayMonth(from)} – ${formatDayMonth(to)}`,
      ...periodRate(habits, doneMap, from, to, today)
    });
  }
  return series;
}
function monthlySeries(habits, doneMap, today, count = 12) {
  const series = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const from = addMonths(today, -i);
    const to = endOfMonth(from);
    const { y, m } = parseKey(from);
    series.push({
      from,
      to,
      isCurrent: i === 0,
      label: AYLAR_KISA[m - 1],
      title: `${AYLAR_KISA[m - 1]} ${y}`,
      ...periodRate(habits, doneMap, from, to, today)
    });
  }
  return series;
}
function rankHabits(habits, doneMap, today) {
  const rows = habits.filter((h2) => !h2.archived && !isFinished(h2, today)).map((habit) => {
    const done = doneMap.get(habit.id) || EMPTY;
    const stats = windowStats(habit, done, addDays(today, -29), today, today);
    return { habit, stats, streak: computeStreaks(habit, done, today).current };
  }).filter((row) => row.stats.total >= MIN_RANK_DAYS);
  if (rows.length === 0) return { state: "no-data", best: null, worst: null };
  const order = (a, b) => b.stats.rate - a.stats.rate || b.streak - a.streak || a.habit.name.localeCompare(b.habit.name, "tr");
  rows.sort(order);
  const best = rows[0];
  const worst = rows[rows.length - 1];
  if (rows.length === 1) return { state: "single", best, worst: null };
  if (best.stats.rate === worst.stats.rate) return { state: "tied", best, worst: null };
  return { state: "ok", best, worst };
}
function streakLeader(habits, doneMap, today) {
  let leader = null;
  for (const habit of habits) {
    if (habit.archived || isFinished(habit, today)) continue;
    const streak = computeStreaks(habit, doneMap.get(habit.id) || EMPTY, today).current;
    if (streak >= 2 && (!leader || streak > leader.streak)) leader = { habit, streak };
  }
  return leader;
}
function challengeStatus(habit, done = EMPTY, today) {
  const end = endDate(habit);
  if (end === null) return null;
  const days = [];
  let doneCount = 0;
  let missed = 0;
  for (let i = 0; i < habit.duration; i += 1) {
    const key = addDays(habit.startDate, i);
    let state2;
    if (key > today) state2 = "future";
    else if (done.has(key)) {
      state2 = "done";
      doneCount += 1;
    } else if (key === today) state2 = "today";
    else if (isInArchive(habit, key)) state2 = "out";
    else {
      state2 = "miss";
      missed += 1;
    }
    days.push({ key, n: i + 1, state: state2 });
  }
  const notStarted = today < habit.startDate;
  const dayNumber = notStarted ? 0 : Math.min(habit.duration, diffDays(today, habit.startDate) + 1);
  return {
    end,
    days,
    done: doneCount,
    missed,
    dayNumber,
    left: habit.duration - dayNumber,
    total: habit.duration,
    notStarted,
    finished: today > end
  };
}

// books.js
var MAX_PAGES = 1e5;
function parsePageNumber(text) {
  const clean = String(text ?? "").trim();
  if (clean === "") return { ok: true, value: null };
  if (!/^\d{1,6}$/.test(clean)) return { ok: false };
  const value = Number(clean);
  return value <= MAX_PAGES ? { ok: true, value } : { ok: false };
}
function cleanPages(raw) {
  const pages = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return pages;
  for (const [key, value] of Object.entries(raw)) {
    if (isValidKey(key) && Number.isInteger(value) && value >= 0 && value <= MAX_PAGES) pages[key] = value;
  }
  return pages;
}
function normalizeBook(id, data = {}) {
  const total = data.totalPages;
  return {
    id,
    title: typeof data.title === "string" && data.title.trim() ? data.title : "Adsız kitap",
    author: typeof data.author === "string" ? data.author : "",
    totalPages: Number.isInteger(total) && total > 0 && total <= MAX_PAGES ? total : null,
    startPage: Number.isInteger(data.startPage) && data.startPage >= 0 && data.startPage <= MAX_PAGES ? data.startPage : null,
    status: data.status === "done" ? "done" : "reading",
    startDate: isValidKey(data.startDate) ? data.startDate : "",
    finishedAt: isValidKey(data.finishedAt) ? data.finishedAt : null,
    pages: cleanPages(data.pages),
    createdAt: typeof data.createdAt === "string" ? data.createdAt : ""
  };
}
function latestPage(book, today) {
  let key = null;
  for (const k of Object.keys(book.pages)) {
    if (k <= today && (key === null || k > key)) key = k;
  }
  return key ? { page: book.pages[key], key } : { page: 0, key: null };
}
function pagesLastWeek(book, today) {
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
function bookProgress(book, today) {
  const { page, key } = latestPage(book, today);
  const percent = book.totalPages ? Math.min(100, page / book.totalPages * 100) : null;
  const days = book.status === "done" && book.finishedAt && book.startDate && book.finishedAt >= book.startDate ? diffDays(book.finishedAt, book.startDate) + 1 : null;
  return { page, lastKey: key, percent, days, lastWeek: pagesLastWeek(book, today) };
}
function sortBooks(books) {
  const reading = books.filter((b) => b.status === "reading").sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.title.localeCompare(b.title, "tr"));
  const finished = books.filter((b) => b.status === "done").sort((a, b) => (b.finishedAt || "").localeCompare(a.finishedAt || "") || a.title.localeCompare(b.title, "tr"));
  return { reading, finished };
}

// mastery.js
var EMPTY2 = /* @__PURE__ */ new Set();
var MASTERY = {
  hours: {
    target: 1e4,
    unit: "dakika",
    goalUnit: "saat",
    name: "10.000 saat",
    factor: 60,
    ask: "Bir günde genelde kaç dakika?",
    defaultDaily: 60
  },
  words: {
    target: 5e3,
    unit: "kelime",
    goalUnit: "kelime",
    name: "5.000 kelime",
    factor: 1,
    ask: "Bir günde genelde kaç kelime?",
    defaultDaily: 10
  }
};
var isMasteryType = (type) => Object.prototype.hasOwnProperty.call(MASTERY, type);
function amountOn(habit, key, values) {
  const value = values ? values[key] : void 0;
  return typeof value === "number" ? value : habit.dailyDefault || 0;
}
function masteryStatus(habit, done = EMPTY2, values = {}, today) {
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
    percent: Math.min(100, current / kind.target * 100),
    days,
    month: month / kind.factor,
    perDay,
    daysLeft
  };
}
var numberFormat = (digits) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: digits });
function formatAmount(value) {
  if (value >= 100) return numberFormat(0).format(Math.round(value));
  return numberFormat(1).format(Math.round(value * 10) / 10);
}
function formatWithUnit(value, kind) {
  if (kind.factor === 60 && value > 0 && value < 1) return `${Math.max(1, Math.round(value * 60))} dakika`;
  return `${formatAmount(value)} ${kind.goalUnit}`;
}
function formatPercent(value) {
  if (value > 0 && value < 1) return `%${numberFormat(2).format(Math.round(value * 100) / 100)}`;
  if (value < 10) return `%${numberFormat(1).format(Math.round(value * 10) / 10)}`;
  return `%${Math.floor(value)}`;
}
function formatSpan(days) {
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

// measure.js
var MIN_ENTRIES = 3;
var MAX_VALUE = 1e6;
var EMPTY3 = /* @__PURE__ */ new Set();
var monthKey = (key) => key.slice(0, 7);
var isValidMonth = (m) => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) && Number(m.slice(0, 4)) >= 1970;
var isValidScore = (n) => Number.isInteger(n) && n >= 1 && n <= 10;
function monthName(month) {
  const { y, m } = parseKey(`${month}-01`);
  return `${AYLAR[m - 1]} ${y}`;
}
function formatNumber(value) {
  if (value === null || value === void 0) return "—";
  return String(Math.round(value * 10) / 10).replace(".", ",");
}
function parseMeasure(text) {
  const clean = String(text).trim().replace(",", ".");
  if (clean === "") return { ok: true, value: null };
  if (!/^\d+(\.\d+)?$/.test(clean)) return { ok: false };
  const value = Number(clean);
  if (!Number.isFinite(value) || value > MAX_VALUE) return { ok: false };
  return { ok: true, value };
}
function monthAverage(habit, done = EMPTY3, values = {}, month, today) {
  let sum = 0;
  let count = 0;
  for (const [key, value] of Object.entries(values)) {
    if (monthKey(key) !== month || key < habit.startDate || key > today || !done.has(key)) continue;
    sum += value;
    count += 1;
  }
  return { count, average: count > 0 ? sum / count : null };
}
function measureMonths(habit, done, values, today, count = 6) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const from = addMonths(today, -i);
    const month = monthKey(from);
    const row = monthAverage(habit, done, values, month, today);
    if (row.count > 0) rows.push({ month, title: i === 0 ? "Bu ay" : monthName(month), ...row });
  }
  return rows;
}
function measureComparison(habit, done, values, today) {
  const months = new Set(Object.keys(values || {}).map(monthKey));
  const usable = [...months].sort().map((month) => ({ month, ...monthAverage(habit, done, values, month, today) })).filter((row) => row.count >= MIN_ENTRIES);
  if (usable.length < 2) return { state: "not-enough", latest: usable[usable.length - 1] || null };
  const previous = usable[usable.length - 2];
  const latest = usable[usable.length - 1];
  const diff = latest.average - previous.average;
  if (previous.average === 0) return { state: "from-zero", previous, latest, diff, relative: null };
  return { state: "ok", previous, latest, diff, relative: diff / previous.average * 100 };
}

// words.js
var MAX_WORD = 80;
var MAX_MEANING = 160;
var MAX_EXAMPLE = 240;
var ID_RE = /^[A-Za-z0-9]{1,32}$/;
var MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
var wordDocId = (habitId, date) => `${habitId}_${date.slice(0, 7)}`;
function newWordId(now2 = Date.now(), random = Math.random) {
  return `${now2.toString(36)}${Math.floor(random() * 36 ** 4).toString(36).padStart(4, "0")}`;
}
function cleanText(value, max) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}
function fold(value) {
  return String(value ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
}
function isValidWordId(id) {
  return typeof id === "string" && ID_RE.test(id);
}
function isValidMonthKey(month) {
  return typeof month === "string" && MONTH_RE.test(month);
}
function wordsFromDoc(docId, data) {
  if (!data || typeof data.habitId !== "string") return [];
  const items = data.items && typeof data.items === "object" ? data.items : {};
  const out = [];
  for (const [id, raw] of Object.entries(items)) {
    if (!raw || typeof raw !== "object" || typeof raw.word !== "string" || !raw.word.trim()) continue;
    out.push({
      id,
      docId,
      habitId: data.habitId,
      word: raw.word,
      meaning: typeof raw.meaning === "string" ? raw.meaning : "",
      example: typeof raw.example === "string" ? raw.example : "",
      date: isValidKey(raw.date) ? raw.date : isValidMonthKey(data.month) ? `${data.month}-01` : "2000-01-01",
      learned: raw.learned === true,
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : ""
    });
  }
  return out;
}
function sortWords(list) {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || a.word.localeCompare(b.word, "tr"));
}
function findDuplicate(list, word, exceptId = null) {
  const key = fold(cleanText(word, MAX_WORD));
  return list.find((item) => item.id !== exceptId && fold(item.word) === key) || null;
}
function filterWords(list, { query = "", status = "all" } = {}) {
  const q = fold(query.trim());
  return list.filter((item) => {
    if (status === "learning" && item.learned) return false;
    if (status === "learned" && !item.learned) return false;
    if (!q) return true;
    return fold(item.word).includes(q) || fold(item.meaning).includes(q) || fold(item.example).includes(q);
  });
}
function groupByDay(list) {
  const groups = [];
  for (const item of list) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.date) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }
  return groups;
}
function wordCounts(list, today) {
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
var STUDY_SETS = [
  { id: "learning", label: "Öğreniyorum" },
  { id: "today", label: "Bugün eklediklerim" },
  { id: "week", label: "Son 7 gün" },
  { id: "all", label: "Hepsi" }
];
function studyPool(list, set, today) {
  if (set === "learning") return list.filter((item) => !item.learned);
  if (set === "today") return list.filter((item) => item.date === today);
  if (set === "week") {
    const weekStart = addDays(today, -6);
    return list.filter((item) => item.date >= weekStart && item.date <= today);
  }
  return [...list];
}
function shuffle(items, random = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function byDoc(list) {
  const map = /* @__PURE__ */ new Map();
  for (const item of list) {
    if (!map.has(item.docId)) map.set(item.docId, []);
    map.get(item.docId).push(item);
  }
  return map;
}

// backup.js
var BACKUP_APP = "cetele";
var BACKUP_VERSION = 1;
var MAX_BACKUP_BYTES = 10 * 1024 * 1024;
var ID_RE2 = /^[A-Za-z0-9-]{1,64}$/;
var COLOR_RE = /^#[0-9a-fA-F]{6}$/;
var BackupError = class extends Error {
};
var logDocId = (habitId, year) => `${habitId}_${year}`;
var MAX_DURATION = 1e3;
function createBackup(habits, doneMap, now2 = /* @__PURE__ */ new Date(), valuesMap = /* @__PURE__ */ new Map(), books = [], words = []) {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now2.toISOString(),
    habits: habits.map((h2) => ({
      id: h2.id,
      name: h2.name,
      description: h2.description || "",
      color: h2.color,
      startDate: h2.startDate,
      archived: Boolean(h2.archived),
      archivedRanges: h2.archivedRanges || [],
      createdAt: h2.createdAt || "",
      unit: h2.unit || "",
      duration: h2.duration ?? null,
      mastery: h2.mastery ?? null,
      dailyDefault: h2.dailyDefault ?? null,
      target: h2.target ?? null,
      floor: h2.floor ?? null,
      selfScores: h2.selfScores || {},
      values: valuesMap.get(h2.id) || {},
      completions: [...doneMap.get(h2.id) || []].sort()
    })),
    books: books.map((b) => ({ id: b.id, ...bookFields(b) })),
    words: [...words].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)).map((w) => ({ id: w.id, habitId: w.habitId, ...wordFields(w) }))
  };
}
function parseBackup(text, today) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError("Bu dosya okunamadı. Geçerli bir JSON yedeği seç.");
  }
  if (!data || data.app !== BACKUP_APP || !Array.isArray(data.habits)) {
    throw new BackupError("Bu dosya Çetele yedeği değil.");
  }
  if (data.version !== BACKUP_VERSION) {
    throw new BackupError(`Bu yedeğin sürümü (${data.version}) desteklenmiyor.`);
  }
  const seen = /* @__PURE__ */ new Set();
  let skippedFuture = 0;
  const habits = data.habits.map((raw, index) => {
    const where = `${index + 1}. alışkanlık`;
    if (!raw || typeof raw !== "object") throw new BackupError(`${where} hatalı.`);
    if (typeof raw.id !== "string" || !ID_RE2.test(raw.id)) throw new BackupError(`${where}: kimlik hatalı.`);
    if (seen.has(raw.id)) throw new BackupError(`${where}: aynı kimlik iki kez kullanılmış.`);
    seen.add(raw.id);
    if (typeof raw.name !== "string" || !raw.name.trim()) throw new BackupError(`${where}: ad boş olamaz.`);
    if (typeof raw.color !== "string" || !COLOR_RE.test(raw.color)) throw new BackupError(`${where}: renk hatalı.`);
    if (!isValidKey(raw.startDate)) throw new BackupError(`${where}: başlangıç tarihi hatalı.`);
    if (!Array.isArray(raw.completions)) throw new BackupError(`${where}: kayıt listesi hatalı.`);
    const ranges = raw.archivedRanges === void 0 ? [] : raw.archivedRanges;
    if (!Array.isArray(ranges) || !ranges.every((r) => r && isValidKey(r.from) && (r.to === null || isValidKey(r.to)))) {
      throw new BackupError(`${where}: arşiv tarihleri hatalı.`);
    }
    const completions = /* @__PURE__ */ new Set();
    for (const key of raw.completions) {
      if (!isValidKey(key)) throw new BackupError(`${where}: "${String(key).slice(0, 20)}" geçerli bir tarih değil.`);
      if (key > today) skippedFuture += 1;
      else completions.add(key);
    }
    const rawValues = raw.values === void 0 ? {} : raw.values;
    if (!rawValues || typeof rawValues !== "object" || Array.isArray(rawValues)) throw new BackupError(`${where}: sayılar hatalı.`);
    const values = {};
    for (const [key, value] of Object.entries(rawValues)) {
      if (!isValidKey(key) || typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_VALUE) {
        throw new BackupError(`${where}: sayılar hatalı.`);
      }
      if (key > today) skippedFuture += 1;
      else values[key] = value;
    }
    const rawScores = raw.selfScores === void 0 ? {} : raw.selfScores;
    if (!rawScores || typeof rawScores !== "object" || Array.isArray(rawScores) || !Object.entries(rawScores).every(([month, score]) => isValidMonth(month) && isValidScore(score))) {
      throw new BackupError(`${where}: değerlendirme puanları hatalı.`);
    }
    const goal = (field) => {
      const value = raw[field];
      if (value === void 0 || value === null) return null;
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > MAX_VALUE) {
        throw new BackupError(`${where}: ${field === "dailyDefault" ? "günlük sayı" : "hedef"} hatalı.`);
      }
      return value;
    };
    const target = goal("target");
    const floor = goal("floor");
    const mastery = raw.mastery === void 0 || raw.mastery === null ? null : raw.mastery;
    if (mastery !== null && mastery !== "hours" && mastery !== "words") throw new BackupError(`${where}: uzmanlık türü hatalı.`);
    const dailyDefault = goal("dailyDefault");
    const duration = raw.duration === void 0 || raw.duration === null ? null : raw.duration;
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
      unit: typeof raw.unit === "string" ? raw.unit.trim().slice(0, 20) : "",
      selfScores: rawScores,
      values,
      name: raw.name.trim(),
      description: typeof raw.description === "string" ? raw.description : "",
      color: raw.color,
      startDate: raw.startDate,
      archived: Boolean(raw.archived),
      archivedRanges: ranges.map((r) => ({ from: r.from, to: r.to })),
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
      completions: [...completions].sort()
    };
  });
  if (data.books !== void 0 && !Array.isArray(data.books)) throw new BackupError("Kitap listesi hatalı.");
  const bookIds = /* @__PURE__ */ new Set();
  const books = (data.books || []).map((raw, index) => {
    const where = `${index + 1}. kitap`;
    if (!raw || typeof raw !== "object") throw new BackupError(`${where} hatalı.`);
    if (typeof raw.id !== "string" || !ID_RE2.test(raw.id)) throw new BackupError(`${where}: kimlik hatalı.`);
    if (bookIds.has(raw.id)) throw new BackupError(`${where}: aynı kimlik iki kez kullanılmış.`);
    bookIds.add(raw.id);
    if (typeof raw.title !== "string" || !raw.title.trim()) throw new BackupError(`${where}: kitap adı boş olamaz.`);
    const total = raw.totalPages === void 0 ? null : raw.totalPages;
    if (total !== null && !(Number.isInteger(total) && total > 0 && total <= MAX_PAGES)) throw new BackupError(`${where}: sayfa sayısı hatalı.`);
    if (raw.status !== "reading" && raw.status !== "done") throw new BackupError(`${where}: durum hatalı.`);
    const startPage = raw.startPage === void 0 ? null : raw.startPage;
    if (startPage !== null && !(Number.isInteger(startPage) && startPage >= 0 && startPage <= MAX_PAGES)) throw new BackupError(`${where}: başlangıç sayfası hatalı.`);
    if (raw.startDate !== void 0 && raw.startDate !== "" && !isValidKey(raw.startDate)) throw new BackupError(`${where}: başlangıç tarihi hatalı.`);
    if (raw.finishedAt !== void 0 && raw.finishedAt !== null && !isValidKey(raw.finishedAt)) throw new BackupError(`${where}: bitiş tarihi hatalı.`);
    const rawPages = raw.pages === void 0 ? {} : raw.pages;
    if (!rawPages || typeof rawPages !== "object" || Array.isArray(rawPages)) throw new BackupError(`${where}: sayfa kayıtları hatalı.`);
    const pages = {};
    for (const [key, value] of Object.entries(rawPages)) {
      if (!isValidKey(key) || !Number.isInteger(value) || value < 0 || value > MAX_PAGES) throw new BackupError(`${where}: sayfa kayıtları hatalı.`);
      if (key > today) skippedFuture += 1;
      else pages[key] = value;
    }
    return {
      id: raw.id,
      title: raw.title.trim(),
      author: typeof raw.author === "string" ? raw.author.trim() : "",
      totalPages: total,
      startPage,
      status: raw.status,
      startDate: raw.startDate || "",
      finishedAt: raw.finishedAt || null,
      pages,
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : ""
    };
  });
  if (data.words !== void 0 && !Array.isArray(data.words)) throw new BackupError("Kelime listesi hatalı.");
  const wordIds = /* @__PURE__ */ new Set();
  const words = [];
  (data.words || []).forEach((raw, index) => {
    const where = `${index + 1}. kelime`;
    if (!raw || typeof raw !== "object") throw new BackupError(`${where} hatalı.`);
    if (!isValidWordId(raw.id)) throw new BackupError(`${where}: kimlik hatalı.`);
    if (typeof raw.habitId !== "string" || !seen.has(raw.habitId)) throw new BackupError(`${where}: alışkanlığı yedekte yok.`);
    const uniq = `${raw.habitId}/${raw.id}`;
    if (wordIds.has(uniq)) throw new BackupError(`${where}: aynı kimlik iki kez kullanılmış.`);
    wordIds.add(uniq);
    if (typeof raw.word !== "string" || !raw.word.trim()) throw new BackupError(`${where}: kelime boş olamaz.`);
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
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : ""
    });
  });
  return {
    habits,
    books,
    words,
    skippedFuture,
    exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : null
  };
}
function groupByYear(days) {
  const years = /* @__PURE__ */ new Map();
  for (const key of days) {
    const { y } = parseKey(key);
    if (!years.has(y)) years.set(y, []);
    years.get(y).push(key);
  }
  return years;
}
var sortedEntries = (o) => Object.entries(o).sort((x, y) => x[0] < y[0] ? -1 : 1);
var habitFields = (h2) => ({
  name: h2.name,
  description: h2.description || "",
  color: h2.color,
  startDate: h2.startDate,
  archived: Boolean(h2.archived),
  archivedRanges: h2.archivedRanges || [],
  createdAt: h2.createdAt || "",
  unit: h2.unit || "",
  duration: h2.duration ?? null,
  mastery: h2.mastery ?? null,
  dailyDefault: h2.dailyDefault ?? null,
  target: h2.target ?? null,
  floor: h2.floor ?? null,
  selfScores: Object.fromEntries(sortedEntries(h2.selfScores || {}))
});
function bookFields(b) {
  return {
    title: b.title,
    author: b.author || "",
    totalPages: b.totalPages ?? null,
    startPage: b.startPage ?? null,
    status: b.status === "done" ? "done" : "reading",
    startDate: b.startDate || "",
    finishedAt: b.finishedAt || null,
    pages: Object.fromEntries(sortedEntries(b.pages || {})),
    createdAt: b.createdAt || ""
  };
}
function wordFields(w) {
  return {
    word: w.word,
    meaning: w.meaning || "",
    example: w.example || "",
    date: w.date,
    learned: w.learned === true,
    createdAt: w.createdAt || ""
  };
}
function wordDocs(list, docOf) {
  const docs = /* @__PURE__ */ new Map();
  for (const w of list) {
    const id = docOf(w);
    if (!docs.has(id)) docs.set(id, { habitId: w.habitId, month: id.slice(-7), items: {} });
    docs.get(id).items[w.id] = wordFields(w);
  }
  return docs;
}
var sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
var sameValues = (a, b) => sameJson(sortedEntries(a), sortedEntries(b));
var sameDays = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
function planRestore(currentHabits, currentLogs, backup, mode, currentBooks = [], currentWords = []) {
  const ops = {
    habitSets: [],
    habitDeletes: [],
    logSets: [],
    logDeletes: [],
    bookSets: [],
    bookDeletes: [],
    wordSets: [],
    wordDeletes: []
  };
  const byId = new Map(currentHabits.map((h2) => [h2.id, h2]));
  const wanted = /* @__PURE__ */ new Set();
  for (const habit of backup.habits) {
    const fields = habitFields(habit);
    const existing = byId.get(habit.id);
    if (!existing || !sameJson(habitFields(existing), fields)) {
      ops.habitSets.push({ id: habit.id, data: fields });
    }
    const yearsOfDays = groupByYear(habit.completions);
    const backupValues = habit.values || {};
    const yearsOfValues = groupByYear(Object.keys(backupValues));
    for (const year of /* @__PURE__ */ new Set([...yearsOfDays.keys(), ...yearsOfValues.keys()])) {
      const days = yearsOfDays.get(year) || [];
      const valuesOfYear = {};
      (yearsOfValues.get(year) || []).forEach((key) => {
        valuesOfYear[key] = backupValues[key];
      });
      const id = logDocId(habit.id, year);
      wanted.add(id);
      const current = currentLogs.get(id);
      const merging = mode === "merge" && current;
      const finalDays = merging ? [.../* @__PURE__ */ new Set([...current.days, ...days])].sort() : days;
      const finalValues = merging ? { ...current.values || {}, ...valuesOfYear } : valuesOfYear;
      const hasValues = Object.keys(finalValues).length > 0;
      if (!current || !sameDays(current.days, finalDays) || !sameValues(current.values || {}, finalValues)) {
        ops.logSets.push({
          id,
          data: { habitId: habit.id, year, days: finalDays, ...hasValues ? { values: finalValues } : {} }
        });
      }
    }
  }
  const booksById = new Map(currentBooks.map((b) => [b.id, b]));
  for (const book of backup.books || []) {
    const existing = booksById.get(book.id);
    const pages = mode === "merge" && existing ? { ...existing.pages, ...book.pages } : book.pages;
    const fields = bookFields({ ...book, pages });
    if (!existing || !sameJson(bookFields(existing), fields)) ops.bookSets.push({ id: book.id, data: fields });
  }
  const currentDocs = wordDocs(currentWords, (w) => w.docId);
  const backupDocs = wordDocs(backup.words || [], (w) => wordDocId(w.habitId, w.date));
  const sortedItems = (items) => Object.fromEntries(sortedEntries(items));
  for (const [id, doc] of backupDocs) {
    const existing = currentDocs.get(id);
    const items = mode === "merge" && existing ? { ...existing.items, ...doc.items } : doc.items;
    if (!existing || !sameJson(sortedItems(existing.items), sortedItems(items)) || existing.habitId !== doc.habitId) {
      ops.wordSets.push({ id, data: { habitId: doc.habitId, month: doc.month, items: sortedItems(items) } });
    }
  }
  if (mode === "replace") {
    for (const id of currentDocs.keys()) {
      if (!backupDocs.has(id)) ops.wordDeletes.push(id);
    }
    const keepBooks = new Set((backup.books || []).map((b) => b.id));
    for (const book of currentBooks) {
      if (!keepBooks.has(book.id)) ops.bookDeletes.push(book.id);
    }
    const keep = new Set(backup.habits.map((h2) => h2.id));
    for (const habit of currentHabits) {
      if (!keep.has(habit.id)) ops.habitDeletes.push(habit.id);
    }
    for (const id of currentLogs.keys()) {
      if (!wanted.has(id)) ops.logDeletes.push(id);
    }
  }
  return ops;
}
function countOps(ops) {
  return ops.habitSets.length + ops.habitDeletes.length + ops.logSets.length + ops.logDeletes.length + (ops.bookSets || []).length + (ops.bookDeletes || []).length + (ops.wordSets || []).length + (ops.wordDeletes || []).length;
}

// colors.js
var PALETTE = [
  { name: "Kobalt", hex: "#2B4FD8" },
  { name: "Hardal", hex: "#B98500" },
  { name: "Mor", hex: "#7E4FD6" },
  { name: "Zümrüt", hex: "#1E9A4F" },
  { name: "Mercan", hex: "#E04F2F" },
  { name: "Turkuaz", hex: "#00909E" },
  { name: "Gül", hex: "#D23C80" },
  { name: "Toprak", hex: "#A0602A" }
];
var SURFACE = { light: "#FFFFFF", dark: "#141416" };
var INK = { light: "#FFFFFF", dark: "#141416" };
function toRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}
function toHex(rgb) {
  return `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}
function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
function mix(hex, target, amount) {
  const a = toRgb(hex);
  const b = toRgb(target);
  return toHex(a.map((v, i) => v + (b[i] - v) * amount));
}
function displayColor(hex, theme) {
  const surface = SURFACE[theme] || SURFACE.light;
  const target = theme === "dark" ? "#FFFFFF" : "#000000";
  let color = hex.toLowerCase();
  for (let step = 0; step <= 20 && contrast(color, surface) < 3; step += 1) {
    color = mix(hex, target, step * 0.05);
  }
  return color;
}
function inkOn(hex) {
  return contrast(hex, INK.light) >= contrast(hex, INK.dark) ? INK.light : INK.dark;
}

// store.js
var SDK_VERSION = "13.2.0";
var SDK_BASE = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;
var WRITE_DELAY_MS = 350;
var SLOW_LOAD_MS = 1e4;
var BATCH_LIMIT = 400;
var COLLECTIONS = ["habits", "logs", "books", "words"];
var flags = (value) => Object.fromEntries(COLLECTIONS.map((name) => [name, value]));
function isConfigured(config) {
  const required = ["apiKey", "authDomain", "projectId", "appId"];
  return Boolean(config) && required.every((k) => typeof config[k] === "string" && config[k] && !config[k].includes("BURAYA"));
}
function errorMessage(error) {
  const code = String(error?.code || "").replace("firestore/", "");
  const messages = {
    "auth/unauthorized-domain": "Bu site adresi Firebase Authentication'da yetkili değil. Konsoldan yetkili alan adlarına ekle.",
    "auth/popup-blocked": "Giriş penceresi engellendi. Tarayıcında bu site için açılır pencerelere izin ver ve yeniden dene.",
    "auth/network-request-failed": "Giriş yapılamadı: internet bağlantısı yok. Bağlantını kontrol edip yeniden dene.",
    "auth/operation-not-allowed": "Google girişi kapalı. Firebase konsolunda Authentication bölümünden etkinleştir.",
    "auth/configuration-not-found": "Authentication bu projede henüz açılmamış. Firebase konsolundan Google girişini etkinleştir.",
    "auth/invalid-api-key": "firebase-config.js içindeki apiKey değeri geçersiz. Konsoldaki değerle karşılaştır.",
    "auth/api-key-not-valid": "firebase-config.js içindeki apiKey değeri geçersiz. Konsoldaki değerle karşılaştır.",
    "auth/too-many-requests": "Çok fazla deneme yapıldı. Biraz bekleyip yeniden dene.",
    "auth/internal-error": "Giriş sırasında bir sorun oluştu. Yeniden dene.",
    "permission-denied": "Firestore bu işleme izin vermedi. Güvenlik kurallarının yayımlandığını kontrol et.",
    unauthenticated: "Oturumun sona erdi. Yeniden giriş yap.",
    unavailable: "Sunucuya ulaşılamıyor. İnternet bağlantını kontrol et.",
    "resource-exhausted": "Firebase'in günlük ücretsiz kotası doldu. Kota yenilenince yeniden dene.",
    "not-found": "Firestore veritabanı bulunamadı. Firebase konsolunda veritabanını oluşturduğunu kontrol et.",
    "failed-precondition": "Firestore bu işlemi şu anda yapamadı. Sayfayı yenileyip yeniden dene.",
    "deadline-exceeded": "Sunucu zamanında yanıt vermedi. Yeniden dene."
  };
  return messages[code] || "Beklenmeyen bir hata oluştu. Sayfayı yenileyip yeniden dene.";
}
function normalizeHabit(id, data) {
  return {
    id,
    name: typeof data.name === "string" ? data.name : "Adsız",
    description: typeof data.description === "string" ? data.description : "",
    color: typeof data.color === "string" ? data.color : "#2B4FD8",
    startDate: isValidKey(data.startDate) ? data.startDate : todayKey(),
    archived: Boolean(data.archived),
    archivedRanges: Array.isArray(data.archivedRanges) ? data.archivedRanges : [],
    unit: typeof data.unit === "string" ? data.unit : "",
    duration: Number.isInteger(data.duration) && data.duration > 0 ? data.duration : null,
    mastery: data.mastery === "hours" || data.mastery === "words" ? data.mastery : null,
    dailyDefault: Number.isFinite(data.dailyDefault) && data.dailyDefault > 0 ? data.dailyDefault : null,
    target: Number.isFinite(data.target) && data.target > 0 ? data.target : null,
    floor: Number.isFinite(data.floor) && data.floor > 0 ? data.floor : null,
    selfScores: data.selfScores && typeof data.selfScores === "object" ? data.selfScores : {},
    createdAt: typeof data.createdAt === "string" ? data.createdAt : ""
  };
}
function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
var Store = class {
  constructor() {
    this.phase = "booting";
    this.user = null;
    this.loadError = null;
    this.habits = [];
    this.books = [];
    this.words = [];
    this.wordDocs = /* @__PURE__ */ new Map();
    this.logs = /* @__PURE__ */ new Map();
    this.done = /* @__PURE__ */ new Map();
    this.values = /* @__PURE__ */ new Map();
    this.pending = /* @__PURE__ */ new Map();
    this.sent = /* @__PURE__ */ new Map();
    this.hasPendingWrites = false;
    this.listeners = /* @__PURE__ */ new Set();
    this.unsubs = [];
    this.flushTimer = null;
    this.slowTimer = null;
    this.signature = flags("");
    this.seen = flags(false);
    this.arrived = flags(false);
    this.pendingFlags = flags(false);
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(kind) {
    this.listeners.forEach((fn) => fn(kind));
  }
  setPhase(phase) {
    if (this.phase === phase) return;
    this.phase = phase;
    this.emit("phase");
  }
  reportError(error) {
    console.error(error);
    this.emit({ error: errorMessage(error) });
  }
  async init(config) {
    if (!isConfigured(config)) {
      this.setPhase("config");
      return;
    }
    let app2;
    let auth;
    let fs;
    try {
      [app2, auth, fs] = await Promise.all([
        import(`${SDK_BASE}/firebase-app.js`),
        import(`${SDK_BASE}/firebase-auth.js`),
        import(`${SDK_BASE}/firebase-firestore.js`)
      ]);
    } catch (error) {
      console.error(error);
      this.setPhase("sdk-error");
      return;
    }
    this.fs = fs;
    this.authSdk = auth;
    try {
      const firebaseApp = app2.initializeApp(config);
      this.auth = auth.getAuth(firebaseApp);
      this.db = fs.initializeFirestore(firebaseApp, {
        localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() })
      });
    } catch (error) {
      console.error(error);
      this.setPhase("sdk-error");
      return;
    }
    window.addEventListener("pagehide", () => this.flush());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.flush();
    });
    auth.onAuthStateChanged(this.auth, (user) => this.handleUser(user), (error) => this.reportError(error));
  }
  handleUser(user) {
    this.stopListening();
    this.clearData();
    this.user = user;
    if (user) this.startListening();
    else this.setPhase("signed-out");
  }
  clearData() {
    clearTimeout(this.flushTimer);
    this.pending.clear();
    this.sent.clear();
    this.habits = [];
    this.books = [];
    this.words = [];
    this.wordDocs = /* @__PURE__ */ new Map();
    this.logs = /* @__PURE__ */ new Map();
    this.done = /* @__PURE__ */ new Map();
    this.values = /* @__PURE__ */ new Map();
    this.signature = flags("");
    this.seen = flags(false);
    this.pendingFlags = flags(false);
    this.hasPendingWrites = false;
  }
  col(name) {
    return this.fs.collection(this.db, "users", this.user.uid, name);
  }
  ref(name, id) {
    return this.fs.doc(this.db, "users", this.user.uid, name, id);
  }
  stopListening() {
    clearTimeout(this.slowTimer);
    this.unsubs.forEach((stop) => stop());
    this.unsubs = [];
  }
  startListening() {
    this.loadError = null;
    this.seen = flags(false);
    this.arrived = flags(false);
    this.setPhase("loading");
    clearTimeout(this.slowTimer);
    this.slowTimer = setTimeout(() => {
      if (this.phase === "loading") this.setPhase("slow");
    }, SLOW_LOAD_MS);
    const options = { includeMetadataChanges: true };
    const onError = (error) => {
      console.error(error);
      this.stopListening();
      this.loadError = errorMessage(error);
      if (this.phase === "ready") this.emit({ error: this.loadError });
      this.setPhase("load-error");
    };
    this.unsubs = [
      this.fs.onSnapshot(this.col("habits"), options, (snap) => this.onHabits(snap), onError),
      this.fs.onSnapshot(this.col("logs"), options, (snap) => this.onLogs(snap), onError),
      this.fs.onSnapshot(this.col("books"), options, (snap) => this.onBooks(snap), onError),
      this.fs.onSnapshot(this.col("words"), options, (snap) => this.onWords(snap), onError)
    ];
  }
  retry() {
    if (!this.user) return;
    this.stopListening();
    this.startListening();
  }
  // Sunucuya ulaşılamadığında bu cihazdaki verilerle devam etmeyi sağlar.
  continueOffline() {
    clearTimeout(this.slowTimer);
    this.setPhase("ready");
  }
  onHabits(snap) {
    const habits = snap.docs.map((d) => normalizeHabit(d.id, d.data())).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name, "tr"));
    const signature = JSON.stringify(habits);
    const changed = signature !== this.signature.habits;
    this.signature.habits = signature;
    this.habits = habits;
    this.afterSnapshot("habits", snap, changed);
  }
  onLogs(snap) {
    const logs = /* @__PURE__ */ new Map();
    snap.docs.forEach((d) => {
      const data = d.data();
      if (typeof data.habitId !== "string") return;
      logs.set(d.id, {
        ...data,
        days: Array.isArray(data.days) ? data.days : [],
        values: data.values && typeof data.values === "object" ? data.values : {}
      });
    });
    const signature = JSON.stringify([...logs.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1));
    const changed = signature !== this.signature.logs;
    this.signature.logs = signature;
    this.logs = logs;
    this.sent.forEach(({ habitId, key, value }, id) => {
      if (this.savedDone(habitId, key) === value) this.sent.delete(id);
    });
    if (changed) this.rebuildDone();
    this.afterSnapshot("logs", snap, changed);
  }
  afterSnapshot(which, snap, changed) {
    if (!snap.metadata.fromCache) this.seen[which] = true;
    this.arrived[which] = true;
    this.pendingFlags[which] = snap.metadata.hasPendingWrites;
    const pendingNow = COLLECTIONS.some((name) => this.pendingFlags[name]);
    const pendingChanged = pendingNow !== this.hasPendingWrites;
    this.hasPendingWrites = pendingNow;
    const hasCached = this.habits.length > 0 || this.books.length > 0 || this.words.length > 0;
    const serverReady = COLLECTIONS.every((name) => this.seen[name]);
    const allArrived = COLLECTIONS.every((name) => this.arrived[name]);
    if (this.phase !== "ready" && allArrived && (serverReady || hasCached)) {
      clearTimeout(this.slowTimer);
      this.setPhase("ready");
    } else if (changed && this.phase === "ready") {
      this.emit("data");
    }
    if (pendingChanged) this.emit("sync");
  }
  onBooks(snap) {
    const books = snap.docs.map((d) => normalizeBook(d.id, d.data()));
    const signature = JSON.stringify(books);
    const changed = signature !== this.signature.books;
    this.signature.books = signature;
    this.books = books;
    this.afterSnapshot("books", snap, changed);
  }
  onWords(snap) {
    const words = [];
    const docs = /* @__PURE__ */ new Map();
    snap.docs.forEach((d) => {
      const list = wordsFromDoc(d.id, d.data());
      docs.set(d.id, list.length);
      words.push(...list);
    });
    const signature = JSON.stringify(words);
    const changed = signature !== this.signature.words;
    this.signature.words = signature;
    this.words = words;
    this.wordDocs = docs;
    this.afterSnapshot("words", snap, changed);
  }
  rebuildDone() {
    const done = /* @__PURE__ */ new Map();
    const values = /* @__PURE__ */ new Map();
    this.logs.forEach((log) => {
      if (!done.has(log.habitId)) done.set(log.habitId, /* @__PURE__ */ new Set());
      const days = done.get(log.habitId);
      log.days.forEach((d) => days.add(d));
      values.set(log.habitId, { ...values.get(log.habitId) || {}, ...log.values });
    });
    this.values = values;
    const overlay = ({ habitId, key, value }) => {
      if (!done.has(habitId)) done.set(habitId, /* @__PURE__ */ new Set());
      if (value) done.get(habitId).add(key);
      else done.get(habitId).delete(key);
    };
    this.sent.forEach(overlay);
    this.pending.forEach(overlay);
    this.done = done;
  }
  isDone(habitId, key) {
    return this.done.get(habitId)?.has(key) || false;
  }
  savedDone(habitId, key) {
    const { y } = parseKey(key);
    const log = this.logs.get(logDocId(habitId, y));
    return log ? log.days.includes(key) : false;
  }
  // İşareti hemen ekranda gösterir. Hızlı aç-kapa yapılırsa gereksiz yazma oluşmaz.
  canMark(habit, key) {
    if (!habit || key > todayKey() || key < habit.startDate) return false;
    const end = endDate(habit);
    return end === null || key <= end;
  }
  toggle(habitId, key) {
    const habit = this.habits.find((h2) => h2.id === habitId);
    if (!this.canMark(habit, key)) return false;
    const value = !this.isDone(habitId, key);
    const id = `${habitId}|${key}`;
    const base = this.sent.has(id) ? this.sent.get(id).value : this.savedDone(habitId, key);
    if (value === base) this.pending.delete(id);
    else this.pending.set(id, { habitId, key, value });
    this.rebuildDone();
    clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flush(), WRITE_DELAY_MS);
    return true;
  }
  flush() {
    clearTimeout(this.flushTimer);
    if (this.pending.size === 0 || !this.user) return;
    const { arrayUnion, arrayRemove, writeBatch } = this.fs;
    const items = [...this.pending.entries()];
    this.pending.clear();
    items.forEach(([id, item]) => this.sent.set(id, item));
    chunk(items, BATCH_LIMIT).forEach((part) => {
      const batch = writeBatch(this.db);
      part.forEach(([, { habitId, key, value }]) => {
        const { y } = parseKey(key);
        batch.set(
          this.ref("logs", logDocId(habitId, y)),
          { habitId, year: y, days: value ? arrayUnion(key) : arrayRemove(key) },
          { merge: true }
        );
      });
      this.watch(batch.commit(), () => part.forEach(([id]) => this.sent.delete(id)));
    });
  }
  // Firestore çevrimdışıyken yazma sözü bağlantı gelene kadar tamamlanmaz.
  // Bu yüzden arayüz sonucu beklemez, yalnızca hatayı bildirir.
  watch(promise, onFail) {
    promise.catch((error) => {
      if (onFail) onFail();
      this.rebuildDone();
      this.emit("data");
      this.reportError(error);
    });
  }
  // Günlük sayı. Boş değer sayıyı siler. Yıl belgesinin içine yazılır, yeni belge açmaz.
  setValue(habitId, key, value) {
    const habit = this.habits.find((h2) => h2.id === habitId);
    if (!this.canMark(habit, key)) return false;
    const current = this.values.get(habitId)?.[key];
    if (value === null && current === void 0 || value === current) return true;
    const map = { ...this.values.get(habitId) || {} };
    if (value === null) delete map[key];
    else map[key] = value;
    this.values.set(habitId, map);
    const { y } = parseKey(key);
    this.watch(this.fs.setDoc(
      this.ref("logs", logDocId(habitId, y)),
      { habitId, year: y, values: { [key]: value === null ? this.fs.deleteField() : value } },
      { merge: true }
    ));
    return true;
  }
  // Kitaplar
  addBook({ title, author, totalPages, page }) {
    const ref = this.fs.doc(this.col("books"));
    const today = todayKey();
    this.watch(this.fs.setDoc(ref, {
      title,
      author,
      totalPages,
      startPage: page || 0,
      status: "reading",
      startDate: today,
      finishedAt: null,
      pages: { [today]: page || 0 },
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }));
    return ref.id;
  }
  updateBook(id, fields) {
    this.watch(this.fs.updateDoc(this.ref("books", id), fields));
  }
  // Bugünün sayfası. Kitap belgesinin içine yazılır, yeni belge açmaz.
  setBookPage(id, page) {
    this.watch(this.fs.setDoc(this.ref("books", id), { pages: { [todayKey()]: page } }, { merge: true }));
  }
  deleteBook(id) {
    this.watch(this.fs.deleteDoc(this.ref("books", id)));
  }
  // Kelime arşivi. Her işlem yalnızca o ayın belgesine tek yazma yapar.
  addWord(habitId, { word, meaning, example }) {
    const date = todayKey();
    const id = newWordId();
    const month = date.slice(0, 7);
    const item = {
      word,
      meaning,
      example,
      date,
      learned: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.watch(this.fs.setDoc(this.ref("words", wordDocId(habitId, date)), { habitId, month, items: { [id]: item } }, { merge: true }));
    return id;
  }
  updateWord(item, fields) {
    this.watch(this.fs.setDoc(this.ref("words", item.docId), { habitId: item.habitId, items: { [item.id]: fields } }, { merge: true }));
  }
  deleteWord(item) {
    const ref = this.ref("words", item.docId);
    if ((this.wordDocs.get(item.docId) || 0) <= 1) this.watch(this.fs.deleteDoc(ref));
    else this.watch(this.fs.setDoc(ref, { items: { [item.id]: this.fs.deleteField() } }, { merge: true }));
  }
  // Birden çok kelimenin durumunu değiştirir. Aynı aydaki kelimeler tek yazmayla gider.
  setLearned(items, learned) {
    const groups = [...byDoc(items).entries()];
    chunk(groups, BATCH_LIMIT).forEach((part) => {
      const batch = this.fs.writeBatch(this.db);
      part.forEach(([docId, list]) => {
        const changes = Object.fromEntries(list.map((item) => [item.id, { learned }]));
        batch.set(this.ref("words", docId), { habitId: list[0].habitId, items: changes }, { merge: true });
      });
      this.watch(batch.commit());
    });
  }
  addHabit(fields) {
    const ref = this.fs.doc(this.col("habits"));
    this.watch(this.fs.setDoc(ref, {
      ...fields,
      archived: false,
      archivedRanges: [],
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }));
    return ref.id;
  }
  updateHabit(id, fields) {
    this.watch(this.fs.updateDoc(this.ref("habits", id), fields));
  }
  archiveHabit(id) {
    const habit = this.habits.find((h2) => h2.id === id);
    if (!habit || habit.archived) return;
    this.updateHabit(id, {
      archived: true,
      archivedRanges: [...habit.archivedRanges, { from: todayKey(), to: null }]
    });
  }
  // Arşivde geçen günler yapılmamış sayılmaz; alışkanlık geri alındığı günden itibaren sayılır.
  unarchiveHabit(id) {
    const habit = this.habits.find((h2) => h2.id === id);
    if (!habit || !habit.archived) return;
    const today = todayKey();
    const ranges = habit.archivedRanges.map((r) => r.to == null ? { from: r.from, to: addDays(today, -1) } : r).filter((r) => r.from <= r.to);
    this.updateHabit(id, { archived: false, archivedRanges: ranges });
  }
  deleteHabit(id) {
    this.flush();
    const { deleteDoc, writeBatch } = this.fs;
    const logIds = [...this.logs.entries()].filter(([, log]) => log.habitId === id).map(([logId]) => ["logs", logId]);
    const wordIds = [...new Set(this.words.filter((w) => w.habitId === id).map((w) => w.docId))].map((docId) => ["words", docId]);
    chunk([...logIds, ...wordIds], BATCH_LIMIT).forEach((part) => {
      const batch = writeBatch(this.db);
      part.forEach(([name, docId]) => batch.delete(this.ref(name, docId)));
      this.watch(batch.commit());
    });
    this.watch(deleteDoc(this.ref("habits", id)));
  }
  async applyRestore(ops) {
    this.flush();
    const { writeBatch } = this.fs;
    const steps = [
      ...ops.logDeletes.map((id) => (b) => b.delete(this.ref("logs", id))),
      ...ops.habitDeletes.map((id) => (b) => b.delete(this.ref("habits", id))),
      ...ops.habitSets.map(({ id, data }) => (b) => b.set(this.ref("habits", id), data)),
      ...ops.logSets.map(({ id, data }) => (b) => b.set(this.ref("logs", id), data)),
      ...(ops.bookDeletes || []).map((id) => (b) => b.delete(this.ref("books", id))),
      ...(ops.bookSets || []).map(({ id, data }) => (b) => b.set(this.ref("books", id), data)),
      ...(ops.wordDeletes || []).map((id) => (b) => b.delete(this.ref("words", id))),
      ...(ops.wordSets || []).map(({ id, data }) => (b) => b.set(this.ref("words", id), data))
    ];
    await Promise.all(chunk(steps, BATCH_LIMIT).map((part) => {
      const batch = writeBatch(this.db);
      part.forEach((step) => step(batch));
      return batch.commit();
    }));
  }
  async signIn() {
    const provider = new this.authSdk.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await this.authSdk.signInWithPopup(this.auth, provider);
  }
  // Çıkışta bu tarayıcıdaki önbellek temizlenir. Bekleyen yazma varsa önbellek
  // korunur; değişiklikler aynı hesapla yeniden girişte gönderilir.
  async signOut() {
    this.flush();
    const { waitForPendingWrites, terminate, clearIndexedDbPersistence } = this.fs;
    const synced = await Promise.race([
      waitForPendingWrites(this.db).then(() => true),
      new Promise((resolve) => {
        setTimeout(() => resolve(false), 4e3);
      })
    ]);
    this.stopListening();
    await this.authSdk.signOut(this.auth);
    if (synced) {
      try {
        await terminate(this.db);
        await clearIndexedDbPersistence(this.db);
      } catch (error) {
        console.warn("Önbellek temizlenemedi", error);
      }
      window.location.reload();
    }
  }
};

// ui.js
var SVG_NS = "http://www.w3.org/2000/svg";
function apply(el, props) {
  Object.entries(props || {}).forEach(([key, value]) => {
    if (value === null || value === void 0 || value === false) return;
    if (key === "class") el.setAttribute("class", value);
    else if (key === "style" && typeof value === "object") {
      Object.entries(value).forEach(([k, v]) => el.style.setProperty(k, v));
    } else if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key === "value") el.value = value;
    else if (value === true) el.setAttribute(key, "");
    else el.setAttribute(key, value);
  });
}
function append(el, children) {
  children.flat(Infinity).forEach((child) => {
    if (child === null || child === void 0 || child === false) return;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
}
function h(tag, props, ...children) {
  const el = document.createElement(tag);
  apply(el, props);
  append(el, children);
  return el;
}
function s(tag, props, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  apply(el, props);
  append(el, children);
  return el;
}
var ICONS = {
  left: "M15 5l-7 7 7 7",
  right: "M9 5l7 7-7 7",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
  edit: "M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4",
  archive: "M4 5h16v4H4zM6 9v10h12V9M10 13h4",
  restore: "M4 12a8 8 0 1 0 2.5-5.8L4 8.5M4 4v4.5h4.5",
  trash: "M5 7h14M10 4h4M8 7l1 13h6l1-13",
  download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  upload: "M12 20V9M7 13l5-5 5 5M5 4h14",
  calendar: "M5 6h14v14H5zM5 10.5h14M9 3.5v4M15 3.5v4",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  sound: "M4 9.5v5h3.5L12 18V6L7.5 9.5H4zM15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11",
  cards: "M8 4h11v13H8zM5 7v13h11"
};
function icon(name, size = 22) {
  return s("svg", {
    class: "icon",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true"
  }, s("path", { d: ICONS[name] }));
}
function singleMark(color) {
  return s(
    "svg",
    { class: "mark", viewBox: "0 0 12 12", width: 12, height: 12, "aria-hidden": "true" },
    s("circle", { cx: 6, cy: 6, r: 6, fill: color })
  );
}

// app.js
var store = new Store();
var app = document.getElementById("app");
var state = {
  day: todayKey(),
  heatYear: "son",
  heatCell: null,
  signingIn: false,
  signInError: null,
  wordDraft: { word: "", meaning: "", example: "" },
  wordQuery: "",
  wordStatus: "all",
  wordLimit: 50,
  study: null,
  studySet: "learning",
  studyFront: "word"
};
var dayWatcher = null;
var THEME_KEY = "cetele-tema";
var systemDark = window.matchMedia("(prefers-color-scheme: dark)");
function savedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}
function activeTheme() {
  const saved = savedTheme();
  if (saved === "light" || saved === "dark") return saved;
  return systemDark.matches ? "dark" : "light";
}
function applyTheme() {
  const saved = savedTheme();
  if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
  else delete document.documentElement.dataset.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", activeTheme() === "dark" ? "#141416" : "#FFFFFF");
}
function setTheme(value) {
  try {
    if (value === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, value);
  } catch {
    toast("Tema tercihi bu tarayıcıda saklanamadı.");
  }
  applyTheme();
  render();
}
systemDark.addEventListener("change", () => {
  applyTheme();
  render();
});
var habitVars = (color) => {
  const shown = displayColor(color, activeTheme());
  return { "--c": shown, "--on": inkOn(shown) };
};
function toast(message, kind = "info") {
  const box = document.getElementById("toasts");
  const item = h("div", { class: `toast toast-${kind}`, role: kind === "error" ? "alert" : "status" }, message);
  box.append(item);
  setTimeout(() => item.remove(), kind === "error" ? 7e3 : 3500);
}
function openDialog(content, { onClose } = {}) {
  const dialog = h("dialog", { class: "sheet" }, content);
  document.body.append(dialog);
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (onClose) onClose();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close("cancel");
  });
  dialog.showModal();
  return dialog;
}
function confirmDialog({ title, body, confirmLabel, danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const dialog = openDialog(h(
      "div",
      { class: "sheet-body" },
      h("h2", null, title),
      h("p", null, body),
      h(
        "div",
        { class: "sheet-actions" },
        h("button", { type: "button", class: "btn btn-quiet", onclick: () => dialog.close() }, "Vazgeç"),
        h("button", {
          type: "button",
          class: `btn ${danger ? "btn-danger" : "btn-primary"}`,
          onclick: () => {
            result = true;
            dialog.close();
          }
        }, confirmLabel)
      )
    ), {
      onClose: () => resolve(result)
    });
  });
}
function habitForm(habit = null) {
  const isEdit = Boolean(habit);
  let color = habit ? habit.color : PALETTE[0].hex;
  const error = h("p", { class: "field-error", role: "alert", hidden: true });
  const warning = h("p", { class: "field-note", hidden: true });
  const name = h("input", {
    id: "habit-name",
    type: "text",
    maxlength: 80,
    required: true,
    autocomplete: "off",
    value: habit?.name || "",
    placeholder: "Örneğin: 20 sayfa kitap oku"
  });
  const description = h("textarea", {
    id: "habit-desc",
    rows: 2,
    maxlength: 200,
    placeholder: "İstersen kısa bir not ekle"
  });
  description.value = habit?.description || "";
  const unit = h("input", {
    id: "habit-unit",
    type: "text",
    maxlength: 20,
    autocomplete: "off",
    value: habit?.unit || "",
    placeholder: "Örneğin: sayfa, dakika, km"
  });
  const masterySelect = h(
    "select",
    { id: "habit-mastery" },
    h("option", { value: "" }, "Yok"),
    h("option", { value: "hours" }, "Bir işte uzmanlaşma: 10.000 saat"),
    h("option", { value: "words" }, "Dil öğrenimi: 5.000 kelime")
  );
  masterySelect.value = habit?.mastery || "";
  const daily = h("input", {
    id: "habit-daily",
    type: "text",
    inputmode: "decimal",
    autocomplete: "off",
    value: habit?.dailyDefault ? String(habit.dailyDefault).replace(".", ",") : ""
  });
  const dailyLabel = h("span");
  const dailyField = h(
    "label",
    { class: "field", for: "habit-daily" },
    dailyLabel,
    daily,
    h("small", { class: "field-note" }, "İşaretleyip kutuya sayı yazmadığın günlerde bu sayı eklenir.")
  );
  let manualUnit = habit?.mastery ? "" : unit.value;
  unit.addEventListener("input", () => {
    manualUnit = unit.value;
  });
  const syncMastery = () => {
    const kind = MASTERY[masterySelect.value];
    dailyField.hidden = !kind;
    unit.readOnly = Boolean(kind);
    if (kind) {
      unit.value = kind.unit;
      dailyLabel.textContent = kind.ask;
      daily.placeholder = `Örneğin: ${kind.defaultDaily}`;
      const autoValues = Object.values(MASTERY).map((k) => String(k.defaultDaily));
      if (!daily.value || !habit?.mastery && autoValues.includes(daily.value)) daily.value = String(kind.defaultDaily);
    } else {
      unit.value = manualUnit;
    }
  };
  masterySelect.addEventListener("change", syncMastery);
  syncMastery();
  const startDate = h("input", {
    id: "habit-start",
    type: "date",
    required: true,
    value: habit?.startDate || todayKey()
  });
  const duration = h("input", {
    id: "habit-duration",
    type: "text",
    inputmode: "numeric",
    autocomplete: "off",
    value: habit?.duration ? String(habit.duration) : "",
    placeholder: "Örneğin: 40"
  });
  const durationNote = h("small", { class: "field-note" });
  const parseDuration = () => {
    const text = duration.value.trim();
    if (text === "") return { ok: true, value: null };
    if (!/^\d{1,4}$/.test(text)) return { ok: false };
    const value = Number(text);
    return value >= 1 && value <= MAX_DURATION ? { ok: true, value } : { ok: false };
  };
  const refreshDuration = () => {
    const parsed = parseDuration();
    durationNote.textContent = parsed.ok && parsed.value && isValidKey(startDate.value) ? `Son gün: ${formatLong(endDate({ startDate: startDate.value, duration: parsed.value }))}. Süre bitince Bugün listesinden kalkar, sonucu sayfasında kalır.` : "Boş bırakırsan süresiz olur. 40 günlük bir deneme için 40 yaz.";
  };
  duration.addEventListener("input", refreshDuration);
  startDate.addEventListener("input", refreshDuration);
  refreshDuration();
  const custom = h("input", {
    type: "color",
    class: "swatch-custom",
    "aria-label": "Özel renk seç",
    value: color.toLowerCase(),
    oninput: (event) => {
      color = event.target.value;
      syncSwatches();
    }
  });
  const swatches = PALETTE.map((option) => h("button", {
    type: "button",
    class: "swatch",
    style: { "--swatch": displayColor(option.hex, activeTheme()) },
    "aria-label": option.name,
    title: option.name,
    onclick: () => {
      color = option.hex;
      syncSwatches();
    },
    dataset: { hex: option.hex }
  }));
  function syncSwatches() {
    swatches.forEach((el) => {
      const on = el.dataset.hex.toLowerCase() === color.toLowerCase();
      el.setAttribute("aria-pressed", String(on));
    });
    custom.value = color.toLowerCase();
  }
  syncSwatches();
  const refreshWarning = () => {
    if (!isEdit || !isValidKey(startDate.value)) {
      warning.hidden = true;
      return;
    }
    const days = store.done.get(habit.id) || /* @__PURE__ */ new Set();
    const before = [...days].filter((d) => d < startDate.value).length;
    warning.hidden = before === 0;
    warning.textContent = `Bu tarihten önce ${before} günlük kayıt var. Kayıtlar silinmez, ama istatistiklere girmez.`;
  };
  startDate.addEventListener("input", refreshWarning);
  refreshWarning();
  const submit = (event) => {
    event.preventDefault();
    const fail = (message, field) => {
      error.textContent = message;
      error.hidden = false;
      field.focus();
    };
    const cleanName = name.value.trim();
    if (!cleanName) return fail("Alışkanlığa bir ad ver.", name);
    if (!isValidKey(startDate.value)) return fail("Geçerli bir başlangıç tarihi seç.", startDate);
    const masteryType = isMasteryType(masterySelect.value) ? masterySelect.value : null;
    const parsedDaily = parseMeasure(daily.value);
    if (masteryType && (!parsedDaily.ok || !parsedDaily.value)) return fail("Günlük sayı 0'dan büyük olmalı.", daily);
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
      dailyDefault: masteryType ? parsedDaily.value : null
    };
    if (isEdit) {
      store.updateHabit(habit.id, fields);
      toast("Değişiklikler kaydedildi.");
    } else {
      store.addHabit(fields);
      toast("Alışkanlık eklendi.");
    }
    dialog.close();
    return void 0;
  };
  const dialog = openDialog(h(
    "form",
    { class: "sheet-body", onsubmit: submit, novalidate: true },
    h("h2", null, isEdit ? "Alışkanlığı düzenle" : "Yeni alışkanlık"),
    error,
    h("label", { class: "field", for: "habit-name" }, h("span", null, "Ad"), name),
    h("label", { class: "field", for: "habit-desc" }, h("span", null, "Açıklama (isteğe bağlı)"), description),
    h(
      "label",
      { class: "field", for: "habit-unit" },
      h("span", null, "Ölçü birimi (isteğe bağlı)"),
      unit,
      h("small", { class: "field-note" }, "Sayı kutusunda görünür. Boş bırakabilirsin.")
    ),
    h(
      "label",
      { class: "field", for: "habit-mastery" },
      h("span", null, "Uzmanlık takibi (isteğe bağlı)"),
      masterySelect,
      h("small", { class: "field-note" }, "Seçersen Uzmanlık sekmesinde toplamın ve hedefe kalan süre görünür.")
    ),
    dailyField,
    h(
      "div",
      { class: "field" },
      h("span", { id: "color-label" }, "Renk"),
      h(
        "div",
        { class: "swatches", role: "group", "aria-labelledby": "color-label" },
        swatches,
        h("label", { class: "swatch-custom-wrap" }, custom, h("span", null, "Özel"))
      )
    ),
    h("label", { class: "field", for: "habit-start" }, h("span", null, "Başlangıç tarihi"), startDate),
    warning,
    h(
      "label",
      { class: "field", for: "habit-duration" },
      h("span", null, "Kaç gün sürecek? (isteğe bağlı)"),
      duration,
      durationNote
    ),
    h(
      "div",
      { class: "sheet-actions" },
      h("button", { type: "button", class: "btn btn-quiet", onclick: () => dialog.close() }, "Vazgeç"),
      h("button", { type: "submit", class: "btn btn-primary" }, isEdit ? "Kaydet" : "Ekle")
    )
  ));
  name.focus();
}
async function askDelete(habit) {
  const count = (store.done.get(habit.id) || /* @__PURE__ */ new Set()).size;
  const words = store.words.filter((w) => w.habitId === habit.id).length;
  const ok = await confirmDialog({
    title: "Alışkanlık silinsin mi?",
    body: `"${habit.name}" ve ${count} günlük kaydı${words > 0 ? `, kelime arşivindeki ${words} kelimeyle birlikte,` : ""} kalıcı olarak silinecek. Bu işlem geri alınamaz. Geçmişini korumak istersen arşivle.`,
    confirmLabel: "Kalıcı olarak sil",
    danger: true
  });
  if (!ok) return;
  store.deleteHabit(habit.id);
  toast("Alışkanlık silindi.");
  if (location.hash.startsWith("#/aliskanlik/")) location.hash = "#/aliskanliklar";
}
function emptyState(title, text, action) {
  return h("div", { class: "empty" }, h("h2", null, title), h("p", null, text), action);
}
var addButton = (label = "Alışkanlık ekle") => h("button", {
  type: "button",
  class: "btn btn-primary",
  onclick: () => habitForm()
}, icon("plus", 20), label);
function goToDay(key) {
  state.day = key;
  render();
}
var doneSet = (habit) => store.done.get(habit.id) || /* @__PURE__ */ new Set();
function weekStrip(day, today) {
  const monday = startOfWeek(day);
  const cells = [];
  for (let i = 0; i < 7; i += 1) {
    const key = addDays(monday, i);
    const future = key > today;
    const summary = future ? null : daySummary(store.habits, store.done, key, today);
    const classes = ["week-day"];
    if (key === day) classes.push("is-selected");
    if (key === today) classes.push("is-today");
    if (summary?.rate === 100) classes.push("is-full");
    cells.push(h(
      "button",
      {
        type: "button",
        class: classes.join(" "),
        disabled: future,
        "aria-current": key === day ? "date" : null,
        "aria-label": `${formatLong(key)}${future ? ", gelecek gün" : `, ${formatPct(summary.rate)}`}`,
        dataset: { fk: `week-${key}` },
        onclick: () => goToDay(key)
      },
      h("span", { class: "week-name" }, GUNLER_KISA[i]),
      h("span", { class: "week-num" }, String(parseKey(key).d))
    ));
  }
  return h("div", { class: "week", role: "group", "aria-label": "Bu hafta" }, cells);
}
function viewToday(today) {
  if (state.day > today) state.day = today;
  const day = state.day;
  const isToday = day === today;
  const summary = daySummary(store.habits, store.done, day, today);
  const hasHabits = store.habits.length > 0;
  const head = h(
    "section",
    { class: "day-hero", "aria-label": "Seçili gün" },
    h(
      "div",
      { class: "day-head" },
      h(
        "div",
        { class: "day-heading" },
        h("h1", { class: "day-title" }, formatDayMonth(day)),
        h("p", { class: "day-sub" }, isToday ? `Bugün, ${weekdayName(day)}, ${parseKey(day).y}` : `${weekdayName(day)}, ${parseKey(day).y}`)
      ),
      summary.total > 0 && h(
        "p",
        { class: "day-pct" },
        h("strong", null, formatPct(summary.rate)),
        h("span", null, `${summary.done} / ${summary.total}`)
      )
    ),
    hasHabits && h(
      "div",
      { class: "day-nav" },
      h("button", {
        type: "button",
        class: "icon-btn",
        "aria-label": "Önceki gün",
        dataset: { fk: "prev" },
        onclick: () => goToDay(addDays(state.day, -1))
      }, icon("left", 20)),
      weekStrip(day, today),
      h("button", {
        type: "button",
        class: "icon-btn",
        "aria-label": "Sonraki gün",
        disabled: isToday,
        dataset: { fk: "next" },
        onclick: () => {
          if (state.day < todayKey()) goToDay(addDays(state.day, 1));
        }
      }, icon("right", 20)),
      h(
        "label",
        { class: "icon-btn date-pick", title: "Tarihe git" },
        icon("calendar", 20),
        h("span", { class: "sr-only" }, "Tarihe git"),
        h("input", {
          type: "date",
          max: today,
          value: day,
          dataset: { fk: "pick" },
          onclick: (event) => {
            try {
              event.target.showPicker();
            } catch {
            }
          },
          onchange: (event) => {
            const { value } = event.target;
            if (!isValidKey(value)) return;
            if (value > todayKey()) {
              toast("Gelecek günler işaretlenemez.");
              event.target.value = state.day;
              return;
            }
            goToDay(value);
          }
        })
      )
    ),
    !isToday && h(
      "div",
      { class: "past-note" },
      h("span", null, "Geçmiş bir gün."),
      h("button", {
        type: "button",
        class: "link-btn",
        dataset: { fk: "back-today" },
        onclick: () => goToDay(todayKey())
      }, "Bugüne dön")
    )
  );
  let body;
  if (!hasHabits) {
    body = emptyState("Henüz alışkanlık yok", "Takip etmek istediğin ilk alışkanlığı ekle.", addButton("İlk alışkanlığını ekle"));
  } else if (summary.total === 0) {
    const anyActive = store.habits.some((habit) => !habit.archived && !isFinished(habit, today));
    body = emptyState(
      isToday ? "Bugün için alışkanlık yok" : "Bu tarihte alışkanlık yok",
      isToday && !anyActive ? "Tüm alışkanlıkların arşivde ya da süresi bitti." : "Alışkanlıklar başlangıç tarihlerinden itibaren burada görünür.",
      isToday ? addButton() : null
    );
  } else {
    body = h(
      "section",
      { class: "habit-list", "aria-label": "Alışkanlıklar" },
      summary.list.map((habit) => habitRow(habit, day, today)),
      isToday && h("button", { type: "button", class: "btn-add-row", onclick: () => habitForm() }, icon("plus", 18), "Alışkanlık ekle")
    );
  }
  return h("div", { class: "today" }, head, h("div", { class: "today-main" }, body, isToday && todayLinks(today)));
}
function todayLinks(today) {
  const { reading } = sortBooks(store.books);
  const books = reading.map((book) => {
    const p = bookProgress(book, today);
    return h(
      "a",
      { class: "reading-link", href: "#/kitaplar" },
      h("span", { class: "reading-label" }, "Okuduğun kitap"),
      h("span", { class: "reading-title" }, book.title),
      h("span", { class: "reading-page" }, book.totalPages ? `${p.page} / ${book.totalPages}` : `${p.page}. sayfa`),
      icon("right", 18)
    );
  });
  const words = store.habits.filter((habit) => habit.mastery === "words" && !habit.archived).map((habit) => {
    const counts = wordCounts(wordsOf(habit.id), today);
    return h(
      "a",
      { class: "reading-link word-link", href: `#/kelimeler/${habit.id}` },
      h("span", { class: "reading-label" }, "Kelime arşivi"),
      h("span", { class: "reading-title" }, habit.name),
      h("span", { class: "reading-page" }, counts.today > 0 ? `bugün ${counts.today}` : `${counts.total} kelime`),
      icon("right", 18)
    );
  });
  if (books.length === 0 && words.length === 0) return null;
  return h("section", { class: "reading", "aria-label": "Kitaplar ve kelimeler" }, books, words);
}
function changeWord(value, suffix = "") {
  if (Math.round(value) === 0) return "değişim yok";
  return `${value > 0 ? "artış" : "düşüş"}${suffix}`;
}
function withUnit(value, habit) {
  return habit.unit ? `${formatNumber(value)} ${habit.unit}` : formatNumber(value);
}
function measureSummary(habit, today) {
  const cmp = measureComparison(habit, doneSet(habit), store.values.get(habit.id), today);
  if (cmp.state === "not-enough") {
    return {
      text: cmp.latest ? `${monthName(cmp.latest.month)}: ortalama ${withUnit(cmp.latest.average, habit)}.` : null,
      note: `Karşılaştırma için iki ayda en az 3'er giriş gerekir.`,
      delta: null
    };
  }
  const base = `${monthName(cmp.previous.month)}: ${withUnit(cmp.previous.average, habit)}. ${monthName(cmp.latest.month)}: ${withUnit(cmp.latest.average, habit)}.`;
  if (cmp.state === "from-zero") {
    return { text: base, delta: `${withUnit(Math.abs(cmp.diff), habit)} ${cmp.diff > 0 ? "artış" : "düşüş"}`, dir: cmp.diff };
  }
  const amount = Math.round(Math.abs(cmp.relative));
  return { text: base, delta: amount === 0 ? "Değişim yok" : `%${amount} ${changeWord(cmp.relative)}`, dir: amount === 0 ? 0 : cmp.relative };
}
function measureSection(habit, today) {
  const values = store.values.get(habit.id);
  const months = measureMonths(habit, doneSet(habit), values, today);
  if (months.length === 0) return null;
  const measure = measureSummary(habit, today);
  return h(
    "section",
    { class: "block" },
    h("h2", null, "Sayıların"),
    measure.delta && h("p", null, measure.text, " ", h("strong", null, `${measure.delta}.`)),
    h(
      "table",
      { class: "plain-table" },
      h("thead", null, h(
        "tr",
        null,
        h("th", { scope: "col" }, "Ay"),
        h("th", { scope: "col" }, "Giriş"),
        h("th", { scope: "col" }, "Günlük ortalama")
      )),
      h("tbody", null, months.map((row) => h(
        "tr",
        null,
        h("th", { scope: "row" }, row.title),
        h("td", null, `${row.count} gün`),
        h("td", null, withUnit(row.average, habit))
      )))
    )
  );
}
function habitMeta(habit, day, streak) {
  const parts = [];
  const challenge = challengeStatus(habit, /* @__PURE__ */ new Set(), day);
  if (challenge) parts.push(`Gün ${challenge.dayNumber} / ${challenge.total}`);
  if (streak > 0) parts.push(`${streak} gün seri`);
  return parts.join(", ");
}
function habitRow(habit, day, today) {
  const isDone = store.isDone(habit.id, day);
  const streak = computeStreaks(habit, doneSet(habit), today).current;
  return h(
    "article",
    {
      class: `habit-card${isDone ? " is-done" : ""}`,
      style: habitVars(habit.color)
    },
    h(
      "button",
      {
        type: "button",
        class: "habit",
        "aria-pressed": String(isDone),
        dataset: { fk: `habit-${habit.id}` },
        onclick: () => handleToggle(habit, day)
      },
      h("span", { class: "habit-check", "aria-hidden": "true" }, isDone && icon("check", 20)),
      h(
        "span",
        { class: "habit-text" },
        h("span", { class: "habit-name" }, habit.name),
        habit.description && h("span", { class: "habit-desc" }, habit.description),
        habit.archived && h("span", { class: "habit-desc" }, "Arşivde"),
        habitMeta(habit, day, streak) && h("span", { class: "habit-desc" }, habitMeta(habit, day, streak))
      )
    ),
    measureInput(habit, day, isDone),
    h("a", {
      class: "habit-more",
      href: `#/aliskanlik/${habit.id}`,
      "aria-label": `${habit.name} ayrıntıları`
    }, icon("right", 18))
  );
}
function measureInput(habit, day, isDone) {
  const stored = store.values.get(habit.id)?.[day];
  const hasValue = isDone && stored !== void 0;
  const question = habit.unit ? `Kaç ${habit.unit}?` : "Kaç?";
  const save = (event) => {
    const parsed = parseMeasure(event.target.value);
    if (!parsed.ok) {
      toast("Geçerli bir sayı yaz. Örneğin 20 veya 2,5.", "error");
      event.target.value = hasValue ? formatNumber(stored) : "";
      return;
    }
    holdRender();
    if (parsed.value === null && !isDone) return;
    if (!store.setValue(habit.id, day, parsed.value)) {
      toast("Bu gün için sayı girilemez.");
      return;
    }
    if (parsed.value !== null && parsed.value > 0 && !store.isDone(habit.id, day)) {
      handleToggle(habit, day, { deferRender: true });
    } else {
      requestRender();
    }
  };
  return h("input", {
    type: "text",
    inputmode: "decimal",
    autocomplete: "off",
    enterkeyhint: "done",
    class: "measure-input",
    placeholder: habit.unit || "Sayı",
    value: hasValue ? String(stored).replace(".", ",") : "",
    "aria-label": `${habit.name}: ${question}`,
    dataset: { fk: `measure-${habit.id}`, draft: "1" },
    onchange: save,
    onkeydown: (event) => {
      if (event.key === "Enter") event.target.blur();
    }
  });
}
function handleToggle(habit, day, { deferRender = false } = {}) {
  if (dayWatcher) dayWatcher.check();
  if (state.day !== day) return;
  if (!store.toggle(habit.id, day)) {
    toast("Bu gün işaretlenemez.");
    return;
  }
  if (deferRender) requestRender();
  else render();
}
function rankBlock(today) {
  const rank = rankHabits(store.habits, store.done, today);
  const row = (label, item, variant) => h(
    "a",
    {
      class: `rank rank-${variant}`,
      href: `#/aliskanlik/${item.habit.id}`
    },
    singleMark(displayColor(item.habit.color, activeTheme())),
    h("span", { class: "rank-text" }, h("span", { class: "rank-label" }, label), h("strong", null, item.habit.name)),
    h("span", { class: "rank-value" }, formatPct(item.stats.rate))
  );
  let items;
  if (rank.state === "no-data") {
    items = h("p", { class: "muted" }, "Karşılaştırma için bir alışkanlıkta en az 3 gün veri gerekiyor.");
  } else if (rank.state === "single") {
    items = [
      row("En istikrarlı", rank.best, "best"),
      h("p", { class: "muted" }, "Geliştirilecek alışkanlığı görmek için ikinci bir alışkanlıkta da 3 gün veri gerekiyor.")
    ];
  } else if (rank.state === "tied") {
    items = h("p", { class: "muted" }, `Tüm alışkanlıkların son 30 günde ${formatPct(rank.best.stats.rate)} ile aynı seviyede.`);
  } else {
    items = [row("En istikrarlı", rank.best, "best"), row("En çok geliştirilmesi gereken", rank.worst, "worst")];
  }
  return h("section", { class: "block" }, h("h2", null, "Son 30 günde"), items);
}
function changeLine(cmp, thisLabel, prevLabel) {
  const now2 = cmp.current.rate;
  const before = cmp.previous.rate;
  if (cmp.state === "no-current") return `${thisLabel} henüz işaret yok.`;
  if (cmp.state === "no-previous") return `${thisLabel} ${formatPct(now2)}. ${prevLabel} için veri yok.`;
  const base = `${thisLabel} ${formatPct(now2)}, ${prevLabel.toLowerCase()} ${formatPct(before)}.`;
  if (cmp.state === "from-zero") return base;
  const amount = Math.round(Math.abs(cmp.relative));
  if (amount === 0) return `${base} Değişim yok.`;
  return `${base} ${cmp.relative > 0 ? `%${amount} daha iyi.` : `%${amount} daha az.`}`;
}
function periodTable(title, firstHeader, rows) {
  if (rows.length === 0) return null;
  return h(
    "section",
    { class: "block" },
    h("h2", null, title),
    h(
      "table",
      { class: "plain-table" },
      h("thead", null, h(
        "tr",
        null,
        h("th", { scope: "col" }, firstHeader),
        h("th", { scope: "col" }, "Yapılan"),
        h("th", { scope: "col" }, "Oran")
      )),
      h("tbody", null, rows.map((row) => h(
        "tr",
        null,
        h("th", { scope: "row" }, row.label),
        h("td", null, `${row.done} / ${row.total}`),
        h("td", null, h("strong", null, formatPct(row.rate)))
      )))
    )
  );
}
function viewProgress(today) {
  if (store.habits.length === 0) {
    return h(
      "div",
      { class: "page" },
      h("h1", { class: "page-title" }, "İlerleme"),
      emptyState("Gösterilecek veri yok", "İstatistikler alışkanlık ekleyip işaretlemeye başladığında burada oluşur.", addButton())
    );
  }
  const summary = daySummary(store.habits, store.done, today, today);
  const week = weekComparison(store.habits, store.done, today);
  const month = monthComparison(store.habits, store.done, today);
  const leader = streakLeader(store.habits, store.done, today);
  const active = store.habits.filter((habit) => !habit.archived && !isFinished(habit, today));
  const finished = store.habits.filter((habit) => !habit.archived && isFinished(habit, today));
  const archived = store.habits.filter((habit) => habit.archived);
  const weeks = [...weeklySeries(store.habits, store.done, today, 4)].reverse().filter((point) => point.rate !== null).map((point) => ({ ...point, label: point.isCurrent ? "Bu hafta" : point.title }));
  const months = [...monthlySeries(store.habits, store.done, today, 6)].reverse().filter((point) => point.rate !== null).map((point) => ({ ...point, label: point.isCurrent ? "Bu ay" : monthName(point.from.slice(0, 7)) }));
  return h(
    "div",
    { class: "page" },
    h("h1", { class: "page-title" }, "İlerleme"),
    h(
      "ul",
      { class: "summary-list", "aria-label": "Özet" },
      h("li", null, summary.total === 0 ? "Bugün için alışkanlık yok." : `Bugün ${summary.done} / ${summary.total} tamamlandı.`),
      h("li", null, changeLine(week, "Bu hafta", "Geçen hafta")),
      h("li", null, changeLine(month, "Bu ay", "Geçen ay")),
      leader && h("li", null, `En uzun süren serin ${leader.streak} gün: ${leader.habit.name}.`)
    ),
    periodTable("Haftalar", "Hafta", weeks),
    periodTable("Aylar", "Ay", months),
    rankBlock(today),
    h(
      "section",
      { class: "block" },
      h("h2", null, "Alışkanlıklar"),
      active.length > 0 ? h("div", { class: "stat-list" }, active.map((habit) => statRow(habit, today))) : h("p", { class: "muted" }, "Etkin alışkanlık yok.")
    ),
    finished.length > 0 && h(
      "section",
      { class: "block" },
      h("h2", null, "Süresi bitenler"),
      h("div", { class: "stat-list" }, finished.map((habit) => statRow(habit, today)))
    ),
    archived.length > 0 && h(
      "section",
      { class: "block" },
      h("h2", null, "Arşiv"),
      h("div", { class: "stat-list" }, archived.map((habit) => statRow(habit, today)))
    ),
    h("p", { class: "footnote" }, "Oran, yapılması gereken günlerin yüzde kaçını yaptığını gösterir. Bugün henüz yapmadıkların haftalık ve aylık oranı düşürmez.")
  );
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
  return h(
    "a",
    { class: "stat-row", href: `#/aliskanlik/${habit.id}` },
    singleMark(displayColor(habit.color, activeTheme())),
    h(
      "span",
      { class: "stat-main" },
      h("span", { class: "stat-name" }, habit.name),
      h("span", { class: "stat-small" }, statSmall(habit, stats, notStarted, today))
    ),
    h("span", { class: "stat-value" }, formatPct(stats.overall.rate))
  );
}
function statLine(label, win) {
  return h(
    "tr",
    null,
    h("th", { scope: "row" }, label),
    h("td", null, win.total === 0 ? "—" : `${win.done} / ${win.total} gün`),
    h("td", null, h("strong", null, formatPct(win.rate)))
  );
}
function heatmap(habit, today) {
  const done = store.done.get(habit.id) || /* @__PURE__ */ new Set();
  const firstYear = Math.min(parseKey(habit.startDate).y, ...[...done].map((d) => parseKey(d).y));
  const thisYear = parseKey(today).y;
  const years = [];
  for (let y = thisYear; y >= Math.min(firstYear, thisYear); y -= 1) years.push(y);
  const selected = state.heatYear;
  const from = selected === "son" ? addDays(startOfWeek(today), -52 * 7) : startOfWeek(`${selected}-01-01`);
  const lastDay = selected === "son" ? today : `${selected}-12-31` > today ? today : `${selected}-12-31`;
  const inView = (key) => selected === "son" || parseKey(key).y === Number(selected);
  const status = (key) => {
    if (key < habit.startDate) return "out";
    if (done.has(key)) return "done";
    if (isInArchive(habit, key)) return "out";
    return "miss";
  };
  const statusText = { done: "Yapıldı", miss: "Yapılmadı", out: "Sayılmıyor" };
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
      cells.push(h("span", {
        class: `cell cell-${st}${state.heatCell === cursor ? " is-picked" : ""}`,
        style: { "grid-column": col + 1, "grid-row": row + 1 },
        title: `${formatLong(cursor)}: ${statusText[st]}`,
        dataset: { date: cursor, st }
      }));
      const { m, d } = parseKey(cursor);
      if (m !== lastMonth && d <= 7 && row === 0) {
        monthMarks.push(h("span", { style: { "grid-column": col + 1 } }, AYLAR_KISA[m - 1]));
        lastMonth = m;
      }
    }
    cursor = addDays(cursor, 1);
  }
  const columns = col + 1;
  const readout = h("div", { class: "heat-readout", "aria-live": "polite" });
  const pick = (key) => {
    state.heatCell = key;
    grid.querySelectorAll(".is-picked").forEach((el2) => el2.classList.remove("is-picked"));
    const el = grid.querySelector(`[data-date="${key}"]`);
    if (el) el.classList.add("is-picked");
    readout.textContent = "";
    if (!key) return;
    const st = status(key);
    readout.append(
      h(
        "span",
        null,
        h("strong", null, `${formatLong(key)}, ${weekdayName(key)}: `),
        statusText[st],
        st === "done" && habit.unit && store.values.get(habit.id)?.[key] !== void 0 && `, ${formatNumber(store.values.get(habit.id)[key])} ${habit.unit}`
      ),
      key >= habit.startDate && h("button", {
        type: "button",
        class: "link-btn",
        onclick: () => {
          state.day = key;
          location.hash = "#/";
        }
      }, "Bu güne git")
    );
  };
  const grid = h("div", {
    class: "heat-grid",
    style: { "--cols": columns },
    tabindex: 0,
    role: "group",
    "aria-label": `${habit.name} yıllık takvim. Ok tuşlarıyla günler arasında gezebilirsin.`,
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
    }
  }, cells);
  const yearSelect = h(
    "select",
    {
      "aria-label": "Takvim dönemi",
      dataset: { fk: "heat-year" },
      onchange: (event) => {
        state.heatYear = event.target.value;
        state.heatCell = null;
        render();
      }
    },
    h("option", { value: "son", selected: selected === "son" }, "Son 12 ay"),
    years.map((y) => h("option", { value: String(y), selected: String(selected) === String(y) }, String(y)))
  );
  const wrap = h(
    "div",
    { class: "heat-scroll" },
    h(
      "div",
      { class: "heat", style: { "--cols": columns } },
      h("div", { class: "heat-months", style: { "--cols": columns } }, monthMarks),
      h(
        "div",
        { class: "heat-days", "aria-hidden": "true" },
        [0, 2, 4].map((i) => h("span", { style: { "grid-row": i + 1 } }, GUNLER_KISA[i]))
      ),
      grid
    )
  );
  requestAnimationFrame(() => {
    wrap.scrollLeft = wrap.scrollWidth;
  });
  if (state.heatCell && inView(state.heatCell)) requestAnimationFrame(() => pick(state.heatCell));
  return h(
    "section",
    { class: "block" },
    h("div", { class: "block-head" }, h("h2", null, "Yıllık takvim"), yearSelect),
    wrap,
    h(
      "div",
      { class: "heat-legend" },
      h("span", null, h("i", { class: "cell cell-done" }), "Yapıldı"),
      h("span", null, h("i", { class: "cell cell-miss" }), "Yapılmadı"),
      h("span", null, h("i", { class: "cell cell-out" }), "Sayılmıyor")
    ),
    readout
  );
}
function viewHabit(id, today) {
  const habit = store.habits.find((item) => item.id === id);
  if (!habit) {
    return h("div", { class: "page" }, emptyState(
      "Alışkanlık bulunamadı",
      "Silinmiş olabilir.",
      h("a", { class: "btn btn-primary", href: "#/ilerleme" }, "İlerlemeye dön")
    ));
  }
  const done = doneSet(habit);
  const stats = habitStats(habit, done, today);
  const notStarted = habit.startDate > today;
  return h(
    "div",
    { class: "page", style: habitVars(habit.color) },
    h("a", { class: "back", href: "#/ilerleme" }, icon("left", 18), "İlerleme"),
    h(
      "header",
      { class: "habit-head" },
      h("h1", { class: "page-title" }, singleMark(displayColor(habit.color, activeTheme())), habit.name),
      habit.description && h("p", { class: "muted" }, habit.description),
      h("p", { class: "muted" }, `Başlangıç: ${formatLong(habit.startDate)}${habit.archived ? ". Arşivde." : ""}`)
    ),
    challengeSection(habit, today),
    notStarted ? !habit.duration && emptyState("Henüz başlamadı", `Bu alışkanlık ${formatLong(habit.startDate)} tarihinde başlıyor.`, null) : [
      h(
        "dl",
        { class: "habit-facts" },
        h("div", null, h("dt", null, "Mevcut seri"), h("dd", null, `${stats.currentStreak} gün`)),
        h("div", null, h("dt", null, "En uzun seri"), h("dd", null, `${stats.longestStreak} gün`)),
        h("div", null, h("dt", null, "Toplam"), h("dd", null, `${stats.totalDone} gün`))
      ),
      h(
        "table",
        { class: "plain-table" },
        h("thead", null, h(
          "tr",
          null,
          h("th", { scope: "col" }, "Dönem"),
          h("th", { scope: "col" }, "Yapılan"),
          h("th", { scope: "col" }, "Oran")
        )),
        h(
          "tbody",
          null,
          statLine("Başlangıçtan beri", stats.overall),
          statLine("Son 7 gün", stats.last7),
          statLine("Son 30 gün", stats.last30),
          statLine("Son 365 gün", stats.last365)
        )
      ),
      heatmap(habit, today),
      measureSection(habit, today)
    ],
    h("div", { class: "habit-actions" }, habitActions(habit))
  );
}
function challengeSection(habit, today) {
  const c = challengeStatus(habit, doneSet(habit), today);
  if (!c) return null;
  let summary;
  if (c.notStarted) summary = `${formatLong(habit.startDate)} tarihinde başlıyor. ${c.total} gün sürecek, son gün ${formatLong(c.end)}.`;
  else if (c.finished) summary = `Bitti. ${c.total} günün ${c.done} gününde yaptın, ${c.missed} gün kaçırdın.`;
  else summary = `Gün ${c.dayNumber} / ${c.total}. ${c.done} gün yapıldı, ${c.missed} gün kaçırıldı, ${c.left} gün kaldı.`;
  const label = { done: "Yapıldı", miss: "Yapılmadı", today: "Bugün, henüz yapılmadı", future: "Henüz gelmedi", out: "Arşivde" };
  return h(
    "section",
    { class: "block" },
    h("h2", null, `${c.total} günlük tablo`),
    h("p", null, summary),
    h("div", { class: "challenge", role: "list" }, c.days.map((d) => h("button", {
      type: "button",
      role: "listitem",
      class: `challenge-day is-${d.state}`,
      disabled: d.state === "future",
      "aria-label": `${d.n}. gün, ${formatLong(d.key)}: ${label[d.state]}`,
      title: `${formatLong(d.key)}: ${label[d.state]}`,
      onclick: () => {
        state.day = d.key;
        location.hash = "#/";
      }
    }, String(d.n)))),
    h("p", { class: "field-note" }, "Dolu kutu yapıldı, boş kutu yapılmadı demek. Bir güne dokunarak o günü düzeltebilirsin.")
  );
}
function habitActions(habit) {
  const hasWords = habit.mastery === "words" || store.words.some((w) => w.habitId === habit.id);
  return [
    hasWords && h("a", { class: "btn btn-quiet btn-small", href: `#/kelimeler/${habit.id}` }, icon("cards", 18), "Kelime arşivi"),
    h("button", { type: "button", class: "btn btn-quiet btn-small", onclick: () => habitForm(habit) }, icon("edit", 18), "Düzenle"),
    habit.archived ? h("button", {
      type: "button",
      class: "btn btn-quiet btn-small",
      onclick: () => {
        store.unarchiveHabit(habit.id);
        toast("Alışkanlık arşivden çıkarıldı.");
      }
    }, icon("restore", 18), "Arşivden çıkar") : h("button", {
      type: "button",
      class: "btn btn-quiet btn-small",
      onclick: () => {
        store.archiveHabit(habit.id);
        toast("Alışkanlık arşivlendi. Geçmişi korunuyor.");
      }
    }, icon("archive", 18), "Arşivle"),
    h("button", { type: "button", class: "btn btn-quiet btn-small btn-danger-text", onclick: () => askDelete(habit) }, icon("trash", 18), "Sil")
  ];
}
function manageSheet(habit) {
  const close = (action) => () => {
    dialog.close();
    action();
  };
  const dialog = openDialog(h(
    "div",
    { class: "sheet-body" },
    h("h2", null, habit.name),
    h(
      "div",
      { class: "sheet-list" },
      h("button", { type: "button", class: "btn btn-quiet", onclick: close(() => habitForm(habit)) }, icon("edit", 20), "Düzenle"),
      habit.archived ? h("button", {
        type: "button",
        class: "btn btn-quiet",
        onclick: close(() => {
          store.unarchiveHabit(habit.id);
          toast("Alışkanlık arşivden çıkarıldı.");
        })
      }, icon("restore", 20), "Arşivden çıkar") : h("button", {
        type: "button",
        class: "btn btn-quiet",
        onclick: close(() => {
          store.archiveHabit(habit.id);
          toast("Alışkanlık arşivlendi. Geçmişi korunuyor.");
        })
      }, icon("archive", 20), "Arşivle"),
      h("button", { type: "button", class: "btn btn-quiet btn-danger-text", onclick: close(() => askDelete(habit)) }, icon("trash", 20), "Sil")
    ),
    h(
      "div",
      { class: "sheet-actions" },
      h("button", { type: "button", class: "btn btn-quiet", onclick: () => dialog.close() }, "Kapat")
    )
  ));
}
function manageRow(habit, today) {
  const count = habitStats(habit, doneSet(habit), today).totalDone;
  return h(
    "div",
    { class: "manage-row" },
    singleMark(displayColor(habit.color, activeTheme())),
    h(
      "a",
      { class: "manage-text", href: `#/aliskanlik/${habit.id}` },
      h("strong", null, habit.name),
      h("span", null, habit.startDate > today ? `${formatLong(habit.startDate)} tarihinde başlıyor` : `${count} gün tamamlandı${habit.duration ? `, ${habit.duration} günlük` : ""}`)
    ),
    h("button", {
      type: "button",
      class: "icon-btn",
      "aria-label": `${habit.name} seçenekleri`,
      dataset: { fk: `manage-${habit.id}` },
      onclick: () => manageSheet(habit)
    }, icon("more", 22))
  );
}
function viewManage(today) {
  const active = store.habits.filter((habit) => !habit.archived && !isFinished(habit, today));
  const finished = store.habits.filter((habit) => !habit.archived && isFinished(habit, today));
  const archived = store.habits.filter((habit) => habit.archived);
  return h(
    "div",
    { class: "page" },
    h(
      "div",
      { class: "page-head" },
      h("h1", { class: "page-title" }, "Alışkanlıklar"),
      store.habits.length > 0 && addButton("Ekle")
    ),
    store.habits.length === 0 ? emptyState("Liste boş", "Takip etmek istediğin ilk alışkanlığı ekleyerek başla.", addButton("İlk alışkanlığını ekle")) : [
      active.length > 0 ? h("section", { class: "manage-list" }, active.map((habit) => manageRow(habit, today))) : h("p", { class: "muted" }, "Etkin alışkanlık yok."),
      finished.length > 0 && h(
        "section",
        { class: "block" },
        h("h2", null, "Süresi bitenler"),
        h("p", { class: "muted" }, "Süreyi uzatmak için Düzenle'ye girip gün sayısını değiştir ya da sil."),
        h("div", { class: "manage-list" }, finished.map((habit) => manageRow(habit, today)))
      ),
      archived.length > 0 && h(
        "section",
        { class: "block" },
        h("h2", null, "Arşiv"),
        h("p", { class: "muted" }, "Arşivdeki alışkanlıklar günlük listede görünmez, geçmişleri korunur."),
        h("div", { class: "manage-list" }, archived.map((habit) => manageRow(habit, today)))
      )
    ]
  );
}
function masteryCard(habit, today) {
  const m = masteryStatus(habit, doneSet(habit), store.values.get(habit.id), today);
  const unit = m.kind.goalUnit;
  let pace;
  if (m.daysLeft === 0) pace = `${m.kind.name} hedefine ulaştın.`;
  else if (m.perDay > 0) {
    pace = `Son 30 günde günde ortalama ${formatWithUnit(m.perDay, m.kind)}. Bu hızla hedefe yaklaşık ${formatSpan(m.daysLeft)} kaldı.`;
  } else pace = "Son 30 günde kayıt yok, bu yüzden kalan süre hesaplanamıyor.";
  const status = [];
  if (habit.archived) status.push("Arşivde.");
  else if (isFinished(habit, today)) status.push("Süresi bitti.");
  return h(
    "article",
    { class: "book", style: habitVars(habit.color) },
    h(
      "div",
      { class: "book-head" },
      h(
        "a",
        { class: "book-name", href: `#/aliskanlik/${habit.id}` },
        h("strong", null, habit.name),
        h("span", { class: "muted" }, `Hedef: ${m.kind.name}${status.length ? `. ${status.join(" ")}` : ""}`)
      )
    ),
    h(
      "p",
      { class: "book-progress" },
      h("span", null, `${formatAmount(m.current)} / ${formatAmount(m.target)} ${unit}`),
      h("strong", null, formatPercent(m.percent))
    ),
    h(
      "div",
      { class: "meter-track", "aria-hidden": "true" },
      h("span", { class: "meter-fill mastery-fill", style: { width: `${Math.max(m.percent, m.current > 0 ? 0.6 : 0)}%` } })
    ),
    h(
      "ul",
      { class: "plain-list mastery-lines" },
      h("li", null, `${m.days} gün çalıştın. Bu ay ${formatWithUnit(m.month, m.kind)}.`),
      h("li", null, pace)
    ),
    habit.mastery === "words" && wordButtons(habit)
  );
}
function wordButtons(habit) {
  const total = store.words.filter((w) => w.habitId === habit.id).length;
  return h(
    "div",
    { class: "button-row word-buttons" },
    h("a", { class: "btn btn-quiet btn-small", href: `#/kelimeler/${habit.id}` }, icon("cards", 18), `Kelime arşivi (${total})`),
    total > 0 && h("a", { class: "btn btn-quiet btn-small", href: `#/calis/${habit.id}` }, "Çalış")
  );
}
function viewMastery(today) {
  const list = store.habits.filter((habit) => habit.mastery).sort((a, b) => Number(a.archived) - Number(b.archived));
  return h(
    "div",
    { class: "page" },
    h("h1", { class: "page-title" }, "Uzmanlık"),
    list.length === 0 ? emptyState(
      "Henüz uzmanlık takibi yok",
      'Bir alışkanlığı düzenleyip "Uzmanlık takibi" alanından 10.000 saat ya da 5.000 kelime seç. Bugün ekranında işaretledikçe burada birikir.',
      h("a", { class: "btn btn-primary", href: "#/aliskanliklar" }, "Alışkanlıklara git")
    ) : [
      h("p", { class: "muted" }, "Bugün ekranında işaretlediğin günler buraya eklenir. Kutuya sayı yazdıysan o sayı, yazmadıysan alışkanlıktaki günlük sayı sayılır."),
      h("div", { class: "books" }, list.map((habit) => masteryCard(habit, today)))
    ]
  );
}
var WORD_PAGE = 50;
var STUDY_SIZE = 20;
var canSpeak = typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance === "function";
var wordsOf = (habitId) => sortWords(store.words.filter((w) => w.habitId === habitId));
function speak(text) {
  try {
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  } catch {
    toast("Sesli okuma bu tarayıcıda çalışmadı.");
  }
}
function speakButton(text, size = 20) {
  if (!canSpeak) return null;
  return h("button", {
    type: "button",
    class: "icon-btn speak-btn",
    "aria-label": `${text} sesli oku`,
    title: "Sesli oku",
    onclick: (event) => {
      event.stopPropagation();
      speak(text);
    }
  }, icon("sound", size));
}
function wordDayLabel(key, today) {
  if (key === today) return "Bugün";
  if (key === addDays(today, -1)) return "Dün";
  const year = parseKey(key).y === parseKey(today).y ? "" : ` ${parseKey(key).y}`;
  return `${formatDayMonth(key)}${year}, ${weekdayName(key)}`;
}
function wordInputs(prefix, values) {
  const make = (name, max, placeholder, extra) => h("input", {
    id: `${prefix}-${name}`,
    type: "text",
    maxlength: max,
    autocomplete: "off",
    value: values[name] || "",
    placeholder,
    dataset: { fk: `${prefix}-${name}` },
    ...extra
  });
  return {
    word: make("word", MAX_WORD, "Örneğin: improve", {
      autocapitalize: "off",
      autocorrect: "off",
      spellcheck: "false",
      enterkeyhint: "next"
    }),
    meaning: make("meaning", MAX_MEANING, "Örneğin: geliştirmek", { autocapitalize: "off", enterkeyhint: "done" }),
    example: make("example", MAX_EXAMPLE, "Örneğin: I want to improve my English.", { spellcheck: "false", enterkeyhint: "done" })
  };
}
function wordFields2(inputs) {
  return [
    h("label", { class: "field", for: inputs.word.id }, h("span", null, "Kelime"), inputs.word),
    h("label", { class: "field", for: inputs.meaning.id }, h("span", null, "Anlamı"), inputs.meaning),
    h("label", { class: "field", for: inputs.example.id }, h("span", null, "Örnek cümle (isteğe bağlı)"), inputs.example)
  ];
}
function readWord(inputs, list, exceptId = null) {
  const word = cleanText(inputs.word.value, MAX_WORD);
  const meaning = cleanText(inputs.meaning.value, MAX_MEANING);
  const example = cleanText(inputs.example.value, MAX_EXAMPLE);
  if (!word) return { error: "Kelimeyi yaz.", field: inputs.word };
  if (!meaning) return { error: "Anlamını da yaz. Çalışırken kartın arkasında görünür.", field: inputs.meaning };
  const same = findDuplicate(list, word, exceptId);
  if (same) return { error: `"${same.word}" zaten arşivde. ${formatDayMonth(same.date)} tarihinde eklemişsin.`, field: inputs.word };
  return { fields: { word, meaning, example } };
}
function nextOnEnter(inputs) {
  inputs.word.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing || inputs.meaning.value.trim()) return;
    event.preventDefault();
    inputs.meaning.focus();
  });
}
function wordAddForm(habit, list) {
  const inputs = wordInputs("new", state.wordDraft);
  const error = h("p", { class: "field-error", role: "alert", hidden: true });
  Object.entries(inputs).forEach(([name, input]) => input.addEventListener("input", () => {
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
    state.wordDraft = { word: "", meaning: "", example: "" };
    Object.values(inputs).forEach((input) => {
      input.value = "";
    });
    inputs.word.focus();
    store.addWord(habit.id, result.fields);
    toast(`"${result.fields.word}" kaydedildi.`);
  };
  return h(
    "form",
    { class: "word-form", onsubmit: submit, novalidate: true },
    h("h2", null, "Yeni kelime"),
    error,
    wordFields2(inputs),
    h("button", { type: "submit", class: "btn btn-primary" }, icon("plus", 20), "Kaydet")
  );
}
function wordEditForm(item) {
  const inputs = wordInputs("edit", item);
  const error = h("p", { class: "field-error", role: "alert", hidden: true });
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
    toast("Değişiklikler kaydedildi.");
    dialog.close();
  };
  const dialog = openDialog(h(
    "form",
    { class: "sheet-body", onsubmit: submit, novalidate: true },
    h("h2", null, "Kelimeyi düzenle"),
    error,
    wordFields2(inputs),
    h(
      "div",
      { class: "sheet-actions" },
      h("button", { type: "button", class: "btn btn-quiet", onclick: () => dialog.close() }, "Vazgeç"),
      h("button", { type: "submit", class: "btn btn-primary" }, "Kaydet")
    )
  ));
  inputs.word.focus();
}
async function askDeleteWord(item) {
  const ok = await confirmDialog({
    title: "Kelime silinsin mi?",
    body: `"${item.word}" arşivden kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
    confirmLabel: "Kalıcı olarak sil",
    danger: true
  });
  if (!ok) return;
  store.deleteWord(item);
  toast("Kelime silindi.");
}
function toggleLearned(item) {
  store.setLearned([item], !item.learned);
  toast(item.learned ? "Kelime yeniden çalışılacaklara alındı." : "Öğrendim olarak işaretlendi.");
}
function wordSheet(item) {
  const close = (action) => () => {
    dialog.close();
    action();
  };
  const dialog = openDialog(h(
    "div",
    { class: "sheet-body" },
    h("div", { class: "word-sheet-head" }, h("h2", null, item.word), speakButton(item.word, 22)),
    h("p", null, item.meaning),
    item.example && h("p", { class: "word-example" }, item.example),
    h("p", { class: "field-note" }, `${formatLong(item.date)} tarihinde eklendi.${item.learned ? " Öğrendim olarak işaretli." : ""}`),
    h(
      "div",
      { class: "sheet-list" },
      h("button", { type: "button", class: "btn btn-quiet", onclick: close(() => wordEditForm(item)) }, icon("edit", 20), "Düzenle"),
      h(
        "button",
        { type: "button", class: "btn btn-quiet", onclick: close(() => toggleLearned(item)) },
        icon(item.learned ? "restore" : "check", 20),
        item.learned ? "Yeniden öğreniyorum" : "Öğrendim"
      ),
      h("button", { type: "button", class: "btn btn-quiet btn-danger-text", onclick: close(() => askDeleteWord(item)) }, icon("trash", 20), "Sil")
    ),
    h(
      "div",
      { class: "sheet-actions" },
      h("button", { type: "button", class: "btn btn-quiet", onclick: () => dialog.close() }, "Kapat")
    )
  ));
}
function wordRow(item) {
  return h(
    "div",
    { class: `word-row${item.learned ? " is-learned" : ""}` },
    h(
      "button",
      {
        type: "button",
        class: "word-main",
        dataset: { fk: `w-${item.id}` },
        onclick: () => wordSheet(item)
      },
      h("span", { class: "word-text" }, item.word),
      h("span", { class: "word-meaning" }, item.meaning),
      item.example && h("span", { class: "word-example" }, item.example)
    ),
    item.learned && h("span", { class: "word-learned", title: "Öğrendin" }, icon("check", 18), h("span", { class: "sr-only" }, "Öğrendin")),
    speakButton(item.word)
  );
}
function missingHabit(title) {
  return h("div", { class: "page" }, emptyState(
    title,
    "Alışkanlık silinmiş olabilir.",
    h("a", { class: "btn btn-primary", href: "#/uzmanlik" }, "Uzmanlığa dön")
  ));
}
function viewWords(id, today) {
  const habit = store.habits.find((item) => item.id === id);
  if (!habit) return missingHabit("Kelime arşivi bulunamadı");
  const all = wordsOf(id);
  const counts = wordCounts(all, today);
  const list = filterWords(all, { query: state.wordQuery, status: state.wordStatus });
  const shown = list.slice(0, state.wordLimit);
  const search = h("input", {
    type: "search",
    class: "word-search",
    placeholder: "Kelimelerde ara",
    "aria-label": "Kelimelerde ara",
    autocomplete: "off",
    autocapitalize: "off",
    spellcheck: "false",
    value: state.wordQuery,
    dataset: { fk: "word-search" },
    oninput: (event) => {
      state.wordQuery = event.target.value;
      state.wordLimit = WORD_PAGE;
      render();
    }
  });
  const statusOption = (value, label) => h("button", {
    type: "button",
    "aria-pressed": String(state.wordStatus === value),
    dataset: { fk: `ws-${value}` },
    onclick: () => {
      state.wordStatus = value;
      state.wordLimit = WORD_PAGE;
      render();
    }
  }, label);
  let summary = 'Gün içinde öğrendiğin kelimeleri buraya yaz. Sonra "Çalış" ile kartlarla tekrar edersin.';
  if (counts.total > 0) {
    summary = `${counts.total} kelime. Bugün ${counts.today}, son 7 günde ${counts.week} kelime ekledin.`;
    if (counts.learned > 0) summary += ` ${counts.learned} kelimeyi öğrendin.`;
  }
  return h(
    "div",
    { class: "page", style: habitVars(habit.color) },
    h("a", { class: "back", href: "#/uzmanlik" }, icon("left", 18), "Uzmanlık"),
    h(
      "div",
      { class: "page-head" },
      h(
        "div",
        { class: "page-heading" },
        h("h1", { class: "page-title" }, "Kelime arşivi"),
        h("p", { class: "muted" }, habit.name)
      ),
      counts.total > 0 && h("a", { class: "btn btn-primary", href: `#/calis/${habit.id}` }, icon("cards", 20), "Çalış")
    ),
    h("p", { class: "word-summary" }, summary),
    wordAddForm(habit, all),
    counts.total > 0 && h(
      "section",
      { class: "block" },
      h("h2", null, "Kelimelerim"),
      h(
        "div",
        { class: "word-tools" },
        search,
        h(
          "div",
          { class: "segmented segmented-fill", role: "group", "aria-label": "Hangi kelimeler" },
          statusOption("all", "Tümü"),
          statusOption("learning", "Öğreniyorum"),
          statusOption("learned", "Öğrendim")
        )
      ),
      list.length === 0 ? h("p", { class: "muted" }, state.wordQuery.trim() ? "Bu aramayla eşleşen kelime yok." : "Bu listede kelime yok.") : groupByDay(shown).map((group) => h(
        "div",
        { class: "word-group" },
        h("h3", { class: "word-day" }, `${wordDayLabel(group.date, today)} · ${group.items.length} kelime`),
        h("div", { class: "word-list" }, group.items.map(wordRow))
      )),
      list.length > shown.length && h("button", {
        type: "button",
        class: "btn btn-quiet",
        dataset: { fk: "word-more" },
        onclick: () => {
          state.wordLimit += WORD_PAGE;
          render();
        }
      }, `Daha fazla göster (${list.length - shown.length} kelime daha)`)
    )
  );
}
function startStudy(habitId, ids, set) {
  const queue = shuffle(ids).slice(0, STUDY_SIZE);
  state.study = {
    habitId,
    set,
    front: state.studyFront,
    queue,
    pos: 0,
    revealed: false,
    first: {},
    done: /* @__PURE__ */ new Set(),
    total: queue.length,
    finished: false,
    marked: false
  };
  render();
}
function studyReveal() {
  const s2 = state.study;
  if (!s2 || s2.finished || s2.revealed) return;
  s2.revealed = true;
  render();
}
function studyAnswer(knew) {
  const s2 = state.study;
  if (!s2 || s2.finished || !s2.revealed) return;
  const id = s2.queue[s2.pos];
  if (!(id in s2.first)) s2.first[id] = knew;
  if (knew) s2.done.add(id);
  else s2.queue.push(id);
  s2.pos += 1;
  s2.revealed = false;
  if (s2.pos >= s2.queue.length) s2.finished = true;
  render();
}
function studySetup(habit, all, today) {
  const pools = Object.fromEntries(STUDY_SETS.map((set) => [set.id, studyPool(all, set.id, today)]));
  if (!pools[state.studySet] || pools[state.studySet].length === 0) {
    state.studySet = (STUDY_SETS.find((set) => pools[set.id].length > 0) || STUDY_SETS[3]).id;
  }
  const pool = pools[state.studySet];
  const count = Math.min(pool.length, STUDY_SIZE);
  const frontOption = (value, label) => h("button", {
    type: "button",
    "aria-pressed": String(state.studyFront === value),
    dataset: { fk: `front-${value}` },
    onclick: () => {
      state.studyFront = value;
      render();
    }
  }, label);
  return h(
    "div",
    { class: "page", style: habitVars(habit.color) },
    h("a", { class: "back", href: `#/kelimeler/${habit.id}` }, icon("left", 18), "Kelime arşivi"),
    h(
      "div",
      { class: "page-heading" },
      h("h1", { class: "page-title" }, "Çalış"),
      h("p", { class: "muted" }, habit.name)
    ),
    all.length === 0 ? emptyState(
      "Çalışacak kelime yok",
      "Önce arşive birkaç kelime ekle.",
      h("a", { class: "btn btn-primary", href: `#/kelimeler/${habit.id}` }, "Kelime ekle")
    ) : [
      h(
        "section",
        { class: "block" },
        h("h2", null, "Hangi kelimeler?"),
        h(
          "div",
          { class: "option-list", role: "radiogroup", "aria-label": "Hangi kelimeler" },
          STUDY_SETS.map((set) => h(
            "button",
            {
              type: "button",
              role: "radio",
              class: "option",
              "aria-checked": String(state.studySet === set.id),
              disabled: pools[set.id].length === 0,
              dataset: { fk: `set-${set.id}` },
              onclick: () => {
                state.studySet = set.id;
                render();
              }
            },
            h("span", { class: "option-dot", "aria-hidden": "true" }),
            h("span", { class: "option-label" }, set.label),
            h("span", { class: "option-count" }, String(pools[set.id].length))
          ))
        )
      ),
      h(
        "section",
        { class: "block" },
        h("h2", null, "Kartın önünde ne yazsın?"),
        h(
          "div",
          { class: "segmented", role: "group", "aria-label": "Kartın önü" },
          frontOption("word", "Kelime"),
          frontOption("meaning", "Anlamı")
        )
      ),
      h(
        "div",
        { class: "block" },
        h("button", {
          type: "button",
          class: "btn btn-primary btn-large",
          dataset: { fk: "study-start" },
          onclick: () => startStudy(habit.id, pool.map((w) => w.id), state.studySet)
        }, `Başla (${count} kelime)`),
        h("p", { class: "field-note" }, `Kelimeler karışık sırayla gelir, bir seferde en fazla ${STUDY_SIZE} kelime. Bilemediğin kelime sonra yeniden sorulur.`)
      )
    ]
  );
}
function studyCard(habit, item, s2) {
  const front = s2.front === "meaning" ? item.meaning : item.word;
  const back = s2.front === "meaning" ? item.word : item.meaning;
  const percent = s2.total ? s2.done.size / s2.total * 100 : 0;
  return h(
    "div",
    { class: "page study", style: habitVars(habit.color) },
    h(
      "div",
      { class: "study-top" },
      h("a", { class: "back", href: `#/kelimeler/${habit.id}` }, icon("left", 18), "Kelime arşivi"),
      h("span", { class: "study-count" }, `${s2.done.size} / ${s2.total}`),
      h("button", {
        type: "button",
        class: "link-btn",
        dataset: { fk: "study-stop" },
        onclick: () => {
          s2.finished = true;
          render();
        }
      }, "Bitir")
    ),
    h("div", { class: "meter-track", "aria-hidden": "true" }, h("span", { class: "meter-fill mastery-fill", style: { width: `${percent}%` } })),
    h(
      "section",
      { class: "study-card", "aria-live": "polite" },
      h("p", { class: "study-front" }, front),
      s2.front === "word" && speakButton(item.word, 26),
      s2.revealed && h(
        "div",
        { class: "study-back" },
        h("p", { class: "study-answer" }, back),
        s2.front === "meaning" && speakButton(item.word, 24),
        item.example && h("p", { class: "word-example" }, item.example)
      )
    ),
    s2.revealed ? h(
      "div",
      { class: "study-actions" },
      h("button", { type: "button", class: "btn btn-quiet btn-large", onclick: () => studyAnswer(false) }, "Bilemedim"),
      h("button", { type: "button", class: "btn btn-primary btn-large", onclick: () => studyAnswer(true) }, "Bildim")
    ) : h(
      "button",
      { type: "button", class: "btn btn-primary btn-large study-reveal", onclick: studyReveal },
      s2.front === "meaning" ? "Kelimeyi göster" : "Anlamını göster"
    ),
    h("p", { class: "study-keys" }, "Klavyeyle: boşluk göster, → bildim, ← bilemedim.")
  );
}
function studyResult(habit, byId, s2) {
  const answered = Object.keys(s2.first).filter((id) => byId.has(id));
  const right = answered.filter((id) => s2.first[id]).map((id) => byId.get(id));
  const missed = answered.filter((id) => !s2.first[id]).map((id) => byId.get(id));
  const toMark = right.filter((w) => !w.learned);
  let text = "Hiç kelime cevaplamadın.";
  if (answered.length > 0) {
    text = `${answered.length} kelimeden ${right.length} tanesini ilk seferde bildin.`;
    if (missed.length > 0) text += ` ${missed.length} kelimeyi tekrar ederek çalıştın.`;
  }
  return h(
    "div",
    { class: "page", style: habitVars(habit.color) },
    h("a", { class: "back", href: `#/kelimeler/${habit.id}` }, icon("left", 18), "Kelime arşivi"),
    h("h1", { class: "page-title" }, "Çalışma bitti"),
    h("p", { class: "study-result" }, text),
    toMark.length > 0 && !s2.marked && h(
      "section",
      { class: "block" },
      h("p", { class: "muted" }, 'İlk seferde bildiğin kelimeleri "öğrendim" yaparsan "Öğreniyorum" çalışmasında artık sorulmaz. Arşivden istediğin zaman geri alabilirsin.'),
      h("button", {
        type: "button",
        class: "btn btn-quiet",
        dataset: { fk: "study-mark" },
        onclick: () => {
          store.setLearned(toMark, true);
          s2.marked = true;
          toast(`${toMark.length} kelime öğrendim olarak işaretlendi.`);
          render();
        }
      }, icon("check", 20), `Bildiğim ${toMark.length} kelimeyi öğrendim yap`)
    ),
    missed.length > 0 && h(
      "section",
      { class: "block" },
      h("h2", null, "Bilemediklerin"),
      h("div", { class: "word-list" }, missed.map(wordRow))
    ),
    h(
      "div",
      { class: "button-row" },
      missed.length > 0 && h("button", {
        type: "button",
        class: "btn btn-primary",
        dataset: { fk: "study-missed" },
        onclick: () => startStudy(habit.id, missed.map((w) => w.id), s2.set)
      }, "Bilemediklerimi çalış"),
      h("button", {
        type: "button",
        class: "btn btn-quiet",
        dataset: { fk: "study-new" },
        onclick: () => {
          state.study = null;
          render();
        }
      }, "Yeni çalışma"),
      h("a", { class: "btn btn-quiet", href: `#/kelimeler/${habit.id}` }, "Arşive dön")
    )
  );
}
function viewStudy(id, today) {
  const habit = store.habits.find((item) => item.id === id);
  if (!habit) return missingHabit("Çalışma bulunamadı");
  const all = wordsOf(id);
  const s2 = state.study && state.study.habitId === id ? state.study : null;
  if (!s2) return studySetup(habit, all, today);
  const byId = new Map(all.map((w) => [w.id, w]));
  while (!s2.finished && s2.pos < s2.queue.length && !byId.has(s2.queue[s2.pos])) {
    s2.done.add(s2.queue[s2.pos]);
    s2.pos += 1;
  }
  if (s2.pos >= s2.queue.length) s2.finished = true;
  if (s2.finished) return studyResult(habit, byId, s2);
  return studyCard(habit, byId.get(s2.queue[s2.pos]), s2);
}
document.addEventListener("keydown", (event) => {
  const s2 = state.study;
  if (!s2 || s2.finished || !route().startsWith("calis/") || document.querySelector("dialog[open]")) return;
  if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
  const onControl = event.target?.closest?.("button, a, input, textarea, select");
  if (event.key === " " && !onControl && !s2.revealed) {
    event.preventDefault();
    studyReveal();
  } else if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && s2.revealed && !event.target.closest?.("input, textarea, select")) {
    event.preventDefault();
    studyAnswer(event.key === "ArrowRight");
  }
});
function bookForm(book = null) {
  const isEdit = Boolean(book);
  const error = h("p", { class: "field-error", role: "alert", hidden: true });
  const title = h("input", {
    id: "book-title",
    type: "text",
    maxlength: 120,
    autocomplete: "off",
    value: book?.title || "",
    placeholder: "Örneğin: Atomik Alışkanlıklar"
  });
  const author = h("input", {
    id: "book-author",
    type: "text",
    maxlength: 80,
    autocomplete: "off",
    value: book?.author || "",
    placeholder: "Örneğin: James Clear"
  });
  const total = h("input", {
    id: "book-total",
    type: "text",
    inputmode: "numeric",
    autocomplete: "off",
    value: book?.totalPages ? String(book.totalPages) : "",
    placeholder: "Örneğin: 320"
  });
  const page = h("input", {
    id: "book-page",
    type: "text",
    inputmode: "numeric",
    autocomplete: "off",
    placeholder: "Yeni başlıyorsan boş bırak"
  });
  const submit = (event) => {
    event.preventDefault();
    const fail = (message, field) => {
      error.textContent = message;
      error.hidden = false;
      field.focus();
    };
    const cleanTitle = title.value.trim();
    if (!cleanTitle) return fail("Kitabın adını yaz.", title);
    const parsedTotal = parsePageNumber(total.value);
    if (!parsedTotal.ok || parsedTotal.value === 0) return fail("Sayfa sayısı 0'dan büyük bir tam sayı olmalı.", total);
    const parsedPage = isEdit ? { ok: true, value: null } : parsePageNumber(page.value);
    if (!parsedPage.ok) return fail("Sayfa numarası bir tam sayı olmalı.", page);
    if (parsedTotal.value && parsedPage.value && parsedPage.value > parsedTotal.value) {
      return fail(`Bu kitap ${parsedTotal.value} sayfa.`, page);
    }
    const fields = { title: cleanTitle, author: author.value.trim(), totalPages: parsedTotal.value };
    if (isEdit) {
      store.updateBook(book.id, fields);
      toast("Değişiklikler kaydedildi.");
    } else {
      store.addBook({ ...fields, page: parsedPage.value });
      toast("Kitap eklendi.");
    }
    dialog.close();
    return void 0;
  };
  const dialog = openDialog(h(
    "form",
    { class: "sheet-body", onsubmit: submit, novalidate: true },
    h("h2", null, isEdit ? "Kitabı düzenle" : "Yeni kitap"),
    error,
    h("label", { class: "field", for: "book-title" }, h("span", null, "Kitabın adı"), title),
    h("label", { class: "field", for: "book-author" }, h("span", null, "Yazar (isteğe bağlı)"), author),
    h("label", { class: "field", for: "book-total" }, h("span", null, "Toplam sayfa (isteğe bağlı)"), total),
    !isEdit && h("label", { class: "field", for: "book-page" }, h("span", null, "Şu an kaçıncı sayfadasın?"), page),
    h(
      "div",
      { class: "sheet-actions" },
      h("button", { type: "button", class: "btn btn-quiet", onclick: () => dialog.close() }, "Vazgeç"),
      h("button", { type: "submit", class: "btn btn-primary" }, isEdit ? "Kaydet" : "Ekle")
    )
  ));
  title.focus();
}
async function askDeleteBook(book) {
  const ok = await confirmDialog({
    title: "Kitap silinsin mi?",
    body: `"${book.title}" ve sayfa kayıtları kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
    confirmLabel: "Kalıcı olarak sil",
    danger: true
  });
  if (!ok) return;
  store.deleteBook(book.id);
  toast("Kitap silindi.");
}
function finishBook(book) {
  const today = todayKey();
  const fields = { status: "done", finishedAt: today };
  store.updateBook(book.id, fields);
  if (book.totalPages && bookProgress(book, today).page < book.totalPages) store.setBookPage(book.id, book.totalPages);
  toast("Kitap bitirdiklerine taşındı.");
}
function bookSheet(book) {
  const close = (action) => () => {
    dialog.close();
    action();
  };
  const dialog = openDialog(h(
    "div",
    { class: "sheet-body" },
    h("h2", null, book.title),
    h(
      "div",
      { class: "sheet-list" },
      h("button", { type: "button", class: "btn btn-quiet", onclick: close(() => bookForm(book)) }, icon("edit", 20), "Düzenle"),
      book.status === "reading" ? h("button", { type: "button", class: "btn btn-quiet", onclick: close(() => finishBook(book)) }, icon("check", 20), "Bitirdim") : h("button", {
        type: "button",
        class: "btn btn-quiet",
        onclick: close(() => {
          store.updateBook(book.id, { status: "reading", finishedAt: null });
          toast("Kitap okuduklarına geri alındı.");
        })
      }, icon("restore", 20), "Okumaya devam et"),
      h("button", { type: "button", class: "btn btn-quiet btn-danger-text", onclick: close(() => askDeleteBook(book)) }, icon("trash", 20), "Sil")
    ),
    h(
      "div",
      { class: "sheet-actions" },
      h("button", { type: "button", class: "btn btn-quiet", onclick: () => dialog.close() }, "Kapat")
    )
  ));
}
function lastEntryText(key, today) {
  if (!key) return "Henüz sayfa girilmedi.";
  if (key === today) return "Son kayıt: bugün.";
  if (key === addDays(today, -1)) return "Son kayıt: dün.";
  return `Son kayıt: ${formatDayMonth(key)}.`;
}
function bookCard(book, today) {
  const p = bookProgress(book, today);
  const input = h("input", {
    id: `page-${book.id}`,
    type: "text",
    inputmode: "numeric",
    autocomplete: "off",
    enterkeyhint: "done",
    class: "page-input",
    placeholder: String(p.page || ""),
    dataset: { fk: `page-${book.id}`, draft: "1" }
  });
  const save = (event) => {
    event.preventDefault();
    const parsed = parsePageNumber(input.value);
    if (!parsed.ok || parsed.value === null) {
      toast("Geçerli bir sayfa numarası yaz.", "error");
      input.focus();
      return;
    }
    if (book.totalPages && parsed.value > book.totalPages) {
      toast(`Bu kitap ${book.totalPages} sayfa.`, "error");
      input.focus();
      return;
    }
    input.value = "";
    store.setBookPage(book.id, parsed.value);
    if (book.totalPages && parsed.value === book.totalPages) {
      store.updateBook(book.id, { status: "done", finishedAt: todayKey() });
      toast("Kitabı bitirdin. Bitirdiklerin listesine taşındı.");
    } else {
      toast(`${parsed.value}. sayfa kaydedildi.`);
    }
  };
  return h(
    "article",
    { class: "book" },
    h(
      "div",
      { class: "book-head" },
      h(
        "div",
        { class: "book-name" },
        h("strong", null, book.title),
        book.author && h("span", { class: "muted" }, book.author)
      ),
      h("button", {
        type: "button",
        class: "icon-btn",
        "aria-label": `${book.title} seçenekleri`,
        dataset: { fk: `book-${book.id}` },
        onclick: () => bookSheet(book)
      }, icon("more", 22))
    ),
    h(
      "p",
      { class: "book-progress" },
      h("span", null, book.totalPages ? `Sayfa ${p.page} / ${book.totalPages}` : `Sayfa ${p.page}`),
      p.percent !== null && h("strong", null, `%${Math.floor(p.percent)}`)
    ),
    p.percent !== null && h(
      "div",
      { class: "meter-track", "aria-hidden": "true" },
      h("span", { class: "meter-fill", style: { width: `${p.percent}%` } })
    ),
    h(
      "p",
      { class: "muted book-note" },
      lastEntryText(p.lastKey, today),
      p.lastWeek !== null && ` Son 7 günde ${p.lastWeek} sayfa ilerledin.`
    ),
    h(
      "form",
      { class: "page-form", onsubmit: save },
      h("label", { for: `page-${book.id}` }, "Kaçıncı sayfadasın?"),
      input,
      h("button", { type: "submit", class: "btn btn-primary btn-small" }, "Kaydet")
    )
  );
}
function finishedRow(book, today) {
  const p = bookProgress(book, today);
  const parts = [];
  if (book.finishedAt) parts.push(`Bitiş: ${formatLong(book.finishedAt)}.`);
  if (p.days) parts.push(`${p.days} günde okudun.`);
  return h(
    "div",
    { class: "manage-row book-done" },
    icon("check", 20),
    h(
      "div",
      { class: "manage-text" },
      h("strong", null, book.title),
      book.author && h("span", null, book.author),
      parts.length > 0 && h("span", null, parts.join(" "))
    ),
    h("button", {
      type: "button",
      class: "icon-btn",
      "aria-label": `${book.title} seçenekleri`,
      dataset: { fk: `book-${book.id}` },
      onclick: () => bookSheet(book)
    }, icon("more", 22))
  );
}
function viewBooks(today) {
  const { reading, finished } = sortBooks(store.books);
  const addBook = (label) => h("button", { type: "button", class: "btn btn-primary", onclick: () => bookForm() }, icon("plus", 20), label);
  return h(
    "div",
    { class: "page" },
    h(
      "div",
      { class: "page-head" },
      h("h1", { class: "page-title" }, "Kitaplar"),
      store.books.length > 0 && addBook("Ekle")
    ),
    store.books.length === 0 ? emptyState("Henüz kitap yok", "Okuduğun kitabı ekle. Her gün kaçıncı sayfada olduğunu yazarsın, burada ilerlemen görünür.", addBook("Kitap ekle")) : [
      h(
        "section",
        { class: "block" },
        h("h2", null, "Okuduklarım"),
        reading.length > 0 ? h("div", { class: "books" }, reading.map((book) => bookCard(book, today))) : h("p", { class: "muted" }, "Şu an okuduğun kitap yok.")
      ),
      finished.length > 0 && h(
        "section",
        { class: "block" },
        h("h2", null, `Bitirdiklerim (${finished.length})`),
        h("div", { class: "manage-list" }, finished.map((book) => finishedRow(book, today)))
      )
    ]
  );
}
function downloadBackup(prefix = "cetele-yedek") {
  store.flush();
  const data = createBackup(store.habits, store.done, /* @__PURE__ */ new Date(), store.values, store.books, store.words);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = h("a", { href: url, download: `${prefix}-${todayKey()}.json` });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2e3);
}
async function runRestore(backup, mode) {
  if (!navigator.onLine) {
    toast("Geri yükleme için internet bağlantısı gerekli.", "error");
    return;
  }
  const ops = planRestore(store.habits, store.logs, backup, mode, store.books, store.words);
  if (countOps(ops) === 0) {
    toast("Yedek zaten mevcut verilerle aynı. Yazma yapılmadı.");
    return;
  }
  const busy = openDialog(h(
    "div",
    { class: "sheet-body", role: "status" },
    h("p", null, "Yedek geri yükleniyor…")
  ));
  busy.addEventListener("cancel", (event) => event.preventDefault());
  try {
    const finished = store.applyRestore(ops).then(() => true);
    const timeout = new Promise((resolve) => {
      setTimeout(() => resolve(false), 3e4);
    });
    const inTime = await Promise.race([finished, timeout]);
    toast(inTime ? "Yedek geri yüklendi." : "Bağlantı yavaş. Değişiklikler arka planda gönderiliyor.");
    finished.catch((error) => toast(errorMessage(error), "error"));
  } catch (error) {
    console.error(error);
    toast(`Yedek geri yüklenemedi. ${errorMessage(error)}`, "error");
  } finally {
    busy.close();
  }
}
async function handleFile(file) {
  if (file.size > MAX_BACKUP_BYTES) {
    toast("Dosya çok büyük. En fazla 10 MB olabilir.", "error");
    return;
  }
  let backup;
  try {
    backup = parseBackup(await file.text(), todayKey());
  } catch (error) {
    const message = error instanceof BackupError ? error.message : "Dosya okunamadı.";
    toast(message, "error");
    return;
  }
  const records = backup.habits.reduce((sum, habit) => sum + habit.completions.length, 0);
  const date = backup.exportedAt ? new Date(backup.exportedAt) : null;
  const dateText = date && !Number.isNaN(date.getTime()) ? formatLong(todayKey(date)) : "bilinmiyor";
  const dialog = openDialog(h(
    "div",
    { class: "sheet-body" },
    h("h2", null, "Yedeği geri yükle"),
    h("p", null, `Yedek tarihi: ${dateText}. İçinde ${backup.habits.length} alışkanlık, ${records} günlük kayıt, ${backup.books.length} kitap ve ${backup.words.length} kelime var.`),
    backup.skippedFuture > 0 && h("p", { class: "field-note" }, `Gelecek tarihli ${backup.skippedFuture} kayıt atlanacak.`),
    h(
      "div",
      { class: "choice" },
      h("button", {
        type: "button",
        class: "btn btn-primary",
        onclick: () => {
          dialog.close();
          runRestore(backup, "merge");
        }
      }, "Mevcut verilerle birleştir"),
      h("p", { class: "muted" }, "Yedekteki bilgiler geri gelir, mevcut hiçbir kayıt silinmez.")
    ),
    h(
      "div",
      { class: "choice" },
      h("button", {
        type: "button",
        class: "btn btn-danger-outline",
        onclick: async () => {
          dialog.close();
          const ok = await confirmDialog({
            title: "Mevcut veriler değiştirilsin mi?",
            body: "Yedekte olmayan alışkanlık ve kayıtlar silinir. Önce şu anki verilerin ayrı bir dosya olarak indirilir.",
            confirmLabel: "Yedekle değiştir",
            danger: true
          });
          if (!ok) return;
          downloadBackup("cetele-degisiklik-oncesi");
          runRestore(backup, "replace");
        }
      }, "Mevcut verileri yedekle değiştir"),
      h("p", { class: "muted" }, "Hesabın, tam olarak yedekteki duruma döner.")
    ),
    h(
      "div",
      { class: "sheet-actions" },
      h("button", { type: "button", class: "btn btn-quiet", onclick: () => dialog.close() }, "Vazgeç")
    )
  ));
}
function viewSettings() {
  const current = savedTheme() || "system";
  const themeOption = (value, label) => h("button", {
    type: "button",
    "aria-pressed": String(current === value),
    dataset: { fk: `theme-${value}` },
    onclick: () => setTheme(value)
  }, label);
  const fileInput = h("input", {
    type: "file",
    accept: "application/json,.json",
    hidden: true,
    onchange: (event) => {
      const [file] = event.target.files;
      if (file) handleFile(file);
      event.target.value = "";
    }
  });
  return h(
    "div",
    { class: "page" },
    h("h1", { class: "page-title" }, "Ayarlar"),
    h(
      "section",
      { class: "block" },
      h("h2", null, "Tema"),
      h(
        "div",
        { class: "segmented", role: "group", "aria-label": "Tema" },
        themeOption("system", "Cihaz"),
        themeOption("light", "Açık"),
        themeOption("dark", "Koyu")
      )
    ),
    h(
      "section",
      { class: "block" },
      h("h2", null, "Yedekleme"),
      h("p", { class: "muted" }, "Tüm alışkanlıklarını ve kayıtlarını JSON dosyası olarak saklayabilir, sonra geri yükleyebilirsin."),
      h(
        "div",
        { class: "button-row" },
        h("button", {
          type: "button",
          class: "btn btn-quiet",
          onclick: () => {
            downloadBackup();
            toast("Yedek indirildi.");
          }
        }, icon("download", 20), "Yedeği indir"),
        h("button", { type: "button", class: "btn btn-quiet", onclick: () => fileInput.click() }, icon("upload", 20), "Yedeği geri yükle"),
        fileInput
      )
    ),
    h(
      "section",
      { class: "block" },
      h("h2", null, "Hesap"),
      h("p", { class: "muted" }, store.user?.email || store.user?.displayName || "Google hesabı"),
      h("button", {
        type: "button",
        class: "btn btn-quiet",
        onclick: async (event) => {
          event.currentTarget.disabled = true;
          try {
            await store.signOut();
          } catch (error) {
            toast(errorMessage(error), "error");
            render();
          }
        }
      }, "Çıkış yap")
    )
  );
}
var NAV = [
  { hash: "#/", label: "Bugün", match: (r) => r === "" },
  { hash: "#/ilerleme", label: "İlerleme", match: (r) => r === "ilerleme" || r.startsWith("aliskanlik/") },
  { hash: "#/uzmanlik", label: "Uzmanlık", match: (r) => r === "uzmanlik" || r.startsWith("kelimeler/") || r.startsWith("calis/") },
  { hash: "#/kitaplar", label: "Kitaplar", match: (r) => r === "kitaplar" },
  { hash: "#/aliskanliklar", label: "Alışkanlıklar", short: "Alışkanlık", match: (r) => r === "aliskanliklar" },
  { hash: "#/ayarlar", label: "Ayarlar", match: (r) => r === "ayarlar" }
];
var route = () => location.hash.replace(/^#\/?/, "");
function shell(view) {
  const current = route();
  return h(
    "div",
    { class: "shell" },
    h(
      "nav",
      { class: "nav", "aria-label": "Ana menü" },
      h("a", { class: "brand", href: "#/" }, "Çetele"),
      h("div", { class: "nav-items" }, NAV.map((item) => h("a", {
        href: item.hash,
        class: "nav-item",
        "aria-current": item.match(current) ? "page" : null
      }, item.short ? [h("span", { class: "nav-full" }, item.label), h("span", { class: "nav-short" }, item.short)] : item.label)))
    ),
    h(
      "main",
      { class: "main", id: "main", tabindex: -1 },
      !navigator.onLine && h("p", { class: "banner", role: "status" }, "Çevrimdışısın. Değişikliklerin bu cihazda tutuluyor, bağlantı gelince gönderilecek."),
      view
    )
  );
}
function centerScreen(...children) {
  return h("div", { class: "center" }, children);
}
function viewLoading(message) {
  return centerScreen(h("p", { role: "status" }, message));
}
function viewSignIn() {
  return centerScreen(
    h("h1", { class: "cover-title" }, "Çetele"),
    h("p", { class: "cover-text" }, "Her gün yaptıklarını takip et."),
    state.signInError && h("p", { class: "form-error", role: "alert" }, state.signInError),
    h("button", {
      type: "button",
      class: "btn btn-primary btn-large",
      disabled: state.signingIn,
      dataset: { fk: "signin" },
      onclick: async () => {
        state.signingIn = true;
        state.signInError = null;
        render();
        try {
          await store.signIn();
        } catch (error) {
          const closed = ["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(error.code);
          if (!closed) {
            console.error(error);
            state.signInError = errorMessage(error);
          }
        } finally {
          state.signingIn = false;
          render();
        }
      }
    }, state.signingIn ? "Giriş penceresi açık…" : "Google ile giriş yap")
  );
}
function viewConfig() {
  return centerScreen(
    h("h1", { class: "cover-title" }, "Çetele"),
    h("h2", null, "Firebase ayarları eksik"),
    h("p", { class: "cover-text" }, "firebase-config.js dosyasındaki yer tutucuları kendi Firebase projenin değerleriyle değiştir, sonra sayfayı yenile. Adımlar README.md dosyasında.")
  );
}
function viewFatal(title, text, action) {
  return centerScreen(h("h1", { class: "cover-title" }, "Çetele"), h("h2", null, title), h("p", { class: "cover-text", role: "alert" }, text), action);
}
function viewCurrent(today) {
  const current = route();
  if (current.startsWith("aliskanlik/")) return viewHabit(decodeURIComponent(current.slice("aliskanlik/".length)), today);
  if (current.startsWith("kelimeler/")) return viewWords(decodeURIComponent(current.slice("kelimeler/".length)), today);
  if (current.startsWith("calis/")) return viewStudy(decodeURIComponent(current.slice("calis/".length)), today);
  if (current === "ilerleme") return viewProgress(today);
  if (current === "aliskanliklar") return viewManage(today);
  if (current === "kitaplar") return viewBooks(today);
  if (current === "uzmanlik") return viewMastery(today);
  if (current === "ayarlar") return viewSettings();
  return viewToday(today);
}
var lastRouteRendered = null;
var renderHoldUntil = 0;
var pointerDown = false;
var deferredRender = null;
var now = () => performance.now();
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
document.addEventListener("pointerdown", () => {
  pointerDown = true;
}, true);
window.addEventListener("blur", () => {
  pointerDown = false;
});
["pointerup", "pointercancel"].forEach((name) => {
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
    case "booting":
      content = viewLoading("Yükleniyor…");
      break;
    case "config":
      content = viewConfig();
      break;
    case "sdk-error":
      content = viewFatal(
        "Firebase yüklenemedi",
        "Gerekli dosyalar indirilemedi veya ayarlar hatalı. İnternet bağlantını ve firebase-config.js dosyasını kontrol edip sayfayı yenile.",
        h("button", { type: "button", class: "btn btn-primary", onclick: () => location.reload() }, "Sayfayı yenile")
      );
      break;
    case "signed-out":
      content = viewSignIn();
      break;
    case "loading":
      content = viewLoading("Verilerin yükleniyor…");
      break;
    case "slow":
      content = viewFatal(
        "Sunucuya ulaşılamıyor",
        "Veriler hâlâ gelmedi. İnternet bağlantını kontrol et. Sorun sürerse Firebase konsolunda Firestore veritabanını oluşturduğundan emin ol.",
        h(
          "div",
          { class: "button-row button-row-center" },
          h("button", { type: "button", class: "btn btn-primary", onclick: () => store.retry() }, "Yeniden dene"),
          h("button", { type: "button", class: "btn btn-quiet", onclick: () => store.continueOffline() }, "Çevrimdışı devam et")
        )
      );
      break;
    case "load-error":
      content = viewFatal(
        "Veriler yüklenemedi",
        store.loadError || "Beklenmeyen bir hata oluştu.",
        h("button", { type: "button", class: "btn btn-primary", onclick: () => store.retry() }, "Yeniden dene")
      );
      break;
    default:
      content = shell(viewCurrent(todayKey()));
  }
  app.replaceChildren(content);
  const currentRoute = route();
  if (store.phase === "ready" && currentRoute !== lastRouteRendered) {
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
  const el = document.getElementById("sync");
  el.hidden = !(store.phase === "ready" && store.hasPendingWrites && navigator.onLine);
}
async function start() {
  applyTheme();
  render();
  store.subscribe((event) => {
    if (event === "sync") {
      renderSync();
      return;
    }
    if (event && event.error) {
      toast(event.error, "error");
      return;
    }
    requestRender();
  });
  window.addEventListener("hashchange", () => {
    const next = route();
    if (!next.startsWith("aliskanlik/")) {
      state.heatYear = "son";
      state.heatCell = null;
    }
    if (!next.startsWith("kelimeler/")) {
      state.wordQuery = "";
      state.wordStatus = "all";
      state.wordLimit = WORD_PAGE;
    }
    if (!next.startsWith("calis/")) state.study = null;
    render();
  });
  window.addEventListener("online", render);
  window.addEventListener("offline", render);
  dayWatcher = watchDayChange((next, previous) => {
    if (state.day === previous || state.day > next) state.day = next;
    state.heatCell = null;
    if (store.phase === "ready") render();
  });
  let config;
  try {
    ({ firebaseConfig: config } = await import("./firebase-config.js"));
  } catch (error) {
    console.error(error);
    store.setPhase("config");
    return;
  }
  await store.init(config);
}
window.addEventListener("unhandledrejection", (event) => {
  console.error(event.reason);
  toast("Beklenmeyen bir hata oluştu. Sayfayı yenileyip yeniden dene.", "error");
});
start();
