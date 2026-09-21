import { STATES } from "./states";
import type { PlannedStop, RiskLevel, Rule, Settings, Stay } from "./types";

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

function stayLengthDays(s: Stay): number {
  return Math.round((parseISO(s.end).getTime() - parseISO(s.start).getTime()) / 86_400_000) + 1;
}

// ---------- day attribution ----------
// Each calendar day belongs to exactly one stay: the shortest stay covering it,
// so air-trip overlays win over the ground stay they interrupt, and travel days
// shared by two stops go to the more specific (newer) one.

export function attributeDays(stays: Stay[]): Map<string, Stay> {
  const byDay = new Map<string, Stay>();
  for (const stay of stays) {
    const len = stayLengthDays(stay);
    for (let d = parseISO(stay.start); d <= parseISO(stay.end); d = addDays(d, 1)) {
      const key = toISO(d);
      const cur = byDay.get(key);
      // Equal-length ties (shared travel days) go to the later-starting stay —
      // the day you arrive somewhere belongs to where you arrived.
      if (!cur || len < stayLengthDays(cur) || (len === stayLengthDays(cur) && stay.start > cur.start))
        byDay.set(key, stay);
    }
  }
  return byDay;
}

export interface StateAgg {
  state: string;
  workDays: number;
  calDays: number;
  firstDay: string;
  stays: StayAgg[];
}

export interface StayAgg {
  stay: Stay;
  workDays: number;
  /** portion of the stay on or before the cutoff */
  from: string;
  to: string;
}

/** Aggregate logged days per state up to and including `cutoffISO`. */
export function pastAggregates(stays: Stay[], cutoffISO: string): StateAgg[] {
  const byDay = attributeDays(stays);
  const states = new Map<string, StateAgg>();
  const perStay = new Map<string, StayAgg>();

  const keys = [...byDay.keys()].sort();
  for (const key of keys) {
    if (key > cutoffISO) continue;
    const stay = byDay.get(key)!;
    let agg = states.get(stay.state);
    if (!agg) {
      agg = { state: stay.state, workDays: 0, calDays: 0, firstDay: key, stays: [] };
      states.set(stay.state, agg);
    }
    let sa = perStay.get(stay.id);
    if (!sa) {
      sa = { stay, workDays: 0, from: key, to: key };
      perStay.set(stay.id, sa);
      agg.stays.push(sa);
    }
    sa.to = key;
    agg.calDays += 1;
    if (isWeekday(parseISO(key))) {
      agg.workDays += 1;
      sa.workDays += 1;
    }
  }
  return [...states.values()].sort((a, b) => a.firstDay.localeCompare(b.firstDay));
}

// ---------- threshold rules ----------

export const dailyRate = (salary: number) => salary / 260;

export function ruleHit(rule: Rule | null, workDays: number, rate: number): boolean {
  if (!rule || workDays <= 0) return false;
  const wages = workDays * rate;
  const dayLeg = (d: number) => (d === 1 ? workDays >= 1 : workDays > d);
  if (rule.and) return dayLeg(rule.and.d) && wages > rule.and.usd;
  if (rule.any) return dayLeg(rule.any.d) || wages > rule.any.usd;
  if (rule.d !== undefined) return dayLeg(rule.d);
  if (rule.usd !== undefined) return wages > rule.usd;
  return false;
}

/** Work-day budget before the rule trips (null = no limit). */
export function budgetWd(rule: Rule | null, rate: number): number | null {
  if (!rule) return null;
  const fromUsd = (usd: number) => Math.max(Math.floor(usd / rate), 0);
  if (rule.and) return rule.and.d;
  if (rule.any) return Math.min(rule.any.d, fromUsd(rule.any.usd));
  if (rule.d !== undefined) return rule.d === 1 ? 0 : rule.d;
  if (rule.usd !== undefined) return fromUsd(rule.usd);
  return null;
}

export const planTo = (budget: number | null, margin: number) =>
  budget === null ? null : Math.floor(budget * margin);

/** Inherent riskiness of a state, from its withholding budget. */
export function stateTier(code: string, rate: number): RiskLevel {
  const b = budgetWd(STATES[code].withholding, rate);
  if (b === null) return "clear";
  return b < 14 ? "triggered" : "caution";
}

// ---------- past outcomes ----------

export interface Outcome {
  level: RiskLevel;
  youHit: boolean;
  coHit: boolean;
  wages: number;
}

export function pastOutcome(code: string, workDays: number, rate: number): Outcome {
  const info = STATES[code];
  const youHit = ruleHit(info.filing, workDays, rate);
  const coHit = ruleHit(info.withholding, workDays, rate);
  return {
    level: coHit ? "triggered" : youHit ? "caution" : "clear",
    youHit,
    coHit,
    wages: workDays * rate,
  };
}

// ---------- future verdicts ----------

export interface Verdict {
  level: RiskLevel;
  label: string;
  detail?: string;
}

