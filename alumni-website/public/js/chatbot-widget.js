/**
 * AlumniConnect Assistant widget
 * Floating chatbot button + panel, available across the application.
 * - Safe rendering: user and assistant text is inserted with textContent,
 *   never innerHTML.
 * - Does not touch the real-time chat system (separate endpoint, no sockets).
 * - Logged-out visitors see a friendly login prompt instead of an API call.
 */
(function () {
  const ASSISTANT_STORAGE_KEY = 'alumni-assistant-history';

  const QUICK_SUGGESTIONS = [
    'How do I find alumni?',
    'How does mentorship work?',
    'How do I use chat?'
  ];

  let history = loadHistory();

  document.addEventListener('DOMContentLoaded', function () {
    buildWidget();
  });

  function loadHistory() {
    try {
      const raw = localStorage.getItem(ASSISTANT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.slice(-6) : [];
    } catch {
      return [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(ASSISTANT_STORAGE_KEY, JSON.stringify(history.slice(-6)));
    } catch {
      // Storage may be unavailable; the widget still works per-page
    }
  }

  function isLoggedIn() {
    return !!localStorage.getItem('token');
  }

  function buildWidget() {
    const style = document.createElement('style');
    style.textContent = `
      #alumni-assistant-btn {
        position: fixed; right: 1.1rem; bottom: 1.1rem; z-index: 45;
        width: 56px; height: 56px; border-radius: 9999px; border: none;
        background: linear-gradient(135deg, #4F46E5, #312E81);
        color: #fff; font-size: 1.25rem; cursor: pointer;
        box-shadow: 0 10px 26px rgba(49, 46, 129, 0.45);
        display: flex; align-items: center; justify-content: center;
        transition: transform 0.2s ease;
      }
      #alumni-assistant-btn:hover { transform: scale(1.06); }
      #alumni-assistant-btn:focus-visible { outline: 3px solid #14B8A6; outline-offset: 2px; }

      #alumni-assistant-panel {
        position: fixed; right: 1.1rem; bottom: 5.4rem; z-index: 45;
        width: min(92vw, 380px); max-height: min(72vh, 540px);
        background: #fff; border-radius: 18px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.3);
        display: none; flex-direction: column; overflow: hidden;
        font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      }
      #alumni-assistant-panel.open { display: flex; }

      #alumni-assistant-header {
        background: linear-gradient(135deg, #4F46E5, #312E81);
        color: #fff; padding: 0.9rem 1rem;
        display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
      }
      #alumni-assistant-header-title { font-weight: 700; font-size: 0.95rem; display: flex; align-items: center; gap: 0.5rem; }
      #alumni-assistant-close {
        background: transparent; border: none; color: #fff; cursor: pointer;
        width: 30px; height: 30px; border-radius: 9999px; font-size: 0.9rem;
      }
      #alumni-assistant-close:hover { background: rgba(255, 255, 255, 0.18); }

      #alumni-assistant-messages {
        flex: 1; overflow-y: auto; padding: 0.9rem;
        display: flex; flex-direction: column; gap: 0.55rem;
        background: #f8fafc; min-height: 180px;
      }
      .assistant-msg, .assistant-user-msg {
        max-width: 85%; padding: 0.55rem 0.8rem; border-radius: 14px;
        font-size: 0.85rem; line-height: 1.5; white-space: pre-wrap; word-break: break-word;
      }
      .assistant-msg { align-self: flex-start; background: #eef2ff; color: #1e293b; border-bottom-left-radius: 4px; }
      .assistant-user-msg { align-self: flex-end; background: #4F46E5; color: #fff; border-bottom-right-radius: 4px; }

      .assistant-typing { align-self: flex-start; background: #eef2ff; border-radius: 14px; padding: 0.65rem 0.9rem; display: flex; gap: 4px; }
      .assistant-typing span {
        width: 7px; height: 7px; border-radius: 9999px; background: #818cf8;
        animation: assistant-blink 1.2s infinite;
      }
      .assistant-typing span:nth-child(2) { animation-delay: 0.2s; }
      .assistant-typing span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes assistant-blink { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }

      #alumni-assistant-suggestions { display: flex; flex-wrap: wrap; gap: 0.4rem; padding: 0 0.9rem 0.4rem; }
      .assistant-chip {
        border: 1px solid #c7d2fe; background: #eef2ff; color: #4338ca;
        font-size: 0.72rem; font-weight: 600; border-radius: 9999px;
        padding: 0.3rem 0.7rem; cursor: pointer; transition: all 0.15s;
      }
      .assistant-chip:hover { background: #4F46E5; color: #fff; border-color: #4F46E5; }

      #alumni-assistant-composer { display: flex; gap: 0.5rem; padding: 0.7rem; border-top: 1px solid #e2e8f0; }
      #alumni-assistant-input {
        flex: 1; border: 1px solid #cbd5e1; border-radius: 12px;
        padding: 0.55rem 0.8rem; font-size: 0.85rem;
        resize: none; max-height: 96px;
      }
      #alumni-assistant-input:focus { outline: 2px solid #4F46E5; border-color: #4F46E5; }
      #alumni-assistant-send {
        border: none; border-radius: 12px; padding: 0 1rem;
        background: #4F46E5; color: #fff; font-weight: 700; font-size: 0.85rem;
        cursor: pointer;
      }
      #alumni-assistant-send:hover { background: #312E81; }
      #alumni-assistant-send:disabled { opacity: 0.5; cursor: not-allowed; }
    `;
    document.head.appendChild(style);

    // Floating button
    const button = document.createElement('button');
    button.id = 'alumni-assistant-btn';
    button.type = 'button';
    button.setAttribute('aria-label', 'Open AlumniConnect assistant');
    button.textContent = '💬';
    document.body.appendChild(button);

    // Panel
    const panel = document.createElement('div');
    panel.id = 'alumni-assistant-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'AlumniConnect assistant');
    panel.innerHTML = `
      <div id="alumni-assistant-header">
        <span id="alumni-assistant-header-title"><span aria-hidden="true">🤖</span> AlumniConnect Assistant</span>
        <button type="button" id="alumni-assistant-close" aria-label="Close assistant">✕</button>
      </div>
      <div id="alumni-assistant-messages" aria-live="polite"></div>
      <div id="alumni-assistant-suggestions"></div>
      <form id="alumni-assistant-composer">
        <textarea id="alumni-assistant-input" rows="1" aria-label="Ask the assistant"
          placeholder="Ask about the platform…"></textarea>
        <button type="submit" id="alumni-assistant-send">Send</button>
      </form>`;
    document.body.appendChild(panel);

    const messagesEl = panel.querySelector('#alumni-assistant-messages');
    const suggestionsEl = panel.querySelector('#alumni-assistant-suggestions');
    const inputEl = panel.querySelector('#alumni-assistant-input');
    const sendBtn = panel.querySelector('#alumni-assistant-send');
    const composer = panel.querySelector('#alumni-assistant-composer');
    const closeBtn = panel.querySelector('#alumni-assistant-close');

    let busy = false;
    let opened = false;

    function openPanel() {
      panel.classList.add('open');
      button.setAttribute('aria-expanded', 'true');
      if (!opened) {
        opened = true;
        if (!isLoggedIn()) {
          addMessage(
            'Welcome! Log in to ask me anything about AlumniConnect — ' +
            'I can guide you through the Directory, Mentorship, Chat and more.',
            false
          );
          addMessage('You are not logged in yet.', false, { login: true });
        } else {
          addMessage('Hi! 👋 I can help you use AlumniConnect — try "How does mentorship work?" or "How do I find alumni?"', false);
          renderSuggestions();
        }
        // Restore short in-page history
        history.slice(-4).forEach(function (turn) {
          addMessage(turn.content, turn.role === 'assistant');
        });
      }
      inputEl.focus();
    }

    function closePanel() {
      panel.classList.remove('open');
      button.setAttribute('aria-expanded', 'false');
    }

    function renderSuggestions() {
      suggestionsEl.innerHTML = '';
      if (!isLoggedIn()) return;
      QUICK_SUGGESTIONS.forEach(function (question) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'assistant-chip';
        chip.textContent = question;
        chip.addEventListener('click', function () {
          ask(question);
        });
        suggestionsEl.appendChild(chip);
      });
    }

    function addMessage(text, isAssistant, extra) {
      const bubble = document.createElement('div');
      bubble.className = isAssistant ? 'assistant-msg' : 'assistant-user-msg';
      bubble.textContent = text; // safe: never innerHTML with user content

      if (extra && extra.login) {
        const link = document.createElement('a');
        link.href = 'portal.html#login';
        link.textContent = 'Log in';
        link.style.cssText = 'color:#4F46E5;font-weight:700;text-decoration:underline;display:inline-block;margin-left:0.35rem;';
        bubble.appendChild(link);
      }

      messagesEl.appendChild(bubble);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function showTyping() {
      const dots = document.createElement('div');
      dots.className = 'assistant-typing';
      dots.setAttribute('aria-hidden', 'true');
      dots.innerHTML = '<span></span><span></span><span></span>';
      messagesEl.appendChild(dots);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return dots;
    }

    async function ask(question) {
      if (busy) return;

      const text = question.trim();
      if (!text) return;
      if (text.length > 500) {
        addMessage('That question is a bit long — please keep it under 500 characters.', true);
        return;
      }
      if (!isLoggedIn()) {
        addMessage('Please log in to use the assistant.', false);
        addMessage('You are not logged in yet.', true, { login: true });
        return;
      }

      busy = true;
      sendBtn.disabled = true;
      inputEl.value = '';
      inputEl.style.height = 'auto';

      addMessage(text, false);
      const typing = showTyping();

      try {
        const response = await fetch('/api/chatbot', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ message: text })
        });

        const data = await response.json().catch(function () { return {}; });

        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('userData');
          localStorage.removeItem('user');
          addMessage('Your session expired — please log in again.', true, { login: true });
          return;
        }
        if (response.status === 429) {
          addMessage(data.error || 'You are sending questions too quickly. Please wait a moment.', true);
          return;
        }
        if (!response.ok) {
          addMessage('I could not answer right now. Please try again in a moment.', true);
          return;
        }

        const reply = data.reply || 'Hmm, I could not find an answer for that.';
        addMessage(reply, true);
        history.push({ role: 'user', content: text }, { role: 'assistant', content: reply });
        saveHistory();
      } catch (error) {
        addMessage('Network error — please check your connection and try again.', true);
      } finally {
        typing.remove();
        busy = false;
        sendBtn.disabled = false;
        renderSuggestions();
      }
    }

    button.addEventListener('click', function () {
      if (panel.classList.contains('open')) closePanel(); else openPanel();
    });
    closeBtn.addEventListener('click', closePanel);

    composer.addEventListener('submit', function (e) {
      e.preventDefault();
      ask(inputEl.value);
    });

    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        ask(inputEl.value);
      }
    });

    inputEl.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 96) + 'px';
    });
  }
})();
