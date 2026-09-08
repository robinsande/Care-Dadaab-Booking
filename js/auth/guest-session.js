const TOKEN_KEY = 'cams_guest_token';
const USER_KEY = 'cams_guest_user';

export const getGuestToken = () => localStorage.getItem(TOKEN_KEY);
export const getGuest = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
};
export const setGuestSession = (token, guest) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(guest));
};
export const clearGuestSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};