export function futureVerdict(
  code: string,
  wdBefore: number,
  wdStay: number,
  rate: number,
  margin: number
): Verdict {
  const info = STATES[code];
  const after = wdBefore + wdStay;
  if (!info.filing && !info.withholding) return { level: "clear", label: "Clear — no demo trigger" };

  const coBefore = ruleHit(info.withholding, wdBefore, rate);
  const coAfter = ruleHit(info.withholding, after, rate);
  const youBefore = ruleHit(info.filing, wdBefore, rate);
  const youAfter = ruleHit(info.filing, after, rate);
  const registered = info.country !== "CA" && info.employerRegistered;

  if (coAfter && !coBefore) {
    return registered
      ? {
          level: "caution",
          label: "Triggers withholding — admin only",
          detail: `${info.name} crosses the demo withholding trigger, but the employer is registered — a correction inside an existing account.`,
        }
      : {
          level: "triggered",
          label: "Creates a NEW employer registration",
          detail: `${info.name} crosses the demo withholding trigger in an unregistered state — a sample net-new registration plus recurring filings for the employer.`,
        };
  }
  if (coAfter)
    return registered
      ? { level: "caution", label: "Extends exposure (registered)" }
      : { level: "triggered", label: "Extends net-new exposure" };
  if (youAfter && !youBefore)
    return {
      level: "caution",
      label: "Creates your NR filing",
      detail: `${info.name} crosses the demo personal filing threshold — a nonresident return, with nothing new for the employer.`,
    };
  const b = budgetWd(STATES[code].withholding, rate);
  const pt = planTo(b, margin);
  if (b !== null && pt !== null && after > pt)
    return {
      level: "caution",
      label: `Over margin — trim ${after - pt} wd`,
      detail: `${info.name}: ${after} projected work days vs a plan-to of ${pt} — trim the stay or convert days to PTO.`,
    };
  return { level: "clear", label: "Clear" };
}

// ---------- future route scheduling ----------

export interface ScheduledStop {
  stop: PlannedStop;
  index: number;
  startISO: string;
  endISO: string;
  workDays: number;
  wdBefore: number;
  verdict: Verdict;
}

export function scheduleRoute(
  planned: PlannedStop[],
  routeStartISO: string,
  pastWdByState: Map<string, number>,
  rate: number,
  margin: number
): ScheduledStop[] {
  const out: ScheduledStop[] = [];
  const runningWd = new Map<string, number>();
  let cursor = parseISO(routeStartISO);
  planned.forEach((stop, index) => {
    const start = new Date(cursor);
    const end = addDays(start, stop.lengthDays - 1);
    cursor = addDays(end, 1);
    let wd = 0;
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) if (isWeekday(d)) wd += 1;
    const before = (pastWdByState.get(stop.state) ?? 0) + (runningWd.get(stop.state) ?? 0);
    runningWd.set(stop.state, (runningWd.get(stop.state) ?? 0) + wd);
    out.push({
      stop,
      index,
      startISO: toISO(start),
      endISO: toISO(end),
      workDays: wd,
      wdBefore: before,
      verdict: futureVerdict(stop.state, before, wd, rate, margin),
    });
  });
  return out;
}

// ---------- clocks ----------

export interface CurrentRun {
  state: string;
  startISO: string;
  endISO: string;
  workDays: number;
}

/** The contiguous same-state run of ground stays covering `today`. */
export function currentRun(stays: Stay[], todayIso: string): CurrentRun | null {
  const ground = stays
    .filter((s) => s.kind === "ground")
    .sort((a, b) => a.start.localeCompare(b.start));
  let idx = ground.findIndex((s) => s.start <= todayIso && todayIso <= s.end);
  if (idx === -1) return null;
  const state = ground[idx].state;
  while (
    idx > 0 &&
    ground[idx - 1].state === state &&
    parseISO(ground[idx].start) <= addDays(parseISO(ground[idx - 1].end), 1)
  )
    idx -= 1;
  const startISO = ground[idx].start;
  let wd = 0;
  for (let d = parseISO(startISO); toISO(d) <= todayIso; d = addDays(d, 1))
    if (isWeekday(d)) wd += 1;
  const last = ground.find((s) => s.start <= todayIso && todayIso <= s.end)!;
  return { state, startISO, endISO: last.end, workDays: wd };
}

export interface Clocks {
  run: CurrentRun | null;
  runBudget: number | null;
  runPlanTo: number | null;
  outsideResidence: number;
  outsideResidenceWithRoute: number;
  foreignDays: number;
  foreignDaysWithRoute: number;
}

export function computeClocks(
  stays: Stay[],
  scheduled: ScheduledStop[],
  settings: Settings,
  todayIso: string
): Clocks {
  const byDay = attributeDays(stays);
  let outside = 0;
  let foreign = 0;
  for (const [key, stay] of byDay) {
    if (key > todayIso) continue;
    if (stay.state !== settings.residence) outside += 1;
    if (STATES[stay.state]?.country === "CA") foreign += 1;
  }
  let outsideRoute = outside;
  let foreignRoute = foreign;
  for (const s of scheduled) {
    if (s.stop.state !== settings.residence) outsideRoute += s.stop.lengthDays;
    if (STATES[s.stop.state]?.country === "CA") foreignRoute += s.stop.lengthDays;
  }
  const run = currentRun(stays, todayIso);
  const rate = dailyRate(settings.salary);
  const budget = run ? budgetWd(STATES[run.state].withholding, rate) : null;
  return {
    run,
    runBudget: budget,
    runPlanTo: planTo(budget, settings.margin),
    outsideResidence: outside,
    outsideResidenceWithRoute: outsideRoute,
    foreignDays: foreign,
    foreignDaysWithRoute: foreignRoute,
  };
}
