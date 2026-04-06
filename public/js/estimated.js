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
let typesCache = [];
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

function populateTypeSelect(selectedTypeId = '') {
  const select = document.getElementById('modal-item-type');
  select.innerHTML = '<option value="">— Sin tipo —</option>';
  typesCache.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    if (t.id === selectedTypeId) opt.selected = true;
    select.appendChild(opt);
  });
}

window.openItemModal = (data = null) => {
  document.getElementById('new-type-row').style.display = 'none';
  document.getElementById('new-type-name').value = '';
  document.getElementById('toggle-new-type').textContent = '＋ Nuevo tipo';

  if (data) {
    document.getElementById('modal-item-id').value = data.id || '';
    document.getElementById('modal-item-name').value = data.name || '';
    document.getElementById('modal-item-icon').value = data.icon || '';
    document.getElementById('modal-item-order').value = data.order_index ?? '';
    document.getElementById('modal-item-notes').value = data.notes || '';
    populateTypeSelect(data.type_id || '');
    document.getElementById('item-modal-title').textContent = 'Editar Rubro';
  } else {
    itemModalForm.reset();
    document.getElementById('modal-item-notes').value = '';
    document.getElementById('modal-item-id').value = '';
    populateTypeSelect('');
    document.getElementById('item-modal-title').textContent = 'Nuevo Rubro';
  }
  itemModal.classList.add('active');
  document.body.style.overflow = 'hidden';
};

window.closeItemModal = () => {
  itemModal.classList.remove('active');
  document.body.style.overflow = 'auto';
};

window.openValueModal = (data) => {
  document.getElementById('modal-value-id').value = data?.id || '';
  document.getElementById('modal-value-item-id').value = data.item_id || '';
  document.getElementById('modal-value-period').value = data.period || '';
  document.getElementById('modal-value-estimated').value = data?.estimated_amount || '0';
  document.getElementById('modal-value-real').value = data?.real_amount || '0';
  document.getElementById('modal-value-paid').value = data?.paid || 'false';
  
  if (document.getElementById('value-modal-subtitle')) {
    document.getElementById('value-modal-subtitle').textContent = `${data.item_name} • ${formatPeriodFull(data.period)}`;
  }
    
  valueModal.classList.add('active');
  document.body.style.overflow = 'hidden';
};

