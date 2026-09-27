"use client";

import { useRef, useState } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { STATES } from "@/lib/states";
import { useEmployer } from "@/lib/employer/useEmployer";
import { canActivate, type StatePlan } from "@/lib/employer/workspace";
import { FILING_FEES } from "@/lib/employer/filingFees";
import { DEFAULT_COSTS, EMPLOYER_CODES, REVIEWED_ON, SETUP_STEPS, SOURCES, STATE_REQUIREMENTS, estimateCosts, type CostInputs } from "@/lib/employer/stateRequirements";
import { getReviewedRule } from "@/lib/compliance/reviewed2026";
import { getRule2026 } from "@/lib/compliance/rules2026";
import { AppShell } from "./AppShell";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { StateTileGrid } from "./StateTileGrid";
import sidebar from "./sidebar.module.css";
import panel from "./panel.module.css";
import map from "./map.module.css";
import s from "./employer.module.css";

const money = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
const sortedCodes = [...EMPLOYER_CODES].sort((a, b) => STATES[a].name.localeCompare(STATES[b].name));
const statusLabel = (status?: string) => status === "supported" ? "Supported" : status === "planning" ? "In setup" : "Not added";
const statusColor = (status?: string) => status === "supported" ? "var(--clear)" : status === "planning" ? "var(--caution)" : "var(--faint)";

