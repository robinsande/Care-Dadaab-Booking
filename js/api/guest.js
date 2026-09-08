import { apiRequest } from './client.js';
import { getGuestToken } from '../auth/guest-session.js';

const request = (path, options = {}) => apiRequest(path, {
  ...options,
  auth: false,
  headers: { ...(options.headers || {}), Authorization: `Bearer ${getGuestToken() || ''}` },
});
export const guestRegister = (payload) => apiRequest('/guest/auth/register', { method: 'POST', body: payload, auth: false });
export const guestLogin = (payload) => apiRequest('/guest/auth/login', { method: 'POST', body: payload, auth: false });
export const guestRequestReset = (email) => apiRequest('/guest/auth/request-reset', { method: 'POST', body: { email }, auth: false });
export const updateGuestProfile = (payload) => request('/guest/auth/me', { method: 'PUT', body: payload });
export const guestResetPassword = (token, newPassword) => apiRequest('/guest/auth/reset', { method: 'POST', body: { token, newPassword }, auth: false });
export const listGuestCamps = () => apiRequest('/guest/camps', { auth: false });
export const listGuestCampRates = (campId) => apiRequest(`/guest/camps/${campId}/rates`, { auth: false });
export const listGuestBookings = () => request('/guest/bookings');
export const listGuestRequests = () => request('/guest/requests');
export const submitBookingRequest = (payload) => request('/guest/requests', { method: 'POST', body: payload });
export const submitBookingAdjustment = (bookingId, payload) => request(`/guest/bookings/${bookingId}/requests`, { method: 'POST', body: payload });
export const listStaffGuestRequests = (params = {}) => apiRequest('/guest/staff/requests', { query: params });
export const resolveGuestRequest = (id, payload) => apiRequest(`/guest/staff/requests/${id}/resolve`, { method: 'POST', body: payload });
export const listAvailableRoomsForGuestRequest = (params = {}) => apiRequest('/rooms/available', { query: params });
export const listCampRoomsForGuestRequest = (campId) => apiRequest('/rooms', { query: { campId } });
