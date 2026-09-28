# AlumniConnect

A home for a university's alumni and students — a place to find each other, mentor,
chat, join groups, attend events, share stories and give back.

It runs as a single website: a public side for everyone, member features once you
sign in, and a separate admin area for running the network.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-3c873a)
![MongoDB](https://img.shields.io/badge/Database-MongoDB-4faa41)

---

## What you can do

**As a visitor**

- Browse the landing page, upcoming events, the job board, campaigns and alumni stories
- Ask the little assistant in the corner how anything works

**As a member**

- Build a profile — experience, education, skills, privacy settings — and appear in the directory
- Search the directory by year, department, degree, location or mentoring availability
- Chat with other alumni in real time, with typing indicators and read receipts
- Join groups, start discussions, and keep private groups off the public list
- Request a mentor, manage your mentorships, and schedule sessions with confirmed times
- Leave reviews for mentors or mentees once a mentorship is complete
- Register for events (with a reminder the day before) and post jobs
- Support campaigns and see your own giving history
- Get notified in-app, choose exactly which alerts you want, and switch the weekly email digest on or off

**As an admin**

- Manage members, events, jobs and campaigns
- See moderation views for mentorships and chat threads — and every look at a
  thread is written to an audit log

---

## Quick start

You need **Node.js 18+** and a **MongoDB** instance (local or Atlas).

```bash
cd alumni-website
npm install

# Windows
copy .env.example .env
# macOS / Linux
cp .env.example .env

npm run seed                  # creates collections and seeds demo data (only when the database is empty)
npm start                     # http://localhost:3000
```

**Want an admin account?** Create one (or promote an existing account) with:

```bash
npm run create-admin
```

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` first. The Admin Panel link only
shows up for accounts whose role is `admin`; visiting `admin.html` without an
admin session sends you to the admin login.

---

## Configuration

All settings live in `alumni-website/.env` — see `.env.example` for the full list.

| Setting | What it's for |
|---|---|
| `PORT` | Which port the site runs on (default 3000) |
| `MONGODB_URI` | Your database connection string |
| `JWT_SECRET` / `JWT_EXPIRE` | Signs sign-in tokens; change the secret for any real deployment |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Used by `npm run create-admin` |
| `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_USER` / `EMAIL_PASSWORD` | Optional. Needed for verification emails, password resets, event reminders and digests |
| `FRONTEND_URL` | Base URL used inside emailed links |
| `CHATBOT_API_URL` / `CHATBOT_API_KEY` / `CHATBOT_MODEL` | Optional. Use a hosted AI model for the assistant instead of the built-in knowledge base |

**Email is optional.** Without it the site works fine — accounts are verified
automatically so nobody gets locked out, and reminders and digests simply don't
send.

---

## The pages

| Page | What it's for |
|---|---|
| `index.html` | Landing page with live network activity |
| `portal.html` | Sign in, register, reset a password |
| `alumni.html` | Alumni directory with filters |
| `profile.html` / `edit-profile.html` | Your profile, and editing it |
| `mentorship.html` | Requests, active mentorships, sessions, chat |
| `chat.html` | Real-time conversations |
| `groups.html` | Groups and their discussions |
| `events.html` | Events and registration |
| `jobs.html` | Job board and applications |
| `donations.html` | Campaigns and giving history |
| `stories.html` | Alumni stories and submissions |
| `about.html` | Mission, gallery, news |
| `admin.html` / `admin-login.html` | Admin panel and its sign-in |
| *(floating widget)* | The assistant, on every page |

---

## For developers

- **Backend:** Node.js, Express, Mongoose (MongoDB), Socket.IO
- **Frontend:** static HTML, Tailwind (CDN) and plain JavaScript, served by Express
- **Auth:** JWT bearer tokens, bcrypt password hashing, and in-memory rate limits
  on sign-in, registration, password reset and email verification
- **Docs:** see [docs/API.md](docs/API.md) for the full endpoint reference, the
  Socket.IO events and the data rules

### Handy commands

| Command | What it does |
|---|---|
| `npm start` | Start the server |
| `npm run dev` | Start with auto-restart |
| `npm run seed` | Create collections and seed demo data |
| `npm run create-admin` | Create or promote an admin |
| `npm run check-mongodb` | Check the database connection |
| `npm run test:directory` / `test:mentorship` / `test:chat` / `test:chatbot` / `test:home` | Run a test suite (server and seeded database required) |

### Project layout

```
AlumniConnect/
├── alumni-website/
│   ├── config/       database connection
│   ├── middleware/   auth, uploads, rate limiting
│   ├── models/       Mongoose schemas
│   ├── routes/       API endpoints
│   ├── services/     email, notifications, reminders, digests, assistant
│   ├── scripts/      seed, admin creation, test suites
│   └── public/       the website itself
└── docs/             developer documentation
```
