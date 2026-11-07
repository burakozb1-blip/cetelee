// Tarih yardımcıları.
//
// Tarihler her yerde "YYYY-AA-GG" biçiminde yerel takvim günü olarak tutulur.
// "Bugün", cihazın yerel saatinden okunur (getFullYear/getMonth/getDate).
// Gün ekleme ve fark alma işlemleri saat içermeyen tam sayı takvim hesabıyla
// yapılır; bu sayede yaz saati geçişleri günleri kaydıramaz.

export const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz',
  'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const AYLAR_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export const GUNLER = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
export const GUNLER_KISA = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const pad = (n) => String(n).padStart(2, '0');
const makeKey = (y, m, d) => `${String(y).padStart(4, '0')}-${pad(m)}-${pad(d)}`;

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

export function daysInMonth(y, m) {
  if (m === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

export function isValidKey(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const { y, m, d } = parseKey(key);
  return y >= 1970 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

// Takvim gününü ardışık tam sayıya çevirir (1970-01-01 = 0).
export function keyToNum(key) {
  const { y, m, d } = parseKey(key);
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function numToKey(num) {
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

// Cihazın yerel saatine göre bugünün takvim günü.
export function todayKey(now = new Date()) {
  return makeKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export const addDays = (key, n) => numToKey(keyToNum(key) + n);
export const diffDays = (a, b) => keyToNum(a) - keyToNum(b);

// 0 = Pazartesi, 6 = Pazar
export function weekdayIndex(key) {
  return (((keyToNum(key) + 3) % 7) + 7) % 7;
}

export const startOfWeek = (key) => addDays(key, -weekdayIndex(key));
export const endOfWeek = (key) => addDays(startOfWeek(key), 6);

export function startOfMonth(key) {
  const { y, m } = parseKey(key);
  return makeKey(y, m, 1);
}

export function endOfMonth(key) {
  const { y, m } = parseKey(key);
  return makeKey(y, m, daysInMonth(y, m));
}

// Verilen günün ayından n ay uzaktaki ayın ilk günü.
export function addMonths(key, n) {
  const { y, m } = parseKey(key);
  const total = y * 12 + (m - 1) + n;
  return makeKey(Math.floor(total / 12), (total % 12) + 1, 1);
}

// Bir sonraki yerel gece yarısına kalan süre. Tarayıcı, yerel saatte var olmayan
// bir gece yarısını (yaz saati geçişi) otomatik olarak ilk geçerli ana taşır.
export function msUntilNextDay(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(0, next.getTime() - now.getTime());
}

export function formatLong(key) {
  const { y, m, d } = parseKey(key);
  return `${d} ${AYLAR[m - 1]} ${y}`;
}

export function formatDayMonth(key) {
  const { m, d } = parseKey(key);
  return `${d} ${AYLAR[m - 1]}`;
}

export function formatShort(key) {
  const { m, d } = parseKey(key);
  return `${d} ${AYLAR_KISA[m - 1]}`;
}

export const weekdayName = (key) => GUNLER[weekdayIndex(key)];

// Gün değişimini izler. Gece yarısı zamanlayıcısı, cihaz uykudayken gecikebileceği
// için sayfa öne geldiğinde ve dakikada iki kez ayrıca kontrol yapılır. Cihaz saati
// veya saat dilimi değişirse de bu kontroller yeni günü yakalar.
export function watchDayChange(onChange) {
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
  const interval = setInterval(check, 30000);
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('focus', wake);
  window.addEventListener('pageshow', wake);

  return {
    check,
    stop() {
      clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('pageshow', wake);
    },
  };
}
