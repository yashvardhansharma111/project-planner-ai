# 🚀 RoadmapAI — AI Project-Roadmap Generator

Turn project requirements into professional planning documents — **PRD, TRD, BRD, SRS, API Docs, and Database Schema** — through a free-form **AI chatbot**, a **guided questionnaire**, or a **quick form**. Built as a single **Next.js** app (frontend + API route handlers), deployable as one unit.

---

## ✨ Features

- **Three intake methods** — AI chat (streaming, live completeness meter + editable draft), a multi-step guided questionnaire (DB-driven, conditional questions, AI-enriched), and a quick form.
- **6 document types** generated on demand via Groq — PRD, TRD, BRD, SRS, API Docs (with endpoint tables), DB Schema (with a Mermaid ERD).
- **Pre-generation feature checklist** the client reviews/edits before generating.
- **Guest mode** — visitors scope a project at `/` without an account, then sign in to generate (conversation is preserved and turned into a project).
- **Auth** — email/password **and** Google sign-in (JWT access token + rotating HTTP-only refresh cookie).
- **Roles** — `client`, `tech`, `admin`, each with a tailored experience.
- **Project lifecycle** — draft → in_review → approved → **locked** (finalise & lock, enforced on the backend).
- **Tech workspace** — approved projects, their documents, a task board, and milestones.
- **Admin** — analytics (KPIs, revenue in INR, charts), Clients & Developers management (role change, suspend, delete), all projects, and a questionnaire-bank editor.

## 🧱 Tech stack

- **App:** Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS
- **Backend:** Next.js **route handlers** (`app/api/**`) — no separate server
- **Database:** MongoDB Atlas + Mongoose
- **AI:** Groq API (`llama-3.3-70b-versatile`) — free tier
- **Auth:** Custom JWT (access token + HTTP-only refresh cookie) + Google OAuth (ID-token flow)
- **UI:** Lucide icons, Recharts (admin analytics), react-markdown (doc viewer)

## 📁 Structure (npm-workspaces monorepo, single app)

```
project-planner-ai/
└─ apps/
   └─ web/
      ├─ app/
      │  ├─ (auth)/ (dashboard)/ (tech)/ (admin)/   route groups + guards
      │  ├─ page.tsx                                guest chatbot landing
      │  └─ api/                                    backend route handlers
      │     ├─ auth/ projects/ documents/ ai/
      │     ├─ public/ questions/ tech/ admin/
      ├─ components/                                UI (app-shell, guest-chat, admin/…)
      ├─ lib/                                       api client + auth context
      └─ server/                                    backend core
         ├─ db.ts env.ts jwt.ts auth.ts http.ts rateLimit.ts schemas.ts
         ├─ models/        User, Project, AiDocument, Question, Task, Milestone
         └─ services/      groq.service, ai.service, seed.service
```

---

## ⚙️ Setup

> npm-workspaces monorepo. Run everything from the repo root.

1. **Install**
   ```bash
   npm install
   ```

2. **Environment** — create `apps/web/.env.local`:
   ```bash
   # Public (browser)
   NEXT_PUBLIC_API_URL=                       # blank → same-origin /api
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your-google-oauth-client-id>

   # Server-only
   MONGODB_URI=<mongodb+srv://... or direct mongodb://... string>
   JWT_SECRET=<64-char hex>
   JWT_REFRESH_SECRET=<different 64-char hex>
   GROQ_API_KEY=<gsk_...>                      # console.groq.com
   GOOGLE_CLIENT_ID=<same as NEXT_PUBLIC_GOOGLE_CLIENT_ID>
   SEED_DEMO=true                              # seed demo users + questionnaire (dev only)
   ```
   Generate a secret: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

3. **Run**
   | Command | What it does |
   |---|---|
   | `npm run dev` | Start the app (frontend + API) with hot-reload |
   | `npm run build` / `npm start` | Production build & serve |
   | `npm run type-check` | TypeScript check |

   Open the app on the printed port (e.g. `http://localhost:3001`).

### Demo accounts (when `SEED_DEMO=true`)
Seeded on first DB connect:
- **Admin:** `admin@example.com` / `Admin@2026`
- **Client:** `client@example.com` / `Demo12345`
- **Tech:** `tech@example.com` / `Demo12345`

---

## 🔌 API (route handlers under `/api`)

| Area | Examples |
|---|---|
| Auth | `POST /api/auth/{register,login,google,refresh,logout}` · `GET/PATCH /api/auth/me` · `/api/auth/me/{password,theme}` |
| Projects | `GET/POST /api/projects` · `GET/PATCH/DELETE /api/projects/:id` · `POST /api/projects/:id/finalize` |
| Documents | `GET /api/documents` · `GET/PATCH /api/documents/:id` · `/api/documents/:id/approve` · `/api/documents/:projectId/:docType/download` |
| AI | `POST /api/ai/{generate,checklist}/:projectId` · `/api/ai/chat`, `/chat/stream`, `/chat/extract`, `/enrich` |
| Guest | `POST /api/public/chat` (no auth, rate-limited) |
| Questions | `GET /api/questions` |
| Tech | `/api/tech/projects`, `/tech/projects/:id`, tasks & milestones |
| Admin | `/api/admin/{stats,users,projects,questions}` (+ role/status/delete) — `admin` role |

**Auth flow:** login/register/google return an access token (JSON, ~15 min) + set an HTTP-only `refreshToken` cookie (~7 days). Send `Authorization: Bearer <token>` on protected routes; on expiry the client calls `POST /api/auth/refresh` (cookie rotated). Role guards (`requireRole`) gate `/api/admin` and `/api/tech`.

---

## ☁️ Deploy (Vercel — single app)

1. Import the repo on Vercel; set **Root Directory** to `apps/web`.
2. Add the env vars from above in the Vercel dashboard (use the `mongodb+srv://` URI — Vercel resolves SRV fine).
3. Deploy. The frontend and all `/api` routes ship together.

> AI generation can take several seconds; route handlers set `maxDuration`. The full duration needs a Vercel plan that allows longer function execution.

## 📝 Notes

- **`querySrv ECONNREFUSED` locally?** Some networks block SRV lookups. Either keep the `DNS_SERVERS` override (default `8.8.8.8,1.1.1.1`) or use the **direct (non-SRV)** `mongodb://host1,host2,host3/...?replicaSet=...&ssl=true` connection string from Atlas.
- Secrets live only in `apps/web/.env.local` (gitignored) / the Vercel dashboard — never commit them.
