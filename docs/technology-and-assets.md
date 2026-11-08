# Technology stack, fonts and external assets

> **Purpose:** a high-level view of what the application actually uses, where each asset comes from, and whether we run a local copy. This is deliberately not an SBOM or module tree.
>
> **Snapshot:** 8 November 2026.

## 1. At a glance

| Area | What we use | Local copy? | Network needed? |
|---|---|---|---|
| UI framework | React 19 + React DOM | Yes — bundled into the app's JavaScript | No |
| Styling | Tailwind CSS 4, compiled into local CSS | Yes | No |
| Icons | **Lucide React** (SVG React components) | Yes — bundled | No |
| Body font | **Roboto** | **Yes** — `public/fonts/` | No |
| Monospace font | **JetBrains Mono** | **Yes** — `public/fonts/` | No |
| Secondary/display font | **Plus Jakarta Sans** | **Yes** — `public/fonts/` | No |
| Relationship graph | Cytoscape.js | Yes — bundled | No |
| Charts | Hand-built inline SVG and canvas | Yes — source code | No |
| Word export | `docx` | Yes — bundled | No |
| PDF export | `jsPDF` | Yes — bundled | No |
| CSV export | Application code | Yes | No |
| Server | Express | Yes — installed locally | No |
| Runtime/build | Node.js, `tsx`, Vite | Yes — installed locally | No at runtime |
| Database | JSON file on disk | Yes | No |
| Authentication | Local accounts; Node `crypto` scrypt | Yes | No |
| AI / LLM | **Not used** | — | No |
| External identity provider | Not used | — | No |

**There are no external runtime requests.** Fonts, icons, styles, scripts and images are all served from the application's own origin.

## 2. Fonts

All three families are self-hosted as variable TTF files in [`public/fonts`](../public/fonts):

| Family | Files | Role | Weights loaded |
|---|---|---|---|
| **Roboto** | `Roboto-VariableFont_wdth,wght.ttf`, `Roboto-Italic-VariableFont_wdth,wght.ttf` | Primary body/UI font | 100–900, width 75–100% |
| **Plus Jakarta Sans** | `PlusJakartaSans-VariableFont_wght.ttf`, `PlusJakartaSans-Italic-VariableFont_wght.ttf` | Secondary/display font, available for future use | 200–800 |
| **JetBrains Mono** | `JetBrainsMono-VariableFont_wght.ttf`, `JetBrainsMono-Italic-VariableFont_wght.ttf` | Hostnames, IPs, IDs, code-style text | 100–800 |

`src/index.css` declares local `@font-face` rules pointing at `/fonts/...`, then sets:

- `--font-sans` and the body to **Roboto**.
- `--font-mono` and `code`/`pre` to **JetBrains Mono**.
- **Plus Jakarta Sans** is loaded locally and available for headings or future UI work, but the current body font is Roboto as requested.

There are no Google Fonts links in `index.html`, no `fonts.googleapis.com`, no `fonts.gstatic.com` and no CDN font request. The built `dist/index.html` contains no external font references.

### Font Awesome — no

Font Awesome is **not used**: no package, no icon font, no `@fortawesome/*` dependency and no CDN.

### Changing the body font

To switch later, change the `@font-face` family already declared in `src/index.css` and the `--font-sans` / `body` declarations. The Plus Jakarta Sans files are already local, so switching back does not require a download or a network request.

## 3. Icons

- **Lucide React** is the only icon library. Icons are React SVG components imported from `lucide-react` and bundled into the application JavaScript.
- There is no icon webfont, no Font Awesome, no Material Icons, no Bootstrap Icons and no icon CDN.
- Because the SVGs are bundled at build time, icons work completely offline.

## 4. UI, styling and layout

- **React 19 + React DOM** — component UI, bundled.
- **Tailwind CSS 4** — utility classes compiled at build time into a local CSS file (`dist/assets/*.css`). No Tailwind CDN.
- Custom CSS in `src/index.css` for fonts, scrollbars and glass-panel effects.
- No component library (no Material UI, Bootstrap, Ant Design, Chakra, shadcn) and no external CSS framework.
- `motion` is present in `package.json` but is **not imported anywhere**; there is currently no animation library in use.

## 5. Graphs and charts

- **Cytoscape.js** renders the Ownership Explorer relationship graph. It is bundled; no external graph service.
- All other charts (dashboards, gauges, report charts) are **hand-built inline SVG or canvas** in the application code.
- No Chart.js, D3, Recharts, ECharts or similar charting dependency is used.

## 6. Reports and exports

All document generation happens **in the browser**; nothing is uploaded to a document service:

| Output | Technology | Where it runs |
|---|---|---|
| PDF incident report | `jsPDF` | Browser |
| Word incident report | `docx` | Browser |
| Markdown report | Application code | Browser |
| CSV exports | Application code + browser Blob API | Browser |
| Print view | Browser print | Browser |

