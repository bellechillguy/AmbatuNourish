/** Tanggal & waktu Bahasa Indonesia, tanpa bergantung pada data locale Intl. */

export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
export const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/** YYYY-MM-DD dalam zona waktu perangkat. */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(key: string, days: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Senin pada minggu yang memuat tanggal tsb. */
export function startOfWeek(key: string): string {
  const d = fromDateKey(key);
  const dow = d.getDay(); // 0 = Minggu
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(key, diff);
}

export function weekDays(key: string): string[] {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** "19 November" */
export function formatDayMonth(key: string): string {
  const d = fromDateKey(key);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

/** "Kamis, 19 Nov" */
export function formatDayShortMonth(key: string): string {
  const d = fromDateKey(key);
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

/** "Kam, 19 Nov" */
export function formatShortDay(key: string): string {
  const d = fromDateKey(key);
  return `${DAY_SHORT[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

/** "12 Nov 2026" */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** "14.05" */
export function formatTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${pad(d.getHours())}.${pad(d.getMinutes())}`;
}

export function dayName(key: string): string {
  return DAY_NAMES[fromDateKey(key).getDay()];
}

export function dayShort(key: string): string {
  return DAY_SHORT[fromDateKey(key).getDay()];
}

/** "16 - 22 November" */
export function formatWeekRange(key: string): string {
  const days = weekDays(key);
  const a = fromDateKey(days[0]);
  const b = fromDateKey(days[6]);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} - ${b.getDate()} ${MONTH_NAMES[b.getMonth()]}`;
  return `${a.getDate()} ${MONTH_SHORT[a.getMonth()]} - ${b.getDate()} ${MONTH_SHORT[b.getMonth()]}`;
}

/** Label relatif: "Hari ini", "Kemarin", atau tanggal. */
export function relativeDayLabel(key: string): string {
  const today = todayKey();
  if (key === today) return 'Hari ini';
  if (key === addDays(today, -1)) return 'Kemarin';
  return formatShortDay(key);
}

/** "3 hari lalu" untuk penanda cache. */
export function ageLabel(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) {
    const hours = Math.max(1, Math.floor(diffMs / 3_600_000));
    return `${hours} jam lalu`;
  }
  return `${days} hari lalu`;
}

/** Gabungkan dateKey + "HH.MM" → Date. Mengembalikan null bila format jam salah. */
export function combineDateTime(dateKey: string, time: string): Date | null {
  const m = /^(\d{1,2})[.:](\d{2})$/.exec(time.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const d = fromDateKey(dateKey);
  d.setHours(h, min, 0, 0);
  return d;
}
