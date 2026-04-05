import { getSession, signOut } from './auth.js';

const escapeHtml = (str) => {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const logoutBtn = document.getElementById('logout-btn');
const monthsSelect = document.getElementById('months-select');
const addItemBtn = document.getElementById('add-item-btn');
const noItems = document.getElementById('no-items');
const matrixSection = document.getElementById('matrix-section');
const matrixHeader = document.getElementById('matrix-header');
const matrixBody = document.getElementById('matrix-body');
const matrixFooter = document.getElementById('matrix-footer');

const itemModal = document.getElementById('item-modal');
const itemModalForm = document.getElementById('item-modal-form');
const valueModal = document.getElementById('value-modal');
const valueModalForm = document.getElementById('value-modal-form');

let session = null;
let itemsCache = [];
let valuesCache = [];
let selectedYear = new Date().getFullYear();

function getYearPeriods(year) {
  const periods = [];
  for (let month = 1; month <= 12; month++) {
    periods.push(`${year}-${String(month).padStart(2, '0')}`);
  }
  return periods;
}

function formatPeriod(period) {
  const [year, month] = period.split('-');
  const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  return months[parseInt(month) - 1];
}

function formatPeriodFull(period) {
  const [year, month] = period.split('-');
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${months[parseInt(month) - 1]} ${year}`;
}

window.openItemModal = (data = null) => {
  if (data) {
    document.getElementById('modal-item-id').value = data.id || '';
    document.getElementById('modal-item-name').value = data.name || '';
    document.getElementById('item-modal-title').textContent = 'Renombrar Rubro';
  } else {
    itemModalForm.reset();
    document.getElementById('modal-item-id').value = '';
    document.getElementById('item-modal-title').textContent = 'Nuevo Rubro';
  }
  itemModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
};

window.closeItemModal = () => {
  itemModal.classList.add('hidden');
  document.body.style.overflow = 'auto';
};

window.openValueModal = (data) => {
  document.getElementById('modal-value-id').value = data?.id || '';
  document.getElementById('modal-value-item-id').value = data.item_id || '';
  document.getElementById('modal-value-period').value = data.period || '';
  document.getElementById('modal-value-estimated').value = data?.estimated_amount || '0';
  document.getElementById('modal-value-real').value = data?.real_amount || '0';
  
  if (document.getElementById('value-modal-subtitle')) {
    document.getElementById('value-modal-subtitle').textContent = `${data.item_name} • ${formatPeriodFull(data.period)}`;
  }
    
  valueModal.classList.remove('hidden');
  valueModal.classList.add('flex');
  document.body.style.overflow = 'hidden';
};

window.closeValueModal = () => {
  valueModal.classList.add('hidden');
  document.body.style.overflow = 'auto';
};

async function loadItems() {
  try {
    const res = await fetch('/api/estimated-expense-items', {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    });
    if (!res.ok) throw new Error('Error al cargar items');
    itemsCache = await res.json();
    renderItems(itemsCache);
  } catch (err) {
    console.error('❌ Error cargando items:', err);
  }
}

function renderItems(items) {
  if (!items || items.length === 0) {
    noItems.classList.remove('hidden');
    matrixSection.classList.add('hidden');
    return;
  }
  noItems.classList.add('hidden');
  matrixSection.classList.remove('hidden');
}

function updateSummaryStats() {
  let totalEst = 0;
  let totalRe = 0;
  
  const periods = getYearPeriods(selectedYear);
  itemsCache.forEach(item => {
    periods.forEach(period => {
      const v = getValue(item.id, period);
      if (v) {
        totalEst += parseFloat(v.estimated_amount) || 0;
        totalRe += parseFloat(v.real_amount) || 0;
      }
    });
  });

  const diff = totalEst - totalRe;
  const diffEl = document.getElementById('stat-diff');
  const diffPill = document.getElementById('stat-diff-pill');
  
  document.getElementById('stat-estimated').textContent = `$${totalEst.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
  document.getElementById('stat-real').textContent = `$${totalRe.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
  diffEl.textContent = `$${diff.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
  
  if (diff >= 0) {
    diffEl.className = 'stat-value text-zinc-900';
  } else {
    diffEl.className = 'stat-value text-[#D12052]';
  }
}

async function loadValues() {
  if (itemsCache.length === 0) return;
  
  const periods = getYearPeriods(selectedYear);
  const periodsQuery = periods.join(',');
  try {
    const res = await fetch(`/api/estimated-expense-values?periods=${periodsQuery}`, {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    });
    if (!res.ok) throw new Error('Error al cargar valores');
    valuesCache = await res.json();
    renderMatrix();
  } catch (err) {
    console.error('❌ Error cargando valores:', err);
  }
}

function getValue(itemId, period) {
  return valuesCache.find(v => v.item_id === itemId && v.period === period);
}

function renderMatrix() {
  const yearPeriods = getYearPeriods(selectedYear);
  updateSummaryStats();
  document.getElementById('year-display').textContent = selectedYear;
  
  matrixHeader.innerHTML = `
    <th class="px-6 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest sticky-col bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 min-w-[180px]">RUBRO</th>
    ${yearPeriods.map(m => `
      <th class="px-4 py-4 text-right text-[10px] font-black text-zinc-400 uppercase tracking-widest min-w-[100px]">${formatPeriod(m)}</th>
    `).join('')}
    <th class="px-6 py-4 text-right text-[10px] font-black color-warning uppercase tracking-widest min-w-[120px] bg-zinc-100/50 dark:bg-zinc-900/50">ANUAL</th>
  `;
  
  let grandTotal = 0;
  
  matrixBody.innerHTML = itemsCache.map(item => {
    let itemTotal = 0;
    
    const cells = yearPeriods.map(period => {
      const value = getValue(item.id, period);
      const estimated = value ? parseFloat(value.estimated_amount) : 0;
      const real = value ? parseFloat(value.real_amount) : 0;
      
      const isActiveReal = real > 0;
      const displayAmount = isActiveReal ? real : estimated;
      itemTotal += displayAmount;
      
      const valueId = value ? escapeHtml(value.id) : '';
      
      return `
        <td class="px-1 py-1 text-right">
          <button 
            data-item-id="${escapeHtml(item.id)}" 
            data-item-name="${escapeHtml(item.name)}" 
            data-period="${period}" 
            data-value-id="${valueId}"
            data-estimated="${estimated}" 
            data-real="${real}"
            class="value-cell w-full text-right p-3 rounded-xl transition-all border-2 border-transparent tabular-nums hover-border-accent ${isActiveReal ? 'bg-color-primary-soft dark:bg-color-primary-soft' : 'bg-color-warning-soft dark:bg-color-warning-soft'}"
          >
            <span class="text-[13px] ${isActiveReal ? 'font-black color-primary' : 'font-medium color-warning opacity-80'}">
              $${displayAmount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
            </span>
          </button>
        </td>
      `;
    }).join('');
    
    grandTotal += itemTotal;
    
    return `
      <tr class="group hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
        <td class="px-6 py-4 sticky-col border-r border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/60">
          <button onclick="openItemModal(${JSON.stringify(item).replace(/"/g, '&quot;')})" class="font-bold text-sm text-zinc-900 dark:text-zinc-100 uppercase tracking-tighter italic hover-color-warning transition-colors cursor-pointer text-left">
            ${escapeHtml(item.name)}
          </button>
        </td>
        ${cells}
        <td class="px-6 py-4 text-right text-sm font-black text-zinc-900 dark:text-white bg-zinc-50/30 dark:bg-zinc-900/10 tabular-nums">
          $${itemTotal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
        </td>
      </tr>
    `;
  }).join('');
  
  const cells = document.querySelectorAll('.value-cell');
  cells.forEach(btn => {
    btn.addEventListener('click', () => {
      openValueModal({
        item_id: btn.dataset.itemId,
        item_name: btn.dataset.itemName,
        period: btn.dataset.period,
        id: btn.dataset.valueId,
        estimated_amount: btn.dataset.estimated,
        real_amount: btn.dataset.real
      });
    });
  });
  
  matrixFooter.innerHTML = `
    <td class="px-6 py-6 sticky-col bg-zinc-50 dark:bg-zinc-900 font-black text-[10px] uppercase tracking-[0.2em] text-zinc-400 border-r border-zinc-200 dark:border-zinc-800">Cierre Consolidado</td>
    ${yearPeriods.map(period => {
      let totalColumn = 0;
      itemsCache.forEach(item => {
        const v = getValue(item.id, period);
        if (v) {
          const est = parseFloat(v.estimated_amount) || 0;
          const re = parseFloat(v.real_amount) || 0;
          totalColumn += (re > 0 ? re : est);
        }
      });
      return `
        <td class="px-4 py-6 text-right text-[13px] font-black text-zinc-900 dark:text-white tabular-nums">
          $${totalColumn.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
        </td>
      `;
    }).join('')}
    <td class="px-6 py-6 text-right color-primary font-black bg-color-primary-soft text-base tabular-nums shadow-inner">
      $${grandTotal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
    </td>
  `;
}


async function initMonthsSelect() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= currentYear - 2; y--) {
    years.push(y);
  }
  
  monthsSelect.innerHTML = years.map(y => 
    `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`
  ).join('');
  
  monthsSelect.addEventListener('change', (e) => {
    selectedYear = parseInt(e.target.value);
    loadValues();
  });
}

itemModalForm.onsubmit = async (e) => {
  e.preventDefault();
  
  const id = document.getElementById('modal-item-id').value;
  const name = document.getElementById('modal-item-name').value;
  
  try {
    const url = id ? `/api/estimated-expense-items/${id}` : '/api/estimated-expense-items';
    const method = id ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ name })
    });
    
    if (res.ok) {
      closeItemModal();
      await loadItems();
    } else {
      const err = await res.json();
      alert('Error: ' + (err.error || 'No se pudo guardar'));
    }
  } catch (err) {
    console.error('❌ Error guardando item:', err);
  }
};

valueModalForm.onsubmit = async (e) => {
  e.preventDefault();
  
  const id = document.getElementById('modal-value-id').value;
  const item_id = document.getElementById('modal-value-item-id').value;
  const period = document.getElementById('modal-value-period').value;
  const estimated_amount = document.getElementById('modal-value-estimated').value;
  const real_amount = document.getElementById('modal-value-real').value;
  
  try {
    const url = id ? `/api/estimated-expense-values/${id}` : '/api/estimated-expense-values';
    const method = id ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ item_id, period, estimated_amount, real_amount })
    });
    
    if (res.ok) {
      closeValueModal();
      await loadValues();
    } else {
      const err = await res.json();
      alert('Error: ' + (err.error || 'No se pudo guardar'));
    }
  } catch (err) {
    console.error('❌ Error guardando valor:', err);
  }
};

logoutBtn.onclick = async () => {
  await signOut();
  window.location.href = '/';
};

async function init() {
  session = await getSession();
  if (!session) {
    window.location.href = '/';
    return;
  }
  
  await initMonthsSelect();
  await loadItems();
  await loadValues();
}

addItemBtn.addEventListener('click', () => openItemModal());
init();
