import { dayCount, jurisdiction, workSessions, type WorkDay } from "./model.ts";
import type { Period } from "../compliance/expression.ts";
export function periodBounds(period: Period, through: string, payPeriod?: { start: string; end: string }) {
  const year = through.slice(0, 4);
  if (period === "pay_period") return payPeriod;
  if (period === "quarter") {
    const firstMonth = Math.floor((Number(through.slice(5, 7)) - 1) / 3) * 3 + 1;
    return { start: `${year}-${String(firstMonth).padStart(2, "0")}-01`, end: through };
  }
  return { start: `${year}-01-01`, end: through };
}
export function aggregateActivity(days: WorkDay[], state: string, start: string, end: string, definition: "any" | "majority" = "any", includeProjected = false) {
  const selected = days.filter(d => d.date >= start && d.date <= end && (includeProjected || d.status !== "projected"));
  return {
    workdays: selected.reduce((n, d) => n + dayCount(d, state, definition), 0),
    hours: selected.reduce((n, d) => n + workSessions(d).filter(s => jurisdiction(s) === state).reduce((v, s) => v + s.hours, 0), 0),
    totalDistinctWorkdays: selected.filter(d => workSessions(d).length).length,
  };
}
