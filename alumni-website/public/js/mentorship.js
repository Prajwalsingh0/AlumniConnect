/**
 * Mentorship Dashboard - Page Logic
 * Loads the user's mentorships, groups them into sections, and wires
 * accept/reject/cancel/complete actions plus the socket-backed chat drawer
 * for active mentorships (reusing the existing messaging backend).
 */

const myUserId = () => {
  try {
    const raw = localStorage.getItem('userData') || localStorage.getItem('user');
    const user = raw ? JSON.parse(raw) : null;
    return user ? (user._id || user.id) : null;
  } catch {
    return null;
  }
};

const mentorshipState = { items: [], sessions: [], myReviews: {}, requestId: 0, socket: null, chat: { mentorshipId: null, conversationId: null, recipientId: null } };

document.addEventListener('DOMContentLoaded', function () {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'portal.html#login';
    return;
  }

  document.getElementById('retry-load').addEventListener('click', function () {
    loadMentorships(getToken());
  });
  initChatDrawer();

  loadMentorships(getToken());
  loadMyReviews();
  loadSessions();
});

function getToken() {
  return localStorage.getItem('token');
}

async function api(method, path, body) {
  const response = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await response.json(); } catch { /* non-JSON */ }
  return { status: response.status, data };
}

// ── Load & partition ─────────────────────────────────────────────────────────

async function loadMentorships(token) {
  const loading = document.getElementById('mentorship-loading');
  const content = document.getElementById('mentorship-content');
  const errorBox = document.getElementById('mentorship-error');

  const requestId = ++mentorshipState.requestId;
  loading.classList.remove('hidden');
  content.classList.add('hidden');
  errorBox.classList.add('hidden');

  try {
    const response = await fetch('/api/mentorships?limit=48&sort=updatedAt', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (requestId !== mentorshipState.requestId) return;

    if (response.status === 401 || response.status === 403) {
      clearSession();
      return;
    }
    if (!response.ok) throw new Error('Failed to load mentorships');

    const data = await response.json();
    mentorshipState.items = data.mentorships || [];

    loading.classList.add('hidden');
    renderSections();
    content.classList.remove('hidden');
  } catch (error) {
    if (requestId !== mentorshipState.requestId) return;
    loading.classList.add('hidden');
    errorBox.classList.remove('hidden');
  }
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('userData');
  localStorage.removeItem('user');
  window.location.href = 'portal.html#login';
}

function partition(items) {
  const me = myUserId();
  const received = [], sent = [], active = [], completed = [], past = [];

  items.forEach(function (m) {
    const iAmMentor = m.mentor && m.mentor._id === me;
    if (m.status === 'pending') {
      (iAmMentor ? received : sent).push(m);
    } else if (m.status === 'accepted') {
      active.push(m);
    } else if (m.status === 'completed') {
      completed.push(m);
    } else {
      past.push(m); // rejected / cancelled
    }
  });

  return { received, sent, active, completed, past };
}

// ── Rendering ────────────────────────────────────────────────────────────────

function renderSections() {
  const content = document.getElementById('mentorship-content');
  const groups = partition(mentorshipState.items);

  content.innerHTML = '';

  content.appendChild(renderSection(
    'Requests received', 'fa-inbox',
    'Alumni and students asking you to mentor them.',
    groups.received, renderReceivedCard
  ));
  content.appendChild(renderSection(
    'Requests sent', 'fa-paper-plane',
    'Your mentorship requests waiting for a response.',
    groups.sent, renderSentCard
  ));
  content.appendChild(renderSection(
    'Active mentorships', 'fa-hands-helping',
    'Mentorships currently in progress.',
    groups.active, renderActiveCard
  ));
  content.appendChild(renderSessionSection());
  content.appendChild(renderSection(
    'Completed', 'fa-circle-check',
    'Mentorships you have completed together.',
    groups.completed, renderCompletedCard
  ));
  content.appendChild(renderSection(
    'Declined & cancelled', 'fa-ban',
    'Requests that were rejected or withdrawn.',
    groups.past, renderPastCard
  ));
}

function renderSection(title, icon, description, items, cardRenderer) {
  const section = document.createElement('section');
  section.className = 'bg-white rounded-2xl shadow-lg p-5 md:p-6';

  const heading = document.createElement('div');
  heading.className = 'flex items-center justify-between mb-4';
  heading.innerHTML = `
    <div>
      <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
        <i class="fas ${icon} text-primary-indigo" aria-hidden="true"></i>${title}
        <span class="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">${items.length}</span>
      </h2>
      <p class="text-sm text-gray-500">${description}</p>
    </div>`;
  section.appendChild(heading);

  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'text-sm text-gray-400 py-3';
    empty.textContent = 'Nothing here yet.';
    section.appendChild(empty);
    return section;
  }

  const list = document.createElement('div');
  list.className = 'space-y-4';
  items.forEach(function (m) {
    list.appendChild(cardRenderer(m));
  });
  section.appendChild(list);

  return section;
}

