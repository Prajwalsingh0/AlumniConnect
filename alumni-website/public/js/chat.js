/**
 * Chat - Page Logic
 * Real-time messaging built on the existing /api/messages REST endpoints and
 * the existing Socket.IO server. Safe rendering via DOM APIs (no innerHTML
 * for user-generated content), cursor pagination, unread sync, typing
 * indicator, and connection-state handling.
 */

const chatState = {
  myId: null,
  conversations: [],        // raw conversation docs from the API
  activeConversationId: null,
  activeOther: null,        // { _id, name, avatar }
  messages: [],             // ascending order
  oldestCursor: null,       // createdAt of oldest loaded message
  hasMoreOlder: false,
  loadingOlder: false,
  sending: false,
  pendingById: new Map(),   // pendingTempId -> { content }
  socket: null,
  socketConnected: false,
  typingTimer: null,
  otherTyping: false,
  otherTypingTimeout: null
};

document.addEventListener('DOMContentLoaded', function () {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'portal.html#login';
    return;
  }

  chatState.myId = resolveMyId();
  initChatUi();
  connectSocket();
  loadConversations(token);
  refreshUnreadBadge();

  // Entry point: chat.html?to=<userId> opens (or creates) that conversation
  const params = new URLSearchParams(window.location.search);
  const targetUser = params.get('to');
  if (targetUser) {
    openConversationWithUser(targetUser, token);
  }
});

async function openConversationWithUser(userId, token) {
  try {
    const response = await fetch('/api/messages/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ recipientId: userId })
    });

    if (response.status === 401 || response.status === 403) {
      clearSessionAndRedirect();
      return;
    }
    if (!response.ok) return; // directory list still loads

    const conversation = await response.json();
    // Ensure the list contains it, then open
    if (!chatState.conversations.some(function (c) { return c._id === conversation._id; })) {
      chatState.conversations.unshift(conversation);
    }
    await loadConversations(token);
    openConversation(conversation._id);
  } catch (error) {
    // Non-fatal: the visitor can still pick a conversation manually
  }
}

function resolveMyId() {
  try {
    const raw = localStorage.getItem('userData') || localStorage.getItem('user');
    const user = raw ? JSON.parse(raw) : null;
    return user ? (user._id || user.id) : null;
  } catch {
    return null;
  }
}

function getToken() {
  return localStorage.getItem('token');
}

function clearSessionAndRedirect() {
  localStorage.removeItem('token');
  localStorage.removeItem('userData');
  localStorage.removeItem('user');
  window.location.href = 'portal.html#login';
}

// ── UI references ────────────────────────────────────────────────────────────

const els = {};

function initChatUi() {
  els.list = document.getElementById('conversations-list');
  els.search = document.getElementById('conversation-search');
  els.placeholder = document.getElementById('chat-placeholder');
  els.chatActive = document.getElementById('chat-active');
  els.headerAvatar = document.getElementById('chat-header-avatar');
  els.headerName = document.getElementById('chat-header-name');
  els.messagesScroll = document.getElementById('messages-scroll');
  els.loadOlderWrap = document.getElementById('load-older-wrap');
  els.loadOlderBtn = document.getElementById('load-older-btn');
  els.composer = document.getElementById('chat-composer');
  els.input = document.getElementById('chat-input');
  els.sendBtn = document.getElementById('chat-send-btn');
  els.connectionState = document.getElementById('connection-state');
  els.typingIndicator = document.getElementById('typing-indicator');
  els.chatAlert = document.getElementById('chat-alert');
  els.mobileBack = document.getElementById('mobile-back-btn');
  els.unreadBadge = document.getElementById('chat-unread-badge');

  els.search.addEventListener('input', renderConversationList);

  els.loadOlderBtn.addEventListener('click', loadOlderMessages);

  els.mobileBack.addEventListener('click', function () {
    document.getElementById('conversations-pane').classList.remove('pane-hidden');
    document.getElementById('chat-window').classList.remove('pane-visible');
    setActiveConversationId(null);
  });

  els.composer.addEventListener('submit', submitMessage);

  els.input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitMessage(e);
    }
  });

  // Typing indicator: throttled emits while typing
  els.input.addEventListener('input', function () {
    autoGrow(this);
    emitTyping(true);
    clearTimeout(chatState.typingTimer);
    chatState.typingTimer = setTimeout(function () { emitTyping(false); }, 2000);
  });
}

function autoGrow(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 112) + 'px';
}

