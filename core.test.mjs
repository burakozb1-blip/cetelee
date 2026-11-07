// Çalıştırmak için: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as D from '../js/dates.js';
import * as S from '../js/stats.js';
import * as B from '../js/backup.js';
import { PALETTE, SURFACE, contrast, displayColor, inkOn } from '../js/colors.js';

const habit = (over = {}) => ({
  id: 'h1', name: 'Kitap', description: '', color: '#2B4FD8', startDate: '2026-11-01',
  archived: false, archivedRanges: [], createdAt: '', ...over,
});
const set = (...days) => new Set(days);
const range = (from, to) => {
  const out = [];
  for (let k = from; k <= to; k = D.addDays(k, 1)) out.push(k);
  return out;
};

test('takvim hesabı: 1970-2100 arası her gün gidiş dönüş tutarlı ve haftanın günü doğru', () => {
  let key = '1970-01-01';
  let n = 0;
  while (key <= '2100-12-31') {
    assert.equal(D.keyToNum(key), n);
    assert.equal(D.numToKey(n), key);
    const native = new Date(Date.UTC(...(([y, m, d]) => [y, m - 1, d])(key.split('-').map(Number))));
    assert.equal(native.toISOString().slice(0, 10), key);
    assert.equal(D.weekdayIndex(key), (native.getUTCDay() + 6) % 7);
    key = D.addDays(key, 1);
    n += 1;
  }
});

test('tarih doğrulama, hafta ve ay sınırları', () => {
  assert.equal(D.isValidKey('2024-02-29'), true);
  assert.equal(D.isValidKey('2026-02-29'), false);
  assert.equal(D.isValidKey('2026-13-01'), false);
  assert.equal(D.isValidKey('26-1-1'), false);
  assert.equal(D.startOfWeek('2026-11-04'), '2026-11-02');
  assert.equal(D.endOfWeek('2026-11-04'), '2026-11-08');
  assert.equal(D.startOfWeek('2026-11-02'), '2026-11-02');
  assert.equal(D.startOfWeek('2026-11-08'), '2026-11-02');
  assert.equal(D.addMonths('2026-01-31', -1), '2025-12-01');
  assert.equal(D.addMonths('2026-12-15', 1), '2027-01-01');
  assert.equal(D.endOfMonth('2028-02-10'), '2028-02-29');
  assert.equal(D.formatLong('2026-11-04'), '4 Kasım 2026');
  assert.equal(D.weekdayName('2026-11-04'), 'Çarşamba');
});

test('genel yüzde: başlangıçtan önceki ve gelecekteki işaretler sayılmaz', () => {
  const h = habit({ startDate: '2026-11-01' });
  const done = set('2026-10-30', '2026-11-01', '2026-11-03', '2026-11-20');
  const st = S.habitStats(h, done, '2026-11-04');
  assert.deepEqual([st.overall.done, st.overall.total], [2, 4]);
  assert.equal(st.overall.rate, 50);
  assert.equal(st.totalDone, 2);
});

test('son 7, 30, 365 gün: pencere başlangıç tarihiyle kısalır', () => {
  const h = habit({ startDate: '2026-10-01' });
  const st = S.habitStats(h, new Set(range('2026-10-29', '2026-11-04')), '2026-11-04');
  assert.deepEqual([st.last7.done, st.last7.total, st.last7.rate], [7, 7, 100]);
  assert.deepEqual([st.last30.done, st.last30.total], [7, 30]);
  assert.deepEqual([st.last365.done, st.last365.total], [7, 35]);
  assert.deepEqual([st.overall.done, st.overall.total], [7, 35]);
});

test('üç gün önce başlayan alışkanlıkta son 7 günün paydası 3 olur', () => {
  const st = S.habitStats(habit({ startDate: '2026-11-02' }), set('2026-11-02', '2026-11-03'), '2026-11-04');
  assert.deepEqual([st.last7.done, st.last7.total], [2, 3]);
  assert.equal(Math.round(st.last7.rate), 67);
});

test('seri: bugün işaretlenmemişse mevcut seri düne kadar sürer', () => {
  const h = habit({ startDate: '2026-10-01' });
  const days = range('2026-11-01', '2026-11-03');
  assert.equal(S.computeStreaks(h, new Set(days), '2026-11-04').current, 3);
  assert.equal(S.computeStreaks(h, new Set([...days, '2026-11-04']), '2026-11-04').current, 4);
});

test('seri: dün boşsa mevcut seri 0, en uzun seri korunur', () => {
  const h = habit({ startDate: '2026-10-01' });
  const done = new Set(range('2026-10-05', '2026-10-09'));
  done.add('2026-11-02');
  const s = S.computeStreaks(h, done, '2026-11-04');
  assert.deepEqual([s.current, s.longest], [0, 5]);
});

