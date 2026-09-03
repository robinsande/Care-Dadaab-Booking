/**
 * Application configuration.
 * Update API_BASE_URL to point at the backend server.
 */
export const config = {
  API_BASE_URL: window.__API_BASE_URL__ || 'http://localhost:5000/api/v1',
  APP_NAME: 'CAMS',
  APP_TITLE: 'CARE Accommodation Management System',
  BRAND_LOGO_SRC: '/assets/care-logo.jpg',
  TOKEN_KEY: 'cams_token',
  USER_KEY: 'cams_user',
};

/** Apply the canonical CARE logo to all brand image elements. */
export function applyBrandLogos(root = document) {
  root.querySelectorAll('.brand-logo, .invoice-document-logo').forEach((img) => {
    if (!img.src.startsWith('data:')) {
      img.src = config.BRAND_LOGO_SRC;
    }
    img.alt = 'CARE';
  });
}

export function resolveAssetUrl(path) {
  if (!path || path.startsWith('http') || path.startsWith('data:')) return path;
  return new URL(path, window.location.origin).href;
}

let logoDataUrlCache = null;

/** Embed logo as data URL so it appears in printed PDFs. */
export async function getBrandLogoDataUrl() {
  if (logoDataUrlCache) return logoDataUrlCache;

  const url = resolveAssetUrl(config.BRAND_LOGO_SRC);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Logo fetch failed');
    const blob = await response.blob();
    logoDataUrlCache = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return logoDataUrlCache;
  } catch {
    return url;
  }
}