function setActiveConversationId(id) {
  chatState.activeConversationId = id;
  document.querySelectorAll('.conversation-item').forEach(function (item) {
    item.classList.toggle('active', item.dataset.conversationId === id);
  });
}

// ── Conversations list ───────────────────────────────────────────────────────

async function loadConversations(token) {
  els.list.innerHTML = '';
  renderListSkeletons();

  try {
    const response = await fetch('/api/messages/conversations', {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    if (response.status === 401 || response.status === 403) {
      clearSessionAndRedirect();
      return;
    }
    if (!response.ok) throw new Error('Failed');

    chatState.conversations = await response.json();
    renderConversationList();
  } catch (error) {
    renderListError();
  }
}

function renderListSkeletons() {
  for (let i = 0; i < 5; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'flex items-center gap-3 p-4 border-b border-gray-100';
    skeleton.innerHTML = `
      <div class="skeleton w-11 h-11 rounded-full flex-shrink-0"></div>
      <div class="flex-1">
        <div class="skeleton h-3.5 w-1/2 mb-2"></div>
        <div class="skeleton h-3 w-3/4"></div>
      </div>`;
    els.list.appendChild(skeleton);
  }
}

function renderListError() {
  els.list.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'text-center py-10 px-4';
  const icon = document.createElement('i');
  icon.className = 'fas fa-triangle-exclamation text-3xl text-red-300 mb-3';
  const text = document.createElement('p');
  text.className = 'text-gray-500 text-sm mb-4';
  text.textContent = 'Conversations could not be loaded.';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'bg-primary-indigo text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-primary-dark-blue transition';
  retry.textContent = 'Retry';
  retry.addEventListener('click', function () { loadConversations(getToken()); });
  wrap.append(icon, text, retry);
  els.list.appendChild(wrap);
}

function otherParticipantOf(conversation) {
  const participants = conversation.participants || [];
  return participants.find(function (p) { return p._id !== chatState.myId; }) || participants[0] || null;
}

function myUnreadCount(conversation) {
  if (!conversation.unreadCount) return 0;
  return conversation.unreadCount[chatState.myId] || 0;
}

function renderConversationList() {
  const query = els.search.value.trim().toLowerCase();
  els.list.innerHTML = '';

  const visible = chatState.conversations.filter(function (conversation) {
    if (!query) return true;
    const other = otherParticipantOf(conversation);
    const name = other ? (other.name || '').toLowerCase() : '';
    const preview = conversation.lastMessage ? (conversation.lastMessage.content || '').toLowerCase() : '';
    return name.includes(query) || preview.includes(query);
  });

  if (visible.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-center py-12 px-4';
    const icon = document.createElement('i');
    icon.className = 'fas fa-comments text-4xl text-gray-200 mb-4';
    const text = document.createElement('p');
    text.className = 'text-gray-400 text-sm';
    text.textContent = query
      ? 'No conversations match your search.'
      : 'No conversations yet. Start one from an alumni profile or the mentorship dashboard.';
    empty.append(icon, text);
    els.list.appendChild(empty);
    return;
  }

  visible.forEach(function (conversation) {
    els.list.appendChild(renderConversationItem(conversation));
  });
}

function renderConversationItem(conversation) {
  const other = otherParticipantOf(conversation);
  const item = document.createElement('button');
  item.type = 'button';
  item.setAttribute('role', 'option');
  item.dataset.conversationId = conversation._id;
  item.className = 'conversation-item w-full text-left flex items-center gap-3 p-4 border-b border-gray-100 hover:bg-gray-50 focus:outline-none focus:bg-indigo-50 transition';

  if (conversation._id === chatState.activeConversationId) {
    item.classList.add('active');
  }

  const image = other && other.profile && (other.profile.profileImageThumbnail || other.profile.profileImage)
    || 'images/singlee person.webp';
  const name = other ? (other.name || 'User') : 'User';
  const last = conversation.lastMessage;
  const preview = last ? (last.content || '') : 'No messages yet';
  const unread = myUnreadCount(conversation);

  const avatar = document.createElement('img');
  avatar.src = image;
  avatar.alt = 'Profile photo of ' + name;
  avatar.className = 'w-11 h-11 rounded-full object-cover border-2 border-indigo-100 flex-shrink-0';
  avatar.onerror = function () { this.onerror = null; this.src = 'images/singlee person.webp'; };

  const middle = document.createElement('div');
  middle.className = 'flex-1 min-w-0';

  const nameEl = document.createElement('p');
  nameEl.className = 'font-semibold text-gray-900 text-sm truncate';
  nameEl.textContent = name;

  const previewEl = document.createElement('p');
  previewEl.className = 'text-xs text-gray-500 truncate';
  previewEl.textContent = last && last.sender === chatState.myId ? 'You: ' + preview : preview;

  middle.append(nameEl, previewEl);

  const right = document.createElement('div');
  right.className = 'flex flex-col items-end gap-1 flex-shrink-0';
  if (last && last.createdAt) {
    const time = document.createElement('span');
    time.className = 'text-[10px] text-gray-400';
    time.textContent = formatListTime(last.createdAt);
    right.appendChild(time);
  }
  if (unread > 0) {
    const badge = document.createElement('span');
    badge.className = 'min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center';
    badge.textContent = unread > 99 ? '99+' : String(unread);
    right.appendChild(badge);
  }

  item.append(avatar, middle, right);
  item.addEventListener('click', function () {
    openConversation(conversation._id);
  });

  return item;
}

function formatListTime(value) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Keep the list in sync after sends/receives without a refetch
function updateConversationInList(conversationId, updates) {
  const conversation = chatState.conversations.find(function (c) { return c._id === conversationId; });
  if (!conversation) return;
  Object.assign(conversation, updates);
  chatState.conversations.sort(function (a, b) {
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  });
  renderConversationList();
}

// ── Open conversation & history ──────────────────────────────────────────────

async function openConversation(conversationId) {
  setActiveConversationId(conversationId);

  if (window.innerWidth < 768) {
    document.getElementById('conversations-pane').classList.add('pane-hidden');
    document.getElementById('chat-window').classList.add('pane-visible');
  }

  const conversation = chatState.conversations.find(function (c) { return c._id === conversationId; });
  if (!conversation) return;

  const other = otherParticipantOf(conversation);
  chatState.activeOther = other;
  chatState.activeConversationId = conversationId;
  chatState.messages = [];
  chatState.oldestCursor = null;
  chatState.hasMoreOlder = false;

  els.placeholder.classList.add('hidden');
  els.chatActive.classList.remove('hidden');
  els.chatAlert.classList.add('hidden');

  const image = other && other.profile && (other.profile.profileImageThumbnail || other.profile.profileImage)
    || 'images/singlee person.webp';
  els.headerAvatar.src = image;
  els.headerName.textContent = other ? (other.name || 'User') : 'User';
  els.headerName.href = `profile.html?id=${encodeURIComponent(other ? other._id : '')}`;

  els.messagesScroll.innerHTML = '';
  const loading = document.createElement('p');
  loading.className = 'text-center text-gray-400 text-sm py-6';
  loading.textContent = 'Loading messages…';
  els.messagesScroll.appendChild(loading);

  try {
    const response = await fetch(`/api/messages/conversations/${encodeURIComponent(conversationId)}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    if (response.status === 401 || response.status === 403) {
      clearSessionAndRedirect();
      return;
    }
    if (response.status === 404) {
      throw Object.assign(new Error('not found'), { notFound: true });
    }
    if (!response.ok) throw new Error('Failed');

    const data = await response.json();
    chatState.messages = data.messages || [];
    chatState.hasMoreOlder = !!(data.pagination && data.pagination.hasMore);
    chatState.oldestCursor = data.pagination ? data.pagination.nextBefore : null;

    renderMessages();

    // Mark read + reset unread in list + navbar badge
    markConversationRead(conversationId);
    clearConversationNotifications(conversationId);
    conversation.unreadCount = conversation.unreadCount || {};
    conversation.unreadCount[chatState.myId] = 0;
    updateConversationInList(conversationId, { unreadCount: conversation.unreadCount });
    refreshUnreadBadge();
  } catch (error) {
    els.messagesScroll.innerHTML = '';
    if (error.notFound) {
      appendCenteredText('This conversation is no longer available.');
    } else {
      appendCenteredText('Messages could not be loaded.');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'mx-auto bg-primary-indigo text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-primary-dark-blue transition';
      retry.textContent = 'Retry';
      retry.addEventListener('click', function () { openConversation(conversationId); });
      els.messagesScroll.appendChild(retry);
    }
  }
}

function appendCenteredText(text) {
  const p = document.createElement('p');
  p.className = 'text-center text-gray-400 text-sm py-6';
  p.textContent = text;
  els.messagesScroll.appendChild(p);
}

function renderMessages() {
  els.messagesScroll.innerHTML = '';

  if (els.loadOlderWrap.parentNode === els.messagesScroll) {
    els.messagesScroll.removeChild(els.loadOlderWrap);
  }
  if (chatState.hasMoreOlder) {
    els.messagesScroll.appendChild(els.loadOlderWrap);
    els.loadOlderWrap.classList.remove('hidden');
  } else {
    els.loadOlderWrap.classList.add('hidden');
  }

  let lastDate = null;
  chatState.messages.forEach(function (message) {
    const messageDate = new Date(message.createdAt).toDateString();
    if (messageDate !== lastDate) {
      appendDateSeparator(messageDate);
      lastDate = messageDate;
    }
    appendMessageElement(message, message.sender === chatState.myId);
  });
  scrollMessagesToBottom();
}

function appendDateSeparator(dateString) {
  const separator = document.createElement('div');
  separator.className = 'date-separator';
  separator.textContent = new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
  els.messagesScroll.appendChild(separator);
}

// Safe rendering: DOM APIs + textContent only (never innerHTML with content)
function appendMessageElement(message, mine) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${mine ? 'mine' : 'theirs'}`;
  if (message._pendingId) {
    bubble.classList.add('pending');
    bubble.dataset.pendingId = message._pendingId;
  }
  if (message._id) {
    bubble.dataset.messageId = message._id;
  }

  const text = document.createElement('span');
  text.textContent = message.content || '';
  bubble.appendChild(text);

  const meta = document.createElement('span');
  meta.className = 'chat-meta';
  const time = message.createdAt ? new Date(message.createdAt) : new Date();
  meta.textContent = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  bubble.appendChild(meta);

  els.messagesScroll.appendChild(bubble);
}

function scrollMessagesToBottom() {
  els.messagesScroll.scrollTop = els.messagesScroll.scrollHeight;
}

// ── Load older messages (cursor pagination) ──────────────────────────────────

async function loadOlderMessages() {
  if (chatState.loadingOlder || !chatState.hasMoreOlder || !chatState.oldestCursor) return;

  chatState.loadingOlder = true;
  els.loadOlderBtn.disabled = true;
  els.loadOlderBtn.textContent = 'Loading…';

  const previousHeight = els.messagesScroll.scrollHeight;
  const previousTop = els.messagesScroll.scrollTop;

  try {
    const params = new URLSearchParams({
      before: chatState.oldestCursor,
      limit: '30'
    });
    const response = await fetch(`/api/messages/conversations/${encodeURIComponent(chatState.activeConversationId)}?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    if (response.status === 401 || response.status === 403) {
      clearSessionAndRedirect();
      return;
    }
    if (!response.ok) throw new Error('Failed');

    const data = await response.json();
    const older = (data.messages || []).slice().reverse(); // ascending
    chatState.hasMoreOlder = !!(data.pagination && data.pagination.hasMore);
    chatState.oldestCursor = data.pagination ? data.pagination.nextBefore : null;

    // Prepend in ascending order as a fragment, preserving scroll position
    const anchor = els.loadOlderWrap.nextSibling;
    const fragment = document.createDocumentFragment();
    let lastDate = null;
    older.forEach(function (message) {
      const messageDate = new Date(message.createdAt).toDateString();
      if (messageDate !== lastDate) {
        const separator = document.createElement('div');
        separator.className = 'date-separator';
        separator.textContent = new Date(messageDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        fragment.appendChild(separator);
        lastDate = messageDate;
        fragment.datasetLastDate = messageDate;
      }
      fragment.appendChild(buildMessageBubble(message, message.sender === chatState.myId));
    });
    els.messagesScroll.insertBefore(fragment, anchor);

    // Junction: drop the old top separator if it now duplicates the fragment's last date
    if (lastDate && anchor && anchor.classList && anchor.classList.contains('date-separator')) {
      const fragmentDateText = new Date(lastDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      if (anchor.textContent === fragmentDateText) anchor.remove();
    }

    chatState.messages = older.concat(chatState.messages);

    els.messagesScroll.scrollTop = els.messagesScroll.scrollHeight - previousHeight + previousTop;
  } catch (error) {
    appendCenteredText('Could not load earlier messages.');
  } finally {
    chatState.loadingOlder = false;
    els.loadOlderBtn.disabled = false;
    els.loadOlderBtn.textContent = 'Load earlier messages';
  }
}

function buildMessageBubble(message, mine) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${mine ? 'mine' : 'theirs'}`;
  if (message._id) bubble.dataset.messageId = message._id;

  const text = document.createElement('span');
  text.textContent = message.content || '';
  bubble.appendChild(text);

  const meta = document.createElement('span');
  meta.className = 'chat-meta';
  meta.textContent = new Date(message.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  bubble.appendChild(meta);
  return bubble;
}

// ── Composer ─────────────────────────────────────────────────────────────────

async function submitMessage(e) {
  if (e && e.preventDefault) e.preventDefault();

  const content = els.input.value.trim();

  if (chatState.sending) return;
  if (!chatState.activeConversationId || !chatState.activeOther) return;
  if (!content) {
    showChatAlert('Type a message before sending.');
    return;
  }
  if (content.length > 5000) {
    showChatAlert('Message is too long (maximum 5000 characters).');
    return;
  }
  if (!chatState.socketConnected) {
    showChatAlert('You are offline — reconnecting. Please try again in a moment.');
    return;
  }

  chatState.sending = true;
  els.sendBtn.disabled = true;

  // Optimistic bubble
  const pendingId = 'pending-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  appendMessageElement({ content, createdAt: new Date().toISOString(), _pendingId: pendingId }, true);
  scrollMessagesToBottom();

  chatState.socket.emit('send_message', {
    conversationId: chatState.activeConversationId,
    recipientId: chatState.activeOther._id,
    content
  });

  els.input.value = '';
  els.input.style.height = 'auto';
  emitTyping(false);

  // Safety net: if the server never acknowledges, restore the draft
  chatState.ackTimer = setTimeout(function () {
    if (chatState.sending) {
      chatState.sending = false;
      els.sendBtn.disabled = false;
      els.input.value = content;
      showChatAlert('The message could not be sent. Please try again.');
      const pendingBubble = els.messagesScroll.querySelector(`[data-pending-id="${pendingId}"]`);
      if (pendingBubble) pendingBubble.remove();
    }
  }, 8000);
}

function showChatAlert(text) {
  els.chatAlert.textContent = text;
  els.chatAlert.classList.remove('hidden');
  setTimeout(function () { els.chatAlert.classList.add('hidden'); }, 4000);
}

// ── Socket.IO ────────────────────────────────────────────────────────────────

function connectSocket() {
  if (typeof io !== 'function') {
    els.connectionState.textContent = 'Chat is unavailable';
    return;
  }

  const socket = io('/', { auth: { token: getToken() } });
  chatState.socket = socket;

  socket.on('connect', function () {
    chatState.socketConnected = true;
    els.connectionState.textContent = 'Online';
    els.connectionState.classList.remove('text-red-400');
    els.connectionState.classList.add('text-green-500');
    els.sendBtn.disabled = false;
  });

  socket.on('disconnect', function () {
    chatState.socketConnected = false;
    els.connectionState.textContent = 'Disconnected';
    els.connectionState.classList.remove('text-green-500');
    els.connectionState.classList.add('text-red-400');
  });

  socket.on('reconnecting', function () {
    chatState.socketConnected = false;
    els.connectionState.textContent = 'Reconnecting…';
  });

  socket.on('connect_error', function (err) {
    chatState.socketConnected = false;
    if (String(err.message).includes('Authentication')) {
      clearSessionAndRedirect();
    } else {
      els.connectionState.textContent = 'Connection failed';
    }
  });

  socket.on('message_sent', function (message) {
    // Server acknowledgement: replace the optimistic bubble with the saved one
    chatState.sending = false;
    els.sendBtn.disabled = false;
    clearTimeout(chatState.ackTimer);

    const pendingBubble = els.messagesScroll.querySelector('[data-pending-id]');
    if (pendingBubble) pendingBubble.remove();

    if (message && message.conversationId === chatState.activeConversationId) {
      if (message._id && els.messagesScroll.querySelector(`[data-message-id="${message._id}"]`)) return;
      appendMessageElement(message, true);
      scrollMessagesToBottom();
      chatState.messages.push(message);
      updateConversationInList(message.conversationId, {
        lastMessage: message,
        updatedAt: new Date().toISOString()
      });
    }
  });

  socket.on('error', function (err) {
    chatState.sending = false;
    els.sendBtn.disabled = false;
    clearTimeout(chatState.ackTimer);
    const pendingBubble = els.messagesScroll.querySelector('[data-pending-id]');
    if (pendingBubble) pendingBubble.remove();
    showChatAlert((err && err.message) || 'The message could not be sent.');
  });

  socket.on('new_message', function (message) {
    if (!message) return;

    refreshUnreadBadge();

    // Message for the conversation currently open? Append + mark read.
    if (message.conversationId === chatState.activeConversationId) {
      if (message._id && els.messagesScroll.querySelector(`[data-message-id="${message._id}"]`)) {
        return; // duplicate prevention
      }
      appendMessageElement(message, message.sender === chatState.myId);
      scrollMessagesToBottom();
      chatState.messages.push(message);
      markConversationRead(message.conversationId);
      clearConversationNotifications(message.conversationId);

      // Update list preview + bump to top without a refetch
      updateConversationInList(message.conversationId, {
        lastMessage: message,
        updatedAt: new Date().toISOString()
      });
      const conversation = chatState.conversations.find(function (c) { return c._id === message.conversationId; });
      if (conversation) {
        conversation.unreadCount = conversation.unreadCount || {};
        conversation.unreadCount[chatState.myId] = 0;
        updateConversationInList(message.conversationId, {});
      }
    } else {
      // Another conversation: refresh preview + unread count
      const conversation = chatState.conversations.find(function (c) { return c._id === message.conversationId; });
      if (conversation) {
        conversation.lastMessage = message;
        conversation.updatedAt = new Date().toISOString();
        conversation.unreadCount = conversation.unreadCount || {};
        conversation.unreadCount[chatState.myId] = (conversation.unreadCount[chatState.myId] || 0) + 1;
        updateConversationInList(message.conversationId, {});
      }
    }
  });

  socket.on('messages_read', function (receipt) {
    // Read receipts: mark my outgoing messages in that conversation as read
    if (receipt.conversationId === chatState.activeConversationId) {
      chatState.messages.forEach(function (message) {
        if (message.sender === chatState.myId) {
          const bubble = els.messagesScroll.querySelector(`[data-message-id="${message._id}"] .chat-meta`);
          if (bubble && !bubble.textContent.includes('✓✓')) {
            bubble.textContent = bubble.textContent + ' ✓✓';
          }
        }
      });
    }
  });

  socket.on('typing', function (event) {
    if (!chatState.activeConversationId || event.conversationId !== chatState.activeConversationId) return;
    if (event.userId === chatState.myId) return;

    if (event.isTyping) {
      chatState.otherTyping = true;
      els.typingIndicator.textContent = 'typing…';
      clearTimeout(chatState.otherTypingTimeout);
      chatState.otherTypingTimeout = setTimeout(function () {
        els.typingIndicator.textContent = '';
        chatState.otherTyping = false;
      }, 3000);
    } else {
      chatState.otherTyping = false;
      els.typingIndicator.textContent = '';
    }
  });
}

let typingLastEmit = 0;
function emitTyping(isTyping) {
  if (!chatState.socketConnected || !chatState.activeConversationId) return;

  if (isTyping) {
    const now = Date.now();
    if (now - typingLastEmit < 1200) return; // throttle starts
    typingLastEmit = now;
  }

  chatState.socket.emit('typing', {
    conversationId: chatState.activeConversationId,
    isTyping
  });
}

// Clear the message-type notifications tied to a conversation (the chat
// unread badge is a separate, per-message count that stays independent)
async function clearConversationNotifications(conversationId) {
    try {
        await fetch('/api/notifications/read-all', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ refType: 'Conversation', refId: conversationId })
        });
        if (typeof window.refreshNotificationBadge === 'function') {
            window.refreshNotificationBadge();
        }
    } catch (error) {
        // Non-fatal: notifications re-sync on the next poll
    }
}
// ── Mark read & navbar badge ─────────────────────────────────────────────────

async function markConversationRead(conversationId) {
  try {
    await fetch(`/api/messages/conversations/${encodeURIComponent(conversationId)}/read`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
  } catch (error) {
    // Non-fatal: unread will re-sync on next load
  }
}

async function refreshUnreadBadge() {
  try {
    const response = await fetch('/api/messages/unread/count', {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (!response.ok) return;
    const data = await response.json();
    updateUnreadBadge(data.count || 0);
  } catch (error) {
    // Non-fatal
  }
}

function updateUnreadBadge(count) {
  document.querySelectorAll('#chat-unread-badge').forEach(function (badge) {
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.classList.remove('hidden');
      badge.classList.add('flex');
    } else {
      badge.classList.add('hidden');
      badge.classList.remove('flex');
    }
  });
}

// Expose for pages sharing this badge element
window.updateUnreadBadge = updateUnreadBadge;
window.refreshUnreadBadge = refreshUnreadBadge;
