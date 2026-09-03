let container;

function ensureContainer() {
  if (!container) {
    container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(container);
    }
  }
  return container;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} [type]
 * @param {{ duration?: number }} [options]
 */
export function showToast(message, type = 'info', options = {}) {
  const { duration = 4200 } = options;
  const host = ensureContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.innerHTML = `
    <p class="toast-message"></p>
    <button type="button" class="toast-close" aria-label="Dismiss notification">&times;</button>
  `;
  toast.querySelector('.toast-message').textContent = message;

  const remove = () => {
    toast.remove();
  };

  toast.querySelector('.toast-close').addEventListener('click', remove);
  host.appendChild(toast);

  if (duration > 0) {
    window.setTimeout(remove, duration);
  }

  return toast;
}
