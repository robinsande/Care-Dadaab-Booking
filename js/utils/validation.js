/** Shared validation helpers for forms. */

export function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

export function isValidEmail(email) {
  if (isBlank(email)) return false;
  // Practical email check — backend re-validates.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

export function isValidPhone(phone) {
  if (isBlank(phone)) return false;
  const digits = String(phone).replace(/[^\d+]/g, '');
  return digits.length >= 7;
}

export function todayISODate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseISODate(value) {
  if (isBlank(value)) return null;
  const [y, m, d] = String(value).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function isArrivalValid(arrivalDate) {
  const arrival = parseISODate(arrivalDate);
  if (!arrival) return false;
  const today = parseISODate(todayISODate());
  return arrival >= today;
}

export function isDepartureAfterArrival(arrivalDate, departureDate) {
  const arrival = parseISODate(arrivalDate);
  const departure = parseISODate(departureDate);
  if (!arrival || !departure) return false;
  return departure > arrival;
}

/**
 * Validate a map of field rules.
 * rules[field] = { required?, email?, phone?, custom?: (value, values) => string|null, label? }
 * Returns { valid, errors: { field: message } }
 */
export function validateFields(values, rules) {
  const errors = {};

  Object.entries(rules).forEach(([field, rule]) => {
    const value = values[field];
    const label = rule.label || field;

    if (rule.required && isBlank(value)) {
      errors[field] = `${label} is required.`;
      return;
    }

    if (!isBlank(value)) {
      if (rule.email && !isValidEmail(value)) {
        errors[field] = 'Enter a valid email address.';
        return;
      }
      if (rule.phone && !isValidPhone(value)) {
        errors[field] = 'Enter a valid phone number.';
        return;
      }
    }

    if (typeof rule.custom === 'function') {
      const message = rule.custom(value, values);
      if (message) {
        errors[field] = message;
      }
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function applyFieldErrors(form, errors) {
  form.querySelectorAll('[data-error-for]').forEach((el) => {
    el.textContent = '';
  });
  form.querySelectorAll('.is-invalid').forEach((el) => {
    el.classList.remove('is-invalid');
    el.removeAttribute('aria-invalid');
  });

  Object.entries(errors).forEach(([field, message]) => {
    const input = form.querySelector(`[name="${field}"]`);
    const errorEl = form.querySelector(`[data-error-for="${field}"]`);
    if (input) {
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
    }
    if (errorEl) {
      errorEl.textContent = message;
    }
  });
}

export function clearFieldErrors(form) {
  applyFieldErrors(form, {});
}

export function getFormValues(form) {
  const data = new FormData(form);
  const values = {};

  for (const [key, value] of data.entries()) {
    const field = form.elements.namedItem(key);
    if (field && field.type === 'checkbox') {
      values[key] = field.checked;
    } else {
      values[key] = typeof value === 'string' ? value.trim() : value;
    }
  }

  // Include unchecked checkboxes
  form.querySelectorAll('input[type="checkbox"][name]').forEach((checkbox) => {
    if (!(checkbox.name in values)) {
      values[checkbox.name] = checkbox.checked;
    }
  });

  return values;
}
