/**
 * test-mentorship.js - Mentorship API test suite
 *
 * Run against a live server (default http://localhost:3000):
 *   npm run test:mentorship
 *
 * Creates its own fresh users, exercises the full mentorship lifecycle
 * (request -> accept/reject/cancel/complete) and every authorization rule.
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

async function register(firstName, lastName, stampSuffix) {
  const r = await api('POST', '/api/auth/register', {
    firstName, lastName,
    email: `mentorship.${lastName.toLowerCase()}.${stampSuffix}@alumni.dev`,
    password: 'Mentorship@123',
    graduationYear: '2019', degree: 'B.Tech', major: 'Computer Science & Engineering',
    currentPosition: 'Software Engineer', company: 'E2E Technologies', location: 'Bengaluru, Karnataka'
  });
  return { status: r.status, token: r.data.token, user: r.data.user };
}

async function main() {
  const stamp = Date.now().toString(36) + Math.floor(Math.random() * 1000);

  // ── Setup users ─────────────────────────────────────────────────────────────
  const mentor1 = await register('Mentor', 'One', stamp + 'a');
  const mentor2 = await register('Mentor', 'Two', stamp + 'b');
  const mentee1 = await register('Mentee', 'One', stamp + 'c');
  const mentee2 = await register('Mentee', 'Two', stamp + 'd');
  const outsider = await register('Outsider', 'One', stamp + 'e');

  check('setup: five users registered', [mentor1, mentor2, mentee1, mentee2, outsider]
    .every(u => u.status === 201 && u.token), 'registration failed');

  const tMentor1 = mentor1.token, tMentor2 = mentor2.token, tMentee1 = mentee1.token, tMentee2 = mentee2.token, tOut = outsider.token;
  const mentor1Id = mentor1.user._id, mentor2Id = mentor2.user._id, mentee1Id = mentee1.user._id;

  // Make mentor1 open to mentorship (directory flag)
  const flag = await api('PUT', '/api/users/profile', { openToMentorship: true }, tMentor1);
  check('setup: openToMentorship saved', flag.status === 200 && flag.data.user.profile.openToMentorship === true,
    `got ${flag.status}`);

  // ── Authentication ──────────────────────────────────────────────────────────
  const noAuth = await api('POST', '/api/mentorships', { mentorId: mentor1Id, message: 'Unauthenticated attempt here' });
  check('create without token -> 401', noAuth.status === 401, `got ${noAuth.status}`);
  const noAuthList = await api('GET', '/api/mentorships');
  check('list without token -> 401', noAuthList.status === 401, `got ${noAuthList.status}`);

  // ── Creation ────────────────────────────────────────────────────────────────
  const invalidId = await api('POST', '/api/mentorships', { mentorId: 'not-a-valid-id', message: 'Valid message here' }, tMentee1);
  check('invalid mentorId -> 400', invalidId.status === 400, `got ${invalidId.status}`);

  const selfRequest = await api('POST', '/api/mentorships', { mentorId: mentee1Id, message: 'Self mentorship attempt' }, tMentee1);
  check('self mentorship -> 400', selfRequest.status === 400, `got ${selfRequest.status}`);

  const noMessage = await api('POST', '/api/mentorships', { mentorId: mentor1Id }, tMentee1);
  check('missing message -> 400', noMessage.status === 400, `got ${noMessage.status}`);

  const shortMessage = await api('POST', '/api/mentorships', { mentorId: mentor1Id, message: 'short' }, tMentee1);
  check('too-short message -> 400', shortMessage.status === 400, `got ${shortMessage.status}`);

  const longMessage = await api('POST', '/api/mentorships', { mentorId: mentor1Id, message: 'x'.repeat(1001) }, tMentee1);
  check('over-long message -> 400', longMessage.status === 400, `got ${longMessage.status}`);

  const nonexistentMentor = await api('POST', '/api/mentorships', {
    mentorId: '5f8d0d55b54764421e3c1234', message: 'Mentor does not exist here'
  }, tMentee1);
  check('nonexistent mentor -> 404', nonexistentMentor.status === 404, `got ${nonexistentMentor.status}`);

  const created = await api('POST', '/api/mentorships', {
    mentorId: mentor1Id, message: 'I would like guidance on backend development.'
  }, tMentee1);
  check('valid request -> 201', created.status === 201, `got ${created.status}`);
  check('created mentorship pending with participants', created.data.mentorship
    && created.data.mentorship.status === 'pending'
    && created.data.mentorship.mentee._id === mentee1Id
    && created.data.mentorship.mentor._id === mentor1Id, JSON.stringify(created.data.mentorship || {}).substring(0, 120));
  const mentorshipId = created.data.mentorship._id;

  const duplicate = await api('POST', '/api/mentorships', {
    mentorId: mentor1Id, message: 'Duplicate pending request attempt here'
  }, tMentee1);
  check('duplicate pending request -> 409', duplicate.status === 409, `got ${duplicate.status}`);

  const reverseDuplicate = await api('POST', '/api/mentorships', {
    mentorId: mentee1Id, message: 'Reverse direction duplicate attempt'
  }, tMentor1);
  check('reverse-direction duplicate -> 409', reverseDuplicate.status === 409, `got ${reverseDuplicate.status}`);

  // ── Received / sent / isolation ─────────────────────────────────────────────
  const received = await api('GET', '/api/mentorships/requests/received', null, tMentor1);
  check('received requests visible to mentor', received.status === 200
    && received.data.mentorships.some(m => m._id === mentorshipId), `count ${received.data.mentorships.length}`);
  const receivedWrong = await api('GET', '/api/mentorships/requests/received', null, tMentor2);
  check('received requests isolated per mentor', receivedWrong.status === 200
    && !receivedWrong.data.mentorships.some(m => m._id === mentorshipId), `count ${receivedWrong.data.mentorships.length}`);

  const sent = await api('GET', '/api/mentorships/requests/sent', null, tMentee1);
  check('sent requests visible to mentee', sent.status === 200
    && sent.data.mentorships.some(m => m._id === mentorshipId), `count ${sent.data.mentorships.length}`);

  const listFiltered = await api('GET', '/api/mentorships?status=pending&role=mentee', null, tMentee1);
  check('status+role filtering works', listFiltered.status === 200
    && listFiltered.data.mentorships.every(m => m.status === 'pending')
    && listFiltered.data.mentorships.some(m => m._id === mentorshipId), `count ${listFiltered.data.mentorships.length}`);

  const badStatus = await api('GET', '/api/mentorships?status=weird', null, tMentee1);
  check('invalid status filter -> 400', badStatus.status === 400, `got ${badStatus.status}`);

  // ── Detail access authorization ─────────────────────────────────────────────
  const detailMentor = await api('GET', `/api/mentorships/${mentorshipId}`, null, tMentor1);
  check('mentor can view detail', detailMentor.status === 200, `got ${detailMentor.status}`);
  const detailMentee = await api('GET', `/api/mentorships/${mentorshipId}`, null, tMentee1);
  check('mentee can view detail', detailMentee.status === 200, `got ${detailMentee.status}`);
  const detailOutsider = await api('GET', `/api/mentorships/${mentorshipId}`, null, tOut);
  check('outsider detail access -> 404 (not leaked)', detailOutsider.status === 404, `got ${detailOutsider.status}`);
  const detailBadId = await api('GET', '/api/mentorships/xyz', null, tMentee1);
  check('invalid detail id -> 400', detailBadId.status === 400, `got ${detailBadId.status}`);

  // ── Accept authorization ────────────────────────────────────────────────────
  const acceptByMentee = await api('PATCH', `/api/mentorships/${mentorshipId}/accept`, null, tMentee1);
  check('mentee cannot accept own request -> 403', acceptByMentee.status === 403, `got ${acceptByMentee.status}`);
  const acceptByOutsider = await api('PATCH', `/api/mentorships/${mentorshipId}/accept`, null, tOut);
  // Intentional: non-participants get 404 so outsider ID probing cannot reveal
  // whether a mentorship exists; 403 is reserved for participants who lack the
  // required role (e.g. the mentee attempting to accept above).
  check('outsider cannot accept -> 404 (existence hidden)', acceptByOutsider.status === 404, `got ${acceptByOutsider.status}`);
  const acceptByMentor = await api('PATCH', `/api/mentorships/${mentorshipId}/accept`, null, tMentor1);
  check('mentor accepts -> 200 accepted', acceptByMentor.status === 200
    && acceptByMentor.data.mentorship.status === 'accepted'
    && !!acceptByMentor.data.mentorship.respondedAt, `got ${acceptByMentor.status}`);
  const acceptAgain = await api('PATCH', `/api/mentorships/${mentorshipId}/accept`, null, tMentor1);
  check('accept non-pending -> 409', acceptAgain.status === 409, `got ${acceptAgain.status}`);

  // A second active mentorship between the same pair must not be created
  // (first one is accepted; both directions blocked)
  const secondBetween = await api('POST', '/api/mentorships', {
    mentorId: mentee1Id, message: 'Second active mentorship attempt here'
  }, tMentor1);
  check('second active between same pair -> 409', secondBetween.status === 409, `got ${secondBetween.status}`);

  // ── Reject flow on a second pair ────────────────────────────────────────────
  const req2 = await api('POST', '/api/mentorships', {
    mentorId: mentor2Id, message: 'Second mentor pair for reject testing'
  }, tMentee2);
  const req2Id = req2.data.mentorship._id;
  check('second pair created', req2.status === 201, `got ${req2.status}`);

  const rejectByMentee = await api('PATCH', `/api/mentorships/${req2Id}/reject`, null, tMentee2);
  check('mentee cannot reject -> 403', rejectByMentee.status === 403, `got ${rejectByMentee.status}`);
  const rejectByMentor = await api('PATCH', `/api/mentorships/${req2Id}/reject`, null, tMentor2);
  check('mentor rejects -> 200 rejected', rejectByMentor.status === 200
    && rejectByMentor.data.mentorship.status === 'rejected', `got ${rejectByMentor.status}`);

  // ── Cancel flow on a third pair ─────────────────────────────────────────────
  const req3 = await api('POST', '/api/mentorships', {
    mentorId: mentor2Id, message: 'Third mentor pair for cancel testing'
  }, tMentee2);
  const req3Id = req3.data.mentorship._id;

  const cancelByMentor = await api('PATCH', `/api/mentorships/${req3Id}/cancel`, null, tMentor2);
  check('mentor cannot cancel -> 403', cancelByMentor.status === 403, `got ${cancelByMentor.status}`);
  const cancelByMentee = await api('PATCH', `/api/mentorships/${req3Id}/cancel`, null, tMentee2);
  check('mentee cancels pending -> 200 cancelled', cancelByMentee.status === 200
    && cancelByMentee.data.mentorship.status === 'cancelled', `got ${cancelByMentee.status}`);

  // ── Complete flow ───────────────────────────────────────────────────────────
  const completeBefore = await api('PATCH', `/api/mentorships/${req3Id}/complete`, null, tMentee2);
  check('complete cancelled -> 409', completeBefore.status === 409, `got ${completeBefore.status}`);
  const completeByMentee = await api('PATCH', `/api/mentorships/${mentorshipId}/complete`, null, tMentee1);
  check('mentee completes active -> 200 completed', completeByMentee.status === 200
    && completeByMentee.data.mentorship.status === 'completed'
    && !!completeByMentee.data.mentorship.completedAt, `got ${completeByMentee.status}`);
  const completeAgain = await api('PATCH', `/api/mentorships/${mentorshipId}/complete`, null, tMentor1);
  check('complete non-active -> 409', completeAgain.status === 409, `got ${completeAgain.status}`);

  // ── Status endpoint (profile button state) ──────────────────────────────────
  const statusPair = await api('POST', '/api/mentorships', {
    mentorId: mentor1Id, message: 'Status endpoint verification request'
  }, tMentee1);
  const statusPending = await api('GET', `/api/mentorships/status/${mentor1Id}`, null, tMentee1);
  check('status pending_sent from mentee side', statusPending.status === 200
    && statusPending.data.status === 'pending' && statusPending.data.direction === 'sent',
    JSON.stringify(statusPending.data));
  const statusMentor = await api('GET', `/api/mentorships/status/${mentee1Id}`, null, tMentor1);
  check('status pending_received from mentor side', statusMentor.status === 200
    && statusMentor.data.status === 'pending' && statusMentor.data.direction === 'received',
    JSON.stringify(statusMentor.data));
  const statusNone = await api('GET', `/api/mentorships/status/${mentor2Id}`, null, tMentee1);
  check('status none when no relationship', statusNone.status === 200
    && statusNone.data.status === 'none', JSON.stringify(statusNone.data));
  const statusBadId = await api('GET', '/api/mentorships/status/badid', null, tMentee1);
  check('status invalid id -> 400', statusBadId.status === 400, `got ${statusBadId.status}`);

  // ── Security: no private fields anywhere ────────────────────────────────────
  const fullJson = JSON.stringify({
    created: created.data, received: received.data, sent: sent.data,
    detail: detailMentor.data, status: statusPending.data
  });
  check('no password in any mentorship response', !fullJson.includes('"password"'), 'password leaked');
  check('no reset/verification tokens', !fullJson.includes('passwordResetToken')
    && !fullJson.includes('emailVerificationToken'), 'token leaked');
  check('no email field in populated participants', !fullJson.includes('"email"'), 'email leaked');

  // ── Malformed body ──────────────────────────────────────────────────────────
  const emptyBody = await api('POST', '/api/mentorships', {}, tMentee1);
  check('empty body -> 400', emptyBody.status === 400, `got ${emptyBody.status}`);

  // ── Directory mentorship filter (integration with Phase 11) ────────────────
  const dirFiltered = await api('GET', '/api/users/directory?mentorship=available', null, tMentee1);
  check('directory mentorship=available filter works', dirFiltered.status === 200
    && dirFiltered.data.users.every(u => u.profile.openToMentorship === true),
    `users ${dirFiltered.data.users.length}`);

  console.log('\n=========================================');
  console.log(`MENTORSHIP RESULTS: ${pass} passed, ${fail} failed`);
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