export function EmployerApp() {
  const { workspace, ready, error, save } = useEmployer();
  const detailRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("overview");
  const [message, setMessage] = useState("");
  const supported = EMPLOYER_CODES.filter(c => workspace[c]?.status === "supported");
  const planning = EMPLOYER_CODES.filter(c => workspace[c]?.status === "planning");
  const visible = sortedCodes.filter(c => `${STATES[c].name} ${c}`.toLowerCase().includes(query.toLowerCase()) && (filter === "all" || (filter === "available" ? !workspace[c] : workspace[c]?.status === filter)));
  const plan = selected ? workspace[selected] : undefined;

  function select(code: string) {
    setSelected(code);
    setMessage("");
    detailRef.current?.scrollTo(0, 0);
    if (window.matchMedia("(max-width: 1000px)").matches) {
      detailRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    }
  }
  function explore() {
    setFilter("available");
    setQuery("");
    searchRef.current?.focus();
  }
  function update(next: StatePlan, success: string) {
    if (selected && save({ ...workspace, [selected]: { ...next, updatedAt: new Date().toISOString() } })) setMessage(success);
  }

  const left = <aside className={sidebar.sidebar} aria-label="Employer states">
    <div className={sidebar.header}><div className={sidebar.titleBlock}>
      <span className={sidebar.title}>State Lines</span>
      <span className={sidebar.subtitle}>Work locations &amp; payroll planning</span>
    </div></div>
    <div className={sidebar.segmentWrap}>
      <WorkspaceSwitcher active="employer" />
      <div className={s.filters}>
        <input ref={searchRef} className={panel.textInput} aria-label="Search states" placeholder="Search states…" value={query} onChange={e => setQuery(e.target.value)} />
        <select className={panel.textInput} aria-label="Filter states" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All states · 50</option><option value="supported">Supported · {supported.length}</option><option value="planning">In setup · {planning.length}</option><option value="available">Not added · {50 - supported.length - planning.length}</option>
        </select>
      </div>
    </div>
    <div className={sidebar.list}>
      {visible.length === 0 && <p className={sidebar.emptyList}>No states match. Try another name or filter.</p>}
      {visible.map(code => <button key={code} className={`${sidebar.groupHeader} ${s.stateRow} ${selected === code ? sidebar.groupSelected : ""}`} aria-pressed={selected === code} onClick={() => select(code)}>
        <span className={sidebar.dot} style={{ background: statusColor(workspace[code]?.status) }} />
        <span className={sidebar.groupName}>{STATES[code].name}</span>
        <span className={s.listStatus}>{statusLabel(workspace[code]?.status)}</span>
      </button>)}
    </div>
    <div className={sidebar.footer}>
      <button className={sidebar.primaryBtn} onClick={explore}>Add a state</button>
      <span className={sidebar.footerNote}>{supported.length} supported · {planning.length} in setup</span>
    </div>
  </aside>;

  const right = <aside ref={detailRef} className={`${panel.panel} ${s.detail}`} aria-label={selected ? `${STATES[selected].name} details` : "Employer coverage"}>
    {error && <p role="alert" className={s.notice}>{error}</p>}
    {selected ? <>
      <div className={panel.headerRow}><h1 className={panel.panelTitle}>{STATES[selected].name}</h1><button className={panel.closeBtn} aria-label="Close state details" onClick={() => { setSelected(null); setMessage(""); }}>×</button></div>
      <p className={panel.meta}>Employer policy: <span style={{ color: statusColor(plan?.status) }}>{statusLabel(plan?.status)}</span></p>
      {!plan && <button disabled={!ready || !!error} className={panel.primaryBtn} onClick={() => { update({ status: "planning", checks: [], evidence: "", updatedAt: "", costs: { ...DEFAULT_COSTS } }, `${STATES[selected].name} added to setup.`); setTab("setup"); }}>Add {STATES[selected].name}</button>}
      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className={sidebar.tabsList} aria-label="State details">
          <Tabs.Indicator className={sidebar.tabIndicator} />
          <Tabs.Tab className={sidebar.tab} value="overview">Rules</Tabs.Tab>
          <Tabs.Tab className={sidebar.tab} value="costs">Costs</Tabs.Tab>
          <Tabs.Tab className={sidebar.tab} value="setup">Setup</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="overview" className={s.tabContent}><StateRules code={selected} /></Tabs.Panel>
        <Tabs.Panel value="costs" className={s.tabContent}><CostEditor key={`${selected}-${plan?.updatedAt ?? "new"}`} code={selected} initial={plan?.costs ?? DEFAULT_COSTS} onSave={costs => update(plan ? { ...plan, costs } : { status: "planning", checks: [], evidence: "", updatedAt: "", costs }, "Cost assumptions saved.")} disabled={!ready || !!error} /></Tabs.Panel>
        <Tabs.Panel value="setup" className={s.tabContent}><SetupEditor key={`${selected}-${plan?.updatedAt ?? "new"}`} plan={plan} disabled={!ready || !!error} onSave={next => update(next, next.status === "supported" ? `${STATES[selected].name} is now supported in employer policy.` : "Setup progress saved.")} /></Tabs.Panel>
      </Tabs.Root>
      <p role="status" className={s.message}>{message}</p>
      <p className={panel.footnote}>Adding a state starts a setup plan. Supporting it records approval and updates the employee map; no agency or payroll filings are submitted.</p>
    </> : <>
      <div className={panel.headerRow}><h1 className={panel.panelTitle}>Employer coverage</h1></div>
      <p className={panel.meta}>Example Remote Co. · Remote W-2 employees</p>
      <div className={panel.stackLg}>
        <div className={panel.kvRow}><span className={panel.kvKey}>Supported states</span><span className={panel.kvVal}>{supported.length}</span></div>
        <div className={panel.kvRow}><span className={panel.kvKey}>In setup</span><span className={panel.kvVal}>{planning.length}</span></div>
        <div className={panel.kvRow}><span className={panel.kvKey}>Not added</span><span className={panel.kvVal}>{50 - supported.length - planning.length}</span></div>
      </div>
      <div className={panel.divider} />
      <p className={panel.issueText}>Select a state on the map or in the list to review its rules, estimate setup and ongoing costs, and manage approval.</p>
      <span className={panel.sectionLabel}>Expanding to a new state</span>
      <div className={panel.stackLg}>
        <p className={panel.issueText}><b>Rules.</b> Registration, unemployment, wage and withholding references for the selected state.</p>
        <p className={panel.issueText}><b>Costs.</b> State filing benchmarks, payroll taxes and editable administrative overhead.</p>
        <p className={panel.issueText}><b>Setup.</b> Record reviews and approval before enabling employee work.</p>
      </div>
      <p className={panel.footnote}>The initial 13 supported states are fictional demo approvals, not verified registrations.</p>
    </>}
    <div className={panel.divider} />
    <EmployerTerms />
    <p className={panel.footnote}>Browser-local demo · References checked {REVIEWED_ON}</p>
  </aside>;

  return <AppShell left={left} right={right}>
    <main className={map.mapArea} aria-label="Employer state map">
      <StateTileGrid codes={EMPLOYER_CODES} renderTile={code => {
        const status = workspace[code]?.status;
        return <button className={`${map.tile} ${selected === code ? map.selected : ""}`} data-status={status ?? "available"} style={{ background: status === "supported" ? "var(--clear-soft)" : status === "planning" ? "var(--caution-soft)" : undefined }} aria-pressed={selected === code} aria-label={`${STATES[code].name}, ${statusLabel(status)}`} onClick={() => select(code)}>
          <span className={map.tileAbbrStrong} style={{ color: status === "supported" ? "var(--clear-deep)" : status === "planning" ? "var(--caution-deep)" : "var(--slate)" }}>{code}</span>
          <span className={map.tileBottomRow}><span /><span className={map.tileCount} style={{ color: statusColor(status) }}>{status === "supported" ? "✓" : status === "planning" ? "◷" : "+"}</span></span>
        </button>;
      }} />
      <div className={map.legend}>{["supported", "planning", "available"].map(status => <span key={status} className={map.legendItem}><span className={map.legendDot} style={{ background: statusColor(status) }} />{statusLabel(status)}</span>)}</div>
    </main>
  </AppShell>;
}

