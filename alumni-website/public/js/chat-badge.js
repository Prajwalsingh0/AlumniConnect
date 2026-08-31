/**
 * Chat unread badge - shared across pages.
 * If the visitor is logged in, shows the total unread message count on the
 * navbar Chat link. Call window.refreshUnreadBadge() after actions that
 * change unread state; pages with a live Socket.IO connection can call
 * window.updateUnreadBadge(count) directly.
 */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    refreshUnreadBadge();
  });

  window.refreshUnreadBadge = async function () {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch('/api/messages/unread/count', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) return;
      const data = await response.json();
      window.updateUnreadBadge(data.count || 0);
    } catch {
      // Non-fatal: badge simply stays as-is
    }
  };

  window.updateUnreadBadge = function (count) {
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
  };
})();
