import type { Settings, Stay } from "./types";

/** Fictional sample itinerary. Trip overlays win day attribution. */
export const SEED_STAYS: Stay[] = [
  {
    id: "pa-home",
    state: "PA",
    location: "Philadelphia",
    start: "2026-01-01",
    end: "2026-12-31",
    kind: "ground",
    note: "Fictional home base",
  },
  { id: "ny-sample", state: "NY", location: "New York", start: "2026-03-02", end: "2026-03-13", kind: "trip", note: "Sample work trip" },
  { id: "va-sample", state: "VA", location: "Richmond", start: "2026-05-04", end: "2026-05-22", kind: "trip", note: "Sample work trip" },
  { id: "il-sample", state: "IL", location: "Chicago", start: "2026-06-08", end: "2026-06-26", kind: "trip", note: "Sample work trip" },
  { id: "co-sample", state: "CO", location: "Denver", start: "2026-07-06", end: "2026-07-31", kind: "trip", note: "Sample work trip" },
  { id: "ca-sample", state: "CA", location: "San Diego", start: "2026-08-03", end: "2026-08-14", kind: "trip", note: "Sample work trip" },
];

export const DEFAULT_SETTINGS: Settings = {
  salary: 120_000,
  margin: 0.75,
  residence: "PA",
  routeStart: "2026-09-01",
  theme: "system",
};