test('seri: boşluktan sonra yeni seri ve yıl geçişi', () => {
  const h = habit({ startDate: '2025-12-20' });
  const done = new Set(range('2025-12-29', '2026-01-03'));
  const s = S.computeStreaks(h, done, '2026-01-03');
  assert.deepEqual([s.current, s.longest], [6, 6]);
  const gap = new Set([...range('2025-12-20', '2025-12-22'), ...range('2025-12-24', '2025-12-25')]);
  assert.deepEqual(S.computeStreaks(h, gap, '2025-12-25'), { current: 2, longest: 3 });
});

test('seri: artık yıl günü de ardışık sayılır', () => {
  const h = habit({ startDate: '2028-02-27' });
  const done = new Set(range('2028-02-27', '2028-03-01'));
  assert.equal(S.computeStreaks(h, done, '2028-03-01').current, 4);
});

test('veri yoksa 0\'a bölme yok: gelecekte başlayan alışkanlık', () => {
  const st = S.habitStats(habit({ startDate: '2026-12-01' }), set(), '2026-11-04');
  assert.equal(st.overall.total, 0);
  assert.equal(st.overall.rate, null);
  assert.equal(st.last7.rate, null);
  assert.equal(st.currentStreak, 0);
  assert.equal(S.formatPct(st.overall.rate), '—');
});

test('bugün başlayan alışkanlık: işaretsiz %0, işaretli %100', () => {
  const h = habit({ startDate: '2026-11-04' });
  assert.equal(S.habitStats(h, set(), '2026-11-04').overall.rate, 0);
  const st = S.habitStats(h, set('2026-11-04'), '2026-11-04');
  assert.equal(st.overall.rate, 100);
  assert.equal(st.currentStreak, 1);
  assert.equal(st.longestStreak, 1);
});

test('arşiv: arşiv günleri aleyhe sayılmaz, seri kırılmaz, geçmiş korunur', () => {
  const h = habit({
    startDate: '2026-10-01',
    archivedRanges: [{ from: '2026-10-04', to: '2026-10-09' }],
  });
  const done = new Set([...range('2026-10-01', '2026-10-03'), '2026-10-10']);
  const st = S.habitStats(h, done, '2026-10-10');
  assert.deepEqual([st.overall.done, st.overall.total], [4, 4]);
  assert.equal(st.currentStreak, 4);
});

test('arşivde olan alışkanlığın serisi ve yüzdesi donar', () => {
  const h = habit({
    startDate: '2026-10-01', archived: true,
    archivedRanges: [{ from: '2026-10-05', to: null }],
  });
  const done = new Set(range('2026-10-01', '2026-10-04'));
  const st = S.habitStats(h, done, '2026-11-04');
  assert.deepEqual([st.overall.done, st.overall.total], [4, 4]);
  assert.equal(st.overall.rate, 100);
  assert.equal(st.currentStreak, 4);
});

test('gün listesi: gelecek, başlangıç öncesi ve arşiv durumları', () => {
  const a = habit({ id: 'a', startDate: '2026-11-01' });
  const b = habit({ id: 'b', startDate: '2026-11-10' });
  const c = habit({ id: 'c', startDate: '2026-10-01', archived: true, archivedRanges: [{ from: '2026-11-03', to: null }] });
  const map = new Map([['c', set('2026-11-04')]]);
  const today = '2026-11-04';
  const ids = (day) => S.habitsForDay([a, b, c], map, day, today).map((h) => h.id);
  assert.deepEqual(ids(today), ['a']);
  assert.deepEqual(ids('2026-11-02'), ['a', 'c']);
  assert.deepEqual(ids('2026-11-03'), ['a']);
  assert.deepEqual(ids('2026-10-15'), ['c']);
  assert.deepEqual(ids('2026-11-05'), []);
});

test('bugünün yüzdesi ve boş gün', () => {
  const a = habit({ id: 'a' });
  const b = habit({ id: 'b' });
  const map = new Map([['a', set('2026-11-04')]]);
  assert.equal(S.daySummary([a, b], map, '2026-11-04', '2026-11-04').rate, 50);
  assert.equal(S.daySummary([], new Map(), '2026-11-04', '2026-11-04').rate, null);
});

test('karşılaştırma: kullanıcının örneği, %50 → %56 = %12 daha istikrarlı', () => {
  const c = S.compareRates({ rate: 56, done: 56, total: 100 }, { rate: 50, done: 50, total: 100 });
  assert.equal(c.state, 'ok');
  assert.equal(Math.round(c.relative), 12);
  assert.equal(c.points, 6);
});

