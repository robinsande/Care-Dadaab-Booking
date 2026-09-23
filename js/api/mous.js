import { api } from './client.js';

export function listMous(params = {}) {
  return api.get('/mous', { query: params });
}
