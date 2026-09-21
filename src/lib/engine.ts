import type { Stay } from "./types";
import { parseISO, toISO, addDays, isWeekday } from "./dates.ts";
export * from "./dates.ts";

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


/** State visits in travel order, including returns after an intervening trip. */
export function pastRouteStates(stays: Stay[], cutoffISO: string): string[] {
  const byDay = attributeDays(stays);
  const route: string[] = [];
  for (const day of [...byDay.keys()].sort()) {
    if (day > cutoffISO) break;
    const state = byDay.get(day)!.state;
    if (route[route.length - 1] !== state) route.push(state);
  }
  return route;
}

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
