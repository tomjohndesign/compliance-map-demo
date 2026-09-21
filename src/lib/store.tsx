"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_SETTINGS, seedForDate } from "./seed";
import { todayISO } from "./engine";
import type { Mode, PlannedStop, Settings, Stay, ThemePref } from "./types";

import { EMPTY_LEDGER, reviseDay, type LedgerState, type WorkDay } from "./ledger/model";
import { readSavedWork, type PeriodRevision } from "./persistence";
import type { PayPeriod } from "./reporting/payroll";

const WORK_KEY = "sl-work-ledger-v1";
const PLANNED_KEY = "sl-planned-itinerary-2026-09-21";
const SETTINGS_KEY = "sl-settings-itinerary-2026-09-21";
const THEME_KEY = "sl-theme";

interface AppState {
  today: string;
  stays: Stay[];
  planned: PlannedStop[];
  settings: Settings;
  mode: Mode;
  selected: string | null;
  pastView: "map" | "report" | "ledger";
  ledger: LedgerState;
  payPeriods: PayPeriod[];
  periodRevisions: PeriodRevision[];
  payrollActive: string[];
  storageError: string | null;
  saveDay: (day: WorkDay, reason: string, previous?: WorkDay) => void;
  savePeriod: (period: PayPeriod) => void;
  setPayrollActive: (key: string, active: boolean) => void;
  addHint: boolean;

  setMode: (m: Mode) => void;
  select: (code: string | null) => void;
  setPastView: (v: "map" | "report" | "ledger") => void;
  setAddHint: (v: boolean) => void;
  addStop: (stop: Omit<PlannedStop, "id">) => void;
  updateStop: (id: string, patch: Partial<PlannedStop>) => void;
  removeStop: (id: string) => void;
  moveStop: (id: string, dir: -1 | 1) => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

const AppContext = createContext<AppState | null>(null);

function applyTheme(theme: ThemePref) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [today] = useState(todayISO);
  const [seed] = useState(() => seedForDate(today));
  const [stays] = useState<Stay[]>(seed.stays);
  const [planned, setPlanned] = useState<PlannedStop[]>(seed.planned);
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS, routeStart: seed.routeStart });
  const [mode, setModeState] = useState<Mode>("past");
  const [selected, setSelected] = useState<string | null>(null);
  const [pastView, setPastView] = useState<"map" | "report" | "ledger">("map");
  const [addHint, setAddHint] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [ledger, setLedger] = useState<LedgerState>(EMPTY_LEDGER);
  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([]);
  const [periodRevisions, setPeriodRevisions] = useState<PeriodRevision[]>([]);
  const [payrollActive, setActive] = useState<string[]>([]);
  const [storageError, setStorageError] = useState<string | null>(null);

  // Load persisted state after mount — localStorage is client-only, so this
  // must happen post-hydration (the server render uses defaults).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const work = localStorage.getItem(WORK_KEY);
      if (work) {
        const parsed = readSavedWork(work);
        setPeriodRevisions(parsed.periodRevisions);
        setLedger(parsed.ledger);
        setPayPeriods(parsed.payPeriods);
        setActive(parsed.payrollActive);
      }
      const p = localStorage.getItem(PLANNED_KEY);
      if (p) setPlanned(JSON.parse(p));
      const s = localStorage.getItem(SETTINGS_KEY);
      // Retain existing preferences, but replace the old sample route's start date.
      const legacy = JSON.parse(localStorage.getItem("sl-settings") || "{}");
      const preferences = s ? JSON.parse(s) : {
        salary: legacy.salary ?? DEFAULT_SETTINGS.salary,
        margin: legacy.margin ?? DEFAULT_SETTINGS.margin,
        residence: legacy.residence ?? DEFAULT_SETTINGS.residence,
      };
      const theme = (localStorage.getItem(THEME_KEY) as ThemePref) || "system";
      setSettings((prev) => ({ ...prev, ...preferences, theme }));
    } catch {
      setStorageError("Saved data could not be loaded. Export or recover browser storage before saving new records.");
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated || storageError) return;
    try { localStorage.setItem(WORK_KEY, JSON.stringify({ ledger, payPeriods, payrollActive, periodRevisions })); }
    // Storage failures must be surfaced to the user instead of silently dropping work.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    catch { setStorageError("Browser storage is full or unavailable. Export your report before closing this tab."); }
  }, [ledger, payPeriods, payrollActive, periodRevisions, hydrated, storageError]);

  useEffect(() => {
    if (!hydrated || storageError) return;
    try { localStorage.setItem(PLANNED_KEY, JSON.stringify(planned)); }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    catch { setStorageError("Route changes could not be saved to browser storage."); }
  }, [planned, hydrated, storageError]);

  useEffect(() => {
    if (!hydrated || storageError) return;
    const { theme, ...rest } = settings;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(rest));
      localStorage.setItem(THEME_KEY, theme);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    } catch { setStorageError("Settings could not be saved to browser storage."); }
    applyTheme(theme);
  }, [settings, hydrated, storageError]);

  // Follow OS appearance changes while in system mode.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (settings.theme === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [settings.theme]);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    setSelected(null);
    setPastView("map");
    setAddHint(false);
  }, []);

  const select = useCallback((code: string | null) => {
    setSelected(code);
    if (code) setPastView("map");
    setAddHint(false);
  }, []);

  const addStop = useCallback((stop: Omit<PlannedStop, "id">) => {
    setPlanned((prev) => [...prev, { ...stop, id: `stop-${Date.now()}` }]);
  }, []);

  const updateStop = useCallback((id: string, patch: Partial<PlannedStop>) => {
    setPlanned((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const removeStop = useCallback((id: string) => {
    setPlanned((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const moveStop = useCallback((id: string, dir: -1 | 1) => {
    setPlanned((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i === -1 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const saveDay = useCallback((day: WorkDay, reason: string, previous?: WorkDay) => {
    const now = new Date().toISOString();
    setLedger(current => reviseDay(current, day, reason, now, previous));
  }, []);
  const savePeriod = useCallback((period: PayPeriod) => {
    const before = payPeriods.find(p => p.id === period.id);
    setPeriodRevisions(current => [...current, { before, after: period, changedAt: new Date().toISOString() }]);
    setPayPeriods(current => [...current.filter(p => p.id !== period.id), period].sort((a, b) => a.start.localeCompare(b.start)));
  }, [payPeriods]);
  const setPayrollActive = useCallback((key: string, active: boolean) => {
    setActive(current => active ? [...new Set([...current, key])] : current.filter(k => k !== key));
  }, []);

  const value = useMemo<AppState>(
    () => ({
      today,
      ledger, payPeriods, periodRevisions, payrollActive, storageError, saveDay, savePeriod, setPayrollActive,
      stays,
      planned,
      settings,
      mode,
      selected,
      pastView,
      addHint,
      setMode,
      select,
      setPastView,
      setAddHint,
      addStop,
      updateStop,
      removeStop,
      moveStop,
      updateSettings,
    }),
    [today, ledger, payPeriods, periodRevisions, payrollActive, storageError, saveDay, savePeriod, setPayrollActive, stays, planned, settings, mode, selected, pastView, addHint, setMode, select, addStop, updateStop, removeStop, moveStop, updateSettings]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
