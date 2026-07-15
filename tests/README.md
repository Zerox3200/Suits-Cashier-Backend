# Automated Testing Suite

## Quick start

```bash
npm install
npm test
npm run test:coverage
```

## What's covered

| Area | Location |
|------|----------|
| Auth / JWT / brute force | `tests/integration/auth.test.js` |
| RBAC matrix (guest/cashier/admin/frozen) | `tests/integration/rbac.matrix.test.js` |
| Products (CRUD, scan, inject, races) | `tests/integration/products.test.js` |
| Invoices (totals, stock, returns, 100 lines) | `tests/integration/invoices.test.js` |
| Stock adjustments & movements | `tests/integration/stock.test.js` |
| Settings + Dashboard | `tests/integration/settings.dashboard.test.js` |
| Security (NoSQL, XSS, mass assignment) | `tests/integration/security.test.js` |
| Concurrency (10×10 + oversell race) | `tests/concurrency/invoices.race.test.js` |
| Middleware unit | `tests/unit/middleware.auth.test.js` |
| Performance smoke (+ optional stress) | `tests/performance/smoke.test.js` |

## Stress

```bash
# Windows PowerShell
$env:RUN_STRESS=1; npx vitest run tests/performance
```

## Design

- **MongoMemoryReplSet** — real transactions (not just the standalone fallback)
- **Single worker** — deterministic, non-flaky
- **Factories** — users, categories, suppliers, products+stock
- **createApp()** — HTTP app without listen/seed side effects

## CI

GitHub Actions runs `npm run test:ci` on push/PR (see `.github/workflows/ci.yml`).
