/**
 * Shared toast for every page.
 *
 * Replaces the near-duplicate showNotification implementations that lived in
 * script.js and portal.js. Messages are written with textContent, so text that
 * came from the server or a form is never interpreted as HTML.
 */
(function () {
  const TYPES = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    warning: 'bg-yellow-600',
    info: 'bg-blue-600',
  };
  const LIFETIME_MS = 5000;

  function stack() {
    let el = document.getElementById('ui-toast-stack');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ui-toast-stack';
      el.className = 'fixed top-4 right-4 z-[10050] flex flex-col items-end gap-2 max-w-sm';
      document.body.appendChild(el);
    }
    return el;
  }

  function dismiss(toast) {
    if (!toast || !toast.parentNode) return;
    clearTimeout(toast._uiTimer);
    toast.classList.add('translate-x-full');
    setTimeout(function () {
      toast.remove();
    }, 300);
  }

  function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className =
      'p-4 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full text-white ' +
      (TYPES[type] || TYPES.info);
    toast.setAttribute('role', 'status');

    const row = document.createElement('div');
    row.className = 'flex items-center';

    const text = document.createElement('span');
    text.className = 'flex-1';
    text.textContent = message === null || message === undefined ? '' : String(message);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ml-3 text-white hover:text-gray-200';
    close.setAttribute('aria-label', 'Dismiss notification');
    close.innerHTML = '<i class="fas fa-times"></i>';
    close.addEventListener('click', function () {
      dismiss(toast);
    });

    row.appendChild(text);
    row.appendChild(close);
    toast.appendChild(row);
    stack().appendChild(toast);

    setTimeout(function () {
      toast.classList.remove('translate-x-full');
    }, 100);

    toast._uiTimer = setTimeout(function () {
      dismiss(toast);
    }, LIFETIME_MS);

    return toast;
  }

  window.showToast = showToast;

  // Pages that still call showNotification keep working
  if (typeof window.showNotification !== 'function') {
    window.showNotification = showToast;
  }

  window.UI = window.UI || {};
  window.UI.showToast = showToast;
  window.UI.dismissToast = dismiss;
})();
