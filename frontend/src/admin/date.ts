// Date helpers. Weekday indexes follow the backend convention: 0 = Monday ... 6 = Sunday.
export const WEEKDAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
export const WEEKDAYS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function toKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromKey(k: string) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey() {
  return toKey(new Date());
}

export function addDays(k: string, n: number) {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function addMonths(k: string, n: number) {
  const d = fromKey(k);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return toKey(d);
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayIndex(k: string) {
  return (fromKey(k).getDay() + 6) % 7;
}

export function weekStart(k: string) {
  return addDays(k, -weekdayIndex(k));
}

export function monthRange(k: string) {
  const d = fromKey(k);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: toKey(first), end: toKey(last) };
}

/** Month grid (weeks × 7), Monday-first, padded with null. */
export function monthGrid(k: string): (string | null)[][] {
  const { start, end } = monthRange(k);
  const lead = weekdayIndex(start);
  const days = fromKey(end).getDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let i = 0; i < days; i++) cells.push(addDays(start, i));
  while (cells.length % 7) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export function fmtLong(k: string) {
  const d = fromKey(k);
  return `${WEEKDAYS_SHORT[weekdayIndex(k)]}, ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}`;
}

export function fmtShort(k: string) {
  const d = fromKey(k);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function fmtBR(k: string) {
  const [y, m, d] = k.split("-");
  return `${d}/${m}/${y}`;
}

/** "dd/mm/aaaa" -> "aaaa-mm-dd" or null */
export function parseBR(s: string): string | null {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const k = `${m[3]}-${m[2]}-${m[1]}`;
  const d = fromKey(k);
  return isNaN(d.getTime()) ? null : k;
}

export function t2m(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function m2t(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function timesBetween(open: string, close: string, step = 30, inclusiveEnd = false) {
  const out: string[] = [];
  const end = t2m(close);
  for (let m = t2m(open); inclusiveEnd ? m <= end : m < end; m += step) out.push(m2t(m));
  return out;
}

export const isValidTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

export function money(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}
