import { listCamps } from '../api/camps.js';
import { listBlocks } from '../api/blocks.js';
import { listRooms, createRoom, updateRoom, deactivateRoom, deleteRoom, reactivateRoom } from '../api/rooms.js';
import { listBookings } from '../api/bookings.js';
import { ApiError } from '../api/client.js';
import { requireAuth, isSuperAdmin } from '../auth/session.js';
import { initAdminShell } from '../components/shell.js';
import { initModals, openModal, closeModal, confirmDialog } from '../components/modal.js';
import { withLoading, setButtonLoading } from '../components/loading.js';
import { showToast } from '../components/toast.js';
import { constants, fillSelect } from '../utils/constants.js';
import { escapeHtml, campLabel, statusBadge, roomCurrentGuest, fullName } from '../utils/format.js';
import { applyFieldErrors, getFormValues, validateFields } from '../utils/validation.js';

const tableBody = document.getElementById('rooms-table-body');
const form = document.getElementById('room-form');
const filterCamp = document.getElementById('filter-camp');
const filterBlock = document.getElementById('filter-block');
const searchInput = document.getElementById('filter-search');
const addBtn = document.getElementById('add-room-btn');
const submitBtn = document.getElementById('room-submit');
const titleEl = document.getElementById('room-modal-title');
const formCampSelect = document.getElementById('campId');
const formBlockSelect = document.getElementById('blockId');

let rooms = [];
let camps = [];
let blocks = [];
let canManage = false;
let searchQuery = '';
let roomGuestMap = {};
let loadRoomsTimer = null;
let loadRoomsSeq = 0;
let enrichPromise = null;

const ACTIVE_BOOKING_STATUSES = new Set(['Checked In', 'Booked']);

function guestForRoom(room) {
  const id = room._id || room.id;
  if (roomGuestMap[String(id)]) return roomGuestMap[String(id)];
  return roomCurrentGuest(room);
}

async function enrichRoomsWithGuests() {
  if (enrichPromise) return enrichPromise;

  enrichPromise = (async () => {
    roomGuestMap = {};
    const params = { limit: 100 };
    if (filterCamp.value) params.campId = filterCamp.value;

    try {
      const response = await listBookings(params);
      const bookings = response.data?.bookings || response.data?.items || response.data || [];
      if (!Array.isArray(bookings)) return;

      bookings.forEach((booking) => {
        if (!ACTIVE_BOOKING_STATUSES.has(booking.status)) return;
        const roomId = booking.room?._id || booking.roomId || booking.room;
        if (roomId) {
          roomGuestMap[String(roomId)] = fullName(booking.guest || booking);
        }
      });
    } catch {
      /* guest column is optional enrichment */
    }
  })().finally(() => {
    enrichPromise = null;
  });

  return enrichPromise;
}

function boot() {
  fillSelect(document.getElementById('status'), constants.ROOM_STATUSES, {
    placeholder: 'Select status',
  });

  if (canManage) {
    addBtn?.addEventListener('click', () => openRoomModal());
    form?.addEventListener('submit', onSave);
  } else if (addBtn) {
    addBtn.hidden = true;
  }

  tableBody.addEventListener('click', onTableClick);
  filterCamp.addEventListener('change', () => loadBlocksForFilter(filterCamp.value));
  filterBlock.addEventListener('change', loadRooms);
  searchInput?.addEventListener('input', () => {
    searchQuery = searchInput.value.trim().toLowerCase();
    renderTable();
  });

  formCampSelect?.addEventListener('change', () => loadBlocksForForm(formCampSelect.value));
  loadCamps();
}

async function loadCamps() {
  try {
    const response = await listCamps({ includeInactive: canManage ? 'true' : undefined });
    camps = response.data?.camps || response.data?.items || response.data || [];
    if (!Array.isArray(camps)) camps = [];
    const options = camps.map((c) => ({ value: c._id || c.id, label: c.name || c.campName }));
    fillSelect(filterCamp, options, { placeholder: 'All camps' });
    if (canManage) {
      fillSelect(
        formCampSelect,
        camps.filter((c) => c.isActive !== false).map((c) => ({ value: c._id || c.id, label: c.name || c.campName })),
        { placeholder: 'Select camp' },
      );
    }
    loadRooms();
  } catch {
    showToast('Unable to load camps.', 'error');
    loadRooms();
  }
}

async function loadBlocksForFilter(campId) {
  if (!campId) {
    fillSelect(filterBlock, [], { placeholder: 'All blocks' });
    loadRooms();
    return;
  }
  try {
    const response = await listBlocks(campId, { includeInactive: canManage ? 'true' : undefined });
    const items = response.data?.blocks || response.data?.items || response.data || [];
    fillSelect(
      filterBlock,
      (Array.isArray(items) ? items : []).map((b) => ({
        value: b._id || b.id,
        label: b.name || b.blockName || b.block,
      })),
      { placeholder: 'All blocks' },
    );
    loadRooms();
  } catch (error) {
    showToast(error instanceof ApiError ? error.message : 'Unable to load blocks.', 'error');
    loadRooms();
  }
}

