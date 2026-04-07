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

const transactionList = document.getElementById('transaction-list');
const transactionForm = document.getElementById('transaction-form');
const categorySelect = document.getElementById('category');
const paymentMethodSelect = document.getElementById('payment-method');
const logoutBtn = document.getElementById('logout-btn');
const openTxModalBtn = document.getElementById('open-transaction-modal-btn');

const totalBalanceEl = document.getElementById('total-balance');
const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');

let session = null;
let categoriesCache = [];
let transactionsCache = [];

// --- GESTIÓN DE MODALES ---
window.openModal = (modalId, title = null, data = null) => {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  
  if (title) {
    const titleEl = document.getElementById('transaction-modal-title');
    if (titleEl) titleEl.textContent = title;
  }
  
  const form = modal.querySelector('form');
  if (form && !data) {
    form.reset();
    const idInput = form.querySelector('input[type="hidden"]');
    if (idInput) idInput.value = '';
    
    // Restaurar fecha por defecto si es el de transacciones
    const dateInput = document.getElementById('date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    const submitBtn = document.getElementById('submit-transaction-btn');
    if (submitBtn) submitBtn.textContent = 'Guardar';
  }
  
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
};

window.closeModal = (modalId) => {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
  }
};

if (openTxModalBtn) openTxModalBtn.addEventListener('click', () => openModal('transaction-modal', 'Nueva Transacción'));

