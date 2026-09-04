import { api } from './client.js';

export function listBookings(params = {}) {
  return api.get('/bookings', { query: params });
}

export function getBooking(id) {
  return api.get(`/bookings/${id}`);
}

export function createBooking(payload) {
  return api.post('/bookings', payload);
}

export function updateBooking(id, payload) {
  return api.put(`/bookings/${id}`, payload);
}

export function cancelBooking(id, { reason }) {
  return api.post(`/bookings/${id}/cancel`, { reason });
}

export function checkInBooking(id) {
  return api.post(`/bookings/${id}/check-in`);
}

export function checkOutBooking(id, checkoutReason = null) {
  return api.post(`/bookings/${id}/check-out`, checkoutReason ? { checkoutReason } : {});
}

export function generateInvoiceForBooking(id) {
  return api.post(`/bookings/${id}/generate-invoice`);
}

export function deleteBooking(id) {
  return api.delete(`/bookings/${id}`);
}