test('karşılaştırma: önceki oran 0 veya yoksa 0\'a bölme olmaz', () => {
  const z = S.compareRates({ rate: 40 }, { rate: 0 });
  assert.equal(z.state, 'from-zero');
  assert.equal(z.relative, null);
  assert.equal(z.points, 40);
  assert.equal(S.compareRates({ rate: 40 }, { rate: null }).state, 'no-previous');
  assert.equal(S.compareRates({ rate: null }, { rate: 40 }).state, 'no-current');
});

test('dönem oranı: bugünün yapılmamış işi aleyhe sayılmaz, yapılanı sayılır', () => {
  const h = habit({ startDate: '2026-10-01' });
  const map = new Map([['h1', new Set(['2026-11-02', '2026-11-03'])]]);
  const week = S.periodRate([h], map, '2026-11-02', '2026-11-08', '2026-11-04');
  assert.deepEqual([week.done, week.total], [2, 2]);
  map.get('h1').add('2026-11-04');
  const after = S.periodRate([h], map, '2026-11-02', '2026-11-08', '2026-11-04');
  assert.deepEqual([after.done, after.total], [3, 3]);
});

test('hafta karşılaştırması: Pazartesi sabahı henüz veri yoksa eksi yüzde çıkmaz', () => {
  const h = habit({ startDate: '2026-10-01' });
  const map = new Map([['h1', new Set(range('2026-10-26', '2026-11-01'))]]);
  const c = S.weekComparison([h], map, '2026-11-02');
  assert.equal(c.state, 'no-current');
});

test('ay karşılaştırması: uçtan uca sayım', () => {
  const h = habit({ startDate: '2026-10-01' });
  const octDone = range('2026-10-01', '2026-10-15');
  const novDone = range('2026-11-01', '2026-11-03');
  const map = new Map([['h1', new Set([...octDone, ...novDone])]]);
  const c = S.monthComparison([h], map, '2026-11-04');
  assert.deepEqual([c.previous.done, c.previous.total], [15, 31]);
  assert.deepEqual([c.current.done, c.current.total], [3, 3]);
  assert.equal(Math.round(c.relative), Math.round(((100 - (15 / 31) * 100) / ((15 / 31) * 100)) * 100));
});

test('haftalık ve aylık seriler: dönemler bitişik, başlangıçtan önce veri yok', () => {
  const h = habit({ startDate: '2026-10-20' });
  const map = new Map([['h1', set('2026-10-20', '2026-11-04')]]);
  const weeks = S.weeklySeries([h], map, '2026-11-04', 8);
  assert.equal(weeks.length, 8);
  assert.equal(weeks[7].from, '2026-11-02');
  assert.equal(weeks[7].isCurrent, true);
  for (let i = 1; i < 8; i += 1) assert.equal(D.addDays(weeks[i - 1].to, 1), weeks[i].from);
  assert.equal(weeks[0].rate, null);
  const months = S.monthlySeries([h], map, '2026-11-04', 12);
  assert.equal(months.length, 12);
  assert.equal(months[11].label, 'Kas');
  assert.equal(months[0].from, '2025-12-01');
  assert.deepEqual([months[10].done, months[10].total], [1, 12]);
});

test('sıralama: en istikrarlı ve geliştirilmesi gereken', () => {
  const a = habit({ id: 'a', name: 'A', startDate: '2026-10-01' });
  const b = habit({ id: 'b', name: 'B', startDate: '2026-10-01' });
  const map = new Map([['a', new Set(range('2026-10-06', '2026-11-04'))], ['b', new Set(range('2026-10-25', '2026-10-27'))]]);
  const r = S.rankHabits([a, b], map, '2026-11-04');
  assert.equal(r.state, 'ok');
  assert.equal(r.best.habit.id, 'a');
  assert.equal(r.worst.habit.id, 'b');
});

test('sıralama: az veri, tek alışkanlık ve eşitlik durumları', () => {
  const today = '2026-11-04';
  assert.equal(S.rankHabits([], new Map(), today).state, 'no-data');
  const yeni = habit({ startDate: today });
  assert.equal(S.rankHabits([yeni], new Map(), today).state, 'no-data');
  const eski = habit({ id: 'x', startDate: '2026-10-01' });
  assert.equal(S.rankHabits([eski], new Map(), today).state, 'single');
  const eski2 = habit({ id: 'y', startDate: '2026-10-01' });
  assert.equal(S.rankHabits([eski, eski2], new Map(), today).state, 'tied');
  const arsiv = habit({ id: 'z', startDate: '2026-10-01', archived: true, archivedRanges: [{ from: today, to: null }] });
  assert.equal(S.rankHabits([arsiv], new Map(), today).state, 'no-data');
});

