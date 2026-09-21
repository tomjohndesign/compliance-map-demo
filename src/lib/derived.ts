"use client";

import { useMemo } from "react";
import {
  computeClocks,
  dailyRate,
  pastAggregates,
  pastOutcome,
  pastRouteStates,
  scheduleRoute,
  type Clocks,
  type Outcome,
  type ScheduledStop,
  type StateAgg,
} from "./engine";
import { useApp } from "./store";

export interface Derived {
  rate: number;
  /** per-state aggregates through today, in order of first visit */
  past: StateAgg[];
  /** chronological state visits, collapsing only consecutive same-state stays */
  pastRoute: string[];
  pastByState: Map<string, StateAgg>;
  outcomes: Map<string, Outcome>;
  scheduled: ScheduledStop[];
  clocks: Clocks;
  routeAlerts: number;
}

export function useDerived(): Derived {
  const { stays, planned, settings, today } = useApp();
  return useMemo(() => {
    const rate = dailyRate(settings.salary);
    const past = pastAggregates(stays, today);
    const pastRoute = pastRouteStates(stays, today);
    const pastByState = new Map(past.map((a) => [a.state, a]));
    const outcomes = new Map(
      past.map((a) => [a.state, pastOutcome(a.state, a.workDays, rate)])
    );
    const pastWd = new Map(past.map((a) => [a.state, a.workDays]));
    const scheduled = scheduleRoute(planned, settings.routeStart, pastWd, rate, settings.margin);
    const clocks = computeClocks(stays, scheduled, settings, today);
    const routeAlerts = scheduled.filter((s) => s.verdict.level === "triggered").length;
    return { rate, past, pastRoute, pastByState, outcomes, scheduled, clocks, routeAlerts };
  }, [stays, planned, settings, today]);
}
