import { supabase } from './supabase-client.js';
import { getSession, signOut } from './auth.js';

const transactionList = document.getElementById('transaction-list');
const transactionForm = document.getElementById('transaction-form');
const categorySelect = document.getElementById('category');
const logoutBtn = document.getElementById('logout-btn');

const totalBalanceEl = document.getElementById('total-balance');
const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');

let session = null;

// Inicialización
async function init() {
  session = await getSession();
  if (!session) {
    window.location.href = '/';
    return;
  }

  await refreshData();
}

async function refreshData() {
  await Promise.all([
    loadCategories(),
    loadTransactions()
  ]);
}

// Cargar categorías
async function loadCategories() {
  const { data: categories, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', session.user.id);

  if (error) {
    console.error('❌ Error cargando categorías:', error);
    return;
  }

  if (categories.length === 0) {
    const basicCategories = [
      { name: 'Sueldo', type: 'income', icon: '💰', color: '#10b981' },
      { name: 'Comida', type: 'expense', icon: '🍔', color: '#ef4444' },
      { name: 'Alquiler', type: 'expense', icon: '🏠', color: '#3b82f6' },
      { name: 'Transporte', type: 'expense', icon: '🚌', color: '#f59e0b' },
      { name: 'Ocio', type: 'expense', icon: '🎮', color: '#8b5cf6' }
    ].map(cat => ({ ...cat, user_id: session.user.id }));

    const { error: createError } = await supabase
      .from('categories')
      .insert(basicCategories);

    if (!createError) {
      const { data: newCats } = await supabase.from('categories').select('*').eq('user_id', session.user.id);
      renderCategories(newCats || []);
    }
  } else {
    renderCategories(categories);
  }
}

function renderCategories(categories) {
  categorySelect.innerHTML = '<option value="">Seleccionar...</option>' +
    categories.map(cat => `
      <option value="${cat.id}">${cat.icon} ${cat.name}</option>
    `).join('');
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
    renderTransactions(transactions);
    updateSummary(transactions);
  } catch (err) {
    console.error('❌ Error en loadTransactions:', err);
  }
}

function renderTransactions(transactions) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    transactionList.innerHTML = '<p style="text-align: center; color: var(--text-light);">No hay transacciones todavía.</p>';
    return;
  }

  transactionList.innerHTML = transactions.map(t => `
    <div class="transaction-item">
      <div class="transaction-info">
        <h4>${t.categories?.icon || '📦'} ${t.description || 'Sin descripción'}</h4>
        <span>${new Date(t.date).toLocaleDateString()} • ${t.categories?.name || 'S/C'}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 1rem;">
        <span class="amount-val" style="color: ${t.categories?.type === 'income' ? '#2ecc71' : '#e74c3c'}">
          ${t.categories?.type === 'income' ? '+' : '-'}$${Math.abs(t.amount).toFixed(2)}
        </span>
        <button class="delete-btn" onclick="deleteTransaction('${t.id}')">✕</button>
      </div>
    </div>
  `).join('');
}

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

// Crear transacción
transactionForm.onsubmit = async (e) => {
  e.preventDefault();
  const amount = document.getElementById('amount').value;
  const category_id = document.getElementById('category').value;
  const description = document.getElementById('description').value;

  try {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ amount, category_id, description })
    });

    if (res.ok) {
      transactionForm.reset();
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
