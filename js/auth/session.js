import { config } from '../config.js';

export function getToken() {
  return localStorage.getItem(config.TOKEN_KEY);
}

export function getUser() {
  const raw = localStorage.getItem(config.USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  localStorage.setItem(config.TOKEN_KEY, token);
  localStorage.setItem(config.USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(config.TOKEN_KEY);
  localStorage.removeItem(config.USER_KEY);
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export function isSuperAdmin(user = getUser()) {
  return user?.role === 'Super Admin';
}

export function isAccommodationOfficer(user = getUser()) {
  return user?.role === 'Accommodation Officer' || isSuperAdmin(user);
}

/**
 * Protects admin pages. Redirects to login when unauthenticated.
 * Optionally requires Super Admin.
 */
export function requireAuth({ superAdmin = false } = {}) {
  if (!isAuthenticated()) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/admin/login.html?redirect=${redirect}`;
    return null;
  }

  const user = getUser();
  if (superAdmin && !isSuperAdmin(user)) {
    window.location.href = '/admin/dashboard.html';
    return null;
  }

  return user;
}
