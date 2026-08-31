/**
 * Mentorship integration for the public profile page (profile.html?id=...).
 * Shows the correct call-to-action based on the real backend relationship
 * state and opens the mentorship request modal.
 *
 * Own profile (no ?id= param): this script does nothing.
 */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    const viewedUserId = params.get('id');
    const token = localStorage.getItem('token');

    // Own profile or not logged in: no mentorship CTA (profile_v2.js already
    // redirects logged-out visitors to the portal).
    if (!viewedUserId || !token) return;

    loadMentorshipState(viewedUserId, token);
  });

  async function loadMentorshipState(viewedUserId, token) {
    const container = document.getElementById('mentorship-action-container');
    if (!container) return;

    try {
      const response = await fetch(`/api/mentorships/status/${encodeURIComponent(viewedUserId)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) return; // leave the CTA hidden on failure

      const state = await response.json();
      renderAction(container, viewedUserId, state);
    } catch (error) {
      // Network failure: leave the CTA hidden; the profile still renders
      console.error('Could not load mentorship state:', error.message);
    }
  }

  function renderAction(container, viewedUserId, state) {
    container.classList.remove('hidden');

    const messageButton = `<a href="chat.html?to=${encodeURIComponent(viewedUserId)}"
      class="btn-edit mentorship-btn" title="Open chat">
      <i class="fas fa-comment-dots"></i> Message
    </a>`;

    if (state.status === 'pending') {
      const label = state.direction === 'sent' ? 'Request Pending' : 'Pending Request';
      container.innerHTML = `<button type="button" class="btn-edit mentorship-btn" disabled>
        <i class="fas fa-hourglass-half"></i> ${label}
      </button>${messageButton}`;
      return;
    }

    if (state.status === 'accepted') {
      container.innerHTML = `<a href="mentorship.html" class="btn-edit mentorship-btn mentorship-active">
        <i class="fas fa-hands-helping"></i> Active Mentorship
      </a>${messageButton}`;
      return;
    }

    // 'none': a request can be sent (including after reject/cancel)
    container.innerHTML = `<button type="button" id="request-mentorship-btn" class="btn-edit mentorship-btn">
      <i class="fas fa-hands-helping"></i> Request Mentorship
    </button>${messageButton}`;

    document.getElementById('request-mentorship-btn').addEventListener('click', function () {
      openRequestModal(viewedUserId);
    });
  }

  // ── Request modal ──────────────────────────────────────────────────────────

  function openRequestModal(viewedUserId) {
    if (document.getElementById('mentorship-modal-overlay')) return;

    const mentorName =
      (document.getElementById('user-name') || {}).textContent || 'this alumni';

    const overlay = document.createElement('div');
    overlay.id = 'mentorship-modal-overlay';
    overlay.innerHTML = `
      <style>
        #mentorship-modal-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(15, 23, 42, 0.6);
          display: flex; align-items: center; justify-content: center;
          padding: 1rem;
        }
        #mentorship-modal-card {
          background: #ffffff; border-radius: 18px;
          width: 100%; max-width: 460px; padding: 1.6rem;
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        #mentorship-modal-card h3 { margin: 0 0 0.35rem; font-size: 1.15rem; color: #1e293b; }
        #mentorship-modal-card p.sub { margin: 0 0 1rem; font-size: 0.85rem; color: #64748b; }
        #mentorship-message {
          width: 100%; min-height: 110px; resize: vertical;
          border: 1px solid #cbd5e1; border-radius: 10px; padding: 0.7rem;
          font-size: 0.9rem; color: #0f172a; margin-bottom: 0.3rem;
        }
        #mentorship-message:focus { outline: 2px solid #4F46E5; border-color: #4F46E5; }
        #mentorship-char-count { font-size: 0.72rem; color: #94a3b8; text-align: right; display: block; margin-bottom: 0.9rem; }
        #mentorship-modal-error { color: #dc2626; font-size: 0.8rem; margin: 0 0 0.8rem; display: none; }
        .mentorship-modal-actions { display: flex; gap: 0.6rem; justify-content: flex-end; }
        .mentorship-modal-actions button {
          border-radius: 10px; padding: 0.55rem 1.1rem; font-size: 0.85rem;
          font-weight: 600; cursor: pointer; border: none; transition: all 0.2s;
        }
        #mentorship-cancel-btn { background: #f1f5f9; color: #475569; }
        #mentorship-cancel-btn:hover { background: #e2e8f0; }
        #mentorship-submit-btn { background: #4F46E5; color: #ffffff; }
        #mentorship-submit-btn:hover { background: #312E81; }
        #mentorship-submit-btn:disabled, #mentorship-cancel-btn:disabled {
          opacity: 0.6; cursor: not-allowed;
        }
      </style>
      <div id="mentorship-modal-card" role="dialog" aria-modal="true" aria-labelledby="mentorship-modal-title">
        <h3 id="mentorship-modal-title">Request Mentorship</h3>
        <p class="sub">Send a mentorship request to <strong>${escapeHtmlText(mentorName)}</strong>.</p>
        <textarea id="mentorship-message" maxlength="1000"
          placeholder="Introduce yourself and what you would like guidance on…"></textarea>
        <span id="mentorship-char-count">0 / 1000</span>
        <p id="mentorship-modal-error"></p>
        <div class="mentorship-modal-actions">
          <button type="button" id="mentorship-cancel-btn">Cancel</button>
          <button type="button" id="mentorship-submit-btn">Send Request</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const textarea = overlay.querySelector('#mentorship-message');
    const counter = overlay.querySelector('#mentorship-char-count');
    const errorEl = overlay.querySelector('#mentorship-modal-error');
    const submitBtn = overlay.querySelector('#mentorship-submit-btn');
    const cancelBtn = overlay.querySelector('#mentorship-cancel-btn');

    textarea.focus();
    textarea.addEventListener('input', function () {
      counter.textContent = `${this.value.length} / 1000`;
    });

    cancelBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    submitBtn.addEventListener('click', async function () {
      const message = textarea.value.trim();

      errorEl.style.display = 'none';
      if (message.length < 10) {
        errorEl.textContent = 'Please write a short message (at least 10 characters).';
        errorEl.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      cancelBtn.disabled = true;
      submitBtn.textContent = 'Sending…';

      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/mentorships', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ mentorId: viewedUserId, message })
        });

        const data = await response.json().catch(() => ({}));

        if (response.status === 201) {
          closeModal();
          const container = document.getElementById('mentorship-action-container');
          if (container) {
            container.innerHTML = `<button type="button" class="btn-edit mentorship-btn" disabled>
              <i class="fas fa-hourglass-half"></i> Request Pending
            </button>`;
          }
          showToast('Mentorship request sent.');
        } else if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('userData');
          localStorage.removeItem('user');
          window.location.href = 'portal.html#login';
        } else {
          errorEl.textContent = data.error || 'Could not send the request. Please try again.';
          errorEl.style.display = 'block';
          submitBtn.disabled = false;
          cancelBtn.disabled = false;
          submitBtn.textContent = 'Send Request';
        }
      } catch (error) {
        errorEl.textContent = 'Network error. Please check your connection and try again.';
        errorEl.style.display = 'block';
        submitBtn.disabled = false;
        cancelBtn.disabled = false;
        submitBtn.textContent = 'Send Request';
      }
    });

    function closeModal() {
      overlay.remove();
    }
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:10000;background:#16a34a;color:#fff;padding:0.8rem 1.2rem;border-radius:10px;font-size:0.85rem;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,0.25);font-family:inherit;';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.4s'; }, 2600);
    setTimeout(() => toast.remove(), 3100);
  }

  function escapeHtmlText(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
