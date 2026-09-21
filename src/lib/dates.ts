// ---------- dates ----------
// All dates are handled at local noon so DST shifts can't move a day.

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export const isWeekday = (d: Date) => d.getDay() > 0 && d.getDay() < 6;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtShort(iso: string, includeYear = false): string {
  const d = parseISO(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${includeYear ? `, ${d.getFullYear()}` : ""}`;
}

export function fmtRange(startISO: string, endISO: string, includeYear = false): string {
  if (startISO === endISO) return fmtShort(startISO, includeYear);
  const s = parseISO(startISO);
  const e = parseISO(endISO);
  if (s.getFullYear() !== e.getFullYear()) return `${fmtShort(startISO, true)} – ${fmtShort(endISO, true)}`;
  const year = includeYear ? `, ${e.getFullYear()}` : "";
  if (s.getMonth() === e.getMonth()) return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${e.getDate()}${year}`;
  return `${fmtShort(startISO)} – ${fmtShort(endISO)}${year}`;
}

export function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
