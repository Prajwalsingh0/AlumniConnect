/**
 * test-chat.js - Chat / messaging API test suite
 *
 * Run against a live server (default http://localhost:3000):
 *   npm run test:chat
 *
 * Covers REST contracts (conversations, pagination, read/unread, security)
 * and Socket.IO behavior (auth, delivery, validation, typing relay) using
 * Node's built-in fetch. Socket.IO client is loaded from the server itself
 * via the socket.io package installed with the project.
 */

const path = require('path');
const { io } = require(path.join(__dirname, '..', 'node_modules', 'socket.io-client'));

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

// Connect a socket with the given token; resolves when connected or errors.
function connectSocket(token) {
  return new Promise((resolve) => {
    const socket = io(BASE, { auth: { token }, transports: ['websocket'], reconnection: false });
    socket.on('connect', () => resolve({ socket, error: null }));
    socket.on('connect_error', (err) => {
      socket.close();
      resolve({ socket: null, error: err });
    });
    setTimeout(() => resolve({ socket: socket.connected ? socket : null, error: socket.connected ? null : new Error('timeout') }), 5000);
  });
}

// Wait for a specific event on a socket (with timeout)
function waitFor(socket, event, timeout = 4000, filter = () => true) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(null);
    }, timeout);
    const handler = (payload) => {
      if (filter(payload)) {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(payload);
      }
    };
    socket.on(event, handler);
  });
}