function EmployerTerms() {
  return <details className={s.method}><summary>About these estimates &amp; terms</summary><p>Scope: a general private business hiring regular W-2 employees in the 50 states. UI means state unemployment insurance; its taxable wage base is the annual per-employee wage cap. Foreign qualification means registering an entity formed in another state. Employer approval, legal registration, and payroll activation are separate decisions.</p><p>Setup assumes 12 administrative hours at $75/hour. Recurring administration assumes 2 hours/month at $75/hour. These are editable planning assumptions, identical across states, not surveyed prices or statutory fees. State-specific UI = employees × min(annual wages per employee, wage base) × rate. Every employee is assumed to have the same annual wages and UI to be localized to this state.</p><p>Known subtotals exclude unquoted costs. Foreign LLC base registration fees are included as a dated benchmark, with state-specific exclusions. The benchmark assumes the business was formed elsewhere; it does not decide whether foreign qualification is required. Override the total one-time fee for your entity, add publication, certificates or other charges, and use the annual quote for registered agent, payroll provider, insurance, paid leave/disability, assessments, annual filings and other state overhead. Employee income-tax withholding is not an employer tax expense. Wages, employer FICA/FUTA, benefits, corporate/franchise/sales taxes and industry licenses are excluded. A full quote needs entity type, home state, work locality, industry and headcount.</p><p>References retrieved {REVIEWED_ON}: UI base rates as of January 2026; wages as of July 2026, with noted exceptions. These are dated planning references, not a comprehensive 50-state legal clearance. Eight states have separately reviewed mobile-worker income-tax rules; the others remain unverified baselines. Confirm assigned rates and current state/local requirements before approval.</p></details>;
}

