🚀 **AI Project-Roadmap Generator**
An AI-powered platform that converts project requirements into professional PRD and TRD documents — via a free-form AI Chatbot or a structured Questionnaire.

**Tech Stack**
-> Frontend: Next.js 14, React 18, Tailwind CSS, Redux Toolkit, Socket.IO Client
-> Backend: Node.js + Express, TypeScript, MongoDB + Mongoose, Socket.IO
-> AI: Groq API (llama-3.3-70b-versatile) — free tier
-> Auth: Custom JWT (short-lived access token + HTTP-only refresh cookie, no OAuth)

---

## Backend (apps/api)

### Setup

1. `npm install` (from the repo root — this is an npm-workspaces monorepo).
2. Copy `.env.example` to `.env` at the repo root and fill in values.
   - `MONGODB_URI` — MongoDB connection string (Atlas `mongodb+srv://...` or local).
   - `DNS_SERVERS` — comma-separated DNS servers (default `8.8.8.8,1.1.1.1`). The
     API points Node's resolver at these before connecting, which fixes the
     `querySrv ECONNREFUSED` SRV-lookup failure seen on some Windows/router setups.
   - `JWT_SECRET` and `JWT_REFRESH_SECRET` — two **different** 64-char hex strings:
     `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

### Run

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the API with hot-reload (tsx watch) |
| `npm run build` / `npm start` | Compile and run the production build |
| `npm run db:ping --workspace apps/api` | Verify the MongoDB connection |
| `npm run create:admin --workspace apps/api -- <email> <password> [name]` | Create/promote an admin user |

### Data model (Mongoose)

Models live in `apps/api/src/models`: `User` (roles: client/admin/tech; password
stored only as a bcrypt hash) and `Project` (owned by a user via `ownerId`,
status enum: draft/in_review/approved/locked/archived).

### API endpoints

| Method | Route | Auth |
|--------|-------|------|
| GET | `/api/health` | — |
| POST | `/api/auth/register` | — |
| POST | `/api/auth/login` | — |
| POST | `/api/auth/refresh` | refresh cookie |
| POST | `/api/auth/logout` | — |
| GET | `/api/auth/me` | Bearer |
| GET/POST | `/api/projects` | Bearer |
| GET/PATCH/DELETE | `/api/projects/:id` | Bearer (owner-scoped) |
| GET | `/api/admin/users` | Bearer + **admin** role |
| GET | `/api/admin/projects` | Bearer + **admin** role |

**Roles:** users register as `client`. Create an `admin` with the `create:admin`
script (admins can't be self-registered). The `requireRole('admin')` middleware
gates everything under `/api/admin`; a non-admin token gets `403`.

**Auth flow:** register/login return an access token (JSON body, ~15 min) and set
an HTTP-only `refreshToken` cookie (~7 days). Send the access token as
`Authorization: Bearer <token>` on protected routes. When it expires, call
`POST /api/auth/refresh` (cookie sent automatically) to get a new one; the refresh
cookie is rotated each time. `POST /api/auth/logout` clears the cookie.