function participantInfo(m, viewerIsMentor) {
  // For received/sent cards the "other" person is the counterparty
  return viewerIsMentor ? m.mentee : m.mentor;
}

function personLine(person) {
  if (!person) return '<p class="text-sm text-gray-400">User</p>';
  const image = (person.profile && (person.profile.profileImageThumbnail || person.profile.profileImage))
    || 'images/singlee person.webp';
  const title = (person.profile && person.profile.title) || '';
  const company = (person.profile && person.profile.company) || '';
  const subtitle = [title, company].filter(Boolean).join(' · ');
  return `
    <div class="flex items-center gap-3">
      <img src="${escapeHtmlAttr(image)}" alt="Profile photo of ${escapeHtml(person.name || 'User')}"
        class="w-11 h-11 rounded-full object-cover border-2 border-indigo-100"
        onerror="this.onerror=null;this.src='images/singlee person.webp'" />
      <div>
        <p class="font-semibold text-gray-900">${escapeHtml((person.name || 'User'))}</p>
        ${subtitle ? `<p class="text-xs text-gray-500">${escapeHtml(subtitle)}</p>` : ''}
      </div>
    </div>`;
}

function requestMessageBlock(m) {
  return `<p class="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mt-3">
    <i class="fas fa-quote-left text-gray-300 mr-1" aria-hidden="true"></i>${escapeHtml(m.message || '')}</p>`;
}