The generated files are downloaded from memory. No external conversion or storage service is involved.

## 7. Server, build and data

- **Express 4** serves the API and, in production, the built SPA.
- **`tsx`** executes the TypeScript server; **Vite** provides the development server/middleware and the production build.
- **`dotenv`** reads the local `.env` file.
- The database is a **single local JSON file** (`data/csm_database.json`). There is no external database, Redis, object storage, message queue or search service.
- Static files (fonts, the seed CSV and images) are served from `public/`.
- The server makes **no outbound network requests**: no telemetry, SMTP, webhooks, cloud APIs or external authentication calls.

### Build and development tooling

| Tool | Role | Local? |
|---|---|---|
| Node.js + npm | Runtime and package installation | Yes |
| TypeScript | Type checking (`tsc --noEmit`) | Yes |
| `tsx` | Runs `server.ts` without a separate compile step | Yes |
| Vite | Dev server, HMR and production bundling | Yes |
| `@vitejs/plugin-react` | JSX/React transform during the build | Yes |
| `@tailwindcss/vite` + `tailwindcss` | Compiles Tailwind classes into local CSS | Yes |
| `autoprefixer`, direct `esbuild` | Installed but not used directly; Tailwind/Vite use their own toolchain | Yes (unused direct) |

The package manager used in this workspace is npm; the repository also contains `bun.lock`. This affects installation, not runtime behaviour.

## 8. Authentication and security

- Local accounts with passwords hashed by Node's built-in `crypto.scrypt`.
- Server-side sessions in the local database, delivered by cookie.
- No OAuth/OIDC redirect, no Entra ID/Google login, no external identity provider and no external MFA service.
- LDAP/Active Directory is a planned option only; `AUTH_MODE=ldap` currently refuses to start.
- No AI/LLM SDK, API key or network call is present in the application.

## 9. Local static assets

| Asset | Location | Purpose |
|---|---|---|
| Fonts | `public/fonts/*.ttf` | Roboto, Plus Jakarta Sans and JetBrains Mono |
| Seed CSV | `public/assets/aistudio/MOCKUP_CSM_Servers_-_Copy_c00cddf2.csv` | Initial demo inventory |
| Reference image | `public/assets/aistudio/image_0329ed5b.png` | Local mockup/reference artwork |
| Text fixture | `public/assets/aistudio/Paste_October_30__2026_-_1_46AM_b7a27fbd` | Local fixture |
| Application bundle | `dist/assets/*` after build | Local JS/CSS |

No external images or CDN assets are referenced.

## 10. Network destinations

| When | Destination | Why | Required? |
|---|---|---|---|
| App use | Same origin (`/`, `/api/*`, `/assets/*`, `/fonts/*`) | Application, API and local fonts | Yes |
| Development only | Local Vite HMR WebSocket (`ws://127.0.0.1:<port>`) | Hot reload | No in production |
| Install | npm registry (or Bun registry/cache) | Package installation | Install time only |
| One-time setup | GitHub | Initial clone | Setup only |
| Runtime server | None | — | — |
| Runtime browser third-party | **None** | — | — |

## 11. What we do **not** use

To make the boundary explicit:

- No Font Awesome, Material Icons or any icon webfont.
- No Google Fonts; all fonts are local.
- No external CSS or JavaScript CDN.
- No analytics, telemetry or crash-reporting service.
- No AI/LLM provider, API key or model call.
- No external database, Redis, S3 or message queue.
- No SMTP, Slack, Teams or ticketing integration.
- No external identity provider (OAuth/OIDC) and no external MFA.
- No external document-conversion service.

## 12. Air-gap checklist

1. Deploy the `public/fonts` directory with the application; verify the files exist in production.
2. Add a CSP with `default-src 'self'`, `font-src 'self'` and `connect-src 'self'`.
3. Ship `node_modules` or a pre-built container; `npm install` will not work without a mirror/cache.
4. Rebuild and confirm `dist/index.html` contains no `fonts.googleapis.com` or `fonts.gstatic.com` reference.
5. Run the app with egress blocked and test every page and report.
6. Check DevTools → Network → Third-party: the list should be empty.

## 13. How to verify

```bash
# Local font files (expected: six TTF files)
find public/fonts -type f

# No external font references in source or built output
grep -RIn "fonts.googleapis\|fonts.gstatic" index.html src dist 2>/dev/null

# Icon libraries (expected: only lucide-react)
grep -RIn "lucide-react\|font-awesome\|@fortawesome" src package.json

# No external URLs in source
grep -RIn "https\?://" index.html src server.ts public
```

In the browser: DevTools → Network → reload → filter by **Third-party**. The list should be empty. Fonts should load from the app's own `/fonts/...` paths.
