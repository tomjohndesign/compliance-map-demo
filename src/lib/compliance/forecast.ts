import type { EmployerPolicy } from "../employer/demoEmployer.ts";
import { addDays, parseISO, toISO } from "../dates.ts";
import { dayCount, projectStays, type WorkDay } from "../ledger/model.ts";
import type { PlannedStop, Settings } from "../types";
import { evaluateState, type StateOutcome } from "./evaluate.ts";
import { getReviewedRule } from "./reviewed2026.ts";

export interface ScheduledStop {
  stop: PlannedStop;
  index: number;
  startISO: string;
  endISO: string;
  workDays: number;
  wdBefore: number;
  outcome: StateOutcome;
  verdict: { label: string; level: StateOutcome["level"] };
  filingTriggerDate?: string;
  withholdingTriggerDate?: string;
  years: string[];
}
export function forecastRoute(planned: PlannedStop[], days: WorkDay[], settings: Settings, active: string[] = [], employer?: EmployerPolicy): ScheduledStop[] {
  let cursor = settings.routeStart;
  // Recorded days always supersede itinerary projections, including same-date future records.
  const recorded = new Map(days.filter(d => d.status !== "projected").map(d => [d.date, d]));
  // A proposed route with >14 NY days cannot forecast use of the <=14-day relief.
  const plannedNyByYear = new Map<string, number>();
  let nyCursor = settings.routeStart;
  for (const stop of planned) {
    const end = toISO(addDays(parseISO(nyCursor), Math.max(1, Math.min(366, stop.lengthDays)) - 1));
    if (stop.state === "NY") for (const day of projectStays([{ ...stop, start: nyCursor, end, kind: "ground" }], end)) {
      const entry = recorded.get(day.date) ?? day;
      const year = day.date.slice(0, 4);
      plannedNyByYear.set(year, (plannedNyByYear.get(year) ?? 0) + dayCount(entry, "NY"));
    }
    nyCursor = toISO(addDays(parseISO(end), 1));
  }
  for (const day of days.filter(d => d.date < settings.routeStart)) {
    const year = day.date.slice(0, 4);
    plannedNyByYear.set(year, (plannedNyByYear.get(year) ?? 0) + dayCount(day, "NY"));
  }
  const forecastSettings = (date: string): Settings => {
    const proposed = plannedNyByYear.get(date.slice(0, 4)) ?? 0;
    return proposed > 14 ? { ...settings, nyExpectedDays: Math.max(settings.nyExpectedDays ?? 0, proposed) } : settings;
  };
  let accumulated = days.filter(d => d.date < cursor);
  const estimates = (code: string, entries: WorkDay[], through: string) => {
    const year = through.slice(0, 4);
    const hours = entries.filter(d => d.date.slice(0, 4) === year && d.date <= through).reduce((n, d) => n + d.sessions.filter(s => s.activity === "work" && s.country === "US" && s.state === code).reduce((v, s) => v + s.hours, 0), 0);
    return { employer, forecast: true, stateWages: hours * settings.salary / 2080, annualTotalWages: settings.salary,
      payrollActive: active.includes(`${year}:${code}`) };
  };
  return planned.map((stop, index) => {
    const startISO = cursor;
    const endISO = toISO(addDays(parseISO(startISO), Math.max(1, Math.min(366, stop.lengthDays)) - 1));
    cursor = toISO(addDays(parseISO(endISO), 1));
    const projections = projectStays([{ ...stop, start: startISO, end: endISO, kind: "ground" }], endISO).map(d => recorded.get(d.date) ?? d);
    let prior = evaluateState(stop.state, accumulated, forecastSettings(startISO), startISO, estimates(stop.state, accumulated, startISO));
    const wdBefore = prior.workDays;
    let filingTriggerDate: string | undefined, withholdingTriggerDate: string | undefined;
    for (const day of projections) {
      if (day.date.endsWith("01-01")) prior = evaluateState(stop.state, [], forecastSettings(day.date), day.date, estimates(stop.state, [], day.date));
      accumulated = [...accumulated, day];
      const next = evaluateState(stop.state, accumulated, forecastSettings(day.date), day.date, estimates(stop.state, accumulated, day.date));
      if (prior.filing.value !== true && next.filing.value === true) filingTriggerDate ??= day.date;
      if (prior.withholding.value !== true && next.withholding.value === true) withholdingTriggerDate ??= day.date;
      prior = next;
    }
    return { stop, index, startISO, endISO, workDays: projections.reduce((n, d) => n + dayCount(d, stop.state, getReviewedRule(stop.state, d.date)?.dayDefinition), 0),
      wdBefore, outcome: prior, verdict: { label: prior.label, level: prior.level }, filingTriggerDate, withholdingTriggerDate,
      years: [...new Set(projections.map(d => d.date.slice(0, 4)))],
    };
  });
}
