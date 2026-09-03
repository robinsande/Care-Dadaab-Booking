import {
  listUsers,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
} from '../api/users.js';
import { ApiError } from '../api/client.js';
import { requireAuth } from '../auth/session.js';
import { initAdminShell } from '../components/shell.js';
import { initModals, openModal, closeModal, confirmDialog } from '../components/modal.js';
import { withLoading, setButtonLoading } from '../components/loading.js';
import { showToast } from '../components/toast.js';
import { constants, fillSelect } from '../utils/constants.js';
import { escapeHtml, fullName } from '../utils/format.js';
import {
  applyFieldErrors,
  getFormValues,
  validateFields,
} from '../utils/validation.js';

const tableBody = document.getElementById('users-table-body');
const form = document.getElementById('user-form');
const addBtn = document.getElementById('add-user-btn');
const submitBtn = document.getElementById('user-submit');
const titleEl = document.getElementById('user-modal-title');
const passwordRequired = document.getElementById('password-required');

let users = [];
let editing = false;

function boot() {
  fillSelect(document.getElementById('role'), constants.USER_ROLES, {
    placeholder: 'Select role',
  });

  addBtn.addEventListener('click', () => openUserModal());
  form.addEventListener('submit', onSave);
  tableBody.addEventListener('click', onTableClick);
  loadUsers();
}

async function loadUsers() {
  try {
    const response = await withLoading(() => listUsers(), 'Loading users…');
    const data = response.data;
    users = data?.users || data?.items || data || [];
    if (!Array.isArray(users)) users = [];
    renderTable();
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">Unable to load users.</td></tr>`;
    showToast(
      error instanceof ApiError ? error.message : 'Unable to load users.',
      'error',
    );
  }
}

function renderTable() {
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
              ${toggleButton}
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function openUserModal(item = null) {
  applyFieldErrors(form, {});
  form.reset();
  editing = Boolean(item);

  if (item) {
    titleEl.textContent = 'Edit User';
    passwordRequired.hidden = true;
    document.getElementById('user-id').value = item._id || item.id;
    document.getElementById('firstName').value = item.firstName || '';
    document.getElementById('lastName').value = item.lastName || '';
    document.getElementById('email').value = item.email || '';
    document.getElementById('role').value = item.role || '';
  } else {
    titleEl.textContent = 'Add User';
    passwordRequired.hidden = false;
    document.getElementById('user-id').value = '';
  }

  openModal('user');
}

async function onSave(event) {
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
    loadUsers();
  } catch (error) {
    showToast(
      error instanceof ApiError ? error.message : 'Unable to save user.',
      'error',
    );
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

async function onTableClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const { action, id } = button.dataset;
  const item = users.find((u) => String(u._id || u.id) === String(id));

  if (action === 'edit' && item) {
    openUserModal(item);
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
      loadUsers();
    } catch (error) {
      showToast(
        error instanceof ApiError ? error.message : 'Unable to deactivate user.',
        'error',
      );
    }
    return;
  }

  if (action === 'reactivate') {
    try {
      await withLoading(() => reactivateUser(id), 'Reactivating…');
      showToast('User reactivated.', 'success');
      loadUsers();
    } catch (error) {
      showToast(
        error instanceof ApiError ? error.message : 'Unable to reactivate user.',
        'error',
      );
    }
  }
}

const user = requireAuth({ superAdmin: true });
if (user) {
  initAdminShell();
  initModals();
  boot();
}
