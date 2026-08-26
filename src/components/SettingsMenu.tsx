"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { fmtMoney, dailyRate } from "@/lib/engine";
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
                  inputMode="numeric"
                  value={salaryText ?? `$${settings.salary.toLocaleString("en-US")}`}
                  onChange={(e) => setSalaryText(e.target.value)}
                  onBlur={(e) => commitSalary(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && commitSalary(e.currentTarget.value)}
                />
                <span className={styles.inputHint}>
                  ≈ {fmtMoney(dailyRate(settings.salary))} / work day
                </span>
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Safety margin</span>
              <div className={styles.inputRow}>
                <input
                  className={styles.input}
                  inputMode="numeric"
                  value={marginText ?? `${Math.round(settings.margin * 100)}%`}
                  onChange={(e) => setMarginText(e.target.value)}
                  onBlur={(e) => commitMargin(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && commitMargin(e.currentTarget.value)}
                />
                <span className={styles.inputHint}>of each demo threshold</span>
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Residence state</span>
              <div className={styles.segRow}>
                {(["PA", "FL"] as const).map((code) => (
                  <button
                    key={code}
                    className={`${styles.segBtn} ${settings.residence === code ? styles.segBtnActive : ""}`}
                    onClick={() => updateSettings({ residence: code })}
                  >
                    {code === "PA" ? "Pennsylvania" : "Florida"}
                  </button>
                ))}
              </div>
              <span className={styles.hint}>Drives the 120-days-outside demo clock.</span>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Future route starts</span>
              <div className={styles.inputRow}>
                <input
                  className={styles.input}
                  type="date"
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
              Salary prices the fictional wage thresholds. This demo is not legal or tax advice.
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