function dateLine(m) {
  const when = m.respondedAt || m.createdAt;
  const label = m.status === 'completed' ? 'Completed' : (m.respondedAt ? 'Responded' : 'Requested');
  return `<span class="text-xs text-gray-400"><i class="far fa-clock mr-1" aria-hidden="true"></i>${label} ${formatDate(when)}</span>`;
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderReceivedCard(m) {
  const card = document.createElement('div');
  card.className = 'border border-gray-100 rounded-xl p-4';
  card.innerHTML = `
    ${personLine(m.mentee)}
    ${requestMessageBlock(m)}
    <div class="flex items-center justify-between mt-3 flex-wrap gap-2">
      ${dateLine(m)}
      <div class="flex gap-2">
        <button type="button" class="px-4 py-1.5 rounded-lg text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition" data-act="reject" data-mid="${escapeHtmlAttr(m._id)}">
          <i class="fas fa-times mr-1" aria-hidden="true"></i>Reject</button>
        <button type="button" class="px-4 py-1.5 rounded-lg text-sm font-semibold bg-primary-indigo text-white hover:bg-primary-dark-blue transition" data-act="accept" data-mid="${escapeHtmlAttr(m._id)}">
          <i class="fas fa-check mr-1" aria-hidden="true"></i>Accept</button>
      </div>
    </div>`;
  return card;
}

function renderSentCard(m) {
  const card = document.createElement('div');
  card.className = 'border border-gray-100 rounded-xl p-4';
  card.innerHTML = `
    ${personLine(m.mentor)}
    ${requestMessageBlock(m)}
    <div class="flex items-center justify-between mt-3 flex-wrap gap-2">
      ${dateLine(m)}
      <button type="button" class="px-4 py-1.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition" data-act="cancel" data-mid="${escapeHtmlAttr(m._id)}">
        <i class="fas fa-ban mr-1" aria-hidden="true"></i>Cancel request</button>
    </div>`;
  return card;
}

function renderActiveCard(m) {
  const me = myUserId();
  const other = (m.mentor && m.mentor._id === me) ? m.mentee : m.mentor;
  const card = document.createElement('div');
  card.className = 'border border-gray-100 rounded-xl p-4';
  card.innerHTML = `
    ${personLine(other)}
    <p class="text-xs text-gray-400 mt-2"><i class="far fa-calendar mr-1" aria-hidden="true"></i>Mentoring since ${formatDate(m.respondedAt || m.createdAt)}</p>
    <div class="flex items-center justify-between mt-3 flex-wrap gap-2">
      <div class="flex gap-2">
        <button type="button" class="px-4 py-1.5 rounded-lg text-sm font-semibold bg-accent-teal text-white hover:bg-teal-600 transition" data-act="chat" data-mid="${escapeHtmlAttr(m._id)}">
          <i class="fas fa-comments mr-1" aria-hidden="true"></i>Open Chat</button>
        <a href="chat.html?to=${encodeURIComponent(other ? other._id : '')}" class="px-4 py-1.5 rounded-lg text-sm font-semibold bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 transition">
          <i class="fas fa-up-right-from-square mr-1" aria-hidden="true"></i>Full Chat</a>
        <button type="button" class="px-4 py-1.5 rounded-lg text-sm font-semibold bg-primary-indigo text-white hover:bg-indigo-700 transition" data-act="schedule" data-mid="${escapeHtmlAttr(m._id)}">
          <i class="fas fa-calendar-plus mr-1" aria-hidden="true"></i>Schedule session</button>
      </div>
      <button type="button" class="px-4 py-1.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition" data-act="complete" data-mid="${escapeHtmlAttr(m._id)}">
        <i class="fas fa-circle-check mr-1" aria-hidden="true"></i>Complete Mentorship</button>
    </div>`;
  return card;
}

function renderCompletedCard(m) {
  const me = myUserId();
  const other = (m.mentor && m.mentor._id === me) ? m.mentee : m.mentor;
  const myReview = mentorshipState.myReviews[m._id];
  const card = document.createElement('div');
  card.className = 'border border-gray-100 rounded-xl p-4 opacity-90';
  card.innerHTML = `
    ${personLine(other)}
    <p class="text-xs text-gray-400 mt-2"><i class="fas fa-circle-check text-green-500 mr-1" aria-hidden="true"></i>Completed ${formatDate(m.completedAt || m.updatedAt)}</p>
    <div class="mt-3 flex items-center justify-between gap-3 flex-wrap">
      ${myReview
        ? `<span class="text-sm text-amber-500 font-semibold" title="Your rating">${'★'.repeat(myReview.rating)}${'☆'.repeat(5 - myReview.rating)}<span class="text-xs text-gray-400 font-normal ml-2">You rated this mentorship</span></span>`
        : '<span class="text-xs text-gray-400">Share how it went to help future mentees.</span>'}
      ${myReview ? '' : '<button type="button" class="px-4 py-1.5 rounded-lg text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition" data-act="review" data-mid="' + escapeHtmlAttr(m._id) + '"><i class="fas fa-star mr-1" aria-hidden="true"></i>Leave a Review</button>'}
    </div>`;
  return card;
}

function renderPastCard(m) {
  const me = myUserId();
  const other = (m.mentor && m.mentor._id === me) ? m.mentee : m.mentor;
  const card = document.createElement('div');
  card.className = 'border border-gray-100 rounded-xl p-4 opacity-75';
  card.innerHTML = `
    ${personLine(other)}
    <p class="text-xs text-gray-400 mt-2">
      <i class="fas fa-ban mr-1" aria-hidden="true"></i>${escapeHtml(m.status.charAt(0).toUpperCase() + m.status.slice(1))} ${formatDate(m.respondedAt || m.updatedAt)}</p>`;
  return card;
}

// ── Actions ──────────────────────────────────────────────────────────────────

document.getElementById('mentorship-content').addEventListener('click', async function (e) {
  const button = e.target.closest('button[data-act]');
  if (!button) return;

  const act = button.dataset.act;
  const mid = button.dataset.mid;

  if (act === 'chat') {
    openChat(mid);
    return;
  }

  if (act === 'review') {
    openReviewModal(mid);
    return;
  }

  if (act === 'schedule') {
    openSessionModal(mid);
    return;
  }

  if (act.indexOf('session-') === 0) {
    const sid = button.dataset.sid;
    const sessionAct = act.slice('session-'.length);
    const originalHtml = button.innerHTML;

    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin mr-1" aria-hidden="true"></i>Working';

    try {
      const result = await api('PATCH', `/api/sessions/${sid}/${sessionAct}`);

      // 401 means the session expired; 403 here is a business rule (for example
      // confirming your own proposal), so it must not sign the user out.
      if (result.status === 401) {
        clearSession();
        return;
      }
      if (result.status < 200 || result.status >= 300) {
        alert((result.data && result.data.error) || 'Action failed. Please try again.');
        button.disabled = false;
        button.innerHTML = originalHtml;
        return;
      }

      await loadSessions();
      const messages = { confirm: 'Session confirmed', decline: 'Session declined', cancel: 'Session cancelled' };
      showToast(messages[sessionAct] || 'Session updated');
    } catch (error) {
      alert('Network error. Please try again.');
      button.disabled = false;
      button.innerHTML = originalHtml;
    }
    return;
  }

  const confirmMessages = {
    reject: 'Reject this mentorship request?',
    cancel: 'Cancel this mentorship request?'
  };

  if (confirmMessages[act] && !window.confirm(confirmMessages[act])) {
    return;
  }

  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="fas fa-spinner fa-spin mr-1" aria-hidden="true"></i>Working…';

  try {
    const response = await api('PATCH', `/api/mentorships/${mid}/${act}`);

    if (response.status === 401 || response.status === 403) {
      clearSession();
      return;
    }
    // api() returns { status, data } - there is no response.ok to test
    if (response.status < 200 || response.status >= 300) {
      alert((response.data && response.data.error) || 'Action failed. Please try again.');
      button.disabled = false;
      button.innerHTML = original;
      return;
    }

    loadMentorships(getToken());
  } catch (error) {
    alert('Network error. Please try again.');
    button.disabled = false;
    button.innerHTML = original;
  }
});

// ── Chat drawer (reuses the existing messaging backend + Socket.IO) ─────────

function initChatDrawer() {
  document.getElementById('chat-close').addEventListener('click', closeChat);

  document.getElementById('chat-form').addEventListener('submit', function (e) {
    e.preventDefault();
    sendChatMessage();
  });
}

function ensureSocket() {
  if (mentorshipState.socket) return mentorshipState.socket;

  if (typeof io !== 'function') {
    throw new Error('Socket.IO client failed to load');
  }

  const socket = io('/', { auth: { token: getToken() } });

  socket.on('connect_error', function (err) {
    if (String(err.message).includes('Authentication')) {
      clearSession();
    }
  });

  socket.on('new_message', function (message) {
    if (message && message.conversationId === mentorshipState.chat.conversationId) {
      appendChatMessage(message, isMine(message));
      scrollChat();
    }
  });

  // Note: the sender's own message is shown optimistically on send;
  // the server's 'message_sent' echo is intentionally not rendered again.

  mentorshipState.socket = socket;
  return socket;
}

function isMine(message) {
  return message.sender === myUserId();
}

async function openChat(mentorshipId) {
  const mentorship = mentorshipState.items.find(function (m) { return m._id === mentorshipId; });
  if (!mentorship) return;

  const me = myUserId();
  const other = (mentorship.mentor && mentorship.mentor._id === me) ? mentorship.mentee : mentorship.mentor;
  if (!other) return;

  const drawer = document.getElementById('chat-drawer');
  const nameEl = document.getElementById('chat-with-name');
  const messagesEl = document.getElementById('chat-messages');

  nameEl.textContent = (other.name || 'Chat');
  messagesEl.innerHTML = '<p class="text-center text-gray-400 text-sm py-6">Loading conversation…</p>';
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');

  mentorshipState.chat.mentorshipId = mentorshipId;
  mentorshipState.chat.recipientId = other._id;

  try {
    const conv = await api('POST', '/api/messages/conversations', { recipientId: other._id });
    if (conv.status !== 200) {
      messagesEl.innerHTML = '<p class="text-center text-red-400 text-sm py-6">Could not open the conversation.</p>';
      return;
    }

    mentorshipState.chat.conversationId = conv.data._id;

    const history = await api('GET', `/api/messages/conversations/${conv.data._id}`);
    messagesEl.innerHTML = '';
    ((history.data && history.data.messages) || []).forEach(function (message) {
      appendChatMessage(message, isMine(message));
    });
    if (!history.data || !history.data.messages || history.data.messages.length === 0) {
      messagesEl.innerHTML = '<p class="text-center text-gray-400 text-sm py-6">No messages yet. Say hello!</p>';
    }
    scrollChat();

    try { ensureSocket(); } catch (error) {
      appendSystemLine('Live chat is unavailable, but you can still read the history.');
    }
  } catch (error) {
    messagesEl.innerHTML = '<p class="text-center text-red-400 text-sm py-6">Could not load the conversation.</p>';
  }
}

function closeChat() {
  const drawer = document.getElementById('chat-drawer');
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  mentorshipState.chat = { mentorshipId: null, conversationId: null, recipientId: null };
}

function appendChatMessage(message, mine) {
  const messagesEl = document.getElementById('chat-messages');
  const emptyNote = messagesEl.querySelector('p.text-center');
  if (emptyNote) emptyNote.remove();

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${mine ? 'mine' : 'theirs'}`;
  const time = message.createdAt
    ? `<span class="chat-time">${new Date(message.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>`
    : '';
  bubble.innerHTML = `${escapeHtml(message.content || '')}${time}`;
  bubble.dataset.messageId = message._id || '';

  // Avoid duplicating a message the server already echoed back
  if (message._id) {
    const existing = messagesEl.querySelector(`[data-message-id="${message._id}"]`);
    if (existing) return;
  }

  messagesEl.appendChild(bubble);
  scrollChat();
}

function appendSystemLine(text) {
  const messagesEl = document.getElementById('chat-messages');
  const line = document.createElement('p');
  line.className = 'text-center text-gray-400 text-xs py-2';
  line.textContent = text;
  messagesEl.appendChild(line);
}

function scrollChat() {
  const messagesEl = document.getElementById('chat-messages');
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  const chat = mentorshipState.chat;

  if (!content || !chat.conversationId || !chat.recipientId) return;

  let socket;
  try {
    socket = ensureSocket();
  } catch (error) {
    alert('Live chat is unavailable right now. Please try again later.');
    return;
  }

  // Optimistic bubble
  appendChatMessage({ content, createdAt: new Date().toISOString() }, true);

  socket.emit('send_message', {
    conversationId: chat.conversationId,
    recipientId: chat.recipientId,
    content
  });

  input.value = '';
}

// ── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeHtmlAttr(text) {
  return escapeHtml(text);
}

// ── Mentorship reviews ───────────────────────────────────────────────────────

async function loadSessions() {
  try {
    const result = await api('GET', '/api/sessions/mine');
    if (result.status !== 200 || !Array.isArray(result.data.sessions)) return;

    mentorshipState.sessions = result.data.sessions;
    if (mentorshipState.items.length > 0) renderSections();
  } catch (error) {
    // Non-fatal: the sessions section simply shows its empty state
  }
}

function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'
  });
}

function renderSessionSection() {
  const fragment = document.createDocumentFragment();
  const now = Date.now();
  const isUpcoming = function (s) {
    return ['proposed', 'confirmed'].indexOf(s.status) !== -1 && new Date(s.scheduledFor).getTime() > now;
  };

  const upcoming = mentorshipState.sessions
    .filter(isUpcoming)
    .sort(function (a, b) { return new Date(a.scheduledFor) - new Date(b.scheduledFor); });

  const earlier = mentorshipState.sessions
    .filter(function (s) { return !isUpcoming(s); })
    .sort(function (a, b) { return new Date(b.scheduledFor) - new Date(a.scheduledFor); })
    .slice(0, 5);

  fragment.appendChild(renderSection(
    'Upcoming sessions', 'fa-calendar-check',
    'Sessions you have agreed with your mentorship partners. Propose one from an active mentorship.',
    upcoming, renderSessionCard
  ));

  if (earlier.length > 0) {
    fragment.appendChild(renderSection(
      'Earlier sessions', 'fa-clock-rotate-left',
      'Sessions that have already happened, or were declined.',
      earlier, renderSessionCard
    ));
  }

  return fragment;
}

function renderSessionCard(s) {
  const me = myUserId();
  const mine = s.proposedBy === me;
  const partnerName = (s.partner && s.partner.name) || 'your mentorship partner';
  const upcoming = ['proposed', 'confirmed'].indexOf(s.status) !== -1 && new Date(s.scheduledFor).getTime() > Date.now();

  const badges = {
    proposed: 'bg-amber-100 text-amber-700',
    confirmed: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-600',
    cancelled: 'bg-gray-100 text-gray-500'
  };

  let actions = '';
  if (s.status === 'proposed' && !mine) {
    actions += `<button type="button" class="px-4 py-1.5 rounded-lg text-sm font-semibold bg-accent-teal text-white hover:bg-teal-600 transition" data-act="session-confirm" data-sid="${escapeHtmlAttr(s._id)}">
      <i class="fas fa-check mr-1" aria-hidden="true"></i>Confirm</button>
      <button type="button" class="px-4 py-1.5 rounded-lg text-sm font-semibold bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 transition" data-act="session-decline" data-sid="${escapeHtmlAttr(s._id)}">
      <i class="fas fa-xmark mr-1" aria-hidden="true"></i>Decline</button>`;
  }
  if (upcoming) {
    actions += `<button type="button" class="px-4 py-1.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition" data-act="session-cancel" data-sid="${escapeHtmlAttr(s._id)}">
      <i class="fas fa-ban mr-1" aria-hidden="true"></i>Cancel</button>`;
  }

  const card = document.createElement('div');
  card.className = 'border border-gray-100 rounded-xl p-4';
  card.innerHTML = `
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <p class="font-semibold text-gray-900">${escapeHtml(formatDateTime(s.scheduledFor))}
          <span class="text-xs font-medium text-gray-400">&middot; ${Number(s.durationMinutes) || 60} min</span></p>
        <p class="text-xs text-gray-500 mt-1">with ${escapeHtml(partnerName)}${mine ? ' &middot; proposed by you' : ''}</p>
      </div>
      <span class="text-xs font-semibold px-2.5 py-1 rounded-full ${badges[s.status] || 'bg-gray-100 text-gray-600'}">${escapeHtml(s.status)}</span>
    </div>
    ${s.agenda ? `<p class="text-sm text-gray-600 mt-2">${escapeHtml(s.agenda)}</p>` : ''}
    ${s.meetingLink ? `<p class="text-xs mt-2"><i class="fas fa-video mr-1" aria-hidden="true"></i><a class="text-accent-indigo hover:underline break-all" href="${escapeHtmlAttr(s.meetingLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.meetingLink)}</a></p>` : ''}
    ${actions ? `<div class="flex gap-2 mt-3 flex-wrap">${actions}</div>` : ''}`;
  return card;
}

async function loadMyReviews() {
  try {
    const result = await api('GET', '/api/reviews/mine');
    if (result.status !== 200 || !Array.isArray(result.data.reviews)) return;

    mentorshipState.myReviews = {};
    result.data.reviews.forEach(function (review) {
      mentorshipState.myReviews[review.mentorship] = review;
    });

    if (mentorshipState.items.length > 0) renderSections();
  } catch (error) {
    // Non-fatal: the review button simply stays visible
  }
}

function openReviewModal(mentorshipId) {
  if (document.getElementById('review-modal-overlay')) return;

  const mentorship = mentorshipState.items.find(function (m) { return m._id === mentorshipId; });
  if (!mentorship) return;

  const me = myUserId();
  const other = (mentorship.mentor && mentorship.mentor._id === me) ? mentorship.mentee : mentorship.mentor;
  const otherName = (other && other.name) || 'this alumni';

  let selectedRating = 0;

  const overlay = document.createElement('div');
  overlay.id = 'review-modal-overlay';
  overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4';
  overlay.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 class="text-lg font-bold text-gray-900">Review your mentorship</h3>
        <button type="button" id="review-modal-close" class="w-8 h-8 rounded-full hover:bg-gray-100 transition" aria-label="Close">
          <i class="fas fa-times text-gray-500"></i>
        </button>
      </div>
      <div class="p-6">
        <p class="text-sm text-gray-600 mb-4">How was your mentorship with <strong id="review-modal-name"></strong>?</p>
        <div id="review-stars" class="flex items-center gap-2 mb-4" role="radiogroup" aria-label="Rating from 1 to 5 stars"></div>
        <div id="review-error" class="hidden mb-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm" role="alert"></div>
        <label for="review-comment" class="block text-xs font-bold text-gray-500 uppercase mb-1">Comment (optional)</label>
        <textarea id="review-comment" rows="3" maxlength="500" placeholder="What went well? Anything future mentees should know?"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-indigo focus:border-primary-indigo transition"></textarea>
        <div class="flex justify-end gap-3 mt-4">
          <button type="button" id="review-cancel" class="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition">Cancel</button>
          <button type="button" id="review-submit" class="bg-amber-500 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition">
            <i class="fas fa-star mr-1" aria-hidden="true"></i>Submit review
          </button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#review-modal-name').textContent = otherName;

  const starsWrap = overlay.querySelector('#review-stars');
  const errorEl = overlay.querySelector('#review-error');
  const submitBtn = overlay.querySelector('#review-submit');

  function renderStars() {
    starsWrap.innerHTML = '';
    for (let value = 1; value <= 5; value++) {
      const star = document.createElement('button');
      star.type = 'button';
      star.setAttribute('role', 'radio');
      star.setAttribute('aria-checked', String(value === selectedRating));
      star.setAttribute('aria-label', value + ' star' + (value === 1 ? '' : 's'));
      star.className = 'text-2xl transition ' + (value <= selectedRating ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400');
      star.textContent = value <= selectedRating ? '★' : '☆';
      star.addEventListener('click', function () {
        selectedRating = value;
        renderStars();
      });
      starsWrap.appendChild(star);
    }
  }
  renderStars();

  function close() { overlay.remove(); }
  overlay.querySelector('#review-modal-close').addEventListener('click', close);
  overlay.querySelector('#review-cancel').addEventListener('click', close);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

  submitBtn.addEventListener('click', async function () {
    errorEl.classList.add('hidden');

    if (selectedRating < 1) {
      errorEl.textContent = 'Please choose a rating between 1 and 5 stars.';
      errorEl.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1" aria-hidden="true"></i>Submitting…';

    try {
      const result = await api('POST', '/api/reviews', {
        mentorshipId: mentorshipId,
        rating: selectedRating,
        comment: overlay.querySelector('#review-comment').value.trim()
      });

      if (result.status === 401 || result.status === 403) { clearSession(); return; }

      if (result.status === 201) {
        mentorshipState.myReviews[mentorshipId] = result.data.review;
        close();
        renderSections();
        showToast('Review submitted. Thank you!');
        return;
      }

      errorEl.textContent = (result.data && result.data.error) || 'Could not submit the review.';
      errorEl.classList.remove('hidden');
    } catch (error) {
      errorEl.textContent = 'Network error. Please try again.';
      errorEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-star mr-1" aria-hidden="true"></i>Submit review';
    }
  });
}


// Propose a session inside an active mentorship
function openSessionModal(mentorshipId) {
  if (document.getElementById('session-modal-overlay')) return;

  const mentorship = mentorshipState.items.find(function (m) { return m._id === mentorshipId; });
  if (!mentorship) return;

  const me = myUserId();
  const other = (mentorship.mentor && mentorship.mentor._id === me) ? mentorship.mentee : mentorship.mentor;
  const otherName = (other && other.name) || 'your mentorship partner';

  // Suggest tomorrow at the top of the hour as a starting point
  const suggested = new Date(Date.now() + 24 * 3600 * 1000);
  suggested.setMinutes(0, 0, 0);
  const suggestedLocal = new Date(suggested.getTime() - suggested.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const overlay = document.createElement('div');
  overlay.id = 'session-modal-overlay';
  overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4';
  overlay.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 class="text-lg font-bold text-gray-900">Propose a session</h3>
        <button type="button" id="session-modal-close" class="w-8 h-8 rounded-full hover:bg-gray-100 transition" aria-label="Close">
          <i class="fas fa-times text-gray-500"></i>
        </button>
      </div>
      <div class="p-6">
        <p class="text-sm text-gray-600 mb-4">Suggest a time with <strong id="session-modal-name"></strong>. They can
          confirm or decline.</p>

        <label for="session-when" class="block text-xs font-bold text-gray-500 uppercase mb-1">Date and time</label>
        <input type="datetime-local" id="session-when" min="${nowLocal}" value="${suggestedLocal}"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary-indigo focus:border-primary-indigo transition">

        <label for="session-duration" class="block text-xs font-bold text-gray-500 uppercase mb-1">Duration</label>
        <select id="session-duration"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary-indigo focus:border-primary-indigo transition">
          <option value="30">30 minutes</option>
          <option value="45">45 minutes</option>
          <option value="60" selected>1 hour</option>
          <option value="90">1 hour 30 minutes</option>
          <option value="120">2 hours</option>
        </select>

        <label for="session-agenda" class="block text-xs font-bold text-gray-500 uppercase mb-1">What will you cover? (optional)</label>
        <textarea id="session-agenda" rows="3" maxlength="300" placeholder="RÃ©sumÃ© review, interview prep, career questions..."
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary-indigo focus:border-primary-indigo transition"></textarea>

        <label for="session-link" class="block text-xs font-bold text-gray-500 uppercase mb-1">Meeting link (optional)</label>
        <input type="url" id="session-link" placeholder="https://meet.example.com/your-room"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-indigo focus:border-primary-indigo transition">

        <div id="session-error" class="hidden mt-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm" role="alert"></div>

        <div class="flex justify-end gap-3 mt-5">
          <button type="button" id="session-cancel" class="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition">Cancel</button>
          <button type="button" id="session-submit" class="bg-primary-indigo text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
            <i class="fas fa-paper-plane mr-1" aria-hidden="true"></i>Send proposal
          </button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#session-modal-name').textContent = otherName;

  const errorEl = overlay.querySelector('#session-error');
  const submitBtn = overlay.querySelector('#session-submit');

  function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }

  function close() { overlay.remove(); }

  overlay.querySelector('#session-modal-close').addEventListener('click', close);
  overlay.querySelector('#session-cancel').addEventListener('click', close);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

  submitBtn.addEventListener('click', async function () {
    errorEl.classList.add('hidden');

    const rawWhen = overlay.querySelector('#session-when').value;
    if (!rawWhen) {
      showError('Pick a date and time.');
      return;
    }

    const when = new Date(rawWhen);
    if (isNaN(when.getTime())) {
      showError('Pick a valid date and time.');
      return;
    }
    if (when.getTime() <= Date.now()) {
      showError('Pick a time in the future.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1" aria-hidden="true"></i>Sending';

    try {
      const result = await api('POST', '/api/sessions', {
        mentorshipId: mentorshipId,
        scheduledFor: when.toISOString(),
        durationMinutes: Number(overlay.querySelector('#session-duration').value) || 60,
        agenda: overlay.querySelector('#session-agenda').value.trim(),
        meetingLink: overlay.querySelector('#session-link').value.trim()
      });

      if (result.status === 401) {
        clearSession();
        return;
      }

      if (result.status === 201) {
        close();
        await loadSessions();
        showToast('Session proposed');
        return;
      }

      showError((result.data && result.data.error) || 'Could not propose the session.');
    } catch (error) {
      showError('Network error. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane mr-1" aria-hidden="true"></i>Send proposal';
    }
  });
}