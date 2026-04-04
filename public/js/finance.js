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
const transactionIdInput = document.getElementById('transaction-id');

const totalBalanceEl = document.getElementById('total-balance');

// --- GESTIÓN DE MODALES ---
window.openModal = (modalId, title = null, data = null) => {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  
  if (title) {
    const titleEl = document.getElementById(modalId === 'category-modal' ? 'category-modal-title' : 'pm-modal-title');
    if (titleEl) titleEl.textContent = title;
  }
  
  // Limpiar form
  const form = modal.querySelector('form');
  if (form && !data) form.reset();
  
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
  } else {
    // Si no hay data, limpiar IDs ocultos
    if (modalId === 'category-modal') document.getElementById('modal-category-id').value = '';
    if (modalId === 'payment-method-modal') document.getElementById('modal-pm-id').value = '';
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

// Event listener para agregar/editar categoría
if (addCatBtn) {
  addCatBtn.addEventListener('click', () => openModal('category-modal', 'Nueva Categoría'));
}

const editCatBtn = document.getElementById('edit-cat-btn');
if (editCatBtn) {
  editCatBtn.addEventListener('click', () => {
    const id = categorySelect.value;
    if (!id) {
      alert('Por favor, selecciona una categoría para editar.');
      return;
    }

    const category = categoriesCache.find(c => c.id === id);
    if (!category) {
      alert('Categoría no encontrada.');
      return;
    }

    openModal('category-modal', 'Editar Categoría', category);
  });
}

// Event listener para agregar/editar medio de pago
if (addPmBtn) {
  addPmBtn.addEventListener('click', () => openModal('payment-method-modal', 'Nuevo Medio de Pago'));
}

const editPmBtn = document.getElementById('edit-pm-btn');
if (editPmBtn) {
  editPmBtn.addEventListener('click', async () => {
    const id = paymentMethodSelect.value;
    if (!id) {
      alert('Por favor, selecciona un medio de pago para editar.');
      return;
    }
    
    try {
      const res = await fetch(`/api/payment-methods`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const pms = await res.json();
      const pm = pms.find(p => p.id === id);
      
      if (!pm) throw new Error('Medio de pago no encontrado');
      
      openModal('payment-method-modal', 'Editar Medio de Pago', pm);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  });
}

// --- SUBMIT DE MODALES ---
const categoryModalForm = document.getElementById('category-modal-form');
if (categoryModalForm) {
  categoryModalForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('modal-category-id').value;
    const name = document.getElementById('modal-category-name').value;
    const type = document.getElementById('modal-category-type').value;
    const icon = document.getElementById('modal-category-icon').value;

    try {
      const url = id ? `/api/categories/${id}` : '/api/categories';
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ name, type, icon })
      });

      if (res.ok) {
        closeModal('category-modal');
        await loadCategories();
      } else {
        const err = await res.json();
        alert('Error: ' + (err.error || 'No se pudo guardar la categoría'));
      }
    } catch (err) {
      console.error('❌ Error guardando categoría:', err);
    }
  };
}

const pmModalForm = document.getElementById('payment-method-modal-form');
if (pmModalForm) {
  pmModalForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('modal-pm-id').value;
    const name = document.getElementById('modal-pm-name').value;
    const type = document.getElementById('modal-pm-type').value;
    const icon = document.getElementById('modal-pm-icon').value;

    try {
      const url = id ? `/api/payment-methods/${id}` : '/api/payment-methods';
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ name, type, icon })
      });

      if (res.ok) {
        closeModal('payment-method-modal');
        await loadPaymentMethods();
      } else {
        const err = await res.json();
        alert('Error: ' + (err.error || 'No se pudo guardar el medio de pago'));
      }
    } catch (err) {
      console.error('❌ Error guardando medio de pago:', err);
    }
  };
}

const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');

let session = null;
let categoriesCache = [];
let transactionsCache = [];

// Inicialización
async function init() {
  session = await getSession();
  if (!session) {
    window.location.href = '/';
    return;
  }

  // Set default date to today
  const dateInput = document.getElementById('date');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  await refreshData();
}

async function refreshData() {
  await Promise.all([
    loadCategories(),
    loadPaymentMethods(),
    loadTransactions()
  ]);
}

// Cargar categorías
async function loadCategories() {
  try {
    const res = await fetch('/api/categories', {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    });
    if (!res.ok) throw new Error('Error al cargar categorías');

    const data = await res.json();

    if (!data || data.length === 0) {
      // Crear categorías por defecto via API
      const basicCategories = [
        { name: 'Comida', icon: '🍔', type: 'expense' },
        { name: 'Sueldo', icon: '💰', type: 'income' },
        { name: 'Transporte', icon: '🚌', type: 'expense' },
        { name: 'Ocio', icon: '🎬', type: 'expense' }
      ];
      await Promise.all(basicCategories.map(cat => fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(cat)
      })));
      const res2 = await fetch('/api/categories', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      renderCategories(await res2.json());
    } else {
      renderCategories(data);
    }
  } catch (err) {
    console.error('❌ Error cargando categorías:', err);
  }
}