test('yorum: artış, düşüş, sabit, sıfırdan artış, seri ve veri yok', () => {
  const h = habit({ startDate: '2026-09-01' });
  const today = '2026-11-04';
  const oct = range('2026-10-01', '2026-10-31');
  const up = new Map([['h1', new Set([...oct.slice(0, 16), ...range('2026-11-01', '2026-11-03')])]]);
  assert.match(S.progressComment([h], up, today), /^Bu ay geçen aya göre %94 daha istikrarlısın\. En uzun süren serin 3 gün: Kitap\.$/);

  const lower = new Map([['h1', new Set([...oct, '2026-11-01'])]]);
  assert.match(S.progressComment([h], lower, today), /^Bu ay geçen aya göre %67 daha az istikrarlısın\.$/);

  const zero = new Map([['h1', new Set(['2026-11-03'])]]);
  assert.match(S.progressComment([h], zero, today), /Bu ay oranın %33\. Bir önceki dönemde %0 idi\./);

  // Ayın tamamı bu ayda: ay karşılaştırılamaz, hafta karşılaştırılır (1 Kasım 1/1, bu hafta 1/2).
  const fresh = habit({ startDate: '2026-11-01' });
  const freshMap = new Map([['h1', set('2026-11-01', '2026-11-02')]]);
  assert.equal(S.progressComment([fresh], freshMap, today), 'Bu hafta geçen haftaya göre %50 daha az istikrarlısın.');

  // Önceki hafta ve önceki ay yok: dürüstçe karşılaştırma yapılamadığı söylenir.
  const fresher = habit({ startDate: '2026-11-02' });
  assert.match(S.progressComment([fresher], new Map([['h1', set('2026-11-02')]]), today), /^Bu ay tamamlama oranın %50\. Karşılaştırma için önceki dönemin verisi henüz yok\.$/);

  // Oranlar eşit: yön uydurulmaz.
  const same = new Map([['h1', new Set([...oct, ...range('2026-11-01', '2026-11-03')])]]);
  assert.match(S.progressComment([h], same, today), /^Bu ay geçen ay kadar istikrarlısın\./);

  assert.equal(S.progressComment([], new Map(), today), null);
  assert.equal(S.progressComment([habit({ startDate: '2027-01-01' })], new Map(), today), null);
});

test('yedek: dışa aktar, doğrula, geri al birebir aynı', () => {
  const h = habit({ archived: true, archivedRanges: [{ from: '2026-11-03', to: null }], description: 'gece' });
  const map = new Map([['h1', set('2026-11-02', '2026-11-01')]]);
  const out = B.createBackup([h], map, new Date('2026-11-04T10:00:00Z'));
  assert.deepEqual(out.habits[0].completions, ['2026-11-01', '2026-11-02']);
  const parsed = B.parseBackup(JSON.stringify(out), '2026-11-04');
  assert.equal(parsed.habits[0].name, 'Kitap');
  assert.equal(parsed.habits[0].archived, true);
  assert.deepEqual(parsed.habits[0].archivedRanges, [{ from: '2026-11-03', to: null }]);
  assert.deepEqual(parsed.habits[0].completions, ['2026-11-01', '2026-11-02']);
});

test('yedek: hatalı dosyalar Türkçe mesajla reddedilir, gelecek tarih atlanır', () => {
  const today = '2026-11-04';
  const ok = (over = {}, c = ['2026-11-01']) => JSON.stringify({
    app: 'cetele', version: 1, habits: [{ id: 'a1', name: 'X', color: '#112233', startDate: '2026-11-01', completions: c, ...over }],
  });
  assert.throws(() => B.parseBackup('{bozuk', today), /JSON/);
  assert.throws(() => B.parseBackup('{"app":"baska","habits":[]}', today), /Çetele yedeği değil/);
  assert.throws(() => B.parseBackup('{"app":"cetele","version":99,"habits":[]}', today), /sürümü/);
  assert.throws(() => B.parseBackup(ok({ id: '../hack' }), today), /kimlik/);
  assert.throws(() => B.parseBackup(ok({ id: 'a_b' }), today), /kimlik/);
  assert.throws(() => B.parseBackup(ok({ name: '  ' }), today), /ad boş/);
  assert.throws(() => B.parseBackup(ok({ color: 'red;}' }), today), /renk/);
  assert.throws(() => B.parseBackup(ok({ startDate: '2026-02-30' }), today), /başlangıç/);
  assert.throws(() => B.parseBackup(ok({}, ['dün']), today), /geçerli bir tarih/);
  const parsed = B.parseBackup(ok({}, ['2026-11-01', '2026-11-05', '2026-11-01']), today);
  assert.equal(parsed.skippedFuture, 1);
  assert.deepEqual(parsed.habits[0].completions, ['2026-11-01']);
});