function StateRules({ code }: { code: string }) {
  const rule = STATE_REQUIREMENTS[code];
  const reviewed = getReviewedRule(code, REVIEWED_ON);
  const baseline = getRule2026(code);
  return <>
    <div className={s.referenceBanner}>2026 planning reference <span>Checked {REVIEWED_ON}</span></div>
    <article className={s.rule}><h3>00 <span>Business registration</span></h3><p className={s.wage}>{money(FILING_FEES[code].amount)} <span>foreign LLC filing benchmark</span></p><p>{FILING_FEES[code].note}</p><a href={FILING_FEES[code].url} target="_blank" rel="noreferrer">State filing fee source ↗</a>{code === "LA" && <p><a href="https://www.legis.la.gov/Legis/ViewDocument.aspx?d=1481829" target="_blank" rel="noreferrer">Act 921 · October 2026 change ↗</a></p>}</article>
    <article className={s.rule}><h3>01 <span>Unemployment insurance</span></h3><div className={s.ruleMetrics}><div><strong>{money(rule.uiWageBase)}</strong><span>annual taxable wage base</span></div><div><strong>{rule.uiRate === null ? "Industry rate" : `${rule.uiRate}%`}</strong><span>new-employer base rate</span></div></div><p>{rule.note}</p><a href={`${SOURCES.ui.url}#page=${rule.page}`} target="_blank" rel="noreferrer">DOL 2026 provisions · page {rule.page} ↗</a>{code === "AK" && <p><a href="https://dol.alaska.gov/estax/forms/2026_First_Time_Filers.pdf" target="_blank" rel="noreferrer">Alaska first-time filer adjustment ↗</a></p>}{code === "WI" && <p><a href="https://dwd.wisconsin.gov/ui/employers/taxrates.htm" target="_blank" rel="noreferrer">Wisconsin total rate schedule ↗</a></p>}</article>
    <article className={s.rule}><h3>02 <span>Wages &amp; employment standards</span></h3><p className={s.wage}>${rule.wageFloor.toFixed(2)} <span>/ hour reference</span></p><p>{rule.wageNote}</p><p>Check local rates, overtime eligibility, breaks, leave, payday and final-pay rules for the actual work location.</p><a href={SOURCES.wage.url} target="_blank" rel="noreferrer">DOL wage table · July 2026 ↗</a>{code === "FL" && <p><a href="https://floridajobs.org/florida-minimum-wage" target="_blank" rel="noreferrer">Florida September 2026 increase ↗</a></p>}</article>
    <article className={s.rule}><h3>03 <span>Mobile-worker withholding</span></h3><span className={s.tag}>{reviewed ? "Primary sources reviewed" : "Unverified baseline · review required"}</span><p>{reviewed?.withholdingSummary ?? baseline?.withholding.display}</p><p>{reviewed?.filingSummary ?? baseline?.filing.display}</p>{reviewed ? reviewed.sources.map(source => <p key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.agency} · {source.title} ↗</a></p>) : <p>Existing research only; do not use this threshold to approve work. Confirm residency, assigned-office sourcing, reciprocity and local taxes.</p>}</article>
    <article className={s.rule}><h3>04 <span>Before your first hire</span></h3>{SETUP_STEPS.map(step => <p key={step.id}><b>{step.title}.</b> {step.detail} <a href={SOURCES[step.source].url} target="_blank" rel="noreferrer">Source ↗</a></p>)}<a href={SOURCES.leave.url} target="_blank" rel="noreferrer">State paid-leave program directory ↗</a></article>
  </>;
}

