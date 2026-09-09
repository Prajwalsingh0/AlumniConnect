/**
 * Notifications - global navbar bell + dropdown.
 * Injects itself into the standard navbar on every page, shows the unread
 * count badge, opens a dropdown with the latest notifications, and updates
 * live via the existing Socket.IO server (per-user rooms). Falls back to
 * polling when Socket.IO is unavailable. Logged-out visitors see nothing.
 */
(function () {
  const POLL_INTERVAL_MS = 45000;
  let socket = null;
  let dropdownOpen = false;
  let items = [];
  let unread = 0;
  let loading = false;

  document.addEventListener('DOMContentLoaded', function () {
    if (!localStorage.getItem('token')) return;
    if (!injectBell()) return;

    refreshCount();
    setInterval(function () {
      if (!document.hidden) refreshCount();
    }, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && localStorage.getItem('token')) refreshCount();
    });

    connectSocket();
  });

  function getToken() {
    return localStorage.getItem('token');
  }

  function injectBell() {
    const dropdown = document.getElementById('user-dropdown');
    const anchor = dropdown || document.getElementById('login-button-container');
    if (!anchor || document.getElementById('notification-bell')) return false;

    const bell = document.createElement('div');
    bell.id = 'notification-bell';
    bell.className = 'relative';
    bell.innerHTML = `
      <style>
        #notification-bell .bell-btn {
          position: relative; width: 40px; height: 40px; border-radius: 9999px;
          display: flex; align-items: center; justify-content: center;
          color: #4b5563; background: transparent; border: none; cursor: pointer;
          transition: background 0.2s;
        }
        #notification-bell .bell-btn:hover, #notification-bell .bell-btn:focus-visible {
          background: #f3f4f6; color: #4F46E5; outline: none;
        }
        #notification-bell .bell-badge {
          position: absolute; top: 2px; right: 2px; min-width: 17px; height: 17px;
          padding: 0 4px; border-radius: 9999px; background: #ef4444; color: #fff;
          font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center;
        }
        #notification-bell .bell-badge.hidden { display: none; }
        #notification-dropdown {
          position: absolute; right: 0; top: 46px; width: 330px; max-width: 92vw;
          background: #fff; border-radius: 14px; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.25);
          border: 1px solid #e5e7eb; overflow: hidden; display: none; z-index: 60;
        }
        #notification-dropdown.open { display: block; }
        #notification-dropdown .notif-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.7rem 0.9rem; border-bottom: 1px solid #f1f5f9;
        }
        #notification-dropdown .notif-head span { font-weight: 700; font-size: 0.85rem; color: #111827; }
        #notification-dropdown .notif-head button {
          border: none; background: none; color: #4F46E5; font-size: 0.72rem;
          font-weight: 600; cursor: pointer; padding: 0;
        }
        #notification-dropdown .notif-head button:hover { text-decoration: underline; }
        #notification-list { max-height: 320px; overflow-y: auto; }
        .notification-item {
          display: flex; gap: 0.6rem; padding: 0.7rem 0.9rem;
          border-bottom: 1px solid #f3f4f6; cursor: pointer; transition: background 0.15s;
        }
        .notification-item:hover { background: #f8fafc; }
        .notification-item:last-child { border-bottom: none; }
        .notification-item .dot {
          width: 8px; height: 8px; border-radius: 9999px; background: #4F46E5;
          margin-top: 6px; flex-shrink: 0; visibility: hidden;
        }
        .notification-item.unread .dot { visibility: visible; }
        .notification-item.unread .notif-text { font-weight: 600; color: #111827; }
        .notification-item .notif-text { font-size: 0.8rem; color: #475569; }
        .notification-item .notif-time { font-size: 0.66rem; color: #9ca3af; margin-top: 2px; }
        .notification-empty { padding: 1.4rem 0.9rem; text-align: center; color: #9ca3af; font-size: 0.8rem; }
      </style>
      <button type="button" class="bell-btn" aria-label="Notifications">
        <i class="fas fa-bell" aria-hidden="true"></i>
        <span id="notification-badge" class="bell-badge hidden"></span>
      </button>
      <div id="notification-dropdown" role="dialog" aria-label="Notifications">
        <div class="notif-head">
          <span>Notifications</span>
          <button type="button" id="notification-mark-all">Mark all read</button>
        </div>
        <div id="notification-list"><div class="notification-empty">Loading…</div></div>
      </div>`;

    anchor.parentElement.insertBefore(bell, anchor);

    bell.querySelector('.bell-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      toggleDropdown();
    });
    document.addEventListener('click', function (e) {
      if (dropdownOpen && !bell.contains(e.target)) closeDropdown();
    });
    bell.querySelector('#notification-mark-all').addEventListener('click', function (e) {
      e.stopPropagation();
      markAllRead();
    });

    return true;
  }

  function bellWrap() {
    return document.getElementById('notification-bell');
  }

  function toggleDropdown() {
    dropdownOpen = !dropdownOpen;
    const panel = document.getElementById('notification-dropdown');
    panel.classList.toggle('open', dropdownOpen);
    if (dropdownOpen) {
      loadList();
    }
  }

  function closeDropdown() {
    dropdownOpen = false;
    const panel = document.getElementById('notification-dropdown');
    if (panel) panel.classList.remove('open');
  }

  // ── Data ────────────────────────────────────────────────────────────────────

  async function api(method, path) {
    const response = await fetch(path, {
      method,
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    let data = null;
    try { data = await response.json(); } catch { /* non-JSON */ }
    return { status: response.status, data };
  }

  async function refreshCount() {
    try {
      const result = await api('GET', '/api/notifications/unread/count');
      if (result.status === 401 || result.status === 403) {
        // session expired - hide the bell silently
        const wrap = bellWrap();
        if (wrap) wrap.remove();
        return;
      }
      if (result.status === 200) {
        unread = result.data.count || 0;
        renderBadge();
      }
    } catch {
      // non-fatal
    }
  }

  // Exposed for pages that clear notification state themselves (e.g. chat
  // marks message-type notifications read when a conversation is opened)
  window.refreshNotificationBadge = refreshCount;

  async function loadList() {
    const listEl = document.getElementById('notification-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="notification-empty">Loading…</div>';

    const result = await api('GET', '/api/notifications?limit=10');
    if (result.status === 401 || result.status === 403) {
      clearSessionAndRedirect();
      return;
    }
    if (result.status !== 200) {
      listEl.innerHTML = '<div class="notification-empty">Could not load notifications.</div>';
      return;
    }

    items = result.data.notifications || [];
    renderList();
  }

  function renderList() {
    const listEl = document.getElementById('notification-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'notification-empty';
      empty.textContent = 'No notifications yet. Mentorship activity will show up here.';
      listEl.appendChild(empty);
      return;
    }

    items.forEach(function (item) {
      const row = document.createElement('div');
      row.className = 'notification-item' + (item.read ? '' : ' unread');
      row.setAttribute('role', 'button');
      row.tabIndex = 0;

      const dot = document.createElement('span');
      dot.className = 'dot';

      const textWrap = document.createElement('div');
      const text = document.createElement('p');
      text.className = 'notif-text';
      text.textContent = item.message;
      const time = document.createElement('p');
      time.className = 'notif-time';
      time.textContent = formatTime(item.createdAt);
      textWrap.append(text, time);

      row.append(dot, textWrap);
      row.addEventListener('click', async function () {
        if (!item.read) {
          await api('POST', `/api/notifications/${item._id}/read`);
          item.read = true;
          unread = Math.max(0, unread - 1);
          renderBadge();
          renderList();
        }
        closeDropdown();
        // Chat-message notifications open the conversation with the sender;
        // mentorship notifications open the mentorship dashboard.
        if (item.type === 'message') {
          window.location.href = `chat.html?to=${encodeURIComponent(item.actor)}`;
        } else {
          window.location.href = 'mentorship.html';
        }
      });
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') row.click();
      });

      listEl.appendChild(row);
    });
  }

  async function markAllRead() {
    const result = await api('POST', '/api/notifications/read-all');
    if (result.status === 200) {
      items.forEach(function (item) { item.read = true; });
      unread = 0;
      renderBadge();
      renderList();
    }
  }

  function renderBadge() {
    const badge = document.getElementById('notification-badge');
    if (!badge) return;
    if (unread > 0) {
      badge.textContent = unread > 99 ? '99+' : String(unread);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  function formatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function clearSessionAndRedirect() {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    localStorage.removeItem('user');
    window.location.href = 'portal.html#login';
  }

  // ── Live updates (existing Socket.IO server, per-user rooms) ───────────────

  function connectSocket() {
    if (typeof io !== 'function') return; // polling covers this page

    socket = io('/', { auth: { token: getToken() } });

    socket.on('notification', function (notification) {
      if (!notification) return;
      unread += 1;
      renderBadge();
      items.unshift(notification);
      if (dropdownOpen) renderList();
    });

    socket.on('messages_read', function () {
      // message read receipts do not affect notifications, but keep
      // the hook point documented for future message notifications
    });
  }
})();