test('geri yükleme planı: birleştirme hiçbir şey silmez, farksız belge yazılmaz', () => {
  const current = [habit({ id: 'a' }), habit({ id: 'kalan' })];
  const logs = new Map([
    ['a_2026', { habitId: 'a', year: 2026, days: ['2026-11-01', '2026-11-02'] }],
    ['kalan_2026', { habitId: 'kalan', year: 2026, days: ['2026-11-03'] }],
  ]);
  const backup = { habits: [{ ...habit({ id: 'a' }), completions: ['2026-11-02', '2026-11-04'] }] };
  const ops = B.planRestore(current, logs, backup, 'merge');
  assert.deepEqual(ops.habitDeletes, []);
  assert.deepEqual(ops.logDeletes, []);
  assert.deepEqual(ops.habitSets, []);
  assert.deepEqual(ops.logSets, [{ id: 'a_2026', data: { habitId: 'a', year: 2026, days: ['2026-11-01', '2026-11-02', '2026-11-04'] } }]);
  const again = B.planRestore(current, new Map([['a_2026', { days: ['2026-11-02', '2026-11-04'] }]]), backup, 'merge');
  assert.equal(B.countOps(again), 0);
});

test('geri yükleme planı: tam geri yükleme yedekte olmayanı siler', () => {
  const current = [habit({ id: 'a' }), habit({ id: 'b' })];
  const logs = new Map([
    ['a_2025', { habitId: 'a', year: 2025, days: ['2025-11-01'] }],
    ['a_2026', { habitId: 'a', year: 2026, days: ['2026-11-01', '2026-11-02'] }],
    ['b_2026', { habitId: 'b', year: 2026, days: ['2026-11-03'] }],
  ]);
  const backup = { habits: [{ ...habit({ id: 'a' }), completions: ['2026-11-02'] }] };
  const ops = B.planRestore(current, logs, backup, 'replace');
  assert.deepEqual(ops.habitDeletes, ['b']);
  assert.deepEqual(ops.logDeletes.sort(), ['a_2025', 'b_2026']);
  assert.deepEqual(ops.logSets[0].data.days, ['2026-11-02']);
});

test('renkler: her renk iki temada da zeminden ayrılır, yazı rengi okunur', () => {
  for (const { hex } of PALETTE) {
    for (const theme of ['light', 'dark']) {
      const shown = displayColor(hex, theme);
      assert.ok(contrast(shown, SURFACE[theme]) >= 3, `${hex} ${theme}`);
      assert.ok(contrast(inkOn(shown), shown) >= 3, `${hex} yazı`);
    }
  }
  assert.ok(contrast(displayColor('#000000', 'dark'), SURFACE.dark) >= 3);
  assert.ok(contrast(displayColor('#ffffff', 'light'), SURFACE.light) >= 3);
});

test('güvenlik kuralları dosyası: süre koşulu yok, yalnızca sahibine açık', () => {
  const rulesPath = fileURLToPath(new URL('../firestore.rules', import.meta.url));
  const rules = execFileSync('cat', [rulesPath], { encoding: 'utf8' });
  const code = rules.replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /request\.time|timestamp|duration|if true/);
  assert.equal((code.match(/allow /g) || []).length, 1);
  assert.match(code, /match \/users\/\{uid\}\/\{document=\*\*\}/);
  assert.match(code, /request\.auth != null && request\.auth\.uid == uid/);
  assert.match(code, /rules_version = '2'/);
});

// Bu tablo kuralın mantığını belgeler. Gerçek kural motorunu çalıştırmaz; gerçek
// doğrulama README'deki Rules Playground adımlarıyla Firebase konsolunda yapılır.
test('kural senaryoları: yalnızca sahibi kendi ağacına erişir', () => {
  const allow = (authUid, path) => {
    const parts = path.split('/');
    if (parts[0] !== 'users' || parts.length < 2) return false;
    return authUid !== null && authUid === parts[1];
  };
  assert.equal(allow('ali', 'users/ali'), true);
  assert.equal(allow('ali', 'users/ali/habits/h1'), true);
  assert.equal(allow('ali', 'users/ali/logs/h1_2026'), true);
  assert.equal(allow('veli', 'users/ali/habits/h1'), false);
  assert.equal(allow(null, 'users/ali/habits/h1'), false);
  assert.equal(allow('ali', 'genel/belge'), false);
});

