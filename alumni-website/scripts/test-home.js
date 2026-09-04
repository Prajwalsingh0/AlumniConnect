/**
 * test-home.js - Homepage data API test suite
 *
 * Run against a live server (default http://localhost:3000):
 *   npm run test:home
 *
 * Verifies the public GET /api/home contract: shape, live counts,
 * upcoming events, latest stories with authors, featured alumni without
 * any private fields.
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';

let pass = 0;
let fail = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    pass++;
    console.log(`PASS  ${name}`);
  } else {
    fail++;
    failures.push(`${name} :: ${detail}`);
    console.log(`FAIL  ${name}  :: ${detail}`);
  }
}

async function api(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, data };
}

async function main() {
  // ── Public access ───────────────────────────────────────────────────────────
  const home = await api('GET', '/api/home');
  check('home data loads without auth -> 200', home.status === 200, `got ${home.status}`);

  if (home.status !== 200) { finish(); return; }

  // ── Shape ───────────────────────────────────────────────────────────────────
  check('stats object with integer counts', home.data.stats
    && Number.isInteger(home.data.stats.members)
    && Number.isInteger(home.data.stats.jobs)
    && Number.isInteger(home.data.stats.stories)
    && Number.isInteger(home.data.stats.upcomingEvents), JSON.stringify(home.data.stats));
  check('upcomingEvents is an array (max 3)', Array.isArray(home.data.upcomingEvents)
    && home.data.upcomingEvents.length <= 3, `count ${home.data.upcomingEvents.length}`);
  check('latestStories is an array (max 3)', Array.isArray(home.data.latestStories)
    && home.data.latestStories.length <= 3, `count ${home.data.latestStories.length}`);
  check('featuredAlumni is an array (max 4)', Array.isArray(home.data.featuredAlumni)
    && home.data.featuredAlumni.length <= 4, `count ${home.data.featuredAlumni.length}`);

  // ── Content sanity (seeded data present on a fresh DB) ─────────────────────
  const serialized = JSON.stringify(home.data);

  check('upcoming events have title + date', home.data.upcomingEvents.length === 0
    || home.data.upcomingEvents.every(e => e.title && e.date), 'missing fields');

  check('latest stories have title + excerpt + author name', home.data.latestStories.length === 0
    || home.data.latestStories.every(s => s.title && s.excerpt && s.author && s.author.name), 'missing fields');

  check('featured alumni have name + title', home.data.featuredAlumni.length === 0
    || home.data.featuredAlumni.every(u => u.name && u.profile === undefined && u.title !== undefined), 'missing fields');

  // ── Security: no private fields anywhere ────────────────────────────────────
  check('no password field', !serialized.includes('"password"'), 'password leaked');
  check('no email field', !serialized.includes('"email"'), 'email leaked');
  check('no reset/verification tokens', !serialized.includes('passwordResetToken')
    && !serialized.includes('emailVerificationToken'), 'token leaked');
  check('no mongoose internals', !serialized.includes('"__v"'), '__v leaked');

  // ── Wrong method -> 404 (SPA fallback returns JSON for /api) ────────────────
  const wrongMethod = await api('DELETE', '/api/home');
  check('DELETE /api/home -> 404', wrongMethod.status === 404, `got ${wrongMethod.status}`);

  console.log('\n=========================================');
  console.log(`HOME RESULTS: ${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(` - ${f}`));
  }
  process.exit(fail ? 1 : 0);
}

function finish() {
  console.log('\n=========================================');
  console.log(`HOME RESULTS: ${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(` - ${f}`));
  }
  process.exit(fail ? 1 : 0);
}

main().catch(e => {
  console.error('SUITE ERROR:', e.message);
  process.exit(1);
});