function CostEditor({ code, initial, onSave, disabled }: { code: string; initial: CostInputs; onSave: (v: CostInputs) => void; disabled: boolean }) {
  const [input, setInput] = useState(initial);
  const estimate = estimateCosts(STATE_REQUIREMENTS[code], input);
  const fields: { key: keyof CostInputs; label: string; max: number; step?: string; optional?: boolean }[] = [
    { key: "employees", label: "Employees in this state", max: 100000 }, { key: "salary", label: "Annual wages / employee ($)", max: 10000000, step: "0.01" },
    { key: "hourlyRate", label: "Admin cost / hour ($)", max: 10000, step: "0.01" }, { key: "setupHours", label: "One-time setup hours", max: 10000, step: "0.5" },
    { key: "monthlyHours", label: "Admin hours / month", max: 10000, step: "0.5" }, { key: "assignedUiRate", label: "Assigned UI rate (%)", max: 100, step: "0.001", optional: true },
    { key: "filingFees", label: "Total one-time fees override ($)", max: 10000000, step: "0.01", optional: true }, { key: "annualOther", label: "Other annual overhead quote ($)", max: 10000000, step: "0.01", optional: true },
  ];
  return <form onSubmit={e => { e.preventDefault(); onSave(input); }}>
    <div className={s.costSummary}><div><span>Setup subtotal</span><strong>{money(estimate.setup)}</strong><small>one time</small></div><div><span>Annual subtotal</span><strong>{money(estimate.annual)}</strong><small>{money(estimate.annual / 12)} / month equivalent</small></div></div>
    <p className={s.notice}>{estimate.incomplete ? "Partial estimate · unquoted items are excluded, not free." : "Scenario estimate · based on your inputs, not a binding quote."}</p>
    <div className={s.costRows}><p><span>Setup administration</span><b>{money(estimate.setupLabor)}</b></p><p><span>Recurring administration / year</span><b>{money(estimate.annualLabor)}</b></p><p><span>Base unemployment tax / year</span><b>{estimate.ui === null ? "Rate needed" : money(estimate.ui)}</b></p><p><span>{input.filingFees === null ? "Foreign LLC base filing benchmark" : "One-time fees override"}</span><b>{money(estimate.filing)}</b></p><p><span>Other annual overhead</span><b>{input.annualOther === null ? "Not quoted" : money(input.annualOther)}</b></p></div>
    <p className={s.muted}>UI uses {input.employees} × min({money(input.salary)}, {money(STATE_REQUIREMENTS[code].uiWageBase)}) × {estimate.rate ?? "assigned"}%. Base rates exclude additional assessments. Monthly cost is an annual budget average, not a payment schedule.</p>
    <p className={s.muted}><a href={FILING_FEES[code].url} target="_blank" rel="noreferrer">State filing reference ↗</a> · {FILING_FEES[code].note}</p><h3 className={s.formTitle}>Adjust your assumptions</h3><div className={s.inputs}>{fields.map(f => <label key={f.key}>{f.label}<input className={s.costInput} type="number" min={f.key === "employees" ? 1 : 0} max={f.max} step={f.step ?? "1"} required={!f.optional} value={input[f.key] ?? ""} placeholder={f.key === "assignedUiRate" ? "Use published base" : f.key === "filingFees" ? `Base fee: ${money(FILING_FEES[code].amount)}` : "Not quoted"} onChange={e => { const raw = e.target.value; const value = raw === "" && f.optional ? null : Number(raw); if (value === null || (Number.isFinite(value) && value >= (f.key === "employees" ? 1 : 0) && value <= f.max && (f.key !== "employees" || Number.isInteger(value)))) setInput({ ...input, [f.key]: value }); }} /></label>)}</div>
    <p className={s.muted}>Other overhead: insurance, paid leave/disability, payroll provider, registered agent, annual filings and UI surcharges. Base salary, federal payroll taxes and business taxes are excluded.</p><button className={s.primary} disabled={disabled} type="submit">Save cost assumptions</button>
  </form>;
}
function SetupEditor({ plan, disabled, onSave }: { plan?: StatePlan; disabled: boolean; onSave: (p: StatePlan) => void }) {
  const [draft, setDraft] = useState<StatePlan>(plan ?? { status: "planning", checks: [], evidence: "", updatedAt: "", costs: { ...DEFAULT_COSTS } });
  return <div><p className={s.muted}>Record completed reviews or documented exemptions. Complete all four and add an approval reference to enable employee work.</p>{SETUP_STEPS.map(step => <label className={s.check} key={step.id}><input type="checkbox" checked={draft.checks.includes(step.id)} onChange={e => setDraft({ ...draft, checks: e.target.checked ? [...draft.checks, step.id] : draft.checks.filter(c => c !== step.id) })} /><span><b>{step.title}</b><small>{step.detail}</small></span></label>)}<label className={s.evidence}>Approval / evidence reference<textarea value={draft.evidence} onChange={e => setDraft({ ...draft, evidence: e.target.value })} placeholder="Reviewer, date, registration or exemption references…" minLength={10} /></label><p className={s.muted}>Record references only; do not enter tax IDs or other sensitive information. This is a local planning record.</p><div className={s.actions}><button className={s.secondary} disabled={disabled} onClick={() => onSave({ ...draft, status: "planning" })}>{plan?.status === "supported" ? "Move back to setup" : "Save setup progress"}</button><button className={s.primary} disabled={disabled || !canActivate(draft)} onClick={() => onSave({ ...draft, status: "supported" })}>Mark state supported</button></div>{plan && <p className={s.muted}>Last saved {plan.updatedAt.slice(0, 10)}. {plan.evidence}</p>}</div>;
}
