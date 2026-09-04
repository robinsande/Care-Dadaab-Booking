import {
  listUsers,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
  resetUserPassword,
} from '../../api/users.js';
import { ApiError } from '../../api/client.js';
import { openModal, closeModal, confirmDialog } from '../../components/modal.js';
import { withLoading, setButtonLoading } from '../../components/loading.js';
import { showToast } from '../../components/toast.js';
import { constants, fillSelect } from '../../utils/constants.js';
import { escapeHtml, fullName } from '../../utils/format.js';
import {
  applyFieldErrors,
  getFormValues,
  validateFields,
} from '../../utils/validation.js';

let initialized = false;
let users = [];
let editing = false;

export async function init() {
  if (initialized) return;
  initialized = true;

  const tableBody = document.getElementById('users-table-body');
  const form = document.getElementById('user-form');
  const addBtn = document.getElementById('add-user-btn');
  const submitBtn = document.getElementById('user-submit');
  const titleEl = document.getElementById('user-modal-title');
  const passwordRequired = document.getElementById('password-required');

  fillSelect(document.getElementById('user-role'), constants.USER_ROLES, {
    placeholder: 'Select role',
  });

  addBtn.addEventListener('click', () => openUserModal(titleEl, passwordRequired));
  form.addEventListener('submit', (e) => onSave(e, form, submitBtn, tableBody));
  tableBody.addEventListener('click', (e) => onTableClick(e, tableBody, titleEl, passwordRequired));
  loadUsers(tableBody);
}

export async function refresh() {
  const tableBody = document.getElementById('users-table-body');
  loadUsers(tableBody);
}

async function loadUsers(tableBody) {
  try {
    const response = await withLoading(() => listUsers(), 'Loading users…');
    const data = response.data;
    users = data?.users || data?.items || data || [];
    if (!Array.isArray(users)) users = [];
    renderTable(tableBody);
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">Unable to load users.</td></tr>`;
    showToast(
      error instanceof ApiError ? error.message : 'Unable to load users.',
      'error',
    );
  }
}

function renderTable(tableBody) {
  if (!users.length) {
    tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">No users found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = users
    .map((item) => {
      const id = item._id || item.id;
      const active = item.isActive !== false;
      const statusBadge = active
        ? '<span class="badge badge-approved">Active</span>'
        : '<span class="badge badge-cancelled">Inactive</span>';
      const toggleButton = active
        ? `<button type="button" class="btn btn-danger btn-sm" data-action="deactivate" data-id="${escapeHtml(id)}">Deactivate</button>`
        : `<button type="button" class="btn btn-primary btn-sm" data-action="reactivate" data-id="${escapeHtml(id)}">Reactivate</button>`;
      return `
        <tr>
          <td>${escapeHtml(fullName(item))}</td>
          <td>${escapeHtml(item.email)}</td>
          <td>${escapeHtml(item.role)}</td>
          <td>${statusBadge}</td>
          <td>
            <div class="table-actions">
              <button type="button" class="btn btn-secondary btn-sm" data-action="edit" data-id="${escapeHtml(id)}">Edit</button>
              ${active ? `<button type="button" class="btn btn-secondary btn-sm" data-action="reset-password" data-id="${escapeHtml(id)}">Reset Password</button>` : ''}
              ${toggleButton}
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function openUserModal(titleEl, passwordRequired, item = null) {
  const form = document.getElementById('user-form');
  applyFieldErrors(form, {});
  form.reset();
  editing = Boolean(item);

  if (item) {
    titleEl.textContent = 'Edit User';
    passwordRequired.hidden = true;
    document.getElementById('user-id').value = item._id || item.id;
    document.getElementById('user-firstName').value = item.firstName || '';
    document.getElementById('user-lastName').value = item.lastName || '';
    document.getElementById('user-email').value = item.email || '';
    document.getElementById('user-role').value = item.role || '';
  } else {
    titleEl.textContent = 'Add User';
    passwordRequired.hidden = false;
    document.getElementById('user-id').value = '';
  }

  openModal('user');
}

async function onSave(event, form, submitBtn, tableBody) {
  event.preventDefault();
  const values = getFormValues(form);

  const { valid, errors } = validateFields(values, {
    firstName: { required: true, label: 'First Name' },
    lastName: { required: true, label: 'Last Name' },
    email: { required: true, email: true, label: 'Email' },
    role: { required: true, label: 'Role' },
    password: {
      required: !editing,
      label: 'Password',
      custom: (value) => {
        if (!value) return null;
        return String(value).length >= 8 ? null : 'Password must be at least 8 characters.';
      },
    },
  });

  applyFieldErrors(form, errors);
  if (!valid) return;

  const payload = {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    role: values.role,
  };
  if (values.password) {
    payload.password = values.password;
  }

  setButtonLoading(submitBtn, true, 'Saving…');
  try {
    if (values.id) {
      await updateUser(values.id, payload);
      showToast('User updated.', 'success');
    } else {
      await createUser(payload);
      showToast('User created.', 'success');
    }
    closeModal('user');
    loadUsers(tableBody);
  } catch (error) {
    showToast(
      error instanceof ApiError ? error.message : 'Unable to save user.',
      'error',
    );
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

async function onTableClick(event, tableBody, titleEl, passwordRequired) {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const { action, id } = button.dataset;
  const item = users.find((u) => String(u._id || u.id) === String(id));

  if (action === 'edit' && item) {
    openUserModal(titleEl, passwordRequired, item);
    return;
  }

  if (action === 'deactivate') {
    const confirmed = await confirmDialog({
      title: 'Deactivate user',
      message: `Deactivate ${fullName(item)} (${item?.email})? They will no longer be able to sign in. You can reactivate them later.`,
      confirmLabel: 'Deactivate',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await withLoading(() => deactivateUser(id), 'Deactivating…');
      showToast('User deactivated.', 'success');
      loadUsers(tableBody);
    } catch (error) {
      showToast(
        error instanceof ApiError ? error.message : 'Unable to deactivate user.',
        'error',
      );
    }

    return;
  }

  if (action === 'reset-password') {
    const confirmed = await confirmDialog({
      title: 'Reset user password',
      message: `Generate a temporary password for ${fullName(item)}? They must change it when they next sign in.`,
      confirmLabel: 'Reset Password',
    });
    if (!confirmed) return;
    try {
      const response = await withLoading(() => resetUserPassword(id), 'Resetting password…');
      showToast(`Temporary password: ${response.data?.temporaryPassword}`, 'info', { duration: 12000 });
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Unable to reset password.', 'error');
    }
    return;
  }

  if (action === 'reactivate') {
    try {
      await withLoading(() => reactivateUser(id), 'Reactivating…');
      showToast('User reactivated.', 'success');
      loadUsers(tableBody);
    } catch (error) {
      showToast(
        error instanceof ApiError ? error.message : 'Unable to reactivate user.',
        'error',
      );
    }
  }
}