// Hesapları bağımsız ve kaba bir yöntemle yeniden yapıp karşılaştırır.
test('rastgele 400 senaryo: seri ve yüzdeler bağımsız hesapla aynı', () => {
  let x = 20261104;
  const rnd = () => { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; };
  const utcKey = (ms) => new Date(ms).toISOString().slice(0, 10);
  const DAY = 86400000;
  const todayMs = Date.UTC(2026, 10, 4);
  const today = utcKey(todayMs);
  for (let run = 0; run < 400; run += 1) {
    const length = Math.floor(rnd() * 500);
    const startMs = todayMs - length * DAY;
    const p = rnd();
    const flags = [];
    const done = new Set();
    for (let i = 0; i <= length; i += 1) {
      const on = rnd() < p;
      flags.push(on);
      if (on) done.add(utcKey(startMs + i * DAY));
    }
    if (rnd() < 0.5) done.add(utcKey(startMs - DAY)); // başlangıçtan önce
    if (rnd() < 0.5) done.add(utcKey(todayMs + DAY)); // gelecek

    const st = S.habitStats(habit({ startDate: utcKey(startMs) }), done, today);

    const total = flags.length;
    const count = flags.filter(Boolean).length;
    assert.equal(st.overall.total, total);
    assert.equal(st.overall.done, count);
    assert.equal(st.totalDone, count);
    for (const [win, days] of [[st.last7, 7], [st.last30, 30], [st.last365, 365]]) {
      const slice = flags.slice(-days);
      assert.equal(win.total, slice.length);
      assert.equal(win.done, slice.filter(Boolean).length);
      assert.ok(win.rate >= 0 && win.rate <= 100);
    }
    let longest = 0;
    let run2 = 0;
    for (const on of flags) { run2 = on ? run2 + 1 : 0; longest = Math.max(longest, run2); }
    let current = 0;
    for (let i = flags.length - 1; i >= 0; i -= 1) {
      if (flags[i]) current += 1;
      else if (i !== flags.length - 1) break;
    }
    assert.equal(st.longestStreak, longest);
    assert.equal(st.currentStreak, current);
  }
});

// Gün değişimi: ayrı süreçlerde gerçek saat dilimleriyle çalıştırılır.
const zoneScript = (body) => `
  import { todayKey, msUntilNextDay } from './js/dates.js';
  ${body}
`;
function inZone(tz, body) {
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', zoneScript(body)], {
    env: { ...process.env, TZ: tz },
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    encoding: 'utf8',
  });
  return JSON.parse(out);
}

test('gün yerel saate göre değişir, UTC gününe göre değil', () => {
  // Aynı an: 2026-11-04 22:30 UTC
  const body = `console.log(JSON.stringify(todayKey(new Date('2026-11-04T22:30:00Z'))));`;
  assert.equal(inZone('Europe/Istanbul', body), '2026-11-05');
  assert.equal(inZone('UTC', body), '2026-11-04');
  assert.equal(inZone('America/New_York', body), '2026-11-04');
  assert.equal(inZone('Pacific/Kiritimati', body), '2026-11-05');
  assert.equal(inZone('Pacific/Pago_Pago', body), '2026-11-04');
});

test('İstanbul: 23:59:59 ile 00:00:00 arasında gün değişir', () => {
  const out = inZone('Europe/Istanbul', `
    const a = new Date(2026, 10, 4, 23, 59, 59, 999);
    const b = new Date(a.getTime() + 1);
    const next = new Date(a.getTime() + msUntilNextDay(a));
    console.log(JSON.stringify([todayKey(a), todayKey(b), msUntilNextDay(a), next.getHours(), todayKey(next)]));
  `);
  assert.deepEqual(out, ['2026-11-04', '2026-11-05', 1, 0, '2026-11-05']);
});

test('yaz saati: gece yarısının atlandığı ve tekrarlandığı günlerde her saat için doğru gün', () => {
  // Havana'da 00:00 yaz saatiyle yok olur (8 Mart 2026), 1 Kasım 2026'da 00:00-01:00 iki kez yaşanır.
  for (const [tz, day, nextDay] of [
    ['America/Havana', [2026, 2, 7], '2026-03-08'],
    ['America/Havana', [2026, 9, 31], '2026-11-01'],
    ['America/New_York', [2026, 2, 7], '2026-03-08'],
    ['Europe/London', [2026, 2, 28], '2026-03-29'],
    ['Australia/Lord_Howe', [2026, 3, 4], '2026-04-05'],
  ]) {
    const [nowKey, reachedKey, later] = inZone(tz, `
      const now = new Date(${day[0]}, ${day[1]}, ${day[2]}, 22, 0, 0);
      const reached = new Date(now.getTime() + msUntilNextDay(now));
      const before = new Date(reached.getTime() - 1);
      console.log(JSON.stringify([todayKey(before), todayKey(reached), msUntilNextDay(reached) > 22 * 3600 * 1000]));
    `);
    assert.notEqual(nowKey, reachedKey, `${tz} ${nextDay}`);
    assert.equal(reachedKey, nextDay, `${tz} ${nextDay}`);
    assert.equal(later, true, `${tz} ${nextDay}: sonraki gün yaklaşık bir gün sonra gelmeli`);
  }
});

