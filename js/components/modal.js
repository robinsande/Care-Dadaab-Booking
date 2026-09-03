/**
 * Lightweight modal helper.
 * Expects markup with [data-modal="id"] backdrop containing .modal.
 */

const openModals = new Set();

function getModal(id) {
  return document.querySelector(`[data-modal="${id}"]`);
}

export function openModal(id) {
  const backdrop = getModal(id);
  if (!backdrop) return;
  backdrop.hidden = false;
  openModals.add(id);
  document.body.style.overflow = 'hidden';

  const focusable = backdrop.querySelector(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  if (focusable) focusable.focus();
}

export function closeModal(id) {
  const backdrop = getModal(id);
  if (!backdrop) return;
  backdrop.hidden = true;
  openModals.delete(id);
  if (openModals.size === 0) {
    document.body.style.overflow = '';
  }
}

export function closeAllModals() {
  [...openModals].forEach(closeModal);
}

export function initModals(root = document) {
  root.querySelectorAll('[data-modal]').forEach((backdrop) => {
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) {
        closeModal(backdrop.dataset.modal);
      }
    });
  });

  root.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => {
      closeModal(button.getAttribute('data-close-modal'));
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && openModals.size) {
      const last = [...openModals].pop();
      closeModal(last);
    }
  });
}

/**
 * Promise-based confirmation dialog using an existing modal.
 * Modal must contain [data-confirm-message], [data-confirm-accept], [data-confirm-cancel].
 */
export function confirmDialog({
  modalId = 'confirm',
  title = 'Confirm',
  message = 'Are you sure?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    const backdrop = getModal(modalId);
    if (!backdrop) {
      resolve(window.confirm(message));
      return;
    }

    const titleEl = backdrop.querySelector('[data-confirm-title]');
    const messageEl = backdrop.querySelector('[data-confirm-message]');
    const acceptBtn = backdrop.querySelector('[data-confirm-accept]');
    const cancelBtn = backdrop.querySelector('[data-confirm-cancel]');

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (acceptBtn) {
      acceptBtn.textContent = confirmLabel;
      acceptBtn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
    }
    if (cancelBtn) cancelBtn.textContent = cancelLabel;

    const cleanup = (result) => {
      acceptBtn?.removeEventListener('click', onAccept);
      cancelBtn?.removeEventListener('click', onCancel);
      closeModal(modalId);
      resolve(result);
    };

    const onAccept = () => cleanup(true);
    const onCancel = () => cleanup(false);

    acceptBtn?.addEventListener('click', onAccept);
    cancelBtn?.addEventListener('click', onCancel);
    openModal(modalId);
  });
}
