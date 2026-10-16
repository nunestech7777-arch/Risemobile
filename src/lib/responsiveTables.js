// RISEMOBILE: no celular e no tablet em pé as tabelas viram cartões (o CSS está em index.css, bloco "Celular / PWA").
// Este módulo só copia o texto de cada <th> para o atributo data-label das células da mesma coluna,
// para o CSS mostrar "rótulo: valor". Cobre qualquer <table> da aplicação, inclusive as que
// aparecem depois (modais, troca de aba). Tabelas com a classe "no-cards" ficam como tabela.

const MOBILE_QUERY = '(max-width: 1023px)';

// Coluna de botões: no cartão ocupa a linha inteira e não leva rótulo.
const isActionsHeader = (text) => /^a[çc](ão|ões|ao|oes)$/i.test(text.trim());

const labelTable = (table) => {
  if (table.classList.contains('no-cards')) return;
  const headers = [...table.querySelectorAll(':scope > thead th')].map((th) => th.textContent.trim());
  if (headers.length === 0) return;

  table.classList.add('rt-cards');
  for (const row of table.querySelectorAll(':scope > tbody > tr')) {
    let column = 0;
    for (const cell of row.children) {
      if (cell.tagName !== 'TD') continue;
      const span = cell.colSpan || 1;
      const header = span === 1 ? headers[column] || '' : '';
      const label = isActionsHeader(header) ? '' : header;
      if (cell.getAttribute('data-label') !== label) cell.setAttribute('data-label', label);
      column += span;
    }
  }
};

export const startResponsiveTables = () => {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return () => {};

  const media = window.matchMedia(MOBILE_QUERY);
  let scheduled = false;

  const run = () => {
    scheduled = false;
    if (!media.matches) return;
    document.querySelectorAll('table').forEach(labelTable);
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  };

  // Só observa inclusão/remoção de elementos: gravar data-label não dispara novo ciclo.
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  media.addEventListener('change', schedule);
  schedule();

  return () => {
    observer.disconnect();
    media.removeEventListener('change', schedule);
  };
};
