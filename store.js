// Firebase katmanı: oturum, canlı veri ve yazma işlemleri.
//
// Veri modeli:
//   users/{uid}/habits/{habitId}      alışkanlık bilgileri
//   users/{uid}/logs/{habitId}_{yıl}  { habitId, year, days: ["YYYY-AA-GG", ...] }
//   users/{uid}/books/{kitapId}       { title, author, totalPages, status, pages: { gün: sayfa } }
//   users/{uid}/words/{habitId}_{ay}  { habitId, month, items: { kelimeId: { word, meaning, ... } } }
//
// Bir alışkanlığın bir yılı tek belgededir. Böylece sayfa açılışında okunan belge
// sayısı "alışkanlık + alışkanlık x yıl" kadar kalır; gün başına belge okunmaz.

import { addDays, isValidKey, parseKey, todayKey } from './dates.js';
import { logDocId } from './backup.js';
import { normalizeBook } from './books.js';
import { byDoc, newWordId, wordDocId, wordsFromDoc } from './words.js';
import { endDate } from './stats.js';

const SDK_VERSION = '13.2.0';
const SDK_BASE = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;
const WRITE_DELAY_MS = 350;
const SLOW_LOAD_MS = 10000;
const BATCH_LIMIT = 400;
const COLLECTIONS = ['habits', 'logs', 'books', 'words'];
const flags = (value) => Object.fromEntries(COLLECTIONS.map((name) => [name, value]));

export function isConfigured(config) {
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
  return Boolean(config) && required.every((k) => typeof config[k] === 'string' && config[k]
    && !config[k].includes('BURAYA'));
}

export function errorMessage(error) {
  const code = String(error?.code || '').replace('firestore/', '');
  const messages = {
    'auth/unauthorized-domain': 'Bu site adresi Firebase Authentication\'da yetkili değil. Konsoldan yetkili alan adlarına ekle.',
    'auth/popup-blocked': 'Giriş penceresi engellendi. Tarayıcında bu site için açılır pencerelere izin ver ve yeniden dene.',
    'auth/network-request-failed': 'Giriş yapılamadı: internet bağlantısı yok. Bağlantını kontrol edip yeniden dene.',
    'auth/operation-not-allowed': 'Google girişi kapalı. Firebase konsolunda Authentication bölümünden etkinleştir.',
    'auth/configuration-not-found': 'Authentication bu projede henüz açılmamış. Firebase konsolundan Google girişini etkinleştir.',
    'auth/invalid-api-key': 'firebase-config.js içindeki apiKey değeri geçersiz. Konsoldaki değerle karşılaştır.',
    'auth/api-key-not-valid': 'firebase-config.js içindeki apiKey değeri geçersiz. Konsoldaki değerle karşılaştır.',
    'auth/too-many-requests': 'Çok fazla deneme yapıldı. Biraz bekleyip yeniden dene.',
    'auth/internal-error': 'Giriş sırasında bir sorun oluştu. Yeniden dene.',
    'permission-denied': 'Firestore bu işleme izin vermedi. Güvenlik kurallarının yayımlandığını kontrol et.',
    unauthenticated: 'Oturumun sona erdi. Yeniden giriş yap.',
    unavailable: 'Sunucuya ulaşılamıyor. İnternet bağlantını kontrol et.',
    'resource-exhausted': 'Firebase\'in günlük ücretsiz kotası doldu. Kota yenilenince yeniden dene.',
    'not-found': 'Firestore veritabanı bulunamadı. Firebase konsolunda veritabanını oluşturduğunu kontrol et.',
    'failed-precondition': 'Firestore bu işlemi şu anda yapamadı. Sayfayı yenileyip yeniden dene.',
    'deadline-exceeded': 'Sunucu zamanında yanıt vermedi. Yeniden dene.',
  };
  return messages[code] || 'Beklenmeyen bir hata oluştu. Sayfayı yenileyip yeniden dene.';
}

