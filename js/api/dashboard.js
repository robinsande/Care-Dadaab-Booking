import { api } from './client.js';

export function getDashboardStats() {
  return api.get('/dashboard');
}
