"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { fmtMoney } from "@/lib/engine";
import { STATES } from "@/lib/states";
import { useApp } from "@/lib/store";
import type { ThemePref } from "@/lib/types";
import sidebarStyles from "./sidebar.module.css";
import styles from "./settings.module.css";

export function SettingsMenu() {
  const { settings, updateSettings } = useApp();
  const [salaryText, setSalaryText] = useState<string | null>(null);
  const [marginText, setMarginText] = useState<string | null>(null);

  const commitSalary = (text: string) => {
    const v = parseInt(text.replace(/[^0-9]/g, ""), 10);
    if (!Number.isNaN(v) && v >= 10_000) updateSettings({ salary: v });
    setSalaryText(null);
  };
  const commitMargin = (text: string) => {
    const v = parseInt(text.replace(/[^0-9]/g, ""), 10);
    if (!Number.isNaN(v) && v >= 50 && v <= 100) updateSettings({ margin: v / 100 });
    setMarginText(null);
  };

  return (
    <Popover.Root>
      <Popover.Trigger className={sidebarStyles.gearBtn} aria-label="Settings">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="6" cy="4" r="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="11" cy="8" r="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="5" cy="12" r="2" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8}>
          <Popover.Popup className={styles.popup}>
            <Popover.Title className={styles.title}>Settings</Popover.Title>

            <div className={styles.field}>
              <span className={styles.label}>Annual salary</span>
              <div className={styles.inputRow}>
                <input
                  className={styles.input}
                  aria-label="Annual salary"
                  inputMode="numeric"
                  value={salaryText ?? `$${settings.salary.toLocaleString("en-US")}`}
                  onChange={(e) => setSalaryText(e.target.value)}
                  onBlur={(e) => commitSalary(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && commitSalary(e.currentTarget.value)}
                />
                <span className={styles.inputHint}>
                  ≈ {fmtMoney((settings.salary / 260))} / work day
                </span>
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Safety margin</span>
              <div className={styles.inputRow}>
                <input
                  className={styles.input}
                  aria-label="Safety margin"
                  inputMode="numeric"
                  value={marginText ?? `${Math.round(settings.margin * 100)}%`}
                  onChange={(e) => setMarginText(e.target.value)}
                  onBlur={(e) => commitMargin(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && commitMargin(e.currentTarget.value)}
                />
                <span className={styles.inputHint}>planning margin, not law</span>
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Residence state</span>
              <select aria-label="Residence state" className={styles.input} value={settings.residence} onChange={e => updateSettings({ residence: e.target.value })}>
                {Object.entries(STATES).filter(([, s]) => s.country !== "CA").map(([code, s]) => <option key={code} value={code}>{s.name}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="assigned-state">Employer-assigned work state</label>
              <select id="assigned-state" className={styles.input} value={settings.assignedWorkState} onChange={e => updateSettings({ assignedWorkState: e.target.value })}>
                {Object.entries(STATES).filter(([, s]) => s.country !== "CA").map(([code, s]) => <option key={code} value={code}>{s.name}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="tracking-start">Employment / tracking starts</label>
              <input id="tracking-start" className={styles.input} type="date" value={settings.trackingStart} onChange={e => e.target.value && updateSettings({ trackingStart: e.target.value })} />
              <span className={styles.hint}>Use employment start, not first trip. Earlier work must be recorded for annual thresholds.</span>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="federal-return">Required to file a federal return?</label>
              <select id="federal-return" className={styles.input} value={settings.federalReturnRequired} onChange={e => updateSettings({ federalReturnRequired: e.target.value as "yes" | "no" | "unknown" })}>
                <option value="unknown">Not confirmed</option><option value="yes">Yes</option><option value="no">No</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="ny-days">Employer-expected NY workdays in 2026</label>
              <input id="ny-days" className={styles.input} type="number" min="0" max="366" value={settings.nyExpectedDays ?? ""} placeholder="Not confirmed" onChange={e => updateSettings({ nyExpectedDays: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) })} />
            </div>
            <label className={styles.hint}><input type="checkbox" checked={settings.ilMobileWorkerConfirmed} onChange={e => updateSettings({ ilMobileWorkerConfirmed: e.target.checked })} /> Employer confirmed Illinois mobile-worker eligibility (nonlocalized compensation and nonincidental services).</label>
            <label className={styles.hint}><input type="checkbox" checked={settings.regularWagesOnly} onChange={e => updateSettings({ regularWagesOnly: e.target.checked })} /> Regular W-2 wages only; no special compensation or occupational exceptions.</label>

            <div className={styles.field}>
              <span className={styles.label}>Future route starts</span>
              <div className={styles.inputRow}>
                <input
                  className={styles.input}
                  type="date"
                  aria-label="Future route starts"
                  value={settings.routeStart}
                  onChange={(e) => e.target.value && updateSettings({ routeStart: e.target.value })}
                />
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Appearance</span>
              <div className={styles.segRow}>
                {(["system", "light", "dark"] as ThemePref[]).map((t) => (
                  <button
                    key={t}
                    className={`${styles.segBtn} ${settings.theme === t ? styles.segBtnActive : ""}`}
                    onClick={() => updateSettings({ theme: t })}
                  >
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.footer}>
              Salary is used only for forecast estimates. Payroll reports use entered gross wages. Changes here do not update payroll.
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
