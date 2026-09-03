import { api } from './client.js';

export function listCamps(params = {}) {
  return api.get('/camps', { query: params });
}

export function getCamp(id) {
  return api.get(`/camps/${id}`);
}

export function createCamp(payload) {
  return api.post('/camps', payload);
}

export function updateCamp(id, payload) {
  return api.put(`/camps/${id}`, payload);
}

export function deactivateCamp(id) {
  return api.put(`/camps/${id}`, { isActive: false });
}

export function deleteCamp(id) {
  return api.delete(`/camps/${id}`);
}

export function reactivateCamp(id) {
  return api.put(`/camps/${id}`, { isActive: true });
}