function renderCategories(cats) {
  categoriesCache = cats;
  categorySelect.innerHTML = '<option value="">Seleccionar...</option>' +
    cats.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.icon) || '🏷️'} ${escapeHtml(c.name)}</option>`).join('');
}

// Cargar medios de pago
async function loadPaymentMethods() {
  try {
    const res = await fetch('/api/payment-methods', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!res.ok) throw new Error('Error al cargar medios de pago');

    const data = await res.json();
    paymentMethodSelect.innerHTML = '<option value="">Seleccionar...</option>' +
      data.map(pm => `<option value="${escapeHtml(pm.id)}">${escapeHtml(pm.icon) || '💳'} ${escapeHtml(pm.name)}</option>`).join('');
  } catch (err) {
    console.error('❌ Error en loadPaymentMethods:', err);
  }
}

// Cargar transacciones desde nuestra API de Hono
async function loadTransactions() {
  try {
    const res = await fetch('/api/transactions', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!res.ok) throw new Error('Error al cargar transacciones');

    const transactions = await res.json();
    transactionsCache = transactions;
    renderTransactions(transactions);
    updateSummary(transactions);
  } catch (err) {
    console.error('❌ Error en loadTransactions:', err);
  }
}

function renderTransactions(transactions) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    transactionList.innerHTML = `
      <div class="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-center shadow-sm">
        No hay transacciones todavía.
      </div>
    `;
    return;
  }

  transactionList.innerHTML = transactions.map(t => `
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-3 transaction-item transition-colors hover:bg-gray-50 dark:hover:bg-gray-750">
      <div class="flex justify-between items-center">
        <div>
          <h5 class="text-lg font-semibold mb-1 dark:text-white">${escapeHtml(t.categories?.icon) || '📦'} ${escapeHtml(t.description) || 'Sin descripción'}</h5>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-0">
            ${new Date(t.date).toLocaleDateString()} • ${escapeHtml(t.categories?.name) || 'S/C'} • <span class="font-medium">${escapeHtml(t.payment_methods?.icon) || '💳'} ${escapeHtml(t.payment_methods?.name) || 'S/M'}</span>
          </p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="text-lg font-bold mr-2 ${t.categories?.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
            ${t.categories?.type === 'income' ? '+' : '-'}$${Math.abs(t.amount).toFixed(2)}
          </span>
          <button class="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors" onclick="editTransaction('${escapeHtml(t.id)}')" title="Editar">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button class="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors" onclick="deleteTransaction('${escapeHtml(t.id)}')" title="Eliminar">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

window.editTransaction = (id) => {
  const t = transactionsCache.find(tx => tx.id === id);
  if (!t) {
    console.error('❌ Transacción no encontrada en cache:', id);
    return;
  }

  document.getElementById('transaction-id').value = t.id;
  document.getElementById('amount').value = t.amount;
  document.getElementById('category').value = t.category_id;
  document.getElementById('payment-method').value = t.payment_method_id;
  document.getElementById('date').value = t.date.split('T')[0];
  document.getElementById('description').value = t.description || '';

  const submitBtn = transactionForm.querySelector('button[type="submit"]');
  submitBtn.textContent = 'Actualizar Transacción';
  submitBtn.classList.add('bg-amber-500', 'hover:bg-amber-600');
  submitBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');

  transactionForm.scrollIntoView({ behavior: 'smooth' });
};

function updateSummary(transactions) {
  let income = 0;
  let expenses = 0;

  transactions.forEach(t => {
    const amount = Number(t.amount);
    if (t.categories?.type === 'income') {
      income += amount;
    } else {
      expenses += amount;
    }
  });

  const total = income - expenses;

  totalBalanceEl.textContent = `$${total.toFixed(2)}`;
  totalIncomeEl.textContent = `$${income.toFixed(2)}`;
  totalExpenseEl.textContent = `$${expenses.toFixed(2)}`;
}

// Crear o actualizar transacción
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ amount, category_id, payment_method_id, date, description })
    });

    if (res.ok) {
      transactionForm.reset();
      document.getElementById('transaction-id').value = '';
      
      const submitBtn = transactionForm.querySelector('button[type="submit"]');
      submitBtn.textContent = 'Guardar Transacción';
      submitBtn.classList.remove('bg-amber-500', 'hover:bg-amber-600');
      submitBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');

      // Restore today's date after reset
      const dateInput = document.getElementById('date');
      if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
      }
      await loadTransactions();
    }
  } catch (err) {
    console.error('❌ Error guardando transacción:', err);
  }
};

window.deleteTransaction = async (id) => {
  if (!confirm('¿Seguro que querés borrar esta transacción?')) return;

  try {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (res.ok) {
      await loadTransactions();
    }
  } catch (err) {
    console.error('❌ Error eliminando transacción:', err);
  }
};

logoutBtn.onclick = async () => {
  await signOut();
  window.location.href = '/';
};

init();