test('Havana geri alma gecesi: gün geriye dönmez', () => {
  const keys = inZone('America/Havana', `
    const start = new Date('2026-11-01T03:30:00Z').getTime();
    const out = [];
    for (let m = 0; m < 180; m += 15) out.push(todayKey(new Date(start + m * 60000)));
    console.log(JSON.stringify(out));
  `);
  const sorted = [...keys].sort();
  assert.deepEqual(keys, sorted);
});

// Günlük ölçü
const M = await import('../js/measure.js');

test('sayı girişi: Türkçe virgül, boş, hatalı ve sınır', () => {
  assert.deepEqual(M.parseMeasure('20'), { ok: true, value: 20 });
  assert.deepEqual(M.parseMeasure(' 2,5 '), { ok: true, value: 2.5 });
  assert.deepEqual(M.parseMeasure('0'), { ok: true, value: 0 });
  assert.deepEqual(M.parseMeasure(''), { ok: true, value: null });
  for (const bad of ['abc', '-3', '1,2,3', '1e5', '2000000', '12 sayfa']) assert.equal(M.parseMeasure(bad).ok, false, bad);
});

test('aylık ortalama: yalnızca yapılmış gün, başlangıç sonrası ve o ay', () => {
  const h = habit({ startDate: '2026-10-05' });
  const done = set('2026-10-05', '2026-10-06', '2026-10-07', '2026-11-01');
  const values = { '2026-10-01': 500, '2026-10-05': 10, '2026-10-06': 20, '2026-10-07': 30, '2026-10-08': 900, '2026-11-01': 40 };
  assert.deepEqual(M.monthAverage(h, done, values, '2026-10', '2026-11-04'), { count: 3, average: 20 });
  assert.deepEqual(M.monthAverage(h, done, values, '2026-11', '2026-11-04'), { count: 1, average: 40 });
  assert.deepEqual(M.monthAverage(h, done, values, '2026-09', '2026-11-04'), { count: 0, average: null });
});

test('ölçü karşılaştırması: kullanıcının örneği 18 → 23 = %28 artış', () => {
  const h = habit({ startDate: '2026-09-01' });
  const sep = ['2026-09-01', '2026-09-02', '2026-09-03'];
  const oct = ['2026-10-01', '2026-10-02', '2026-10-03'];
  const values = Object.fromEntries([...sep.map((k) => [k, 18]), ...oct.map((k) => [k, 23])]);
  const c = M.measureComparison(h, new Set([...sep, ...oct]), values, '2026-11-04');
  assert.equal(c.state, 'ok');
  assert.equal(Math.round(c.relative), 28);
  assert.equal(c.previous.month, '2026-09');
  assert.equal(c.latest.month, '2026-10');
});

test('ölçü karşılaştırması: az veride yüzde yok, önceki 0 ise bölme yok', () => {
  const h = habit({ startDate: '2026-09-01' });
  const few = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-10-01', '2026-10-02'];
  const c = M.measureComparison(h, new Set(few), Object.fromEntries(few.map((k) => [k, 5])), '2026-11-04');
  assert.equal(c.state, 'not-enough');
  assert.equal(c.latest.month, '2026-09');
  assert.equal(M.measureComparison(h, set(), undefined, '2026-11-04').state, 'not-enough');
  const days = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-10-01', '2026-10-02', '2026-10-03'];
  const vals = Object.fromEntries(days.map((k, i) => [k, i < 3 ? 0 : 4]));
  const z = M.measureComparison(h, new Set(days), vals, '2026-11-04');
  assert.equal(z.state, 'from-zero');
  assert.equal(z.relative, null);
  assert.equal(z.diff, 4);
});

test('aylık sayı tablosu: yalnızca girişi olan aylar, bu ay etiketli', () => {
  const h = habit({ startDate: '2026-09-01' });
  const rows = M.measureMonths(h, set('2026-11-01', '2026-09-02'), { '2026-11-01': 23, '2026-09-02': 10, '2026-10-05': 99 }, '2026-11-04');
  assert.deepEqual(rows.map((r) => [r.title, r.count, r.average]), [['Bu ay', 1, 23], ['Eylül 2026', 1, 10]]);
  assert.deepEqual(M.measureMonths(h, set(), {}, '2026-11-04'), []);
});

