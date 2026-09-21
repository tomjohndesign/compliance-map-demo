import assert from "node:assert/strict";
import test from "node:test";
import { getRule2026, MOBILE_WORKER_RULES_2026 } from "../src/lib/compliance/rules2026.ts";
import { getEmployerPolicyStatus, HYPOTHETICAL_EMPLOYER } from "../src/lib/employer/demoEmployer.ts";

const jurisdictions = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" ");
const allowed = "CA CO FL GA IL MA NC NY PA TN TX VA WA".split(" ");

test("the import covers exactly 50 states and DC, all explicitly unverified", () => {
  assert.deepEqual(Object.keys(MOBILE_WORKER_RULES_2026).sort(), jurisdictions.toSorted());
  for (const code of jurisdictions) {
    const rule = getRule2026(code);
    assert.equal(rule.code, code);
    assert.ok(rule.state);
    assert.equal(rule.effectiveAsOf, "2026-01-01");
    assert.equal(rule.researchStatus, "baseline");
    for (const threshold of [rule.filing, rule.withholding]) {
      assert.ok(threshold.display);
      if (threshold.kind !== "special" && threshold.kind !== "none") {
        assert.equal(typeof threshold.greaterThan, "boolean");
      }
    }
    assert.equal("employerSupported" in rule, false);
    assert.equal("employerRegistered" in rule, false);
    assert.equal("supportedStates" in rule, false);
  }
});

test("strict, inclusive and first-day comparisons survive the handoff import", () => {
  for (const obligation of ["filing", "withholding"]) {
    assert.equal(getRule2026("IL")[obligation].days, 30);
    assert.equal(getRule2026("IL")[obligation].greaterThan, true);
    assert.equal(getRule2026("CO")[obligation].days, 1);
    assert.equal(getRule2026("CO")[obligation].greaterThan, false);
  }
  assert.equal(getRule2026("VT").withholding.days, 30);
  assert.equal(getRule2026("VT").withholding.greaterThan, false);
  assert.equal(getRule2026("CA").filing.kind, "day");
  assert.equal(getRule2026("CA").withholding.wages, 1500);
  assert.equal(getRule2026("CA").withholding.greaterThan, true);
  assert.equal(getRule2026("ID").withholding.greaterThan, false);
});

test("compound rules preserve AND/OR, omitted legs and percentage units", () => {
  for (const obligation of ["filing", "withholding"]) {
    const maine = getRule2026("ME")[obligation];
    assert.equal(maine.kind, "day_and_wage");
    assert.equal(maine.days, 12);
    assert.equal(maine.wages, 3000);
    assert.equal(maine.greaterThan, true);
    const georgia = getRule2026("GA")[obligation];
    assert.equal(georgia.kind, "day_or_wage_or_percent");
    assert.equal(georgia.wages, 5000);
    assert.equal(georgia.wagePercent, 0.05);
    assert.equal(georgia.greaterThan, true);
  }
  assert.equal(getRule2026("GA").filing.days, undefined);
  assert.equal(getRule2026("GA").withholding.days, 23);
});

test("unsupported metrics remain special instead of becoming generic annual wages", () => {
  for (const [code, obligation, text] of [
    ["MN", "filing", "Minnesota-source"],
    ["MN", "withholding", "all-source"],
    ["OH", "withholding", "calendar quarter"],
    ["OK", "withholding", "More than $300 per calendar quarter"],
    ["OR", "filing", "filing status"],
    ["DC", "filing", "nonresident"],
    ["DC", "withholding", "nonresident"],
  ]) {
    const threshold = getRule2026(code)[obligation];
    assert.equal(threshold.kind, "special");
    assert.ok(threshold.display.includes(text));
    assert.equal(threshold.wages, undefined);
  }
  const noWageTax = jurisdictions.filter(code => getRule2026(code).filing.kind === "none");
  assert.deepEqual(noWageTax.toSorted(), "AK FL NV NH SD TN TX WA WY".split(" ").toSorted());
});

test("mutuality, convenience and local research flags survive independently", () => {
  const flagged = key => jurisdictions.filter(code => getRule2026(code)[key]).toSorted();
  assert.deepEqual(flagged("mutualityRequired"), ["AL", "ND", "UT", "WV"]);
  assert.deepEqual(flagged("convenienceReviewRequired"), ["CT", "DE", "NJ", "NY"]);
  assert.deepEqual(flagged("localTaxResearchRequired"), "AL CO DE IA IN MD MI MO NJ NY OH OR PA WV".split(" "));
  assert.deepEqual(flagged("reciprocityReviewRequired"), ["KY", "MD", "MI", "PA", "VA", "WV"]);
});

test("employer policy allows exactly the requested states regardless of tax treatment", () => {
  assert.deepEqual(Object.keys(HYPOTHETICAL_EMPLOYER.supportedStates).sort(), allowed);
  for (const code of jurisdictions) {
    assert.equal(getEmployerPolicyStatus(code), allowed.includes(code) ? "allowed" : "prohibited");
  }
  assert.equal(getEmployerPolicyStatus("AK"), "prohibited"); // No wage tax is not permission.
  assert.equal(getEmployerPolicyStatus("CO"), "allowed"); // First day is not prohibition.
  assert.equal(getEmployerPolicyStatus("NY", {
    name: "Approval fixture",
    supportedStates: { NY: "approval_required" },
  }), "approval_required");
});

test("missing, international and inherited object keys never imply permission or a known tax rule", () => {
  for (const code of ["", "ZZ", "AB", "BC", "CA-BC", "ca", "toString", "constructor", "__proto__"]) {
    assert.equal(getEmployerPolicyStatus(code), "prohibited");
    assert.equal(getRule2026(code), undefined);
  }
});
