# State Lines — Work-day Router

An interactive Next.js demo for visualizing work-day travel and exploring how
fictional filing, withholding, and employer-registration rules affect a route.

> All stays, salary figures, thresholds, estimates, registration statuses, and
> policy caps in this repository are fictional. The app is a product demo, not
> legal, payroll, or tax advice.

## What it demonstrates

- A past/future travel workflow with an interactive tile-grid map.
- Per-state work-day aggregation and overlapping-trip attribution.
- A future route builder with configurable safety margins.
- Employer implications and a printable sample compliance report.
- Persistent local settings and light/dark appearance modes.

The public map labels and tile positions live in `src/lib/states.ts`. That file
generates deterministic sample rules to exercise the interface without
including real employer policies or tax data. The fictional itinerary is in
`src/lib/seed.ts`, and all calculations are in `src/lib/engine.ts`.

## Development

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build
pnpm lint
```
