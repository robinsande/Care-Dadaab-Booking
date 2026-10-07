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
  return '';
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

function invoiceLine(invoice, currency, amount, quantity, rateAmount) {
  const location = [invoice.campName, invoice.blockName && `Block ${invoice.blockName}`, invoice.roomNumber && `Room ${invoice.roomNumber}`]
    .filter(Boolean)
    .join(' · ');
  const stayLabel = invoice.stayType || 'Accommodation';
  const period = invoice.appliedRate?.ratePeriod === 'per_month' ? 'month' : 'night';
  return `
    <tr>
      <td>${escapeHtml(stayLabel)}${location ? `<span class="invoice-item-detail">${escapeHtml(location)}</span>` : ''}</td>
      <td>${escapeHtml(quantity)}</td>
      <td>${escapeHtml(formatMoney(rateAmount, currency))}<span class="invoice-item-detail">per ${escapeHtml(period)}</span></td>
      <td><strong>${escapeHtml(formatMoney(amount, currency))}</strong></td>
    </tr>
  `;
}

/**
 * Renders the invoice or paid-receipt layout used for both screen and print.
 */
export function renderInvoiceDocument(invoice, { logoSrc = config.BRAND_LOGO_SRC } = {}) {
  const guest = invoice.guest || invoice;
  const payment = invoice.paymentInstructions || invoice.payment || {};
  const currency = invoice.appliedRate?.currency || 'KES';
  const rateAmount = Number(invoice.appliedRate?.amount ?? invoice.appliedRate ?? 0);
  const nights = invoiceNights(invoice);
  const quantity = invoice.durationMonths || nights || 0;
  const period = invoice.durationMonths ? 'months' : 'nights';
  const isPaid = String(invoice.paymentStatus || '').toLowerCase() === 'paid';
  const documentDate = formatDate(
    isPaid
      ? invoice.paidAt || invoice.generatedAt || invoice.createdAt
      : invoice.generatedAt || invoice.issuedAt || invoice.createdAt || invoice.invoiceDate,
  );
  const amount = Number(invoice.totalAmount ?? rateAmount * quantity);
  const extensionCost = Number(invoice.extensionCost || 0);
  const receiptNumber = `RCPT-${invoice.invoiceNumber || invoice.bookingReference || '—'}`;
  const paymentMethod = invoice.paymentMethod || (isPaid ? 'Recorded payment' : '');
  const paymentReference = invoice.paymentTransactionId || invoice.bookingReference;
  const paymentRows = [
    detailRow('M-Pesa Till / Paybill', paymentValue(payment, 'mpesaTillNumber', 'mpesaPaybillNumber')),
    detailRow('Bank', paymentValue(payment, 'bankName')),
    detailRow('Account Name', paymentValue(payment, 'bankAccountName')),
    detailRow('Account Number', paymentValue(payment, 'bankAccountNumber')),
  ].filter(Boolean).join('');

  return `
    <article class="invoice-document${isPaid ? ' invoice-document-receipt' : ''}">
      <header class="invoice-document-header">
        <div class="invoice-document-brand">
          <img class="invoice-document-logo" src="${escapeHtml(logoSrc)}" alt="CARE">
          <div>
            <p class="invoice-document-subtitle">CARE Kenya · Dadaab</p>
            <p class="invoice-document-system">Accommodation Management System</p>
          </div>
        </div>
        <div class="invoice-document-meta">
          <h1>${isPaid ? 'PAYMENT RECEIPT' : 'INVOICE'}</h1>
          <p class="invoice-document-number">${escapeHtml(isPaid ? receiptNumber : `NO: ${invoice.invoiceNumber || '—'}`)}</p>
          <p class="invoice-document-date">${isPaid ? 'Paid' : 'Date'}: ${escapeHtml(documentDate)}</p>
        </div>
      </header>

      <section class="invoice-parties">
        <div class="invoice-party">
          <h2>Bill To:</h2>
          <p class="invoice-party-name">${escapeHtml(fullName(guest) || 'Guest')}</p>
          ${guest.email ? `<p>${escapeHtml(guest.email)}</p>` : ''}
          ${guest.phone ? `<p>${escapeHtml(guest.phone)}</p>` : ''}
          <p>${escapeHtml(invoice.bookingReference || '—')}</p>
        </div>
        <div class="invoice-party invoice-party-from">
          <h2>From:</h2>
          <p class="invoice-party-name">CARE Kenya — Dadaab</p>
          <p>Accommodation Management System</p>
          <p>accommodation.dadaab@care.org</p>
          <p>Dadaab, Kenya</p>
        </div>
      </section>

      <section class="invoice-document-section invoice-stay-details">
        <h2>${isPaid ? 'Payment Details' : 'Accommodation Details'}</h2>
        <dl class="invoice-detail-list">
          ${detailRow('Camp', invoice.campName)}
          ${detailRow('Room', [invoice.blockName && `Block ${invoice.blockName}`, invoice.roomNumber && `Room ${invoice.roomNumber}`].filter(Boolean).join(' · '))}
          ${detailRow('Arrival', formatDate(invoice.arrivalDate))}
          ${detailRow('Departure', formatDate(invoice.departureDate))}
          ${detailRow('Stay Type', invoice.stayType)}
          ${detailRow('Duration', `${quantity} ${period}`)}
          ${isPaid ? detailRow('Payment Method', paymentMethod) : ''}
          ${isPaid ? detailRow('Payment Reference', paymentReference) : ''}
        </dl>
      </section>

      <section class="invoice-document-section">
        <table class="invoice-charges-table" aria-label="${isPaid ? 'Receipt' : 'Invoice'} charges">
          <thead>
            <tr><th>Description</th><th>Qty</th><th>Price</th><th>Total</th></tr>
          </thead>
          <tbody>
            ${invoiceLine(invoice, currency, amount - extensionCost, quantity, rateAmount)}
            ${extensionCost > 0 ? `<tr><td>Approved accommodation extensions</td><td>—</td><td>—</td><td><strong>${escapeHtml(formatMoney(extensionCost, currency))}</strong></td></tr>` : ''}
          </tbody>
        </table>
        <div class="invoice-document-totals">
          <div><span>Sub Total</span><span>${escapeHtml(formatMoney(amount, currency))}</span></div>
          <div class="invoice-document-grand-total"><strong>${isPaid ? 'Total Paid' : 'Total Due'}</strong><strong>${escapeHtml(formatMoney(amount, currency))}</strong></div>
        </div>
      </section>

      <section class="invoice-document-bottom">
        <div class="invoice-document-note">
          <h2>${isPaid ? 'Notes' : 'Note:'}</h2>
          <p>${isPaid ? 'Payment received in full. Please retain this receipt for your records.' : 'Please quote the invoice number or booking reference when making payment.'}</p>
        </div>
        <div class="invoice-document-payment">
          <h2>${isPaid ? 'Payment Confirmation' : 'Payment Information:'}</h2>
          ${isPaid
            ? `<p><strong>Status:</strong> Paid</p><p><strong>Reference:</strong> ${escapeHtml(paymentReference || '—')}</p>`
            : `<dl class="invoice-detail-list">${paymentRows || detailRow('Contact', 'accommodation.dadaab@care.org')}</dl>`}
        </div>
      </section>
      <footer class="invoice-document-footer">Thank You!<span>CARE Kenya · Dadaab Accommodation Management System</span></footer>
    </article>
  `;
}
