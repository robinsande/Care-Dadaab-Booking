import { api } from './client.js';

export function getCampRates(campId) {
  return api.get(`/camps/${campId}/rates`);
}

export function getCampRateHistory(campId, params = {}) {
  return api.get(`/camps/${campId}/rates/history`, { query: params });
}

/** Creates a new rate version for one stay type (backend uses POST, not PUT). */
export function createCampRate(campId, payload) {
  return api.post(`/camps/${campId}/rates`, payload);
}