async function loadBlocksForForm(campId, selectedBlockId = '') {
  formBlockSelect.innerHTML = '<option value="">Select camp first</option>';
  formBlockSelect.disabled = !campId;
  if (!campId) return;

  const response = await listBlocks(campId, { includeInactive: 'true' });
  const items = response.data?.blocks || response.data?.items || response.data || [];
  fillSelect(
    formBlockSelect,
    (Array.isArray(items) ? items : [])
      .filter((b) => b.isActive !== false)
      .map((b) => ({
        value: b._id || b.id,
        label: b.name || b.blockName || b.block,
      })),
    { placeholder: 'Select block', value: selectedBlockId },
  );
  formBlockSelect.disabled = false;
}

function loadRooms() {
  window.clearTimeout(loadRoomsTimer);
  loadRoomsTimer = window.setTimeout(() => {
    runLoadRooms();
  }, 250);
}

async function runLoadRooms() {
  const seq = ++loadRoomsSeq;

  try {
    const query = {};
    if (canManage) query.includeInactive = 'true';
    if (filterCamp.value) query.campId = filterCamp.value;
    if (filterBlock.value) query.blockId = filterBlock.value;

    const response = await withLoading(() => listRooms(query), 'Loading rooms…');
    if (seq !== loadRoomsSeq) return;

    rooms = response.data?.rooms || response.data?.items || response.data || [];
    if (!Array.isArray(rooms)) rooms = [];
    renderTable();

    await enrichRoomsWithGuests();
    if (seq !== loadRoomsSeq) return;
    renderTable();
  } catch (error) {
    if (seq !== loadRoomsSeq) return;
    tableBody.innerHTML = `<tr><td colspan="8" class="empty-state">Unable to load rooms.</td></tr>`;
    const message = error instanceof ApiError ? error.message : 'Unable to load rooms.';
    showToast(message, 'error');
  }
}

function filteredRooms() {
  if (!searchQuery) return rooms;
  return rooms.filter((room) => {
    const number = String(room.roomNumber || '').toLowerCase();
    const guest = guestForRoom(room).toLowerCase();
    return number.includes(searchQuery) || guest.includes(searchQuery);
  });
}