function normalizeHabit(id, data) {
  return {
    id,
    name: typeof data.name === 'string' ? data.name : 'Adsız',
    description: typeof data.description === 'string' ? data.description : '',
    color: typeof data.color === 'string' ? data.color : '#2B4FD8',
    startDate: isValidKey(data.startDate) ? data.startDate : todayKey(),
    archived: Boolean(data.archived),
    archivedRanges: Array.isArray(data.archivedRanges) ? data.archivedRanges : [],
    unit: typeof data.unit === 'string' ? data.unit : '',
    duration: Number.isInteger(data.duration) && data.duration > 0 ? data.duration : null,
    mastery: data.mastery === 'hours' || data.mastery === 'words' ? data.mastery : null,
    dailyDefault: Number.isFinite(data.dailyDefault) && data.dailyDefault > 0 ? data.dailyDefault : null,
    target: Number.isFinite(data.target) && data.target > 0 ? data.target : null,
    floor: Number.isFinite(data.floor) && data.floor > 0 ? data.floor : null,
    selfScores: data.selfScores && typeof data.selfScores === 'object' ? data.selfScores : {},
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
  };
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export class Store {
  constructor() {
    this.phase = 'booting'; // booting | config | sdk-error | signed-out | loading | slow | ready | load-error
    this.user = null;
    this.loadError = null;
    this.habits = [];
    this.books = [];
    this.words = [];
    this.wordDocs = new Map(); // belge -> kelime sayısı
    this.logs = new Map();
    this.done = new Map();
    this.values = new Map(); // alışkanlık -> { gün: sayı }
    this.pending = new Map(); // henüz gönderilmemiş işaretler
    this.sent = new Map(); // gönderilmiş, canlı veride henüz görünmemiş işaretler
    this.hasPendingWrites = false;
    this.listeners = new Set();
    this.unsubs = [];
    this.flushTimer = null;
    this.slowTimer = null;
    this.signature = flags('');
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
    this.emit('phase');
  }

  reportError(error) {
    console.error(error);
    this.emit({ error: errorMessage(error) });
  }

  async init(config) {
    if (!isConfigured(config)) {
      this.setPhase('config');
      return;
    }
    let app;
    let auth;
    let fs;
    try {
      [app, auth, fs] = await Promise.all([
        import(`${SDK_BASE}/firebase-app.js`),
        import(`${SDK_BASE}/firebase-auth.js`),
        import(`${SDK_BASE}/firebase-firestore.js`),
      ]);
    } catch (error) {
      console.error(error);
      this.setPhase('sdk-error');
      return;
    }

    this.fs = fs;
    this.authSdk = auth;
    try {
      const firebaseApp = app.initializeApp(config);
      this.auth = auth.getAuth(firebaseApp);
      this.db = fs.initializeFirestore(firebaseApp, {
        localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
      });
    } catch (error) {
      console.error(error);
      this.setPhase('sdk-error');
      return;
    }

    window.addEventListener('pagehide', () => this.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });

    auth.onAuthStateChanged(this.auth, (user) => this.handleUser(user), (error) => this.reportError(error));
  }

  handleUser(user) {
    this.stopListening();
    this.clearData();
    this.user = user;
    if (user) this.startListening();
    else this.setPhase('signed-out');
  }

  clearData() {
    clearTimeout(this.flushTimer);
    this.pending.clear();
    this.sent.clear();
    this.habits = [];
    this.books = [];
    this.words = [];
    this.wordDocs = new Map();
    this.logs = new Map();
    this.done = new Map();
    this.values = new Map();
    this.signature = flags('');
    this.seen = flags(false);
    this.pendingFlags = flags(false);
    this.hasPendingWrites = false;
  }

  col(name) {
    return this.fs.collection(this.db, 'users', this.user.uid, name);
  }

  ref(name, id) {
    return this.fs.doc(this.db, 'users', this.user.uid, name, id);
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
    this.setPhase('loading');
    clearTimeout(this.slowTimer);
    this.slowTimer = setTimeout(() => {
      if (this.phase === 'loading') this.setPhase('slow');
    }, SLOW_LOAD_MS);

    const options = { includeMetadataChanges: true };
    const onError = (error) => {
      console.error(error);
      this.stopListening();
      this.loadError = errorMessage(error);
      if (this.phase === 'ready') this.emit({ error: this.loadError });
      this.setPhase('load-error');
    };
    this.unsubs = [
      this.fs.onSnapshot(this.col('habits'), options, (snap) => this.onHabits(snap), onError),
      this.fs.onSnapshot(this.col('logs'), options, (snap) => this.onLogs(snap), onError),
      this.fs.onSnapshot(this.col('books'), options, (snap) => this.onBooks(snap), onError),
      this.fs.onSnapshot(this.col('words'), options, (snap) => this.onWords(snap), onError),
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
    this.setPhase('ready');
  }

  onHabits(snap) {
    const habits = snap.docs
      .map((d) => normalizeHabit(d.id, d.data()))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name, 'tr'));
    const signature = JSON.stringify(habits);
    const changed = signature !== this.signature.habits;
    this.signature.habits = signature;
    this.habits = habits;
    this.afterSnapshot('habits', snap, changed);
  }

  onLogs(snap) {
    const logs = new Map();
    snap.docs.forEach((d) => {
      const data = d.data();
      if (typeof data.habitId !== 'string') return;
      logs.set(d.id, {
        ...data,
        days: Array.isArray(data.days) ? data.days : [],
        values: data.values && typeof data.values === 'object' ? data.values : {},
      });
    });
    const signature = JSON.stringify([...logs.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
    const changed = signature !== this.signature.logs;
    this.signature.logs = signature;
    this.logs = logs;
    this.sent.forEach(({ habitId, key, value }, id) => {
      if (this.savedDone(habitId, key) === value) this.sent.delete(id);
    });
    if (changed) this.rebuildDone();
    this.afterSnapshot('logs', snap, changed);
  }

  afterSnapshot(which, snap, changed) {
    if (!snap.metadata.fromCache) this.seen[which] = true;
    this.arrived[which] = true;
    this.pendingFlags[which] = snap.metadata.hasPendingWrites;
    const pendingNow = COLLECTIONS.some((name) => this.pendingFlags[name]);
    const pendingChanged = pendingNow !== this.hasPendingWrites;
    this.hasPendingWrites = pendingNow;

    // Yeni cihazda boş önbellek "hiç veri yok" gibi gösterilmez; sunucu yanıtı beklenir.
    // Alışkanlıklar kayıtlardan önce gelirse ekran açılmaz; yoksa işaretler bir an boş görünür.
    const hasCached = this.habits.length > 0 || this.books.length > 0 || this.words.length > 0;
    const serverReady = COLLECTIONS.every((name) => this.seen[name]);
    const allArrived = COLLECTIONS.every((name) => this.arrived[name]);
    if (this.phase !== 'ready' && allArrived && (serverReady || hasCached)) {
      clearTimeout(this.slowTimer);
      this.setPhase('ready');
    } else if (changed && this.phase === 'ready') {
      this.emit('data');
    }
    if (pendingChanged) this.emit('sync');
  }

  onBooks(snap) {
    const books = snap.docs.map((d) => normalizeBook(d.id, d.data()));
    const signature = JSON.stringify(books);
    const changed = signature !== this.signature.books;
    this.signature.books = signature;
    this.books = books;
    this.afterSnapshot('books', snap, changed);
  }

  onWords(snap) {
    const words = [];
    const docs = new Map();
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
    this.afterSnapshot('words', snap, changed);
  }

  rebuildDone() {
    const done = new Map();
    const values = new Map();
    this.logs.forEach((log) => {
      if (!done.has(log.habitId)) done.set(log.habitId, new Set());
      const days = done.get(log.habitId);
      log.days.forEach((d) => days.add(d));
      values.set(log.habitId, { ...(values.get(log.habitId) || {}), ...log.values });
    });
    this.values = values;
    const overlay = ({ habitId, key, value }) => {
      if (!done.has(habitId)) done.set(habitId, new Set());
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
    const habit = this.habits.find((h) => h.id === habitId);
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
          this.ref('logs', logDocId(habitId, y)),
          { habitId, year: y, days: value ? arrayUnion(key) : arrayRemove(key) },
          { merge: true },
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
      this.emit('data');
      this.reportError(error);
    });
  }

  // Günlük sayı. Boş değer sayıyı siler. Yıl belgesinin içine yazılır, yeni belge açmaz.
  setValue(habitId, key, value) {
    const habit = this.habits.find((h) => h.id === habitId);
    if (!this.canMark(habit, key)) return false;
    const current = this.values.get(habitId)?.[key];
    if ((value === null && current === undefined) || value === current) return true;
    const map = { ...(this.values.get(habitId) || {}) };
    if (value === null) delete map[key];
    else map[key] = value;
    this.values.set(habitId, map);
    const { y } = parseKey(key);
    this.watch(this.fs.setDoc(
      this.ref('logs', logDocId(habitId, y)),
      { habitId, year: y, values: { [key]: value === null ? this.fs.deleteField() : value } },
      { merge: true },
    ));
    return true;
  }

  // Kitaplar

  addBook({ title, author, totalPages, page }) {
    const ref = this.fs.doc(this.col('books'));
    const today = todayKey();
    this.watch(this.fs.setDoc(ref, {
      title,
      author,
      totalPages,
      startPage: page || 0,
      status: 'reading',
      startDate: today,
      finishedAt: null,
      pages: { [today]: page || 0 },
      createdAt: new Date().toISOString(),
    }));
    return ref.id;
  }

  updateBook(id, fields) {
    this.watch(this.fs.updateDoc(this.ref('books', id), fields));
  }

  // Bugünün sayfası. Kitap belgesinin içine yazılır, yeni belge açmaz.
  setBookPage(id, page) {
    this.watch(this.fs.setDoc(this.ref('books', id), { pages: { [todayKey()]: page } }, { merge: true }));
  }

  deleteBook(id) {
    this.watch(this.fs.deleteDoc(this.ref('books', id)));
  }

  // Kelime arşivi. Her işlem yalnızca o ayın belgesine tek yazma yapar.

  addWord(habitId, { word, meaning, example }) {
    const date = todayKey();
    const id = newWordId();
    const month = date.slice(0, 7);
    const item = {
      word, meaning, example, date, learned: false, createdAt: new Date().toISOString(),
    };
    this.watch(this.fs.setDoc(this.ref('words', wordDocId(habitId, date)), { habitId, month, items: { [id]: item } }, { merge: true }));
    return id;
  }

  updateWord(item, fields) {
    this.watch(this.fs.setDoc(this.ref('words', item.docId), { habitId: item.habitId, items: { [item.id]: fields } }, { merge: true }));
  }

  deleteWord(item) {
    const ref = this.ref('words', item.docId);
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
        batch.set(this.ref('words', docId), { habitId: list[0].habitId, items: changes }, { merge: true });
      });
      this.watch(batch.commit());
    });
  }

  addHabit(fields) {
    const ref = this.fs.doc(this.col('habits'));
    this.watch(this.fs.setDoc(ref, {
      ...fields,
      archived: false,
      archivedRanges: [],
      createdAt: new Date().toISOString(),
    }));
    return ref.id;
  }

  updateHabit(id, fields) {
    this.watch(this.fs.updateDoc(this.ref('habits', id), fields));
  }

  archiveHabit(id) {
    const habit = this.habits.find((h) => h.id === id);
    if (!habit || habit.archived) return;
    this.updateHabit(id, {
      archived: true,
      archivedRanges: [...habit.archivedRanges, { from: todayKey(), to: null }],
    });
  }

  // Arşivde geçen günler yapılmamış sayılmaz; alışkanlık geri alındığı günden itibaren sayılır.
  unarchiveHabit(id) {
    const habit = this.habits.find((h) => h.id === id);
    if (!habit || !habit.archived) return;
    const today = todayKey();
    const ranges = habit.archivedRanges
      .map((r) => (r.to == null ? { from: r.from, to: addDays(today, -1) } : r))
      .filter((r) => r.from <= r.to);
    this.updateHabit(id, { archived: false, archivedRanges: ranges });
  }

  deleteHabit(id) {
    this.flush();
    const { deleteDoc, writeBatch } = this.fs;
    const logIds = [...this.logs.entries()].filter(([, log]) => log.habitId === id).map(([logId]) => ['logs', logId]);
    const wordIds = [...new Set(this.words.filter((w) => w.habitId === id).map((w) => w.docId))].map((docId) => ['words', docId]);
    chunk([...logIds, ...wordIds], BATCH_LIMIT).forEach((part) => {
      const batch = writeBatch(this.db);
      part.forEach(([name, docId]) => batch.delete(this.ref(name, docId)));
      this.watch(batch.commit());
    });
    this.watch(deleteDoc(this.ref('habits', id)));
  }

  async applyRestore(ops) {
    this.flush();
    const { writeBatch } = this.fs;
    const steps = [
      ...ops.logDeletes.map((id) => (b) => b.delete(this.ref('logs', id))),
      ...ops.habitDeletes.map((id) => (b) => b.delete(this.ref('habits', id))),
      ...ops.habitSets.map(({ id, data }) => (b) => b.set(this.ref('habits', id), data)),
      ...ops.logSets.map(({ id, data }) => (b) => b.set(this.ref('logs', id), data)),
      ...(ops.bookDeletes || []).map((id) => (b) => b.delete(this.ref('books', id))),
      ...(ops.bookSets || []).map(({ id, data }) => (b) => b.set(this.ref('books', id), data)),
      ...(ops.wordDeletes || []).map((id) => (b) => b.delete(this.ref('words', id))),
      ...(ops.wordSets || []).map(({ id, data }) => (b) => b.set(this.ref('words', id), data)),
    ];
    await Promise.all(chunk(steps, BATCH_LIMIT).map((part) => {
      const batch = writeBatch(this.db);
      part.forEach((step) => step(batch));
      return batch.commit();
    }));
  }

  async signIn() {
    const provider = new this.authSdk.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    // GitHub Pages'te yönlendirmeli giriş, üçüncü taraf depolamayı engelleyen
    // tarayıcılarda çalışmaz. Bu yüzden açılır pencereli giriş kullanılır.
    await this.authSdk.signInWithPopup(this.auth, provider);
  }

  // Çıkışta bu tarayıcıdaki önbellek temizlenir. Bekleyen yazma varsa önbellek
  // korunur; değişiklikler aynı hesapla yeniden girişte gönderilir.
  async signOut() {
    this.flush();
    const { waitForPendingWrites, terminate, clearIndexedDbPersistence } = this.fs;
    const synced = await Promise.race([
      waitForPendingWrites(this.db).then(() => true),
      new Promise((resolve) => { setTimeout(() => resolve(false), 4000); }),
    ]);
    this.stopListening();
    await this.authSdk.signOut(this.auth);
    if (synced) {
      try {
        await terminate(this.db);
        await clearIndexedDbPersistence(this.db);
      } catch (error) {
        console.warn('Önbellek temizlenemedi', error);
      }
      window.location.reload();
    }
  }
}
