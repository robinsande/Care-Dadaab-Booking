import { listCamps } from '../api/camps.js';
import { listBlocks } from '../api/blocks.js';
import { listAvailableRooms } from '../api/rooms.js';
import { getCampRates } from '../api/rates.js';
import { ApiError } from '../api/client.js';
import { fillSelect } from '../utils/constants.js';
import { formatMoney } from '../utils/format.js';

/**
 * Cascading Camp → Block → Room selectors with availability check and rate display.
 */
export function createCampSelectors({
  campSelect,
  blockSelect,
  roomSelect,
  stayTypeSelect,
  rateDisplay,
  arrivalInput,
  departureInput,
  onRateChange,
}) {
  const state = {
    camps: [],
    blocks: [],
    rooms: [],
    appliedRate: null,
    currency: 'KES',
  };

  let locationLocked = false;

  function setLocationLocked(locked) {
    locationLocked = locked;
    campSelect.disabled = locked;
    blockSelect.disabled = locked || !campSelect.value;
    roomSelect.disabled = locked || !blockSelect.value;
    if (stayTypeSelect) stayTypeSelect.disabled = locked;
    if (arrivalInput) arrivalInput.readOnly = locked;
    if (departureInput) departureInput.readOnly = locked;
  }

  async function loadCamps(selectedId = '') {
    const response = await listCamps();
    const data = response.data;
    state.camps = data?.camps || data?.items || data || [];
    if (!Array.isArray(state.camps)) state.camps = [];

    fillSelect(
      campSelect,
      state.camps.map((c) => ({
        value: c._id || c.id,
        label: c.name || c.campName,
      })),
      { placeholder: 'Select camp', value: selectedId },
    );

    if (selectedId) {
      await loadBlocks(selectedId);
    }
  }

  async function loadBlocks(campId, selectedBlockId = '') {
    blockSelect.innerHTML = '<option value="">Loading blocks…</option>';
    blockSelect.disabled = true;
    roomSelect.innerHTML = '<option value="">Select block first</option>';
    roomSelect.disabled = true;

    if (!campId) {
      fillSelect(blockSelect, [], { placeholder: 'Select camp first' });
      return;
    }

    const response = await listBlocks(campId);
    const data = response.data;
    state.blocks = data?.blocks || data?.items || data || [];
    if (!Array.isArray(state.blocks)) state.blocks = [];

    fillSelect(
      blockSelect,
      state.blocks.map((b) => ({
        value: b._id || b.id,
        label: b.name || b.blockName || b.block,
      })),
      { placeholder: 'Select block', value: selectedBlockId },
    );
    blockSelect.disabled = locationLocked;

    if (selectedBlockId) {
      await loadRooms(campId, selectedBlockId);
    }
  }

  async function loadRooms(campId, blockId, selectedRoomId = '') {
    roomSelect.innerHTML = '<option value="">Loading rooms…</option>';
    roomSelect.disabled = true;

    const arrival = arrivalInput?.value;
    const departure = departureInput?.value;

    if (!campId || !blockId || !arrival || !departure) {
      roomSelect.innerHTML = '<option value="">Select dates and block</option>';
      return;
    }

    const response = await listAvailableRooms({
      campId,
      blockId,
      arrivalDate: arrival,
      departureDate: departure,
    });

    const data = response.data;
    state.rooms = data?.rooms || data?.items || data || [];
    if (!Array.isArray(state.rooms)) state.rooms = [];

    if (!state.rooms.length) {
      roomSelect.innerHTML = '<option value="">No available rooms</option>';
      return;
    }

    fillSelect(
      roomSelect,
      state.rooms.map((room) => ({
        value: room._id || room.id,
        label: `Room ${room.roomNumber}${room.capacity ? ` (cap ${room.capacity})` : ''}`,
      })),
      { placeholder: 'Select room', value: selectedRoomId },
    );
    roomSelect.disabled = locationLocked;
  }

  function setRateMessage(message) {
    if (rateDisplay) rateDisplay.textContent = message;
  }

  async function updateRateDisplay() {
    const campId = campSelect.value;
    const stayType = stayTypeSelect?.value;

    if (!campId || !stayType) {
      setRateMessage('Select camp and stay type to view rate.');
      state.appliedRate = null;
      onRateChange?.(null);
      return;
    }

    try {
      const response = await getCampRates(campId);
      const ratesList = Array.isArray(response.data)
        ? response.data
        : response.data?.rates || [];

      const entry = ratesList.find((r) => r.stayType === stayType);
      const rateDoc = entry?.rate || entry;
      state.currency = rateDoc?.currency || 'KES';

      const rateValue = rateDoc?.amount;

      if (rateValue === undefined || rateValue === null) {
        setRateMessage('No rate configured for this camp and stay type.');
        state.appliedRate = null;
      } else {
        state.appliedRate = Number(rateValue);
        setRateMessage(`${stayType}: ${formatMoney(rateValue, state.currency)}`);
      }
      onRateChange?.(state.appliedRate, state.currency);
    } catch {
      setRateMessage('Unable to load rate.');
      state.appliedRate = null;
      onRateChange?.(null);
    }
  }

  campSelect.addEventListener('change', async () => {
    await loadBlocks(campSelect.value);
    await updateRateDisplay();
  });

  blockSelect.addEventListener('change', async () => {
    await loadRooms(campSelect.value, blockSelect.value);
  });

  if (stayTypeSelect) {
    stayTypeSelect.addEventListener('change', () => updateRateDisplay());
  }

  const refreshRooms = async () => {
    if (campSelect.value && blockSelect.value) {
      await loadRooms(campSelect.value, blockSelect.value, roomSelect.value);
    }
  };

  arrivalInput?.addEventListener('change', refreshRooms);
  departureInput?.addEventListener('change', refreshRooms);

  return {
    loadCamps,
    loadBlocks,
    loadRooms,
    updateRateDisplay,
    setLocationLocked,
    getAppliedRate: () => state.appliedRate,
    getCurrency: () => state.currency,
    async init({
      campId = '',
      blockId = '',
      roomId = '',
      stayType = '',
      lockLocation = false,
    } = {}) {
      await loadCamps(campId);
      if (campId) {
        await loadBlocks(campId, blockId);
        if (blockId && arrivalInput?.value && departureInput?.value) {
          await loadRooms(campId, blockId, roomId);
        }
      }
      if (stayType && stayTypeSelect) {
        stayTypeSelect.value = stayType;
      }
      setLocationLocked(lockLocation);
      await updateRateDisplay();
    },
    handleError(error) {
      const message =
        error instanceof ApiError ? error.message : 'Unable to load location data.';
      return message;
    },
  };
}