test('yedek: birim, hedef, sayı ve eski puanlar gidip gelir; eski yedek de açılır', () => {
  const h = habit({ unit: 'sayfa', target: 20, floor: 5, selfScores: { '2026-11': 7 } });
  const out = B.createBackup([h], new Map([['h1', set('2026-11-01')]]), new Date(), new Map([['h1', { '2026-11-01': 23 }]]));
  const parsed = B.parseBackup(JSON.stringify(out), '2026-11-04');
  assert.equal(parsed.habits[0].unit, 'sayfa');
  assert.deepEqual([parsed.habits[0].target, parsed.habits[0].floor], [20, 5]);
  assert.deepEqual(parsed.habits[0].selfScores, { '2026-11': 7 });
  assert.deepEqual(parsed.habits[0].values, { '2026-11-01': 23 });
  const old = JSON.stringify({ app: 'cetele', version: 1, habits: [{ id: 'a', name: 'X', color: '#112233', startDate: '2026-11-01', completions: [] }] });
  const oldParsed = B.parseBackup(old, '2026-11-04');
  assert.equal(oldParsed.habits[0].unit, '');
  assert.deepEqual(oldParsed.habits[0].values, {});
  const bad = (over) => JSON.stringify({ app: 'cetele', version: 1, habits: [{ id: 'a', name: 'X', color: '#112233', startDate: '2026-11-01', completions: [], ...over }] });
  assert.throws(() => B.parseBackup(bad({ target: -2 }), '2026-11-04'), /hedef/);
  assert.throws(() => B.parseBackup(bad({ floor: 'az' }), '2026-11-04'), /hedef/);
  assert.equal(oldParsed.habits[0].target, null);
  assert.throws(() => B.parseBackup(bad({ values: { 'dün': 3 } }), '2026-11-04'), /sayılar/);
  assert.throws(() => B.parseBackup(bad({ values: { '2026-11-01': -1 } }), '2026-11-04'), /sayılar/);
  assert.throws(() => B.parseBackup(bad({ selfScores: { '2026-11': 11 } }), '2026-11-04'), /puan/);
  assert.throws(() => B.parseBackup(bad({ selfScores: { 'kasim': 5 } }), '2026-11-04'), /puan/);
  assert.deepEqual(B.parseBackup(bad({ values: { '2026-12-01': 3 } }), '2026-11-04').habits[0].values, {});
});

test('geri yükleme planı: sayılar birleşir, farksız belge yazılmaz, tam geri yüklemede değişir', () => {
  const base = habit({ id: 'a', unit: 'km' });
  const logs = new Map([['a_2026', { habitId: 'a', year: 2026, days: ['2026-11-01'], values: { '2026-11-01': 5, '2026-11-02': 9 } }]]);
  const backup = { habits: [{ ...base, completions: ['2026-11-01'], values: { '2026-11-01': 7 } }] };
  const merged = B.planRestore([base], logs, backup, 'merge');
  assert.deepEqual(merged.logSets[0].data.values, { '2026-11-01': 7, '2026-11-02': 9 });
  const replaced = B.planRestore([base], logs, backup, 'replace');
  assert.deepEqual(replaced.logSets[0].data.values, { '2026-11-01': 7 });
  const same = { habits: [{ ...base, completions: ['2026-11-01'], values: { '2026-11-02': 9, '2026-11-01': 5 } }] };
  assert.equal(B.countOps(B.planRestore([base], logs, same, 'merge')), 0);
  const scored = { habits: [{ ...base, selfScores: { '2026-11': 8 }, completions: ['2026-11-01'], values: { '2026-11-01': 5, '2026-11-02': 9 } }] };
  assert.deepEqual(B.planRestore([base], logs, scored, 'merge').habitSets[0].data.selfScores, { '2026-11': 8 });
  const onlyValue = { habits: [{ ...base, completions: [], values: { '2025-03-01': 2 } }] };
  const fresh = B.planRestore([base], new Map(), onlyValue, 'replace');
  assert.deepEqual(fresh.logSets[0], { id: 'a_2025', data: { habitId: 'a', year: 2025, days: [], values: { '2025-03-01': 2 } } });
});

test('en uzun süren seri: arşiv hariç, en az 2 gün', () => {
  const today = '2026-11-04';
  const a = habit({ id: 'a', name: 'A', startDate: '2026-10-01' });
  const b = habit({ id: 'b', name: 'B', startDate: '2026-10-01', archived: true, archivedRanges: [{ from: '2026-11-04', to: null }] });
  const map = new Map([['a', new Set(range('2026-11-01', '2026-11-03'))], ['b', new Set(range('2026-10-01', '2026-11-03'))]]);
  assert.deepEqual([S.streakLeader([a, b], map, today).habit.id, S.streakLeader([a, b], map, today).streak], ['a', 3]);
  assert.equal(S.streakLeader([a], new Map([['a', set('2026-11-03')]]), today), null);
  assert.equal(S.streakLeader([], new Map(), today), null);
});