function renderTable() {
  const visible = filteredRooms();
  if (!visible.length) {
    tableBody.innerHTML = `<tr><td colspan="8" class="empty-state">No rooms found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = visible
    .map((room) => {
      const id = room._id || room.id;
      const active = room.isActive !== false;
      const recordBadge = active
        ? '<span class="badge badge-approved">Active</span>'
        : '<span class="badge badge-cancelled">Inactive</span>';
      const isMaintenance = room.status === 'Maintenance';

      let actions = '';
      if (canManage) {
        const toggleMaintLabel = isMaintenance ? 'Mark Available' : 'Maintenance';
        const toggleMaintAction = isMaintenance ? 'mark-available' : 'maintenance';
        const toggleMaintClass = isMaintenance ? 'btn-primary' : 'btn-secondary';
        const toggleButton = active
          ? `<button type="button" class="btn btn-secondary btn-sm" data-action="deactivate" data-id="${escapeHtml(id)}">Deactivate</button>`
          : `<button type="button" class="btn btn-primary btn-sm" data-action="reactivate" data-id="${escapeHtml(id)}">Reactivate</button>`;
        actions = `
          <div class="table-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-action="edit" data-id="${escapeHtml(id)}">Edit</button>
            <button type="button" class="btn ${toggleMaintClass} btn-sm" data-action="${toggleMaintAction}" data-id="${escapeHtml(id)}">${toggleMaintLabel}</button>
            ${toggleButton}
            <button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="${escapeHtml(id)}">Delete</button>
          </div>
        `;
      }

      return `
        <tr>
          <td>${escapeHtml(campLabel(room.camp))}</td>
          <td>${escapeHtml(room.block?.name || room.blockName || room.block || '—')}</td>
          <td>${escapeHtml(room.roomNumber)}</td>
          <td>${escapeHtml(guestForRoom(room))}</td>
          <td>${escapeHtml(room.capacity)}</td>
          <td>${statusBadge(room.status)}</td>
          <td>${recordBadge}</td>
          <td>${actions || '—'}</td>
        </tr>
      `;
    })
    .join('');
}

async function openRoomModal(room = null) {
  applyFieldErrors(form, {});
  form.reset();

  if (room) {
    titleEl.textContent = 'Edit Room';
    document.getElementById('room-id').value = room._id || room.id;
    const campId = room.campId || room.camp?._id || room.camp?.id;
    const blockId = room.blockId || room.block?._id || room.block?.id;
    formCampSelect.value = campId || '';
    await loadBlocksForForm(campId, blockId);
    document.getElementById('roomNumber').value = room.roomNumber || '';
    document.getElementById('capacity').value = room.capacity ?? '';
    document.getElementById('status').value = room.status || '';
  } else {
    titleEl.textContent = 'Add Room';
    document.getElementById('room-id').value = '';
    if (filterCamp.value) {
      formCampSelect.value = filterCamp.value;
      await loadBlocksForForm(filterCamp.value, filterBlock.value);
    }
  }
  openModal('room');
}

async function onSave(event) {
  event.preventDefault();
  const values = getFormValues(form);
  values.capacity = values.capacity ? Number(values.capacity) : '';

  const { valid, errors } = validateFields(values, {
    campId: { required: true, label: 'Camp' },
    blockId: { required: true, label: 'Block' },
    roomNumber: { required: true, label: 'Room Number' },
    capacity: {
      required: true,
      label: 'Capacity',
      custom: (value) => (Number(value) >= 1 ? null : 'Capacity must be at least 1.'),
    },
    status: { required: true, label: 'Status' },
  });

  applyFieldErrors(form, errors);
  if (!valid) return;

  const payload = {
    campId: values.campId,
    blockId: values.blockId,
    roomNumber: values.roomNumber,
    capacity: Number(values.capacity),
    status: values.status,
  };

  setButtonLoading(submitBtn, true, 'Saving…');
  try {
    if (values.id) {
      await updateRoom(values.id, payload);
      showToast('Room updated.', 'success');
    } else {
      await createRoom(payload);
      showToast('Room created.', 'success');
    }
    closeModal('room');
    loadRooms();
  } catch (error) {
    showToast(error instanceof ApiError ? error.message : 'Unable to save room.', 'error');
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

async function toggleMaintenance(room, id) {
  const nextStatus = room.status === 'Maintenance' ? 'Available' : 'Maintenance';
  const label = nextStatus === 'Maintenance' ? 'mark as maintenance' : 'mark as available';
  const confirmed = await confirmDialog({
    title: nextStatus === 'Maintenance' ? 'Maintenance mode' : 'Mark available',
    message: `${nextStatus === 'Maintenance' ? 'Mark' : 'Set'} room ${room.roomNumber} ${label}?`,
    confirmLabel: nextStatus === 'Maintenance' ? 'Maintenance' : 'Mark Available',
    danger: nextStatus === 'Maintenance',
  });
  if (!confirmed) return;

  try {
    await withLoading(
      () => updateRoom(id, { status: nextStatus }),
      'Updating room…',
    );
    showToast(`Room ${nextStatus === 'Maintenance' ? 'marked maintenance' : 'marked available'}.`, 'success');
    loadRooms();
  } catch (error) {
    showToast(error instanceof ApiError ? error.message : 'Unable to update room.', 'error');
  }
}

async function onTableClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button || !canManage) return;
  const { action, id } = button.dataset;
  const room = rooms.find((r) => String(r._id || r.id) === String(id));

  if (action === 'edit' && room) {
    await openRoomModal(room);
    return;
  }

  if (action === 'maintenance' || action === 'mark-available') {
    if (room) await toggleMaintenance(room, id);
    return;
  }

  if (action === 'deactivate') {
    const confirmed = await confirmDialog({
      title: 'Deactivate room',
      message: `Deactivate room ${room?.roomNumber}? It will be hidden from booking selectors.`,
      confirmLabel: 'Deactivate',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await withLoading(() => deactivateRoom(id), 'Deactivating…');
      showToast('Room deactivated.', 'success');
      loadRooms();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Unable to deactivate room.', 'error');
    }
    return;
  }

  if (action === 'reactivate') {
    try {
      await withLoading(() => reactivateRoom(id), 'Reactivating…');
      showToast('Room reactivated.', 'success');
      loadRooms();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Unable to reactivate room.', 'error');
    }
    return;
  }

  if (action === 'delete') {
    const confirmed = await confirmDialog({
      title: 'Delete room',
      message: `Permanently delete room ${room?.roomNumber}? This only works if the room has never been used in a booking.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await withLoading(() => deleteRoom(id), 'Deleting…');
      showToast('Room deleted.', 'success');
      loadRooms();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Unable to delete room.', 'error');
    }
  }
}

const user = requireAuth();
if (user) {
  canManage = isSuperAdmin(user);
  initAdminShell();
  initModals();
  boot();
}
