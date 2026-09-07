let overlay;

function ensureOverlay() {
  if (!overlay) {
    overlay = document.querySelector('.loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'loading-overlay';
      overlay.hidden = true;
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');
      overlay.innerHTML = `
        <div class="loading-card">
          <div class="loading-orbit" aria-hidden="true">
            <span class="loading-orbit-dot"></span>
            <span class="loading-orbit-dot"></span>
            <span class="loading-orbit-dot"></span>
            <span class="loading-core">C</span>
          </div>
          <strong class="loading-title">CAMS</strong>
          <span class="loading-text">Loading…</span>
        </div>
      `;
      const loadingHost = document.querySelector('.admin-main') || document.body;
      loadingHost.appendChild(overlay);
    }
  }
  return overlay;
}

let activeCount = 0;

export function showLoading(message = 'Loading…') {
  const el = ensureOverlay();
  activeCount += 1;
  const text = el.querySelector('.loading-text');
  if (text) text.textContent = message;
  el.hidden = false;
}

export function hideLoading() {
  activeCount = Math.max(0, activeCount - 1);
  if (activeCount === 0) {
    ensureOverlay().hidden = true;
  }
}

export async function withLoading(fn, message) {
  showLoading(message);
  try {
    return await fn();
  } finally {
    hideLoading();
  }
}

export function setButtonLoading(button, isLoading, loadingText = 'Please wait…') {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.innerHTML = `<span class="spinner spinner-inline" aria-hidden="true"></span> ${loadingText}`;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
  }
}
