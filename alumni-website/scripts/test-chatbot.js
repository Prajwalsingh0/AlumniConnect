/**
 * test-chatbot.js - Website assistant API test suite
 *
 * Run against a live server (default http://localhost:3000):
 *   npm run test:chatbot
 *
 * Covers authentication, input validation, knowledge-base answers,
 * the fallback reply, the per-user rate limit, and error handling.
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
  const stamp = Date.now().toString(36);

  const user = await api('POST', '/api/auth/register', {
    firstName: 'Curious', lastName: 'Alumni',
    email: `chatbot.user.${stamp}@alumni.dev`, password: 'Chatbot@123',
    graduationYear: '2019', degree: 'B.Tech', major: 'CSE'
  });
  check('setup: user registered', user.status === 201, `got ${user.status}`);
  const t = user.data.token;

  // ── Authentication ─────────────────────────────────────────────────────────
  const noAuth = await api('POST', '/api/chatbot', { message: 'How does mentorship work?' });
  check('chatbot without token -> 401', noAuth.status === 401, `got ${noAuth.status}`);
  const badJwt = await fetch(BASE + '/api/chatbot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer invalid.jwt.token' },
    body: JSON.stringify({ message: 'Hello' })
  });
  check('chatbot with invalid JWT -> 403', badJwt.status === 403, `got ${badJwt.status}`);

  // ── Input validation ───────────────────────────────────────────────────────
  const empty = await api('POST', '/api/chatbot', { message: '' }, t);
  check('empty message -> 400', empty.status === 400, `got ${empty.status}`);
  const whitespace = await api('POST', '/api/chatbot', { message: '    ' }, t);
  check('whitespace message -> 400', whitespace.status === 400, `got ${whitespace.status}`);
  const missing = await api('POST', '/api/chatbot', {}, t);
  check('missing message -> 400', missing.status === 400, `got ${missing.status}`);
  const tooLong = await api('POST', '/api/chatbot', { message: 'x'.repeat(501) }, t);
  check('over-long message -> 400', tooLong.status === 400, `got ${tooLong.status}`);
  const nonString = await api('POST', '/api/chatbot', { message: 42 }, t);
  check('non-string message -> 400', nonString.status === 400, `got ${nonString.status}`);

  // ── Knowledge base answers ─────────────────────────────────────────────────
  const mentorshipQ = await api('POST', '/api/chatbot', { message: 'How does mentorship work?' }, t);
  check('mentorship question -> 200', mentorshipQ.status === 200, `got ${mentorshipQ.status}`);
  check('mentorship answer mentions mentorship', mentorshipQ.status === 200
    && /mentor/i.test(mentorshipQ.data.reply), mentorshipQ.data.reply ? '' : 'no reply');
  check('reply is a non-empty string', typeof mentorshipQ.data.reply === 'string'
    && mentorshipQ.data.reply.length > 10, JSON.stringify(mentorshipQ.data.reply).substring(0, 60));

  const directoryQ = await api('POST', '/api/chatbot', { message: 'How do I find alumni?' }, t);
  check('directory question mentions directory', directoryQ.status === 200
    && /directory/i.test(directoryQ.data.reply), (directoryQ.data.reply || '').substring(0, 60));

  const chatQ = await api('POST', '/api/chatbot', { message: 'How do I use chat?' }, t);
  check('chat question mentions chat', chatQ.status === 200
    && /chat/i.test(chatQ.data.reply), (chatQ.data.reply || '').substring(0, 60));

  const greeting = await api('POST', '/api/chatbot', { message: 'hello' }, t);
  check('greeting answered', greeting.status === 200 && greeting.data.reply.length > 10,
    (greeting.data.reply || '').substring(0, 60));

  const caseInsensitive = await api('POST', '/api/chatbot', { message: 'HOW DOES MENTORSHIP WORK?' }, t);
  check('uppercase question still matches', caseInsensitive.status === 200
    && /mentor/i.test(caseInsensitive.data.reply), (caseInsensitive.data.reply || '').substring(0, 60));

  // ── Fallback for unknown topics ────────────────────────────────────────────
  const fallback = await api('POST', '/api/chatbot', { message: 'What is the capital of France?' }, t);
  check('off-topic question -> polite fallback', fallback.status === 200
    && /AlumniConnect/i.test(fallback.data.reply), (fallback.data.reply || '').substring(0, 80));

  // ── Per-user rate limiting (fresh user, isolated bucket) ───────────────────
  const throttled = await api('POST', '/api/auth/register', {
    firstName: 'Speedy', lastName: 'Asker',
    email: `chatbot.speedy.${stamp}@alumni.dev`, password: 'Chatbot@123',
    graduationYear: '2020', degree: 'B.Tech', major: 'CSE'
  });
  const tSpeedy = throttled.data.token;
  check('setup: throttle user registered', throttled.status === 201, `got ${throttled.status}`);

  let sawOk = 0, sawLimited = 0;
  for (let i = 0; i < 22; i++) {
    const r = await api('POST', '/api/chatbot', { message: `Question number ${i} about the platform` }, tSpeedy);
    if (r.status === 200) sawOk++;
    else if (r.status === 429) sawLimited++;
    else {
      check('rate-limit window has only 200/429', false, `unexpected ${r.status} on request ${i + 1}`);
      break;
    }
  }
  check('rate limit: first 20 requests succeed', sawOk === 20, `ok ${sawOk}`);
  check('rate limit: requests beyond 20 -> 429', sawLimited >= 1, `limited ${sawLimited}`);

  console.log('\n=========================================');
  console.log(`CHATBOT RESULTS: ${pass} passed, ${fail} failed`);
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
