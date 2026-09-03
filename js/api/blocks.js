import { api } from './client.js';

export function listBlocks(campId, params = {}) {
  return api.get(`/camps/${campId}/blocks`, { query: params });
}

export function getBlock(campId, blockId) {
  return api.get(`/camps/${campId}/blocks/${blockId}`);
}

export function createBlock(campId, payload) {
  return api.post(`/camps/${campId}/blocks`, payload);
}

export function updateBlock(campId, blockId, payload) {
  return api.put(`/camps/${campId}/blocks/${blockId}`, payload);
}

export function deactivateBlock(campId, blockId) {
  return api.put(`/camps/${campId}/blocks/${blockId}`, { isActive: false });
}

export function deleteBlock(campId, blockId) {
  return api.delete(`/camps/${campId}/blocks/${blockId}`);
}

export function reactivateBlock(campId, blockId) {
  return api.put(`/camps/${campId}/blocks/${blockId}`, { isActive: true });
}
