import assert from "node:assert/strict";
import test from "node:test";
import { condition, evaluateExpression } from "../src/lib/compliance/expression.ts";
import { evaluateState } from "../src/lib/compliance/evaluate.ts";
import { getReviewedRule, REVIEWED_RULES } from "../src/lib/compliance/reviewed2026.ts";
import { forecastRoute } from "../src/lib/compliance/forecast.ts";
import { allocatePayPeriod, wagesThrough } from "../src/lib/reporting/payroll.ts";
import { csvCell } from "../src/lib/reporting/export.ts";
import { coverageIssues, datesBetween, dayCount, EMPTY_LEDGER, mergeLedger, projectStays, reviseDay, validateDay } from "../src/lib/ledger/model.ts";

const settings = { salary: 180000, margin: .8, residence: "TN", assignedWorkState: "TN", trackingStart: "2026-01-01", federalReturnRequired: "yes", ilMobileWorkerConfirmed: true, regularWagesOnly: true, nyExpectedDays: 14, routeStart: "2026-10-05", theme: "light" };
const session = (state, hours = 8, activity = "work") => ({ id: `${state}-${activity}`, country: "US", state, municipality: "Test city", hours, activity });
const day = (date, state = "IL", status = "attested") => ({ date, status, sessions: [session(state)] });
const range = (start, end, state = "IL") => datesBetween(start, end).map(date => day(date, state));
const evaluate = (code, days, through, extra = {}, opts = {}) => evaluateState(code, days, { ...settings, trackingStart: days[0]?.date ?? through, ...extra }, through, opts);

test("AND/OR use three-valued logic; strict and inclusive comparisons differ", () => {
  const d = condition("workdays", 30), w = condition("state_wages", 3000);
  assert.equal(evaluateExpression(d, { "calendar_year:workdays": 30 }).value, false);
  assert.equal(evaluateExpression(d, { "calendar_year:workdays": 31 }).value, true);
  assert.equal(evaluateExpression(condition("workdays", 30, "gte"), { "calendar_year:workdays": 30 }).value, true);
  for (const [type, facts, expected] of [
    ["and", { "calendar_year:workdays": 30 }, false], ["and", { "calendar_year:workdays": 31 }, "unknown"],
    ["or", { "calendar_year:workdays": 31 }, true], ["or", { "calendar_year:workdays": 30 }, "unknown"],
  ]) assert.equal(evaluateExpression({ type, children: [d, w] }, facts).value, expected);
  assert.equal(evaluateExpression(w, { "calendar_year:state_wages": NaN }).value, "unknown");
});

test("quarterly rules do not consume annual wages", () => {
  const expression = condition("state_wages", 300, "gt", "quarter");
  assert.equal(evaluateExpression(expression, { "calendar_year:state_wages": 600 }).value, "unknown");
  assert.equal(evaluateExpression(expression, { "quarter:state_wages": 250 }).value, false);
  assert.equal(evaluateExpression(expression, { "quarter:state_wages": 350 }).value, true);
});

test("Maine-style compound conditions require both legs", () => {
  const expression = { type: "and", children: [condition("workdays", 12), condition("state_wages", 3000)] };
  for (const [d, w, expected] of [[13, 2000, false], [10, 4000, false], [13, 4000, true]])
    assert.equal(evaluateExpression(expression, { "calendar_year:workdays": d, "calendar_year:state_wages": w }).value, expected);
});

test("overlaid stays remain projected; reported non-work replaces the projection", () => {
  const projected = projectStays([
    { id: "ground", state: "TN", location: "Nashville", start: "2026-10-05", end: "2026-10-11", kind: "ground" },
    { id: "trip", state: "CO", location: "Denver", start: "2026-10-06", end: "2026-10-07", kind: "trip" },
  ], "2026-10-11");
  assert.equal(projected[1].sessions[0].state, "CO");
  assert.equal(projected[1].status, "projected");
  assert.equal(projected.at(-1).sessions[0].activity, "weekend");
  const pto = { ...day("2026-10-06", "CO"), sessions: [session("CO", 0, "pto")] };
  const ledger = reviseDay(EMPTY_LEDGER, pto, "PTO", "2026-10-12T00:00:00Z", projected[1]);
  assert.equal(mergeLedger(projected, ledger).filter(d => d.date === pto.date).length, 1);
  assert.equal(dayCount(mergeLedger(projected, ledger)[1], "CO"), 0);
});

