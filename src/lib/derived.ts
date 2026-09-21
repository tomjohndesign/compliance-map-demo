"use client";
import { useMemo } from "react";
import { currentRun, pastRouteStates } from "./engine";
import { useApp } from "./store";
import { STATES } from "./states";
import { coverageIssues, dayCount, jurisdiction, mergeLedger, projectStays } from "./ledger/model";
import { evaluateState } from "./compliance/evaluate";
import { forecastRoute } from "./compliance/forecast";
import { wagesThrough } from "./reporting/payroll";

export function useDerived() {
  const { stays, planned, settings, today, ledger, payPeriods, payrollActive } = useApp();
  return useMemo(() => {
    const days = mergeLedger(projectStays(stays, today), ledger);
    const yearStart = `${today.slice(0, 4)}-01-01`;
    const current = days.filter(d => d.date >= yearStart && d.date <= today);
    const codes = [...new Set(current.flatMap(d => d.sessions.map(s => s.state)))];
    const annualTotalWages = today === `${today.slice(0, 4)}-12-31` && payPeriods.length > 0 && !coverageIssues(days, yearStart, today).length && wagesThrough(days, payPeriods, "TN", yearStart, today) !== undefined
      ? payPeriods.filter(p => p.start >= yearStart && p.end <= today).reduce((n, p) => n + (p.grossWages ?? 0), 0)
      : undefined;
    const outcomes = new Map(Object.keys(STATES).map(code => {
      const id = STATES[code].country === "CA" ? `CA-${code}` : code;
      return [code, evaluateState(id, days, settings, today, { stateWages: wagesThrough(days, payPeriods, id, yearStart, today), annualTotalWages, payrollActive: payrollActive.includes(`${today.slice(0, 4)}:${id}`) })];
    }));
    const past = codes.filter(code => STATES[code]).map(state => {
      const matching = current.filter(d => d.sessions.some(s => s.state === state));
      const recorded = matching.filter(d => d.status !== "projected");
      return { state, firstDay: matching[0].date, lastDay: matching.at(-1)!.date, workDays: recorded.reduce((n, d) => n + dayCount(d, STATES[state].country === "CA" ? `CA-${state}` : state), 0),
        projectedDays: outcomes.get(state)!.projectedDays, calDays: matching.length,
        stays: stays.filter(s => s.state === state && s.start <= today && s.end >= yearStart).map(stay => ({ stay, from: stay.start < yearStart ? yearStart : stay.start, to: stay.end > today ? today : stay.end })),
      };
    }).sort((a, b) => a.firstDay.localeCompare(b.firstDay));
    const scheduled = forecastRoute(planned, days, settings, payrollActive);
    const routeAlerts = scheduled.filter(s => s.outcome.status !== "clear" && s.outcome.status !== "active").length;
    const workedStates = new Set(current.filter(d => d.status !== "projected").flatMap(d => d.sessions.filter(s => s.activity === "work").map(jurisdiction)));
    return { days, past, pastRoute: pastRouteStates(stays, today), pastByState: new Map(past.map(a => [a.state, a])), outcomes, scheduled, clocks: { run: currentRun(stays, today) }, routeAlerts, workedStates };
  }, [stays, planned, settings, today, ledger, payPeriods, payrollActive]);
}
