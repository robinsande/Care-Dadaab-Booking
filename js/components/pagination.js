/**
 * Render pagination controls into a container.
 * @param {HTMLElement} container
 * @param {{ page: number, totalPages: number, total: number, limit: number }}
 * @param {(page: number) => void} onPageChange
 */
export function renderPagination(container, { page, totalPages, total, limit }, onPageChange) {
  if (!container) return;

  if (!totalPages || totalPages <= 1) {
    container.innerHTML = total
      ? `<div class="pagination"><p class="pagination-info">Showing ${total} result${total === 1 ? '' : 's'}</p></div>`
      : '';
    return;
  }

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  container.innerHTML = `
    <div class="pagination">
      <p class="pagination-info">Showing ${from}–${to} of ${total}</p>
      <div class="pagination-controls">
        <button type="button" class="btn btn-secondary btn-sm" data-page="prev" ${page <= 1 ? 'disabled' : ''}>
          Previous
        </button>
        <button type="button" class="btn btn-secondary btn-sm" data-page="next" ${page >= totalPages ? 'disabled' : ''}>
          Next
        </button>
      </div>
    </div>
  `;

  container.querySelector('[data-page="prev"]')?.addEventListener('click', () => {
    if (page > 1) onPageChange(page - 1);
  });
  container.querySelector('[data-page="next"]')?.addEventListener('click', () => {
    if (page < totalPages) onPageChange(page + 1);
  });
}
