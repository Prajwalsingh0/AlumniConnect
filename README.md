# AlumniConnect

Alumni network platform for a university: alumni/student profiles, events with registration, a job board, donation campaigns, community stories, alumni search, group forums, and direct messaging — with a dedicated admin panel.

## Tech Stack

- **Backend:** Node.js, Express, Mongoose (MongoDB), Socket.IO
- **Frontend:** Static HTML/CSS/JS (Tailwind via CDN) served by Express
- **Auth:** JWT (Bearer tokens), bcrypt password hashing

## Getting Started

```bash
cd alumni-website
npm install
copy .env.example .env        # then edit values (Windows) / cp .env.example .env (macOS/Linux)
npm run seed                  # creates collections and seeds demo data if the DB is empty
node scripts/create-admin.js  # creates/promotes the admin account (set ADMIN_EMAIL / ADMIN_PASSWORD in .env first)
npm start                     # serves http://localhost:3000
```

Requirements: Node.js 18+, a running MongoDB instance (local or Atlas). Without MongoDB the server still starts, but database features return errors.

## Environment Variables

See `alumni-website/.env.example`. Key variables:

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default 3000) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` / `JWT_EXPIRE` | Token signing secret / lifetime |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Credentials used by `scripts/create-admin.js` |
| `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_USER` / `EMAIL_PASSWORD` | SMTP for verification & reset emails (optional) |
| `FRONTEND_URL` | Base URL used in email links |

## Main Pages

| Page | Purpose |
|---|---|
| `index.html` | Landing page |
| `portal.html` | Login / registration |
| `profile.html` / `edit-profile.html` | Own profile (view / edit, privacy settings, skills) |
| `events.html` | Event calendar + registration |
| `jobs.html` | Job board + applications |
| `donations.html` | Fundraising campaigns + donations |
| `stories.html` | Alumni stories + story submission |
| `about.html` | Mission, gallery, news |
| `admin.html` / `admin-login.html` | Admin panel (users, events, jobs, campaigns) |

## API Overview

All endpoints are under `/api`:

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET/PUT /api/users/profile`, `POST /api/users/profile/image`, `PUT /api/users/password`
- `GET /api/users/public/:userId`, `GET /api/users/directory`, `GET /api/users/search`
- `POST /api/users/skills/:skillName/endorse`
- `GET /api/events`, `GET /api/events/:id`, `POST/DELETE /api/events/:id/register`, `GET /api/events/user/registrations`
- `GET /api/jobs`, `GET /api/jobs/:id`, `POST /api/jobs`, `POST /api/jobs/:id/apply`
- `GET /api/donations/campaigns`, `POST /api/donations/campaigns`, `POST /api/donations/donate`
- `GET /api/stories`, `GET /api/stories/:id`, `POST /api/stories`
- `GET/POST /api/groups`, `POST /api/groups/:id/join`, `GET/POST /api/groups/:id/posts`
- `GET/POST /api/messages/conversations`, `GET /api/messages/conversations/:conversationId`
- Admin (role `admin` required): `/api/admin/stats`, `/api/admin/users`, `/api/admin/events`, `/api/admin/jobs`, `/api/admin/campaigns`

## Scripts

| Command | Purpose |
|---|---|
| `npm start` | Start the server |
| `npm run dev` | Start with nodemon (auto-restart) |
| `npm run seed` | Create collections + seed demo data (only when the database is empty) |
| `npm run create-admin` | Create or promote the admin user |
| `npm run check-mongodb` | Verify MongoDB connectivity |