async function main() {
  const stamp = Date.now().toString(36);

  // ── Setup: two users ────────────────────────────────────────────────────────
  const alice = await api('POST', '/api/auth/register', {
    firstName: 'Alice', lastName: 'Chatter',
    email: `chat.alice.${stamp}@alumni.dev`, password: 'ChatTest@123',
    graduationYear: '2018', degree: 'B.Tech', major: 'CSE'
  });
  const bob = await api('POST', '/api/auth/register', {
    firstName: 'Bob', lastName: 'Responder',
    email: `chat.bob.${stamp}@alumni.dev`, password: 'ChatTest@123',
    graduationYear: '2017', degree: 'B.Tech', major: 'ECE'
  });
  const eve = await api('POST', '/api/auth/register', {
    firstName: 'Eve', lastName: 'Outsider',
    email: `chat.eve.${stamp}@alumni.dev`, password: 'ChatTest@123',
    graduationYear: '2016', degree: 'B.Tech', major: 'ME'
  });
  check('setup: three users registered', [alice, bob, eve].every(u => u.status === 201), 'registration failed');
  const tA = alice.data.token, tB = bob.data.token, tE = eve.data.token;
  const aliceId = alice.data.user._id, bobId = bob.data.user._id;

  // ── REST: authentication ────────────────────────────────────────────────────
  const noAuth = await api('GET', '/api/messages/conversations');
  check('conversations without token -> 401', noAuth.status === 401, `got ${noAuth.status}`);
  const badJwt = await fetch(BASE + '/api/messages/conversations', {
    headers: { Authorization: 'Bearer not.a.real.jwt' }
  });
  check('conversations with invalid JWT -> 403', badJwt.status === 403, `got ${badJwt.status}`);

  // ── REST: create/open conversation ─────────────────────────────────────────
  const invalidRecipient = await api('POST', '/api/messages/conversations', { recipientId: 'bad-id' }, tA);
  check('invalid recipient id -> 400', invalidRecipient.status === 400, `got ${invalidRecipient.status}`);
  const selfConversation = await api('POST', '/api/messages/conversations', { recipientId: aliceId }, tA);
  check('self conversation -> 400', selfConversation.status === 400, `got ${selfConversation.status}`);
  const ghostRecipient = await api('POST', '/api/messages/conversations', {
    recipientId: '5f8d0d55b54764421e3c9999', message: 'x'
  }, tA);
  check('nonexistent recipient -> 404', ghostRecipient.status === 404, `got ${ghostRecipient.status}`);

  const conv1 = await api('POST', '/api/messages/conversations', { recipientId: bobId }, tA);
  check('create conversation -> 200', conv1.status === 200 && conv1.data._id, `got ${conv1.status}`);
  const conv1Id = conv1.data._id;

  const conv1Again = await api('POST', '/api/messages/conversations', { recipientId: aliceId }, tB);
  check('duplicate conversation prevented (same _id)', conv1Again.status === 200
    && conv1Again.data._id === conv1Id, `${conv1Again.data._id} vs ${conv1Id}`);
  const conv1FromBob = await api('POST', '/api/messages/conversations', { recipientId: bobId }, tA);
  check('re-open conversation prevented (same _id)', conv1FromBob.status === 200
    && conv1FromBob.data._id === conv1Id, `${conv1FromBob.data._id} vs ${conv1Id}`);

  // ── REST: conversation list + isolation ─────────────────────────────────────
  const listA = await api('GET', '/api/messages/conversations', null, tA);
  check('conversation list includes my conversation', listA.status === 200
    && listA.data.some(c => c._id === conv1Id), `count ${listA.data.length}`);
  const listE = await api('GET', '/api/messages/conversations', null, tE);
  check('outsider list excludes the conversation', listE.status === 200
    && !listE.data.some(c => c._id === conv1Id), `count ${listE.data.length}`);

  // ── REST: messages pagination (empty) ───────────────────────────────────────
  const emptyHistory = await api('GET', `/api/messages/conversations/${conv1Id}?limit=30`, null, tA);
  check('empty history returns empty page', emptyHistory.status === 200
    && emptyHistory.data.messages.length === 0
    && emptyHistory.data.pagination.hasMore === false, JSON.stringify(emptyHistory.data.pagination));
  const historyOutsider = await api('GET', `/api/messages/conversations/${conv1Id}`, null, tE);
  check('outsider history access -> 404', historyOutsider.status === 404, `got ${historyOutsider.status}`);
  const historyBadId = await api('GET', '/api/messages/conversations/xyz', null, tA);
  check('history invalid id -> 400', historyBadId.status === 400, `got ${historyBadId.status}`);
  const badLimit = await api('GET', `/api/messages/conversations/${conv1Id}?limit=999`, null, tA);
  check('history limit above max -> 400', badLimit.status === 400, `got ${badLimit.status}`);

  // ── Socket.IO: auth ─────────────────────────────────────────────────────────
  const badSocket = await connectSocket('garbage-token');
  check('socket rejects invalid token', badSocket.socket === null
    && /Authentication/.test(badSocket.error ? badSocket.error.message : ''), 'connected anyway');

  const socketA = await connectSocket(tA);
  check('socket connects with valid JWT', !!socketA.socket, 'connect failed');
  const socketB = await connectSocket(tB);
  check('second participant connects', !!socketB.socket, 'connect failed');
  if (!socketA.socket || !socketB.socket) { finish(); return; }

  // ── Socket.IO: send / delivery / ack ────────────────────────────────────────
  const ackPromise = waitFor(socketA.socket, 'message_sent');
  const deliveryPromise = waitFor(socketB.socket, 'new_message');
  socketA.socket.emit('send_message', { conversationId: conv1Id, recipientId: bobId, content: 'Hi Bob! This is the chat test.' });
  const ack = await ackPromise;
  check('sender receives message_sent acknowledgement', !!ack && ack.content === 'Hi Bob! This is the chat test.', JSON.stringify(ack || {}).substring(0, 80));
  const delivered = await deliveryPromise;
  check('recipient receives new_message', !!delivered && delivered.content === 'Hi Bob! This is the chat test.', 'no delivery');

  // Exactly one stored message per send (no duplicates server-side)
  const historyAfterOne = await api('GET', `/api/messages/conversations/${conv1Id}?limit=30`, null, tA);
  check('exactly one stored message after one send', historyAfterOne.status === 200
    && historyAfterOne.data.messages.length === 1, `count ${historyAfterOne.data.messages.length}`);

  // ── Socket.IO: validation & security ────────────────────────────────────────
  socketA.socket.emit('send_message', { conversationId: conv1Id, recipientId: bobId, content: '   ' });
  const emptyErr = await waitFor(socketA.socket, 'error', 3000);
  check('whitespace-only message rejected', !!emptyErr && /empty/i.test(emptyErr.message), JSON.stringify(emptyErr || {}).substring(0, 80));

  socketA.socket.emit('send_message', { conversationId: conv1Id, recipientId: bobId, content: '' });
  const emptyErr2 = await waitFor(socketA.socket, 'error', 3000);
  check('empty message rejected', !!emptyErr2, 'no error event');

  socketA.socket.emit('send_message', { conversationId: conv1Id, recipientId: bobId, content: 'x'.repeat(5001) });
  const tooLongErr = await waitFor(socketA.socket, 'error', 3000);
  check('oversized message rejected', !!tooLongErr && /5000/.test(tooLongErr.message), JSON.stringify(tooLongErr || {}).substring(0, 80));

  const eveSocket = await connectSocket(tE);
  check('outsider socket connects (auth is user-level)', !!eveSocket.socket, 'unexpected connect failure');
  if (eveSocket.socket) {
    eveSocket.socket.emit('send_message', { conversationId: conv1Id, recipientId: bobId, content: 'Outsider intrusion attempt' });
    const intrudeErr = await waitFor(eveSocket.socket, 'error', 3000);
    check('outsider send to foreign conversation rejected', !!intrudeErr
      && /participant/i.test(intrudeErr.message), JSON.stringify(intrudeErr || {}).substring(0, 80));

    // Sender spoofing: the server derives the sender from the JWT
    const bobSees = await api('GET', `/api/messages/conversations/${conv1Id}?limit=30`, null, tB);
    check('sender id derived from JWT (no spoofing)', bobSees.status === 200
      && bobSees.data.messages.every(m => m.sender._id === aliceId), 'spoofed sender found');
    eveSocket.socket.close();
  }

  // ── Unread / read persistence ───────────────────────────────────────────────
  const unreadBefore = await api('GET', '/api/messages/unread/count', null, tB);
  check('bob has unread count >= 1', unreadBefore.status === 200 && unreadBefore.data.count >= 1,
    `got ${unreadBefore.data.count}`);

  const marked = await api('POST', `/api/messages/conversations/${conv1Id}/read`, null, tB);
  check('mark read -> success', marked.status === 200 && marked.data.modifiedCount >= 1,
    JSON.stringify(marked.data || {}).substring(0, 80));

  const unreadAfter = await api('GET', '/api/messages/unread/count', null, tB);
  check('unread count resets after read', unreadAfter.status === 200 && unreadAfter.data.count === 0,
    `got ${unreadAfter.data.count}`);

  const unreadStill = await api('GET', '/api/messages/unread/count', null, tB);
  check('read state persists server-side', unreadStill.status === 200 && unreadStill.data.count === 0,
    `got ${unreadStill.data.count}`);

  const readOutsider = await api('POST', `/api/messages/conversations/${conv1Id}/read`, null, tE);
  check('outsider mark-read -> 404', readOutsider.status === 404, `got ${readOutsider.status}`);

  // ── Socket.IO: messages_read receipt ────────────────────────────────────────
  socketA.socket.emit('send_message', { conversationId: conv1Id, recipientId: bobId, content: 'Second message for receipt test' });
  await waitFor(socketA.socket, 'message_sent');
  const receiptPromise = waitFor(socketA.socket, 'messages_read', 4000);
  const marked2 = await api('POST', `/api/messages/conversations/${conv1Id}/read`, null, tB);
  check('second mark read ok', marked2.status === 200, `got ${marked2.status}`);
  const receipt = await receiptPromise;
  check('messages_read receipt delivered to sender', !!receipt && receipt.conversationId === conv1Id,
    JSON.stringify(receipt || {}).substring(0, 80));

  // ── Socket.IO: typing relay ─────────────────────────────────────────────────
  const typingPromise = waitFor(socketB.socket, 'typing', 4000);
  socketA.socket.emit('typing', { conversationId: conv1Id, isTyping: true });
  const typing = await typingPromise;
  check('typing indicator relayed to other participant', !!typing
    && typing.conversationId === conv1Id && typing.isTyping === true, JSON.stringify(typing || {}).substring(0, 80));

  const typingOutsider = await connectSocket(tE);
  if (typingOutsider.socket) {
    const noLeakPromise = waitFor(socketB.socket, 'typing', 2500, (p) => p && p.userId !== aliceId);
    typingOutsider.socket.emit('typing', { conversationId: conv1Id, isTyping: true });
    const leaked = await noLeakPromise;
    check('outsider typing not relayed to participants', leaked === null, 'typing leaked from outsider');
    typingOutsider.socket.close();
  }

  // ── Pagination: send several, page through ──────────────────────────────────
  socketA.socket.emit('send_message', { conversationId: conv1Id, recipientId: bobId, content: 'Page test 1' });
  await waitFor(socketA.socket, 'message_sent');
  socketA.socket.emit('send_message', { conversationId: conv1Id, recipientId: bobId, content: 'Page test 2' });
  await waitFor(socketA.socket, 'message_sent');
  socketA.socket.emit('send_message', { conversationId: conv1Id, recipientId: bobId, content: 'Page test 3' });
  await waitFor(socketA.socket, 'message_sent');

  const page1 = await api('GET', `/api/messages/conversations/${conv1Id}?limit=2`, null, tA);
  check('page 1 returns limited messages ascending', page1.status === 200
    && page1.data.messages.length === 2
    && page1.data.messages[0].createdAt <= page1.data.messages[1].createdAt, `count ${page1.data.messages.length}`);
  check('page 1 pagination hasMore + cursor', page1.data.pagination.hasMore === true
    && !!page1.data.pagination.nextBefore, JSON.stringify(page1.data.pagination).substring(0, 80));

  const page2 = await api('GET', `/api/messages/conversations/${conv1Id}?limit=2&before=${encodeURIComponent(page1.data.pagination.nextBefore)}`, null, tA);
  check('page 2 returns older messages', page2.status === 200 && page2.data.messages.length >= 1
    && page2.data.messages.every(m => m.createdAt < page1.data.pagination.nextBefore), `count ${page2.data.messages.length}`);
  const allIds = [...page2.data.messages, ...page1.data.messages].map(m => m._id);
  check('no duplicate messages across pages', new Set(allIds).size === allIds.length, 'duplicates found');

  // ── Cleanup sockets ─────────────────────────────────────────────────────────
  socketA.socket.close();
  socketB.socket.close();

  finish();
}

function finish() {
  console.log('\n=========================================');
  console.log(`CHAT RESULTS: ${pass} passed, ${fail} failed`);
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
