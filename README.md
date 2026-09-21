# State Lines — Work-location and payroll prototype

A Next.js app for a mobile W-2 employee working only in states their employer
permits. The fictional employer allows CA, CO, FL, GA, IL, MA, NC, NY, PA, TN,
TX, VA and WA. All other jurisdictions default to prohibited for work.

The supplied itinerary is retained as **projected activity**, not an employee
work attestation. The fictional employee is Alex Morgan, with Tennessee as the
default domicile and assigned work state. Existing local preferences are retained.

## Workflow

1. **Past → Review work ledger:** confirm state, municipality, hours, PTO,
   holidays, sickness or non-work travel. Add multiple work sessions for split
   days. Save with a reason, then attest individually or after reviewing the
   displayed two-week period. Corrections preserve previous values and timestamps.
2. **Settings:** confirm domicile, assigned office, employment start, federal
   filing requirement and applicable Illinois/New York conditions. The internal
   safety margin is a planning preference, not a legal threshold.
3. **Future:** add, edit, reorder or remove stays. Dates chain automatically;
   repeated visits accumulate by tax year. Forecasts use projected weekdays and
   salary estimates and show crossing dates. Confirmed records replace projections.
4. **Create report:** enter actual regular gross wages for a completed period.
   Complete, attested work records are required before allocation amounts appear.
   Gross-pay corrections retain history. Overlapping periods are rejected.
5. Export allocation **CSV**, an **audit JSON snapshot**, or use **Print / save
   PDF**. These do not submit data to payroll. State treatment can be marked active
   after payroll confirms it; the checkbox itself makes no payroll change.

## Data and calculation boundaries

- `src/lib/states.ts`: geography only. Fictional registration flags and flat tax
  rates have been removed from the runtime.
- `src/lib/employer/demoEmployer.ts`: independent employer policy.
- `src/lib/compliance/rules2026.ts`: original 50-state-plus-DC research import,
  retained as unverified baseline data, never used to provide clearance.
- `src/lib/compliance/reviewed2026.ts`: versioned 2026 rules for CA, CO, GA, IL,
  NY, PA, TN and TX, with assertion-specific government sources, review dates,
  employee forms and open questions. See `research/states/`.
- `src/lib/ledger/`: projections, recorded sessions, revisions, validation,
  coverage checks, and annual/quarter/pay-period aggregation.
- `src/lib/compliance/expression.ts`: strict/inclusive thresholds and three-valued
  AND/OR logic. Missing metrics remain unknown.
- `src/lib/compliance/evaluate.ts` and `forecast.ts`: separate filing exposure
  and withholding outcomes, employer policy precedence, conditions and dates.
- `src/lib/reporting/`: workday allocation, deterministic cent reconciliation,
  period wage totals and CSV output.

**Primary reviewed is not legal reviewed.** The reviewed assertions supersede
simplifications in the handoff, while unresolved matters remain review-required.
Georgia's separate 23-day withholding leg was not corroborated by the reviewed
2026 guide. Final personal filing tests are not a tax-return calculation. NY
assigned-office sourcing, reciprocity documentation, local taxes and special
travel-service day definitions require review where relevant.

Pay-period wage allocations for annual-workday states are provisional and need
annual reconciliation. The automated split-day allocation supports the reviewed
Colorado majority-of-services case; other split-day formulas remain unresolved.
No actual wage amount is fabricated when gross wages or confirmed activity are
missing. Forecast money is explicitly estimated from salary / 2,080 hours.

Rules end on December 31, 2026. The supplied itinerary extends into 2027; those
forecasts correctly require a new rule version. Other states remain baseline-only,
even when employer policy permits work there.

This is a **browser-local prototype**, not a payroll system or a production
compliance database. Records and correction history use localStorage; export JSON
for a portable snapshot. There is no server account, tamper-proof audit log,
professional legal sign-off, provider integration or automatic form submission.
Workers' compensation, unemployment, entity registration, corporate nexus, resident
returns, final tax liability and international employment are outside scope.

## Development and verification

```bash
pnpm install
pnpm dev
pnpm test        # Node 22.18+; no additional test dependencies
pnpm lint
pnpm exec next typegen
pnpm exec tsc --noEmit
pnpm build
```

Tests cover threshold boundaries, unknown-data behavior, conditional rules,
annual resets, quarterly isolation, repeated visits, forecast dates, non-work and
split days, corrections, provenance, storage validation, allocation reconciliation,
overlapping periods and CSV escaping. The interface is also checked in a browser
through record → attestation → persistence → report and route workflows.
