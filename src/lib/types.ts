export type Mode = "past" | "future";

export type RiskLevel = "clear" | "caution" | "triggered";

/** A logged stay. `trip` stays are short overlays on top of a `ground` stay
 *  (for example, a work trip during a longer home stay) and win day attribution. */
export interface Stay {
  id: string;
  state: string;
  location: string;
  /** ISO date, inclusive */
  start: string;
  /** ISO date, inclusive */
  end: string;
  kind: "ground" | "trip";
  note?: string;
  booked?: boolean;
}

/** A future stop. Dates are derived by chaining from the route start. */
export interface PlannedStop {
  id: string;
  state: string;
  location: string;
  lengthDays: number;
}

export type ThemePref = "system" | "light" | "dark";

export interface Settings {
  salary: number;
  /** fraction of each legal day threshold treated as the personal ceiling */
  margin: number;
  residence: string;
  assignedWorkState: string;
  trackingStart: string;
  federalReturnRequired: "unknown" | "yes" | "no";
  nyExpectedDays?: number;
  ilMobileWorkerConfirmed: boolean;
  regularWagesOnly: boolean;
  /** ISO date the future route chains from */
  routeStart: string;
  theme: ThemePref;
}

/** Map geography only; tax rules and employer policy are separate. */
export interface StateInfo {
  name: string;
  row: number;
  col: number;
  country?: "US" | "CA";
}
