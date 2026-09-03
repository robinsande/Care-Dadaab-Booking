import { listCamps, createCamp, updateCamp, deactivateCamp, deleteCamp, reactivateCamp } from '../api/camps.js';
import { ApiError } from '../api/client.js';
import { requireAuth } from '../auth/session.js';
import { initAdminShell } from '../components/shell.js';
import { initModals, openModal, closeModal, confirmDialog } from '../components/modal.js';
import { withLoading, setButtonLoading } from '../components/loading.js';
import { showToast } from '../components/toast.js';
import { escapeHtml } from '../utils/format.js';
import { applyFieldErrors, getFormValues, validateFields } from '../utils/validation.js';

const tableBody = document.getElementById('camps-table-body');
const form = document.getElementById('camp-form');
const addBtn = document.getElementById('add-camp-btn');
const submitBtn = document.getElementById('camp-submit');
const titleEl = document.getElementById('camp-modal-title');
const searchInput = document.getElementById('camp-search');

let camps = [];
let searchQuery = '';

function boot() {
  addBtn.addEventListener('click', () => openCampModal());
  form.addEventListener('submit', onSave);
  tableBody.addEventListener('click', onTableClick);
  searchInput?.addEventListener('input', () => {
    searchQuery = searchInput.value.trim().toLowerCase();
    renderTable();
  });
  loadCamps();
}

async function loadCamps() {
  try {
    const response = await withLoading(
      () => listCamps({ includeInactive: 'true' }),
      'Loading camps…',
    );
    const data = response.data;
    camps = data?.camps || data?.items || data || [];
    if (!Array.isArray(camps)) camps = [];
    renderTable();
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="4" class="empty-state">Unable to load camps.</td></tr>`;
    showToast(error instanceof ApiError ? error.message : 'Unable to load camps.', 'error');
  }
}

function renderTable() {
  const visible = searchQuery
    ? camps.filter((camp) => String(camp.name || '').toLowerCase().includes(searchQuery))
    : camps;

  if (!visible.length) {
    tableBody.innerHTML = `<tr><td colspan="4" class="empty-state">${searchQuery ? 'No camps match your search.' : 'No camps configured.'}</td></tr>`;
    return;
  }

  tableBody.innerHTML = visible
    .map((camp) => {
      const id = camp._id || camp.id;
      const active = camp.isActive !== false;
      const statusBadge = active
        ? '<span class="badge badge-approved">Active</span>'
        : '<span class="badge badge-cancelled">Inactive</span>';
      const toggleButton = active
        ? `<button type="button" class="btn btn-secondary btn-sm" data-action="deactivate" data-id="${escapeHtml(id)}">Deactivate</button>`
        : `<button type="button" class="btn btn-primary btn-sm" data-action="reactivate" data-id="${escapeHtml(id)}">Reactivate</button>`;
      return `
        <tr>
          <td><strong>${escapeHtml(camp.name)}</strong>${camp.description ? `<br><span class="form-hint">${escapeHtml(camp.description)}</span>` : ''}</td>
          <td>${escapeHtml(camp.code || '—')}</td>
          <td>${statusBadge}</td>
          <td>
            <div class="table-actions">
              <button type="button" class="btn btn-secondary btn-sm" data-action="edit" data-id="${escapeHtml(id)}">Edit</button>
              ${toggleButton}
              <button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="${escapeHtml(id)}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function openCampModal(camp = null) {
  applyFieldErrors(form, {});
  form.reset();
  if (camp) {
    titleEl.textContent = 'Edit Camp';
    document.getElementById('camp-id').value = camp._id || camp.id;
    document.getElementById('name').value = camp.name || '';
    document.getElementById('code').value = camp.code || '';
    document.getElementById('description').value = camp.description || '';
  } else {
    titleEl.textContent = 'Add Camp';
    document.getElementById('camp-id').value = '';
  }
  openModal('camp');
}

async function onSave(event) {
  event.preventDefault();
  const values = getFormValues(form);
  const { valid, errors } = validateFields(values, {
    name: { required: true, label: 'Camp Name' },
  });
  applyFieldErrors(form, errors);
  if (!valid) return;

  const payload = { name: values.name };
  if (values.code) payload.code = values.code;
  if (values.description) payload.description = values.description;

  setButtonLoading(submitBtn, true, 'Saving…');
  try {
    if (values.id) {
      await updateCamp(values.id, payload);
      showToast('Camp updated.', 'success');
    } else {
      await createCamp(payload);
      showToast('Camp created.', 'success');
    }
    closeModal('camp');
    loadCamps();
  } catch (error) {
    showToast(error instanceof ApiError ? error.message : 'Unable to save camp.', 'error');
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

async function onTableClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  const camp = camps.find((c) => String(c._id || c.id) === String(id));

  if (action === 'edit' && camp) {
    openCampModal(camp);
    return;
  }

  if (action === 'deactivate') {
    const confirmed = await confirmDialog({
      title: 'Deactivate camp',
      message: `Deactivate ${camp?.name || 'this camp'}? It will be hidden from booking selectors.`,
      confirmLabel: 'Deactivate',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await withLoading(() => deactivateCamp(id), 'Deactivating…');
      showToast('Camp deactivated.', 'success');
      loadCamps();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Unable to deactivate camp.', 'error');
    }
    return;
  }

  if (action === 'delete') {
    const confirmed = await confirmDialog({
      title: 'Delete camp',
      message: `Permanently delete ${camp?.name || 'this camp'}? This only works if the camp has no blocks or booking history.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await withLoading(() => deleteCamp(id), 'Deleting…');
      showToast('Camp deleted.', 'success');
      loadCamps();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Unable to delete camp.', 'error');
    }
    return;
  }

  if (action === 'reactivate') {
    try {
      await withLoading(() => reactivateCamp(id), 'Reactivating…');
      showToast('Camp reactivated.', 'success');
      loadCamps();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Unable to reactivate camp.', 'error');
    }
  }
}

const user = requireAuth({ superAdmin: true });
if (user) {
  initAdminShell();
  initModals();
  boot();
}
