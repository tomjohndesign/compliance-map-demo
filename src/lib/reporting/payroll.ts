import { coverageIssues, datesBetween, dayCount, jurisdiction, validDate, workSessions, type WorkDay } from "../ledger/model.ts";
import { getReviewedRule } from "../compliance/reviewed2026.ts";
import { getEmployerPolicyStatus } from "../employer/demoEmployer.ts";

export interface PayPeriod {
  id: string;
  start: string;
  end: string;
  grossWages?: number;
  source: "employee_entered" | "payroll_actual";
}
export interface Allocation {
  state: string;
  workdays: number;
  hours: number;
  numerator: number;
  denominator: number;
  wages?: number;
  method: string;
  ruleVersion?: string;
}
export interface PayrollAllocation {
  period: PayPeriod;
  rows: Allocation[];
  totalHours: number;
  totalWorkdays: number;
  allocatedWages?: number;
  issues: string[];
  reconciled: boolean;
}
export function validatePeriod(period: PayPeriod): string[] {
  const issues: string[] = [];
  if (!validDate(period.start) || !validDate(period.end) || period.start > period.end) issues.push("Enter a valid pay-period date range.");
  if (period.start.slice(0, 4) !== period.end.slice(0, 4)) issues.push("Split pay periods at the tax-year boundary before allocating.");
  if (period.grossWages === undefined) issues.push("Gross regular wages are missing.");
  else if (!Number.isFinite(period.grossWages) || period.grossWages < 0) issues.push("Gross regular wages must be a nonnegative number.");
  return issues;
}
export function allocatePayPeriod(days: WorkDay[], period: PayPeriod): PayrollAllocation {
  const selected = days.filter(d => d.date >= period.start && d.date <= period.end);
  const coverage = coverageIssues(selected, period.start, period.end);
  const issues = [...validatePeriod(period), ...coverage];
  const byState = new Map<string, { hours: number; workdays: number; units: number }>();
  let totalHours = 0, totalWorkdays = 0, unresolvedSplit = false;
  for (const day of selected) {
    const sessions = workSessions(day);
    const states = [...new Set(sessions.map(jurisdiction))];
    if (!states.length) continue;
    totalWorkdays++;
    const hours = sessions.reduce((n, s) => n + s.hours, 0);
    totalHours += hours;
    // One allocation unit per day. Only the reviewed CO-majority split is automated.
    const owner = states.length === 1 ? states[0] : dayCount(day, "CO", "majority") ? "CO" : undefined;
    if (!owner) unresolvedSplit = true;
    for (const state of states) {
      const row = byState.get(state) ?? { hours: 0, workdays: 0, units: 0 };
      row.hours += sessions.filter(s => jurisdiction(s) === state).reduce((n, s) => n + s.hours, 0);
      row.workdays += dayCount(day, state, getReviewedRule(state, day.date)?.dayDefinition);
      if (owner === state) row.units++;
      byState.set(state, row);
    }
  }
  if (!totalWorkdays) issues.push("No worked days exist in this period; wages cannot be allocated.");
  if (unresolvedSplit) issues.push("Split-state days require a reviewed allocation method; wages are withheld from this draft.");
  const canAllocate = !validatePeriod(period).length && !coverage.length && totalWorkdays > 0 && !unresolvedSplit;
  const cents = canAllocate ? Math.round(period.grossWages! * 100) : 0;
  const parts = [...byState].sort(([a], [b]) => a.localeCompare(b)).map(([state, value]) => ({ state, ...value,
    cents: canAllocate ? Math.floor(cents * value.units / totalWorkdays) : 0,
    remainder: canAllocate ? cents * value.units / totalWorkdays % 1 : 0,
  }));
  // Largest remainder allocation preserves every cent deterministically.
  if (canAllocate) {
    const order = [...parts].sort((a, b) => b.remainder - a.remainder || a.state.localeCompare(b.state));
    const left = cents - parts.reduce((n, row) => n + row.cents, 0);
    for (let i = 0; i < left; i++) order[i % order.length].cents++;
  }
  const rows = parts.map(row => {
    const rule = getReviewedRule(row.state, period.end);
    if (getEmployerPolicyStatus(row.state) !== "allowed") issues.push(`${row.state}: work is not permitted by employer policy.`);
    if (!rule) issues.push(`${row.state}: no reviewed rule for this period.`);
    if (rule?.allocation === "annual_workdays") issues.push(`${row.state}: provisional period allocation; annual reconciliation required.`);
    if (rule?.localReview) issues.push(`${row.state}: local tax review required.`);
    return { state: row.state, hours: row.hours, workdays: row.workdays, numerator: row.units,
      denominator: totalWorkdays, wages: canAllocate ? row.cents / 100 : undefined,
      method: rule?.allocation === "none" ? "Work-location record (no state wage tax)" : rule?.allocationSummary ?? "Unreviewed workday allocation",
      ruleVersion: rule?.version };
  });
  return { period, rows, totalHours, totalWorkdays, allocatedWages: canAllocate ? cents / 100 : undefined,
    reconciled: canAllocate && rows.reduce((n, r) => n + Math.round(r.wages! * 100), 0) === cents,
    issues: [...new Set(issues)] };
}
/** Actual wage metrics are only available where complete, attested periods cover all work. */
export function wagesThrough(days: WorkDay[], periods: PayPeriod[], code: string, start: string, end: string): number | undefined {
  const selected = periods.filter(p => p.start >= start && p.end <= end);
  const seen = new Set<string>();
  let total = 0;
  for (const period of selected) {
    for (const date of datesBetween(period.start, period.end)) {
      if (seen.has(date)) return undefined;
      seen.add(date);
    }
    const result = allocatePayPeriod(days, period);
    if (!result.reconciled || coverageIssues(days, period.start, period.end).length) return undefined;
    const row = result.rows.find(r => r.state === code);
    total += row?.wages ?? 0;
  }
  for (const date of datesBetween(start, end)) {
    const day = days.find(d => d.date === date);
    if (day && workSessions(day).length && !seen.has(date)) return undefined;
  }
  return selected.length ? total : undefined;
}
