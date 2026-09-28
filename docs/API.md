# API Reference

Developer documentation for the AlumniConnect backend. Everything lives under
`/api` and is served by `alumni-website/server.js`.

Authentication uses JWT bearer tokens: send `Authorization: Bearer <token>`.
Endpoints marked **auth** need a valid token, **admin** additionally needs
`role: 'admin'`.

## Auth

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` | Creates an account. With SMTP configured, the account must verify its email before signing in. |
| POST | `/api/auth/login` | Returns the token. Rate limited per IP and per account. |
| POST | `/api/auth/logout` | Client-side session cleanup. |
| GET | `/api/auth/me` | The signed-in account. |
| POST | `/api/auth/forgot-password` / `POST /api/auth/reset-password` | Reset flow. Rate limited. |
| GET | `/api/auth/verify-email` / `POST /api/auth/resend-verification` | Email verification. |

## Profile and directory

| Method | Path | Notes |
|---|---|---|
| GET / PUT | `/api/users/profile` | Own profile. |
| POST | `/api/users/profile/image` | Avatar upload (multipart, image validated). |
| PUT | `/api/users/password` | Change password. |
| GET | `/api/users/public/:userId` | Someone else's profile (respects privacy settings). |
| GET | `/api/users/directory` | Paginated listing: `page`, `limit` ≤ 48, `q`, `graduationYear`, `department`, `degree`, `location`, `mentorship=available`, `sort` = `name_asc`/`name_desc`/`newest`/`grad_year`. |
| GET | `/api/users/directory/facets` | Distinct filter values from real data. |
| GET | `/api/users/search` | Quick search. |
| POST | `/api/users/skills/:skillName/endorse` | Endorse a skill (once per member). |
| DELETE | `/api/users/me` | Delete your own account: password plus a typed `DELETE`. The account is anonymised (name becomes "Former Member"), personal data is cleared, own job posts close, open mentorships cancel, and every existing token stops working. The email address is released. |
| GET / PUT | `/api/users/notification-preferences` | Per-type opt-outs: `mentorship`, `messages`, `reviews`, `reminders`, `digests`. |
| GET | `/api/users/digest/preview` | The content the next digest email would carry, without sending. |

## Notifications

| Method | Path | Notes |
|---|---|---|
| GET | `/api/notifications` | Own notifications: `page`, `limit`, `unread=true`. |
| GET | `/api/notifications/unread/count` | Badge count. |
| POST | `/api/notifications/:id/read`, `POST /api/notifications/read-all` | Mark read. |

Notification preferences are enforced in `services/notificationService.js`, the
single place every notification is created. Only an explicit opt-out suppresses
one, and a lookup failure lets it through.

Types: `mentorship_*`, `mentorship_session_*`, `message`, `review`, `event_reminder`.

## Events

| Method | Path | Notes |
|---|---|---|
| GET | `/api/events`, `GET /api/events/:id` | Published and completed events. |
| POST / DELETE | `/api/events/:id/register` | Sign up or withdraw. |
| GET | `/api/events/user/registrations` | Own registrations, newest signup first, with `registeredAt`. |

Registered attendees receive a reminder the day before a published event starts
(`services/reminderService.js`, checked every 15 minutes). Each event is claimed
with a conditional update, so overlapping runs cannot double-send. Opt out with
the `reminders` preference.

## Mentorship

| Method | Path | Notes |
|---|---|---|
| POST | `/api/mentorships` | Request mentorship (`mentorId` + `message`). |
| GET | `/api/mentorships` | Own mentorships: `status`, `role`, `page`, `limit`. |
| GET | `/api/mentorships/requests/received` / `requests/sent` | Pending inbox. |
| GET | `/api/mentorships/status/:userId` | Relationship state, used by the profile button. |
| GET / PATCH | `/api/mentorships/:id` | Detail, participants only. |
| PATCH | `/api/mentorships/:id/accept` / `reject` | Mentor only. |
| PATCH | `/api/mentorships/:id/cancel` / `complete` | Participant. |

Non-participants get **404** everywhere, so the existence of other people's
mentorships is never revealed.

### Sessions

| Method | Path | Notes |
|---|---|---|
| POST | `/api/sessions` | Propose a session in an accepted mentorship: `scheduledFor` (future), `durationMinutes` 15–480, optional `agenda` (≤300) and `meetingLink` (http/https). |
| GET | `/api/sessions/mine` | Own sessions, soonest first, with `scope=upcoming` or `past`. |
| GET | `/api/sessions/mentorship/:mentorshipId` | Sessions of one mentorship. |
| PATCH | `/api/sessions/:id/confirm` / `decline` | The other participant only. |
| PATCH | `/api/sessions/:id/cancel` | Either participant while it is ahead. |

A mentorship holds at most ten upcoming sessions.

### Reviews

| Method | Path | Notes |
|---|---|---|
| POST | `/api/reviews` | Review the other participant of a completed mentorship (rating 1–5, optional comment). |
| GET | `/api/reviews/mine` | Own reviews. |
| GET | `/api/reviews/user/:userId` | Public rating summary and latest reviews. |

## Chat and messages

| Method | Path | Notes |
|---|---|---|
| GET / POST | `/api/messages/conversations` | List or open a conversation. |
| GET | `/api/messages/conversations/:conversationId` | History, cursor paginated (`before`, `limit`). |
| POST | `/api/messages/conversations/:conversationId/read` | Mark read (server-persisted). |
| GET | `/api/messages/unread/count` | Navbar badge. |
| DELETE | `/api/messages/:messageId` | Delete a message for yourself only; the other participant keeps their copy. |

### Socket.IO

JWT authenticated through `auth.token`.

| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `send_message` | client → server | `{ conversationId, recipientId, content }` | Send (participant-checked). |
| `message_sent` | server → client | Message | Acknowledgement to the sender. |
| `new_message` | server → client | Message | Delivery to the recipient. |
| `typing` | both ways | `{ conversationId, isTyping }` | Relay to the other participant. |
| `messages_read` | server → client | `{ conversationId, readBy, readAt }` | Read receipt. |
| `notification` | server → client | `{ id, type, refId, message, createdAt, read }` | Live notification. |
| `error` | server → client | `{ message }` | Validation or authorisation failure. |

Message content is validated server-side (non-empty, ≤ 5000 characters), the
sender is always taken from the JWT, and only participants can read, send, mark
read or receive relays.

## Groups

| Method | Path | Notes |
|---|---|---|
| GET / POST | `/api/groups` | List or create. Private groups never appear in the public listing and are only listed to their members. |
| POST | `/api/groups/:id/join` / `leave` | Membership. The creator cannot leave - delete instead. |
| PATCH / DELETE | `/api/groups/:id` | Owner or group admin. Deleting removes the discussions. |
| GET / POST | `/api/groups/:id/posts` | Discussions. A private group's posts are 404 for outsiders. |
| DELETE | `/api/groups/:id/posts/:postId` | The author, or owner/admin. |
| PATCH | `/api/groups/:id/posts/:postId/pin` | Owner or group admin. |

Bodies are whitelisted field by field, so a client cannot set `members`, roles,
`createdBy`, `isPinned`, `likes` or the author.

## Jobs

| Method | Path | Notes |
|---|---|---|
| GET | `/api/jobs`, `GET /api/jobs/:id` | Job board. |
| POST | `/api/jobs` | Post a job (nested payload). |
| POST | `/api/jobs/:id/apply` | Apply. |
| GET | `/api/jobs/mine` | Own postings in any status. |
| PATCH | `/api/jobs/:id/status` | Owner or admin: `published` / `closed`. |
| DELETE | `/api/jobs/:id` | Owner or admin. |

## Donations

| Method | Path | Notes |
|---|---|---|
| GET | `/api/donations/campaigns` | Campaign list. |
| POST | `/api/donations/campaigns` | Create a campaign. |
| POST | `/api/donations/donate` | Record a donation. |
| GET | `/api/donations/mine` | Own donation history with the total given. |

## Stories

| Method | Path | Notes |
|---|---|---|
| GET | `/api/stories`, `GET /api/stories/:id` | Published stories. |
| POST | `/api/stories` | Submit a story (consent required). |
| DELETE | `/api/stories/:id` | Author or admin. |

## Assistant

| Method | Path | Notes |
|---|---|---|
| POST | `/api/chatbot` | Website assistant. Auth required, per-user rate limit. Provider abstraction with an optional OpenAI-compatible API (`CHATBOT_API_URL`, `CHATBOT_API_KEY`, `CHATBOT_MODEL`) and a local knowledge-base fallback. |

## Admin

The Admin Panel link only appears for accounts with `role: 'admin'`, and every
route below enforces it server-side. Visiting `admin.html` without an admin
session redirects to `admin-login.html`.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/stats` | Dashboard totals. |
| GET | `/api/admin/users` | Members: `page`, `limit`, `search`, `role`, `status`. |
| PATCH | `/api/admin/users/:id/role` / `ban` | Role changes and activation. |
| DELETE | `/api/admin/users/:id` | Remove an account. |
| GET / POST / PUT / PATCH / DELETE | `/api/admin/events…`, `/api/admin/jobs…`, `/api/admin/campaigns…` | Content management. |
| GET | `/api/admin/mentorships` | Every mentorship with both participants: `page`, `limit`, `search`, `status`. |
| GET | `/api/admin/conversations` | Threads with participants and real message counts. |
| GET | `/api/admin/conversations/:id` | Read one thread. **Writes an audit entry.** |
| GET | `/api/admin/audit-log` | Recent moderation access, newest first. |

## Background work

| Job | File | Cadence |
|---|---|---|
| Event reminders | `services/reminderService.js` | Every 15 minutes; reminds about events starting within 24 hours. |
| Email digests | `services/digestService.js` | Daily check; each member is digested at most once every 7 days. |

Both run in-process, matching the single-process rate limiter. A multi-instance
deployment should move them to a worker with a shared lock. Both are best
effort: a failure is logged and retried on the next tick, and neither throws
into server startup.

## Test suites

Each suite needs a running server and a seeded database, and cleans up the data
it creates.

| Command | Covers |
|---|---|
| `npm run test:directory` | Directory listing, filters, facets, privacy. |
| `npm run test:mentorship` | Mentorship lifecycle and authorisation. |
| `npm run test:chat` | Messaging and Socket.IO, including delivery and read receipts. |
| `npm run test:chatbot` | The assistant endpoint and its fallbacks. |
| `npm run test:home` | Homepage data. |
| `npm run check-mongodb` | Connectivity check. |
