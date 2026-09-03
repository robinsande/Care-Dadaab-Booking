import { config } from '../config.js';
import {
  escapeHtml,
  formatDate,
  formatMoney,
  fullName,
  nightsBetween,
  yesNo,
} from '../utils/format.js';

function invoiceNights(invoice) {
  if (invoice.numberOfNights != null && invoice.numberOfNights !== '') {
    return Number(invoice.numberOfNights);
  }
  return nightsBetween(invoice.arrivalDate, invoice.departureDate);
}

function paymentValue(payment, ...keys) {
  for (const key of keys) {
    const value = payment?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '—';
}

function detailRow(label, value) {
  if (value === undefined || value === null || value === '') return '';
  return `
    <div class="invoice-detail-row">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(String(value))}</dd>
    </div>
  `;
}

/**
 * Renders a printable invoice document (no actions or admin controls).
 */
export function renderInvoiceDocument(invoice, { logoSrc = config.BRAND_LOGO_SRC } = {}) {
  const guest = invoice.guest || invoice;
  const payment = invoice.paymentInstructions || invoice.payment || {};
  const currency = invoice.appliedRate?.currency || 'KES';
  const rateAmount = invoice.appliedRate?.amount ?? invoice.appliedRate;
  const nights = invoiceNights(invoice);
  const nightsLabel = nights == null ? '—' : String(nights);
  const issuedDate = formatDate(
    invoice.generatedAt || invoice.issuedAt || invoice.createdAt || invoice.invoiceDate,
  );
  const lineTotal = invoice.totalAmount != null
    ? formatMoney(invoice.totalAmount, currency)
    : (nights != null && rateAmount != null
      ? formatMoney(Number(rateAmount) * nights, currency)
      : '—');

  return `
    <article class="invoice-document">
      <header class="invoice-document-header">
        <div class="invoice-document-brand">
          <img class="invoice-document-logo" src="${escapeHtml(logoSrc)}" alt="CARE">
          <div>
            <p class="invoice-document-subtitle">CARE Kenya · Accommodation Invoice</p>
          </div>
        </div>
        <div class="invoice-document-meta">
          <p class="invoice-document-number">${escapeHtml(invoice.invoiceNumber || '—')}</p>
          <p class="invoice-document-date">Issued ${escapeHtml(issuedDate)}</p>
          <p class="invoice-document-ref">Booking ${escapeHtml(invoice.bookingReference || '—')}</p>
        </div>
      </header>

      <section class="invoice-document-section">
        <h3>Guest Details</h3>
        <dl class="invoice-detail-list">
          ${detailRow('Name', fullName(guest))}
          ${detailRow('Email', guest.email)}
          ${detailRow('Phone', guest.phone)}
          ${detailRow('Organisation', guest.organisation)}
          ${detailRow('Contract Type', guest.contractType)}
          ${detailRow('Departure Country', guest.departureCountry)}
        </dl>
      </section>

      <section class="invoice-document-section">
        <h3>Accommodation</h3>
        <dl class="invoice-detail-list">
          ${detailRow('Camp', invoice.campName)}
          ${detailRow('Block', invoice.blockName)}
          ${detailRow('Room', invoice.roomNumber)}
          ${detailRow('Arrival', formatDate(invoice.arrivalDate))}
          ${detailRow('Departure', formatDate(invoice.departureDate))}
          ${detailRow('Number of Nights', nightsLabel)}
          ${detailRow('Stay Type', invoice.stayType)}
          ${detailRow('Driver Pickup', yesNo(guest.driverPickup ?? invoice.driverPickup))}
        </dl>
      </section>

      <section class="invoice-document-section">
        <h3>Charges</h3>
        <table class="invoice-charges-table" aria-label="Invoice charges">
          <thead>
            <tr>
              <th>Description</th>
              <th>Rate</th>
              <th>Nights</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${escapeHtml(invoice.stayType || 'Accommodation')} — ${escapeHtml(invoice.campName || '—')}</td>
              <td>${escapeHtml(formatMoney(rateAmount, currency))}</td>
              <td>${escapeHtml(nightsLabel)}</td>
              <td><strong>${escapeHtml(lineTotal)}</strong></td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3">Total Due</td>
              <td><strong class="invoice-document-total">${escapeHtml(lineTotal)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section class="invoice-document-section invoice-document-payment">
        <h3>Payment Instructions</h3>
        <p class="invoice-document-payment-intro">Please settle this invoice using one of the following methods:</p>
        <dl class="invoice-detail-list">
          ${detailRow('M-Pesa Paybill', paymentValue(payment, 'mpesaPaybillNumber', 'mpesaPaybill'))}
          ${detailRow('Bank', paymentValue(payment, 'bankName'))}
          ${detailRow('Account Name', paymentValue(payment, 'bankAccountName', 'accountName'))}
          ${detailRow('Account Number', paymentValue(payment, 'bankAccountNumber', 'accountNumber'))}
        </dl>
        <p class="invoice-document-note">Use invoice number <strong>${escapeHtml(invoice.invoiceNumber || '—')}</strong> or booking reference <strong>${escapeHtml(invoice.bookingReference || '—')}</strong> as payment reference.</p>
      </section>
    </article>
  `;
}
