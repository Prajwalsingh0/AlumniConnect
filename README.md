# AlumniConnect

Alumni network platform for a university: alumni/student profiles, events with registration, a job board, donation campaigns, community stories, real-time chat, alumni search, group forums, and direct messaging — with a dedicated admin panel.

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
| `alumni.html` | Alumni directory (search, filters, pagination) |
| `chat.html` | Real-time chat (conversations, typing, unread badges) |
| `assistant` (floating widget) | AI website assistant on every page (feature guide) |
| `mentorship.html` | Mentorship dashboard (requests, active mentorships, chat) |
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
- `GET /api/home` — public homepage data: live member/job/story counts, upcoming events, latest stories, recently joined alumni
- `GET /api/users/directory` — paginated alumni listing (`page`, `limit` ≤ 48, `q`, `graduationYear`, `department`, `degree`, `location`, `mentorship=available`, `sort`: `name_asc`/`name_desc`/`newest`/`grad_year`)
- `GET /api/users/directory/facets` — distinct filter values from real user data
- `GET /api/users/public/:userId`, `GET /api/users/directory`, `GET /api/users/search`
- `POST /api/users/skills/:skillName/endorse`
- `GET /api/events`, `GET /api/events/:id`, `POST/DELETE /api/events/:id/register`, `GET /api/events/user/registrations`
- `GET /api/jobs`, `GET /api/jobs/:id`, `POST /api/jobs`, `POST /api/jobs/:id/apply`
- `GET /api/donations/campaigns`, `POST /api/donations/campaigns`, `POST /api/donations/donate`
- `GET /api/stories`, `GET /api/stories/:id`, `POST /api/stories`
- `POST /api/mentorships` — request mentorship (`mentorId` + `message`)
- `GET /api/mentorships` — own mentorships (`status`, `role`, `page`, `limit`)
- `GET /api/mentorships/requests/received` / `requests/sent` — pending inbox
- `GET /api/mentorships/status/:userId` — relationship state for the profile CTA
- `GET/PATCH /api/mentorships/:id` — detail (participants only); `accept`/`reject` (mentor), `cancel` (mentee), `complete` (either participant)
- `GET/POST /api/messages/conversations`, `GET /api/messages/conversations/:conversationId` (cursor paginated via `before` + `limit`)
- `POST /api/messages/conversations/:conversationId/read` — mark conversation read (server-persisted)
- `GET /api/messages/unread/count` — total unread messages for the navbar badge
- `GET /api/notifications` - own notifications (`page`, `limit`, `unread=true`)
- `GET /api/notifications/unread/count`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`
- `POST /api/chatbot` — website assistant (auth; per-user rate limit; provider abstraction with optional OpenAI-compatible API via `CHATBOT_API_URL`/`CHATBOT_API_KEY`/`CHATBOT_MODEL`, local knowledge-base fallback)
- `GET/POST /api/groups`, `POST /api/groups/:id/join`, `GET/POST /api/groups/:id/posts`
- Admin (role `admin` required): `/api/admin/stats`, `/api/admin/users`, `/api/admin/events`, `/api/admin/jobs`, `/api/admin/campaigns`

## Socket.IO Events

Real-time messaging runs on Socket.IO with JWT authentication (`auth.token`):

| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `send_message` | client → server | `{ conversationId, recipientId, content }` | Send (participant-checked, server-validated) |
| `message_sent` | server → client | Message | Acknowledgement to the sender |
| `new_message` | server → client | Message | Delivery to the recipient |
| `typing` | both ways | `{ conversationId, isTyping }` | Typing indicator (relayed to the other participant only) |
| `messages_read` | server → client | `{ conversationId, readBy, readAt }` | Read receipt after the recipient marks read |
| `notification` | server > client | `{ id, type, refId, message, createdAt, read }` | Mentorship lifecycle notification (request/accepted/rejected/cancelled/completed) |
| `error` | server → client | `{ message }` | Validation/authorization failures |

Message content is validated server-side (non-empty, ≤ 5000 chars); sender identity is always derived from the JWT; only conversation participants can send, read history, mark read, or receive relays.

## Scripts

| Command | Purpose |
|---|---|
| `npm start` | Start the server |
| `npm run dev` | Start with nodemon (auto-restart) |
| `npm run seed` | Create collections + seed demo data (only when the database is empty) |
| `npm run create-admin` | Create or promote the admin user |
| `npm run test:directory` | Run the directory API test suite (server must be running) |
| `npm run test:mentorship` | Run the mentorship API test suite (server must be running) |
| `npm run test:chat` | Run the chat/messaging test suite, including Socket.IO (server must be running) |
| `npm run test:chatbot` | Run the assistant test suite (server must be running) |
| `npm run test:home` | Run the homepage data API test suite (server must be running) |
| `npm run check-mongodb` | Verify MongoDB connectivity |
