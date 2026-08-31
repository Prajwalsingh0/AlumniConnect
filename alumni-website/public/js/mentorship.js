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

const mentorshipState = { items: [], requestId: 0, socket: null, chat: { mentorshipId: null, conversationId: null, recipientId: null } };

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
      </div>
      <button type="button" class="px-4 py-1.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition" data-act="complete" data-mid="${escapeHtmlAttr(m._id)}">
        <i class="fas fa-circle-check mr-1" aria-hidden="true"></i>Complete Mentorship</button>
    </div>`;
  return card;
}

function renderCompletedCard(m) {
  const me = myUserId();
  const other = (m.mentor && m.mentor._id === me) ? m.mentee : m.mentor;
  const card = document.createElement('div');
  card.className = 'border border-gray-100 rounded-xl p-4 opacity-90';
  card.innerHTML = `
    ${personLine(other)}
    <p class="text-xs text-gray-400 mt-2"><i class="fas fa-circle-check text-green-500 mr-1" aria-hidden="true"></i>Completed ${formatDate(m.completedAt || m.updatedAt)}</p>`;
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
    if (!response.ok) {
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
