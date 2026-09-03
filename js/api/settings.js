import { api } from './client.js';

export function getSettings() {
  return api.get('/settings');
}

export function updateSettings(payload) {
  return api.put('/settings', payload);
}