test("split days count under each state's day definition, without double counting sessions", () => {
  const split = { ...day("2026-10-05"), sessions: [session("IL", 2), session("TN", 6)] };
  assert.equal(dayCount(split, "IL", "majority"), 0);
  assert.equal(dayCount(split, "IL", "any"), 1);
  assert.equal(dayCount(split, "TN", "majority"), 1);
  assert.ok(validateDay({ ...split, sessions: [session("IL", 13), session("TN", 13)] }).length);
  assert.ok(validateDay({ ...split, sessions: [session("IL"), session("IL")] }).includes("Duplicate session ID."));
});

test("corrections retain old attestation and require a new one on the replacement", () => {
  const original = day("2026-09-01", "TN");
  const ledger = reviseDay(EMPTY_LEDGER, original, "Confirmed", "2026-09-02T00:00:00Z");
  const next = reviseDay(ledger, day(original.date, "CO", "reported"), "Wrong location", "2026-09-03T00:00:00Z");
  assert.equal(next.revisions[1].before.attestedAt, "2026-09-02T00:00:00Z");
  assert.equal(next.days[original.date].attestedAt, undefined);
  assert.equal(next.revisions[1].after.sessions[0].state, "CO");
  assert.throws(() => reviseDay(ledger, original, "", "now"), /reason/);
});

test("Illinois 30/31 boundary and active payroll are distinct", () => {
  const entries = range("2026-01-01", "2026-01-31");
  assert.equal(evaluate("IL", entries.slice(0, 30), "2026-01-30").withholding.value, false);
  assert.equal(evaluate("IL", entries, "2026-01-31").status, "payroll_action");
  assert.equal(evaluate("IL", entries, "2026-01-31", {}, { payrollActive: true }).status, "active");
  assert.equal(evaluate("IL", entries, "2026-01-31", { ilMobileWorkerConfirmed: false }).withholding.value, "unknown");
});

test("annual counters reset and missing rule versions never clear a future year", () => {
  const entries = [...range("2026-12-01", "2026-12-31"), day("2027-01-01")];
  const outcome = evaluate("IL", entries, "2027-01-01");
  assert.equal(outcome.workDays, 1);
  assert.equal(outcome.status, "review_required");
  assert.equal(getReviewedRule("IL", "2027-01-01"), undefined);
});

test("unreported weekdays and projected history never produce clear actual outcomes", () => {
  assert.ok(coverageIssues([], "2026-10-05", "2026-10-09")[0].includes("5"));
  const projected = [day("2026-10-05", "IL", "projected")];
  const outcome = evaluate("IL", projected, "2026-10-05");
  assert.equal(outcome.workDays, 0);
  assert.equal(outcome.projectedDays, 1);
  assert.equal(outcome.withholding.value, "unknown");
  assert.equal(outcome.status, "review_required");
});

test("Georgia wage leg can trigger with unknown percentage; otherwise unresolved stays unknown", () => {
  const entries = [day("2026-09-01", "GA")];
  const hit = evaluate("GA", entries, "2026-09-01", {}, { stateWages: 6000 });
  assert.equal(hit.withholding.value, true);
  const unknown = evaluate("GA", entries, "2026-09-01", {}, { stateWages: 2000 });
  assert.equal(unknown.withholding.value, "unknown");
  assert.equal(evaluate("GA", entries, "2026-09-01", {}, { stateWages: 4000, annualTotalWages: 50000 }).filing.value, true);
});

test("NY expectations and assigned-office sourcing gate the administrative rule", () => {
  const entries = [day("2026-09-01", "NY")];
  assert.equal(evaluate("NY", entries, "2026-09-01", { nyExpectedDays: 20 }).withholding.value, true);
  assert.equal(evaluate("NY", entries, "2026-09-01", { nyExpectedDays: 14 }).withholding.value, false);
  assert.equal(evaluate("NY", entries, "2026-09-01", { nyExpectedDays: undefined }).withholding.value, "unknown");
  assert.equal(evaluate("NY", entries, "2026-09-01", { assignedWorkState: "NY" }).withholding.value, "unknown");
});

