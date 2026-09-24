import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPLOYER_CODES, STATE_REQUIREMENTS, DEFAULT_COSTS, SETUP_STEPS, estimateCosts } from '../src/lib/employer/stateRequirements.ts';
import { FILING_FEES } from '../src/lib/employer/filingFees.ts';
import { INITIAL_WORKSPACE, parseWorkspace, policyFromWorkspace, canActivate } from '../src/lib/employer/workspace.ts';
import { getEmployerPolicyStatus } from '../src/lib/employer/demoEmployer.ts';
import { evaluateState } from '../src/lib/compliance/evaluate.ts';
const states = 'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ').sort();

test('all 50 states have independent wage, UI and sourced foreign-LLC references', () => {
  assert.deepEqual([...EMPLOYER_CODES].sort(), states);
  assert.deepEqual(Object.keys(STATE_REQUIREMENTS).sort(), states);
  assert.deepEqual(Object.keys(FILING_FEES).sort(), states);
  for (const code of states) {
    const r = STATE_REQUIREMENTS[code];
    assert.ok(r.uiWageBase > 0 && r.wageFloor >= 7.25);
    assert.ok(r.page >= 1 && r.page <= 5);
    assert.ok(r.note && r.wageNote && FILING_FEES[code].note);
    assert.ok(new URL(FILING_FEES[code].url).protocol === 'https:');
    assert.ok(FILING_FEES[code].amount > 0);
    assert.ok(estimateCosts(r, DEFAULT_COSTS).incomplete);
  }
});
test('costs cap each employee at wage base, retain cents, and keep setup separate', () => {
  const input = { ...DEFAULT_COSTS, employees: 3, salary: 10000, hourlyRate: 50, setupHours: 8, monthlyHours: 1, filingFees: 200, annualOther: 500 };
  const c = estimateCosts(STATE_REQUIREMENTS.CO, input);
  assert.equal(c.ui, 459);
  assert.equal(c.setup, 600);
  assert.equal(c.annual, 1559);
  assert.equal(c.incomplete, false);
  assert.equal(estimateCosts(STATE_REQUIREMENTS.CA, input).ui, 714);
  assert.equal(estimateCosts(STATE_REQUIREMENTS.PA, { ...input, employees: 1 }).ui, 382.2);
});
test('industry rate remains unknown; an explicit zero override is meaningful', () => {
  assert.equal(estimateCosts(STATE_REQUIREMENTS.WA, DEFAULT_COSTS).ui, null);
  const zero = estimateCosts(STATE_REQUIREMENTS.WA, { ...DEFAULT_COSTS, assignedUiRate: 0, filingFees: 0, annualOther: 0 });
  assert.equal(zero.ui, 0);
  assert.equal(zero.filing, 0);
  assert.equal(zero.incomplete, false);
  assert.equal(estimateCosts(STATE_REQUIREMENTS.OR, DEFAULT_COSTS).filing, 275);
});
test('malformed records and nonfinite/negative costs cannot grant permission', () => {
  for (const value of ['null','[]','{"ZZ":{}}','{"OR":{"status":"supported"}}']) assert.throws(() => parseWorkspace(value));
  for (const value of [-1, NaN, Infinity]) assert.throws(() => estimateCosts(STATE_REQUIREMENTS.OR, { ...DEFAULT_COSTS, salary: value }));
  assert.throws(() => estimateCosts(STATE_REQUIREMENTS.OR, { ...DEFAULT_COSTS, employees: 1.5 }));
  assert.throws(() => estimateCosts(STATE_REQUIREMENTS.OR, { ...DEFAULT_COSTS, assignedUiRate: 101 }));
  assert.deepEqual(parseWorkspace(JSON.stringify(INITIAL_WORKSPACE)), INITIAL_WORKSPACE);
});
test('setup is approval-required; activation needs every review and evidence', () => {
  const draft = { status: 'planning', checks: [], evidence: '', updatedAt: '2026-09-23', costs: DEFAULT_COSTS };
  assert.equal(canActivate(draft), false);
  draft.checks = SETUP_STEPS.map(s => s.id);
  assert.equal(canActivate(draft), false);
  draft.evidence = 'Reviewed 2026-09-23, reference DEMO-123';
  assert.equal(canActivate(draft), true);
  assert.equal(getEmployerPolicyStatus('OR', policyFromWorkspace({ OR: draft })), 'approval_required');
  draft.status = 'supported';
  assert.equal(getEmployerPolicyStatus('OR', policyFromWorkspace({ OR: draft })), 'allowed');
  assert.equal(getEmployerPolicyStatus('DC', policyFromWorkspace({ OR: draft })), 'prohibited');
});
test('employer approval flows into employee evaluation but does not create reviewed law', () => {
  const settings = { trackingStart:'2026-01-01', residence:'TN', assignedWorkState:'TN', regularWagesOnly:true, salary:100000, margin:0.8 };
  assert.equal(evaluateState('OR', [], settings, '2026-09-23').status, 'not_permitted');
  const supported = policyFromWorkspace({ OR: { ...INITIAL_WORKSPACE.CA, status:'supported' } });
  assert.equal(evaluateState('OR', [], settings, '2026-09-23', { employer:supported }).status, 'review_required');
  const setup = policyFromWorkspace({ OR: { ...INITIAL_WORKSPACE.CA, status:'planning' } });
  assert.equal(evaluateState('OR', [], settings, '2026-09-23', { employer:setup }).status, 'approval_required');
});
