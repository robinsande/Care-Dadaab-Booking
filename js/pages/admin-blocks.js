import { listCamps } from '../api/camps.js';
import { listBlocks, createBlock, updateBlock, deactivateBlock, deleteBlock, reactivateBlock } from '../api/blocks.js';
import { ApiError } from '../api/client.js';
import { requireAuth } from '../auth/session.js';
import { initAdminShell } from '../components/shell.js';
import { initModals, openModal, closeModal, confirmDialog } from '../components/modal.js';
import { withLoading, setButtonLoading } from '../components/loading.js';
import { showToast } from '../components/toast.js';
import { fillSelect } from '../utils/constants.js';
import { escapeHtml, campLabel } from '../utils/format.js';
import { applyFieldErrors, getFormValues, validateFields } from '../utils/validation.js';

const tableBody = document.getElementById('blocks-table-body');
const form = document.getElementById('block-form');
const filterCamp = document.getElementById('filter-camp');
const addBtn = document.getElementById('add-block-btn');
const submitBtn = document.getElementById('block-submit');
const titleEl = document.getElementById('block-modal-title');
const formCampSelect = document.getElementById('campId');

let blocks = [];
let camps = [];

function boot() {
  addBtn.addEventListener('click', () => openBlockModal());
  form.addEventListener('submit', onSave);
  tableBody.addEventListener('click', onTableClick);
  filterCamp.addEventListener('change', loadBlocks);
  loadCamps();
}

async function loadCamps() {
  try {
    const response = await listCamps({ includeInactive: 'true' });
    camps = response.data?.camps || response.data?.items || response.data || [];
    if (!Array.isArray(camps)) camps = [];
    fillSelect(
      filterCamp,
      camps.map((c) => ({ value: c._id || c.id, label: c.name })),
      { placeholder: 'Select camp' },
    );
    fillSelect(
      formCampSelect,
      camps.filter((c) => c.isActive !== false).map((c) => ({ value: c._id || c.id, label: c.name })),
      { placeholder: 'Select camp' },
    );
    loadBlocks();
  } catch {
    showToast('Unable to load camps.', 'error');
  }
}

async function loadBlocks() {
  const campId = filterCamp.value;
  if (!campId) {
    blocks = [];
    tableBody.innerHTML = `<tr><td colspan="4" class="empty-state">Select a camp to view blocks.</td></tr>`;
    return;
  }

  try {
    const response = await withLoading(
      () => listBlocks(campId, { includeInactive: 'true' }),
      'Loading blocks…',
    );
    blocks = response.data?.blocks || response.data?.items || response.data || [];
    if (!Array.isArray(blocks)) blocks = [];
    renderTable();
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="4" class="empty-state">Unable to load blocks.</td></tr>`;
    showToast(error instanceof ApiError ? error.message : 'Unable to load blocks.', 'error');
  }
}

function renderTable() {
  if (!blocks.length) {
    tableBody.innerHTML = `<tr><td colspan="4" class="empty-state">No blocks found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = blocks
    .map((block) => {
      const id = block._id || block.id;
      const active = block.isActive !== false;
      const statusBadge = active
        ? '<span class="badge badge-approved">Active</span>'
        : '<span class="badge badge-cancelled">Inactive</span>';
      const toggleButton = active
        ? `<button type="button" class="btn btn-secondary btn-sm" data-action="deactivate" data-id="${escapeHtml(id)}">Deactivate</button>`
        : `<button type="button" class="btn btn-primary btn-sm" data-action="reactivate" data-id="${escapeHtml(id)}">Reactivate</button>`;
      return `
        <tr>
          <td>${escapeHtml(campLabel(block.camp || filterCamp.options[filterCamp.selectedIndex]?.text))}</td>
          <td><strong>${escapeHtml(block.name)}</strong></td>
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

function openBlockModal(block = null) {
  applyFieldErrors(form, {});
  form.reset();
  if (block) {
    titleEl.textContent = 'Edit Block';
    document.getElementById('block-id').value = block._id || block.id;
    const campId = block.camp?._id || block.camp || filterCamp.value;
    formCampSelect.value = campId || '';
    document.getElementById('name').value = block.name || '';
  } else {
    titleEl.textContent = 'Add Block';
    document.getElementById('block-id').value = '';
    if (filterCamp.value) formCampSelect.value = filterCamp.value;
  }
  openModal('block');
}

async function onSave(event) {
  event.preventDefault();
  const values = getFormValues(form);
  const { valid, errors } = validateFields(values, {
    campId: { required: true, label: 'Camp' },
    name: { required: true, label: 'Block Name' },
  });
  applyFieldErrors(form, errors);
  if (!valid) return;

  const campId = values.campId;
  const payload = { name: values.name };

  setButtonLoading(submitBtn, true, 'Saving…');
  try {
    if (values.id) {
      await updateBlock(campId, values.id, payload);
      showToast('Block updated.', 'success');
    } else {
      await createBlock(campId, payload);
      showToast('Block created.', 'success');
    }
    closeModal('block');
    if (filterCamp.value !== campId) filterCamp.value = campId;
    loadBlocks();
  } catch (error) {
    showToast(error instanceof ApiError ? error.message : 'Unable to save block.', 'error');
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

async function onTableClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  const block = blocks.find((b) => String(b._id || b.id) === String(id));
  const campId = filterCamp.value;

  if (action === 'edit' && block) {
    openBlockModal(block);
    return;
  }

  if (action === 'deactivate' && campId) {
    const confirmed = await confirmDialog({
      title: 'Deactivate block',
      message: `Deactivate block ${block?.name || ''}? It will be hidden from booking selectors.`,
      confirmLabel: 'Deactivate',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await withLoading(() => deactivateBlock(campId, id), 'Deactivating…');
      showToast('Block deactivated.', 'success');
      loadBlocks();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Unable to deactivate block.', 'error');
    }
    return;
  }

  if (action === 'delete' && campId) {
    const confirmed = await confirmDialog({
      title: 'Delete block',
      message: `Permanently delete block ${block?.name || ''}? This only works if the block has no rooms.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await withLoading(() => deleteBlock(campId, id), 'Deleting…');
      showToast('Block deleted.', 'success');
      loadBlocks();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Unable to delete block.', 'error');
    }
    return;
  }

  if (action === 'reactivate' && campId) {
    try {
      await withLoading(() => reactivateBlock(campId, id), 'Reactivating…');
      showToast('Block reactivated.', 'success');
      loadBlocks();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Unable to reactivate block.', 'error');
    }
  }
}

const user = requireAuth({ superAdmin: true });
if (user) {
  initAdminShell();
  initModals();
  boot();
}