test("reciprocity is residence-dependent and withholding needs documentation", () => {
  const outcome = evaluate("PA", [day("2026-09-01", "PA")], "2026-09-01", { residence: "VA" });
  assert.equal(outcome.filing.value, false);
  assert.equal(outcome.withholding.value, "unknown");
  assert.match(outcome.withholding.reasons[0], /certificate/);
});

test("no wage tax is distinct from employer permission and legal review", () => {
  assert.equal(evaluate("TN", [day("2026-09-01", "TN")], "2026-09-01").withholding.value, false);
  assert.equal(evaluate("TX", [day("2026-09-01", "TX")], "2026-09-01").status, "clear");
  assert.equal(evaluate("AK", [day("2026-09-01", "AK")], "2026-09-01").status, "not_permitted");
  assert.equal(evaluate("WA", [day("2026-09-01", "WA")], "2026-09-01").status, "review_required");
  assert.equal(evaluate("CA-BC", [], "2026-09-01").status, "not_permitted");
});

test("forecast finds the 31st Illinois day on Wednesday and combines repeated visits", () => {
  const entries = range("2026-09-01", "2026-09-28");
  const plans = [{ id: "one", state: "IL", location: "Chicago", lengthDays: 2 }, { id: "two", state: "IL", location: "Chicago", lengthDays: 3 }];
  const route = forecastRoute(plans, entries, { ...settings, trackingStart: "2026-09-01" });
  assert.equal(route[0].outcome.workDays, 30);
  assert.equal(route[1].wdBefore, 30);
  assert.equal(route[1].withholdingTriggerDate, "2026-10-07");
  assert.equal(route[1].outcome.workDays, 33);
});

test("forecast uses recorded PTO instead of itinerary weekdays and retains policy precedence", () => {
  const entries = [...range("2026-09-01", "2026-09-28"), { ...day("2026-10-07"), sessions: [session("IL", 0, "pto")] }];
  const route = forecastRoute([{ id: "one", state: "IL", location: "Chicago", lengthDays: 5 }], entries, settings);
  assert.equal(route[0].withholdingTriggerDate, "2026-10-08");
  const prohibited = forecastRoute([{ id: "bad", state: "AK", location: "Anchorage", lengthDays: 5 }], entries, settings);
  assert.equal(prohibited[0].outcome.status, "not_permitted");
  assert.equal(prohibited[0].outcome.remaining, undefined);
});

test("pay-period workday allocation reconciles Colorado and Tennessee to gross", () => {
  const entries = [...range("2026-10-05", "2026-10-09", "CO"), ...range("2026-10-12", "2026-10-16", "TN")];
  const period = { id: "p", start: "2026-10-05", end: "2026-10-16", grossWages: 8000, source: "employee_entered" };
  const allocation = allocatePayPeriod(entries, period);
  assert.equal(allocation.reconciled, true);
  assert.equal(allocation.totalHours, 80);
  assert.deepEqual(allocation.rows.map(r => [r.state, r.wages]), [["CO", 4000], ["TN", 4000]]);
  assert.equal(wagesThrough(entries, [period], "CO", period.start, period.end), 4000);
});

test("cent rounding reconciles, and invalid/missing gross never produces invented wages", () => {
  const entries = [day("2026-09-01", "CO"), day("2026-09-02", "TN"), day("2026-09-03", "TX")];
  const period = { id: "p", start: "2026-09-01", end: "2026-09-03", grossWages: 100, source: "employee_entered" };
  const report = allocatePayPeriod(entries, period);
  assert.equal(report.rows.reduce((n, r) => n + Math.round(r.wages * 100), 0), 10000);
  assert.equal(report.reconciled, true);
  for (const grossWages of [undefined, NaN, -1]) {
    const invalid = allocatePayPeriod(entries, { ...period, grossWages });
    assert.equal(invalid.reconciled, false);
    assert.ok(invalid.rows.every(r => r.wages === undefined));
  }
});

