import { addDays, isWeekday, parseISO, toISO } from "../dates.ts";
import { STATES } from "../states.ts";
import type { Stay } from "../types";

export type Activity = "work" | "pto" | "holiday" | "sick" | "weekend" | "travel_nonwork";
export interface WorkSession {
  id: string;
  country: "US" | "CA";
  state: string;
  municipality: string;
  hours: number;
  activity: Activity;
}
export interface WorkDay {
  date: string;
  sessions: WorkSession[];
  status: "projected" | "reported" | "attested";
  reportedAt?: string;
  attestedAt?: string;
}
export interface LedgerRevision {
  id: string;
  date: string;
  before?: WorkDay;
  after: WorkDay;
  reason: string;
  changedAt: string;
}
export interface LedgerState {
  days: Record<string, WorkDay>;
  revisions: LedgerRevision[];
}
export const EMPTY_LEDGER: LedgerState = { days: {}, revisions: [] };

export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && toISO(parseISO(value)) === value;
}
export function datesBetween(start: string, end: string): string[] {
  if (!validDate(start) || !validDate(end) || start > end) return [];
  const dates: string[] = [];
  for (let d = parseISO(start); toISO(d) <= end; d = addDays(d, 1)) dates.push(toISO(d));
  return dates;
}
/** Shorter overlays win; equal-length ties favor the later arrival. */
export function projectStays(stays: Stay[], cutoff: string): WorkDay[] {
  const dates = new Map<string, Stay>();
  const length = (s: Stay) => Date.parse(s.end) - Date.parse(s.start);
  for (const stay of stays) for (const date of datesBetween(stay.start, stay.end < cutoff ? stay.end : cutoff)) {
    const previous = dates.get(date);
    if (!previous || length(stay) < length(previous) || (length(stay) === length(previous) && stay.start > previous.start)) dates.set(date, stay);
  }
  return [...dates].sort(([a], [b]) => a.localeCompare(b)).map(([date, stay]) => ({
    date, status: "projected", sessions: [{
      id: `projection-${date}`, country: ["AB", "BC"].includes(stay.state) ? "CA" : "US",
      state: stay.state, municipality: stay.location, hours: isWeekday(parseISO(date)) ? 8 : 0,
      activity: isWeekday(parseISO(date)) ? "work" : "weekend",
    }],
  }));
}
export function mergeLedger(projected: WorkDay[], ledger: LedgerState): WorkDay[] {
  const days = new Map(projected.map(d => [d.date, d]));
  for (const day of Object.values(ledger.days)) days.set(day.date, day);
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function validateDay(day: WorkDay): string[] {
  const issues: string[] = [];
  if (!validDate(day.date)) issues.push("Enter a valid work date.");
  if (!day.sessions.length) issues.push("Record work or a non-work activity for this day.");
  const ids = new Set<string>();
  for (const session of day.sessions) {
    if (ids.has(session.id)) issues.push("Duplicate session ID.");
    ids.add(session.id);
    if (!["work", "pto", "holiday", "sick", "weekend", "travel_nonwork"].includes(session.activity)) issues.push("Unknown activity.");
    if (!Number.isFinite(session.hours) || session.hours < 0 || session.hours > 24) issues.push("Hours must be between 0 and 24.");
    if (session.activity === "work" && (!session.state || session.hours <= 0)) issues.push("Every work session needs a location and positive hours.");
    if (session.activity !== "work" && session.hours !== 0) issues.push("Non-work activities must have zero work hours.");
    if (session.state && (!Object.hasOwn(STATES, session.state) || (STATES[session.state].country ?? "US") !== session.country)) issues.push("State and country do not match a supported location.");
    if (!["US", "CA"].includes(session.country)) issues.push("Unknown country.");
  }
  if (day.sessions.reduce((sum, s) => sum + s.hours, 0) > 24) issues.push("Work hours cannot exceed 24 in one day.");
  return [...new Set(issues)];
}
export function reviseDay(ledger: LedgerState, day: WorkDay, reason: string, now: string, previous?: WorkDay): LedgerState {
  const issues = validateDay(day);
  if (issues.length) throw new Error(issues.join(" "));
  if (!reason.trim()) throw new Error("Add a reason for the record or correction.");
  // Every correction invalidates the old attestation unless this replacement is attested anew.
  const after: WorkDay = { ...day, reportedAt: now, attestedAt: day.status === "attested" ? now : undefined };
  const revision: LedgerRevision = { id: `${day.date}-${now}-${ledger.revisions.length}`, date: day.date,
    before: ledger.days[day.date] ?? previous, after, reason: reason.trim(), changedAt: now };
  return { days: { ...ledger.days, [day.date]: after }, revisions: [...ledger.revisions, revision] };
}
export function jurisdiction(session: WorkSession): string {
  return session.country === "US" ? session.state : `${session.country}-${session.state}`;
}
export function workSessions(day: WorkDay): WorkSession[] {
  return day.sessions.filter(s => s.activity === "work" && s.hours > 0);
}
export function dayCount(day: WorkDay, code: string, definition: "any" | "majority" = "any"): number {
  const sessions = workSessions(day);
  const hours = sessions.filter(s => jurisdiction(s) === code).reduce((n, s) => n + s.hours, 0);
  const total = sessions.reduce((n, s) => n + s.hours, 0);
  return definition === "majority" ? Number(hours > total / 2) : Number(hours > 0);
}
export function coverageIssues(days: WorkDay[], start: string, end: string): string[] {
  const byDate = new Map(days.map(d => [d.date, d]));
  let missing = 0, projected = 0, unattested = 0;
  const issues: string[] = [];
  for (const date of datesBetween(start, end)) {
    const day = byDate.get(date);
    if (!day) { if (isWeekday(parseISO(date))) missing++; continue; }
    if (day.status === "projected") projected++;
    else if (day.status !== "attested") unattested++;
    issues.push(...validateDay(day).map(issue => `${date}: ${issue}`));
  }
  if (missing) issues.push(`${missing} scheduled weekdays have no record.`);
  if (projected) issues.push(`${projected} days are projections, not confirmed work records.`);
  if (unattested) issues.push(`${unattested} reported days await employee attestation.`);
  return [...new Set(issues)];
}
