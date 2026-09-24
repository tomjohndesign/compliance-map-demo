"use client";
import { useEffect, useMemo, useState } from "react";
import { EMPLOYER_KEY, INITIAL_WORKSPACE, parseWorkspace, policyFromWorkspace, type EmployerWorkspace } from "./workspace";
export function useEmployer() {
  const [workspace, setWorkspace] = useState<EmployerWorkspace>(INITIAL_WORKSPACE);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem(EMPLOYER_KEY);
        setWorkspace(raw ? parseWorkspace(raw) : INITIAL_WORKSPACE);
        setError(null);
      } catch { setWorkspace({}); setError("Employer records could not be loaded. Approvals are unavailable until storage is restored."); }
      setReady(true);
    };
    load();
    window.addEventListener("storage", load);
    window.addEventListener("sl-employer-change", load);
    return () => { window.removeEventListener("storage", load); window.removeEventListener("sl-employer-change", load); };
  }, []);
  function save(next: EmployerWorkspace) {
    try {
      const raw = JSON.stringify(next);
      parseWorkspace(raw);
      localStorage.setItem(EMPLOYER_KEY, raw);
      setWorkspace(next);
      setError(null);
      window.dispatchEvent(new Event("sl-employer-change"));
      return true;
    } catch { setError("Could not save employer records. Changes were not saved; check browser storage."); return false; }
  }
  const employer = useMemo(() => policyFromWorkspace(workspace), [workspace]);
  return { workspace, employer, ready, error, save };
}