test("split allocation uses reviewed CO majority and blocks unresolved formulas", () => {
  const period = { id: "p", start: "2026-09-01", end: "2026-09-01", grossWages: 800, source: "employee_entered" };
  const co = [{ ...day(period.start), sessions: [session("CO", 6), session("TN", 2)] }];
  assert.equal(allocatePayPeriod(co, period).rows.find(r => r.state === "CO").wages, 800);
  const ca = [{ ...day(period.start), sessions: [session("CA", 6), session("TN", 2)] }];
  assert.equal(allocatePayPeriod(ca, period).reconciled, false);
  assert.equal(allocatePayPeriod(ca, period).allocatedWages, undefined);
});

test("corrections change allocation without deleting previous records; overlapping periods cannot double count", () => {
  const period = { id: "p", start: "2026-09-01", end: "2026-09-01", grossWages: 800, source: "employee_entered" };
  const first = reviseDay(EMPTY_LEDGER, day(period.start, "TN"), "Initial", "2026-09-02T00:00:00Z");
  const second = reviseDay(first, day(period.start, "CO"), "Correction", "2026-09-03T00:00:00Z");
  assert.equal(allocatePayPeriod(Object.values(first.days), period).rows[0].state, "TN");
  assert.equal(allocatePayPeriod(Object.values(second.days), period).rows[0].state, "CO");
  assert.equal(second.revisions.length, 2);
  assert.equal(wagesThrough(Object.values(second.days), [period, { ...period, id: "overlap" }], "CO", period.start, period.end), undefined);
});

test("reviewed assertions carry government provenance and bounded rule versions", () => {
  assert.deepEqual(Object.keys(REVIEWED_RULES).sort(), ["CA", "CO", "GA", "IL", "NY", "PA", "TN", "TX"]);
  for (const rule of Object.values(REVIEWED_RULES)) {
    assert.ok(rule.sources.length);
    assert.equal(rule.effectiveTo, "2026-12-31");
    for (const s of rule.sources) { assert.ok(s.supports.length); assert.match(s.url, /^https:\/\//); assert.equal(s.lastVerified, "2026-09-21"); }
  }
});

test("CSV export escapes quotes and neutralizes spreadsheet formulas", () => {
  assert.equal(csvCell('Denver, "CO"'), '"Denver, ""CO"""');
  assert.equal(csvCell('=HYPERLINK("https://example.com")'), '"\'=HYPERLINK(""https://example.com"")"');
});

test("a NY route already expected to exceed 14 days forecasts action on the first day", () => {
  const route = forecastRoute([{ id: "ny", state: "NY", location: "NY", lengthDays: 28 }], [], { ...settings, trackingStart: "2026-10-05" });
  assert.equal(route[0].withholdingTriggerDate, "2026-10-05");
});

test("quarter aggregation isolates both activity and wage totals", async () => {
  const { aggregateActivity, periodBounds } = await import("../src/lib/ledger/aggregate.ts");
  const entries = [day("2026-03-31", "CO"), day("2026-04-01", "CO")];
  const bounds = periodBounds("quarter", "2026-04-01");
  assert.equal(bounds.start, "2026-04-01");
  assert.equal(aggregateActivity(entries, "CO", bounds.start, bounds.end).workdays, 1);
  const periods = entries.map((d, i) => ({ id: String(i), start: d.date, end: d.date, grossWages: i ? 350 : 250, source: "employee_entered" }));
  assert.equal(wagesThrough(entries, periods, "CO", bounds.start, bounds.end), 350);
});

test("saved ledger validation preserves history and rejects corrupt records", async () => {
  const { readSavedWork } = await import("../src/lib/persistence.ts");
  const ledger = reviseDay(EMPTY_LEDGER, day("2026-09-01", "CO"), "Confirmed", "2026-09-02T00:00:00Z");
  const saved = { ledger, payPeriods: [], payrollActive: [], periodRevisions: [] };
  assert.deepEqual(readSavedWork(JSON.stringify(saved)), JSON.parse(JSON.stringify(saved)));
  assert.throws(() => readSavedWork(JSON.stringify({ ...saved, ledger: { days: { "2026-09-01": { bad: true } }, revisions: [] } })));
});

test("unconfirmed activity cannot turn actual gross pay into a payroll allocation", () => {
  const period = { id: "p", start: "2026-09-01", end: "2026-09-01", grossWages: 800, source: "employee_entered" };
  const report = allocatePayPeriod([day(period.start, "CO", "projected")], period);
  assert.equal(report.allocatedWages, undefined);
  assert.equal(report.reconciled, false);
});
