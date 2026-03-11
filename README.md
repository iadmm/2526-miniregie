# MiniRégie TV

> IAD Louvain-la-Neuve · JAM Multimédia 48h

---

## Bootstrap

```bash
npm install
npm run dev
```

Ports :
- `3000` — serveur Node.js + broadcast SPA
- `3001` — admin (Svelte, dev only)
- `3002` — /go participant (Svelte, dev only)

## Tests

```bash
npm test           # Vitest — unitaires
npm run test:watch # Vitest en mode watch
npm run test:e2e   # Playwright — E2E
```

## Lint / Format

```bash
npm run check      # Biome — lint + format check
npm run format     # Biome — format auto
```

---

## Structure

```
server/src/
  pool/       PoolManager
  broadcast/  BroadcastManager
  apps/       Une app par fichier
  narrator/   NarratorEngine
  routes/     Express routes
  db/         schema.sql + queries.ts
  scheduler/  LimitTriggers
client/
  broadcast/  SPA vanilla JS — esbuild + lightningcss
  admin/      Svelte + Vite
  go/         Svelte + Vite + PWA
shared/
  types.ts    Interfaces TypeScript partagées
config/
  schedule.json  Planning d'apps
  roles.json     Rôles onboarding /go
e2e/            Tests Playwright
```