window.closeValueModal = () => {
  valueModal.classList.remove('active');
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
  const currentPeriod = getCurrentPeriod();
  let totalMes = 0;
  let pagadoMes = 0;

  itemsCache.forEach(item => {
    const v = getValue(item.id, currentPeriod);
    if (v) {
      const est = parseFloat(v.estimated_amount) || 0;
      const real = parseFloat(v.real_amount) || 0;
      const monto = real > 0 ? real : est;
      totalMes += monto;
      if (v.paid) pagadoMes += monto;
    }
  });

  const pendiente = totalMes - pagadoMes;
  const diffEl = document.getElementById('stat-diff');
  const diffPill = document.getElementById('stat-diff-pill');

  document.getElementById('stat-estimated').textContent = `$${totalMes.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('stat-real').textContent = `$${pagadoMes.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  diffEl.textContent = `$${pendiente.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  diffEl.className = pendiente <= 0 ? 'stat-value color-primary' : 'stat-value color-warning';
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

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function renderMatrix() {
  const yearPeriods = getYearPeriods(selectedYear);
  const currentPeriod = getCurrentPeriod();
  updateSummaryStats();
  
  matrixHeader.innerHTML = `
    <th class="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest sticky-col th-rubro border-r border-ui min-w-[140px]">RUBRO</th>
    ${yearPeriods.map((m, i) => `
      <th class="px-2 py-3 text-right text-[10px] font-black uppercase tracking-widest min-w-[80px] th-month ${i % 2 === 0 ? 'th-month--even' : 'th-month--odd'}${m === currentPeriod ? ' th-month--current' : ''}">${formatPeriod(m)}</th>
    `).join('')}
    <th class="px-3 py-3 text-right text-[10px] font-black color-warning uppercase tracking-widest min-w-[90px] th-annual">ANUAL</th>
  `;

  let grandTotal = 0;

  matrixBody.innerHTML = itemsCache.map((item, rowIndex) => {
    let itemTotal = 0;
    const rowClass = rowIndex % 2 === 0 ? 'row-even' : 'row-odd';

    const cells = yearPeriods.map((period, colIndex) => {
      const value = getValue(item.id, period);
      const estimated = value ? parseFloat(value.estimated_amount) : 0;
      const real = value ? parseFloat(value.real_amount) : 0;
      const paid = value ? value.paid : false;

      const isActiveReal = real > 0;
      const displayAmount = isActiveReal ? real : estimated;
      itemTotal += displayAmount;

      const valueId = value ? escapeHtml(value.id) : '';
      const colClass = colIndex % 2 === 0 ? 'col-even' : 'col-odd';
      const isCurrentMonth = period === currentPeriod;
      const isPendingAlert = isCurrentMonth && !paid && displayAmount > 0;

      const checkBtn = valueId && displayAmount > 0 ? `
        <button
          class="check-btn${paid ? ' check-btn--paid' : ''}"
          data-check-id="${valueId}"
          data-paid="${paid}"
        >✓</button>
      ` : '';

      return `
        <td class="px-0 py-1 ${colClass}${isPendingAlert ? ' cell-pending' : ''}">
          <div class="cell-wrap">
            ${checkBtn}
            <button
              data-item-id="${escapeHtml(item.id)}"
              data-item-name="${escapeHtml(item.name)}"
              data-period="${period}"
              data-value-id="${valueId}"
              data-estimated="${estimated}"
              data-real="${real}"
              data-paid="${paid}"
              class="value-cell text-right px-2 py-1 rounded-lg transition-all border-2 border-transparent tabular-nums hover-border-accent"
            >
              <span class="${isActiveReal ? 'font-black color-primary' : 'font-medium color-warning opacity-80'}" style="font-size:11px">
                $${displayAmount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </button>
          </div>
        </td>
      `;
    }).join('');

    grandTotal += itemTotal;

    return `
      <tr class="table-row ${rowClass}">
        <td class="px-4 py-2 sticky-col border-r border-ui row-sticky-cell">
          <button onclick="openItemModal(${JSON.stringify(item).replace(/"/g, '&quot;')})" class="font-bold text-ui uppercase tracking-tighter italic hover-color-warning transition-colors cursor-pointer text-left" style="font-size:11px;display:flex;align-items:center;gap:6px">
            ${item.icon ? `<span style="font-style:normal">${escapeHtml(item.icon)}</span>` : ''}${escapeHtml(item.name)}
          </button>
        </td>
        ${cells}
        <td class="px-3 py-2 text-right font-black text-ui td-annual tabular-nums" style="font-size:11px">
          $${itemTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        real_amount: btn.dataset.real,
        paid: btn.dataset.paid === 'true'
      });
    });
  });

  const checkBtns = document.querySelectorAll('.check-btn');
  checkBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.checkId;
      const newPaid = btn.dataset.paid !== 'true';
      try {
        const res = await fetch(`/api/estimated-expense-values/${id}/paid`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ paid: newPaid })
        });
        if (res.ok) await loadValues();
      } catch (err) {
        console.error('❌ Error toggling paid:', err);
      }
    });
  });
  
  matrixFooter.innerHTML = `
    <td class="px-4 py-3 sticky-col font-black uppercase tracking-widest border-r border-ui tf-rubro" style="font-size:9px">Cierre Consolidado</td>
    ${yearPeriods.map((period, i) => {
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
        <td class="px-2 py-3 text-right font-black text-ui tabular-nums ${i % 2 === 0 ? 'col-even' : 'col-odd'}" style="font-size:11px">
          $${totalColumn.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
      `;
    }).join('')}
    <td class="px-3 py-3 text-right color-primary font-black bg-color-primary-soft tabular-nums" style="font-size:12px">
      $${grandTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
  const type_id = document.getElementById('modal-item-type').value || null;
  const icon = document.getElementById('modal-item-icon').value.trim() || null;
  const order_raw = document.getElementById('modal-item-order').value;
  const order_index = order_raw !== '' ? parseInt(order_raw) : null;
  const notes = document.getElementById('modal-item-notes').value.trim() || null;

  try {
    const url = id ? `/api/estimated-expense-items/${id}` : '/api/estimated-expense-items';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ name, type_id, icon, order_index, notes })
    });

    if (res.ok) {
      closeItemModal();
      await loadItems();
      await loadValues();
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
  const paid = document.getElementById('modal-value-paid').value === 'true';

  try {
    const url = id ? `/api/estimated-expense-values/${id}` : '/api/estimated-expense-values';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ item_id, period, estimated_amount, real_amount, paid })
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

async function loadTypes() {
  try {
    const res = await fetch('/api/item-types', {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    });
    if (!res.ok) throw new Error('Error al cargar tipos');
    typesCache = await res.json();
  } catch (err) {
    console.error('❌ Error cargando tipos:', err);
  }
}

document.getElementById('toggle-new-type').addEventListener('click', () => {
  const row = document.getElementById('new-type-row');
  const btn = document.getElementById('toggle-new-type');
  const visible = row.style.display !== 'none';
  row.style.display = visible ? 'none' : 'flex';
  btn.textContent = visible ? '＋ Nuevo tipo' : '✕ Cancelar';
  if (!visible) document.getElementById('new-type-name').focus();
});

document.getElementById('new-type-save').addEventListener('click', async () => {
  const name = document.getElementById('new-type-name').value.trim();
  if (!name) return;

  try {
    const res = await fetch('/api/item-types', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ name })
    });

    if (res.ok) {
      const newType = await res.json();
      typesCache.push(newType);
      typesCache.sort((a, b) => a.name.localeCompare(b.name));
      populateTypeSelect(newType.id);
      document.getElementById('new-type-row').style.display = 'none';
      document.getElementById('new-type-name').value = '';
      document.getElementById('toggle-new-type').textContent = '＋ Nuevo tipo';
    } else {
      const err = await res.json();
      alert('Error: ' + (err.error || 'No se pudo crear el tipo'));
    }
  } catch (err) {
    console.error('❌ Error creando tipo:', err);
  }
});

async function init() {
  session = await getSession();
  if (!session) {
    window.location.href = '/';
    return;
  }

  await initMonthsSelect();
  await loadTypes();
  await loadItems();
  await loadValues();
}

addItemBtn.addEventListener('click', () => openItemModal());
init();