// --- LOGICA DE DATOS ---
async function loadCategories() {
  try {
    const res = await fetch('/api/categories', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
    const data = await res.json();
    categoriesCache = data;
    categorySelect.innerHTML = '<option value="">Seleccionar...</option>' +
      data.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.icon) || '🏷️'} ${escapeHtml(c.name)}</option>`).join('');
  } catch (err) { console.error('❌ Error cargando categorías:', err); }
}

async function loadPaymentMethods() {
  try {
    const res = await fetch('/api/payment-methods', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
    const data = await res.json();
    paymentMethodSelect.innerHTML = '<option value="">Seleccionar...</option>' +
      data.map(pm => `<option value="${escapeHtml(pm.id)}">${escapeHtml(pm.icon) || '💳'} ${escapeHtml(pm.name)}</option>`).join('');
  } catch (err) { console.error('❌ Error en loadPaymentMethods:', err); }
}

async function loadTransactions() {
  try {
    const res = await fetch('/api/transactions', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
    const transactions = await res.json();
    transactionsCache = transactions;
    renderTransactions(transactions);
    updateSummary(transactions);
  } catch (err) { console.error('❌ Error en loadTransactions:', err); }
}

function renderTransactions(transactions) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    transactionList.innerHTML = `
      <div class="col-span-full p-20 rounded-[3rem] bg-surface-input border-2 border-dashed border-ui text-center">
        <p class="text-zinc-400 font-bold italic">No hay transacciones por aquí...</p>
      </div>
    `;
    return;
  }

  transactionList.innerHTML = transactions.map(t => {
    const isIncome = t.categories?.type === 'income';
    const displayDate = t.date ? t.date.split('T')[0].split('-').reverse().join('/') : 'S/F';
    
    return `
      <div class="bg-surface-card p-6 border border-ui transition-all hover:border-primary hover:shadow-xl hover:-translate-y-1 group relative overflow-hidden" style="border-radius:2rem">
        <div class="flex justify-between items-start">
          <div class="flex items-center" style="gap:1.5rem">
            <div class="w-14 h-14 flex items-center justify-center text-3xl shrink-0">
              ${escapeHtml(t.categories?.icon) || '📦'}
            </div>
            <div style="flex:1; min-width:0">
              <h5 class="text-base text-ui uppercase tracking-tighter italic truncate" style="font-weight:900; width:100%">${escapeHtml(t.description) || 'Sin descripción'}</h5>
              <p class="text-[9px] text-zinc-400 uppercase tracking-widest mt-1" style="font-weight:400; opacity:0.8">
                ${displayDate} • ${escapeHtml(t.categories?.name) || 'S/C'} • <span style="opacity:0.6">${escapeHtml(t.payment_methods?.name) || 'S/M'}</span>
              </p>
            </div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.75rem; min-width:120px">
            <span class="text-xl tabular-nums ${isIncome ? 'color-primary' : 'color-danger'}" style="font-weight:900; line-height:1; white-space:nowrap">
              ${isIncome ? '+' : '-'}$${Math.abs(t.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
            <div style="display:flex; align-items:center; gap:0.35rem">
              <button class="p-1 hover:text-blue-500 transition-colors flex items-center justify-center" onclick="cloneTransaction('${escapeHtml(t.id)}')" title="Clonar" style="width:28px;height:28px">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
              </button>
              <button class="p-1 hover:text-primary transition-colors flex items-center justify-center" onclick="editTransaction('${escapeHtml(t.id)}')" title="Editar" style="width:28px;height:28px">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </button>
              <button class="p-1 hover:text-red-500 transition-colors flex items-center justify-center" onclick="deleteTransaction('${escapeHtml(t.id)}')" title="Eliminar" style="width:28px;height:28px">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.cloneTransaction = (id) => {
  const t = transactionsCache.find(tx => tx.id === id);
  if (!t) return;
  
  const cleanDate = t.date ? t.date.split('T')[0] : new Date().toISOString().split('T')[0];
  
  document.getElementById('transaction-id').value = ''; 
  document.getElementById('amount').value = t.amount;
  document.getElementById('category').value = t.category_id;
  document.getElementById('payment-method').value = t.payment_method_id;
  document.getElementById('date').value = cleanDate; 
  document.getElementById('description').value = (t.description || '') + ' (copia)';
  
  const submitBtn = document.getElementById('submit-transaction-btn');
  if (submitBtn) submitBtn.textContent = 'Guardar Clon';
  
  openModal('transaction-modal', 'Clonar Transacción', t);
};

window.editTransaction = (id) => {
  const t = transactionsCache.find(tx => tx.id === id);
  if (!t) return;
  
  const cleanDate = t.date ? t.date.split('T')[0] : '';
  
  document.getElementById('transaction-id').value = t.id;
  document.getElementById('amount').value = t.amount;
  document.getElementById('category').value = t.category_id;
  document.getElementById('payment-method').value = t.payment_method_id;
  document.getElementById('date').value = cleanDate;
  document.getElementById('description').value = t.description || '';
  
  const submitBtn = document.getElementById('submit-transaction-btn');
  if (submitBtn) submitBtn.textContent = 'Actualizar';
  
  openModal('transaction-modal', 'Editar Transacción', t);
};

function updateSummary(transactions) {
  let income = 0; let expenses = 0;
  transactions.forEach(t => {
    const amount = Number(t.amount);
    if (t.categories?.type === 'income') income += amount; else expenses += amount;
  });
  const total = income - expenses;
  totalBalanceEl.textContent = `$${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  totalIncomeEl.textContent = `$${income.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  totalExpenseEl.textContent = `$${expenses.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
}

transactionForm.onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('transaction-id').value;
  const amount = document.getElementById('amount').value;
  const category_id = document.getElementById('category').value;
  const payment_method_id = document.getElementById('payment-method').value;
  const date = document.getElementById('date').value;
  const description = document.getElementById('description').value;

  try {
    const url = id ? `/api/transactions/${id}` : '/api/transactions';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ amount, category_id, payment_method_id, date, description })
    });
    if (res.ok) {
      closeModal('transaction-modal');
      await loadTransactions();
    }
  } catch (err) { console.error('❌ Error guardando transacción:', err); }
};

window.deleteTransaction = async (id) => {
  if (!confirm('¿Borrar esta transacción?')) return;
  try {
    const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${session.access_token}` } });
    if (res.ok) await loadTransactions();
  } catch (err) { console.error('❌ Error eliminando transacción:', err); }
};

logoutBtn.onclick = async () => { await signOut(); window.location.href = '/'; };

async function init() {
  session = await getSession();
  if (!session) { window.location.href = '/'; return; }
  const di = document.getElementById('date'); if (di) di.value = new Date().toISOString().split('T')[0];
  await Promise.all([loadCategories(), loadPaymentMethods(), loadTransactions()]);
}

init();
