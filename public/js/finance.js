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
const addPmBtn = document.getElementById('add-pm-btn');
const addCatBtn = document.getElementById('add-cat-btn');
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
    const titleEl = document.getElementById(
      modalId === 'category-modal' ? 'category-modal-title' : 
      modalId === 'payment-method-modal' ? 'pm-modal-title' : 
      'transaction-modal-title'
    );
    if (titleEl) titleEl.textContent = title;
  }
  
  const form = modal.querySelector('form');
  if (form && !data) {
    form.reset();
    const idInput = form.querySelector('input[type="hidden"]');
    if (idInput) idInput.value = '';
    
    // Restaurar fecha por defecto si es el de transacciones
    if (modalId === 'transaction-modal') {
      const dateInput = document.getElementById('date');
      if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
      const submitBtn = document.getElementById('submit-transaction-btn');
      if (submitBtn) submitBtn.textContent = 'Guardar';
    }
  }
  
  if (data) {
    if (modalId === 'category-modal') {
      document.getElementById('modal-category-id').value = data.id || '';
      document.getElementById('modal-category-name').value = data.name || '';
      document.getElementById('modal-category-type').value = data.type || 'expense';
      document.getElementById('modal-category-icon').value = data.icon || '🏷️';
    } else if (modalId === 'payment-method-modal') {
      document.getElementById('modal-pm-id').value = data.id || '';
      document.getElementById('modal-pm-name').value = data.name || '';
      document.getElementById('modal-pm-type').value = data.type || 'cash';
      document.getElementById('modal-pm-icon').value = data.icon || '💳';
    }
  }
  
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
};

window.closeModal = (modalId) => {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
  }
};

if (openTxModalBtn) openTxModalBtn.addEventListener('click', () => openModal('transaction-modal', 'Nueva Transacción'));
if (addCatBtn) addCatBtn.addEventListener('click', () => openModal('category-modal', 'Nueva Categoría'));
if (addPmBtn) addPmBtn.addEventListener('click', () => openModal('payment-method-modal', 'Nuevo Medio de Pago'));

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
      <div class="p-10 rounded-[2.5rem] bg-zinc-50 dark:bg-zinc-900/50 border-2 border-dashed border-zinc-200 dark:border-zinc-800 text-center">
        <p class="text-zinc-400 font-bold italic">No hay transacciones por aquí...</p>
      </div>
    `;
    return;
  }

  transactionList.innerHTML = transactions.map(t => {
    const isIncome = t.categories?.type === 'income';
    return `
      <div class="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border-2 border-zinc-50 dark:border-zinc-800 transition-all hover:border-[#F8DE22] group shadow-sm">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-5">
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-inner">
              ${escapeHtml(t.categories?.icon) || '📦'}
            </div>
            <div>
              <h5 class="text-base font-black text-zinc-800 dark:text-zinc-100 uppercase tracking-tighter italic">${escapeHtml(t.description) || 'Sin descripción'}</h5>
              <p class="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mt-1">
                ${new Date(t.date).toLocaleDateString('es-AR')} • ${escapeHtml(t.categories?.name) || 'S/C'} • ${escapeHtml(t.payment_methods?.name) || 'S/M'}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-6">
            <span class="text-xl font-black tabular-nums ${isIncome ? 'color-primary' : 'color-danger'}">
              ${isIncome ? '+' : '-'}$${Math.abs(t.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
            <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
              <button class="p-2.5 bg-zinc-50 dark:bg-zinc-800 rounded-xl hover-color-primary shadow-sm transition-colors" onclick="editTransaction('${escapeHtml(t.id)}')" title="Editar">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </button>
              <button class="p-2.5 bg-zinc-50 dark:bg-zinc-800 rounded-xl hover-color-danger shadow-sm transition-colors" onclick="deleteTransaction('${escapeHtml(t.id)}')" title="Eliminar">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.editTransaction = (id) => {
  const t = transactionsCache.find(tx => tx.id === id);
  if (!t) return;
  
  document.getElementById('transaction-id').value = t.id;
  document.getElementById('amount').value = t.amount;
  document.getElementById('category').value = t.category_id;
  document.getElementById('payment-method').value = t.payment_method_id;
  document.getElementById('date').value = t.date.split('T')[0];
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
