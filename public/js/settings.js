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

const categoryList = document.getElementById('category-list');
const pmList = document.getElementById('pm-list');
const catCountEl = document.getElementById('cat-count');
const pmCountEl = document.getElementById('pm-count');
const logoutBtn = document.getElementById('logout-btn');

let session = null;
let categoriesCache = [];
let pmsCache = [];

// --- GESTIÓN DE MODALES ---
window.openModal = (modalId, title = null, data = null) => {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  
  const titleEl = document.getElementById(modalId === 'category-modal' ? 'category-modal-title' : 'pm-modal-title');
  const submitBtn = document.getElementById(modalId === 'category-modal' ? 'save-category-btn' : 'save-pm-btn');
  
  if (title && titleEl) titleEl.textContent = title;
  
  const form = modal.querySelector('form');
  if (form && !data) {
    form.reset();
    const idInput = form.querySelector('input[type="hidden"]');
    if (idInput) idInput.value = '';
    // Asegurar type por defecto si es PM
    const pmTypeInput = document.getElementById('pm-type');
    if (pmTypeInput) pmTypeInput.value = 'other';
    if (submitBtn) submitBtn.textContent = 'Guardar';
  }
  
  if (data) {
    if (submitBtn) submitBtn.textContent = 'Actualizar';
    if (modalId === 'category-modal') {
      document.getElementById('category-id').value = data.id || '';
      document.getElementById('category-name').value = data.name || '';
      document.getElementById('category-type').value = data.type || 'expense';
      document.getElementById('category-icon').value = data.icon || '🏷️';
    } else {
      document.getElementById('pm-id').value = data.id || '';
      document.getElementById('pm-name').value = data.name || '';
      document.getElementById('pm-icon').value = data.icon || '💳';
      const pmTypeInput = document.getElementById('pm-type');
      if (pmTypeInput) pmTypeInput.value = data.type || 'other';
    }
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

document.getElementById('add-category-btn').onclick = () => openModal('category-modal', 'Nueva Categoría');
document.getElementById('add-pm-btn').onclick = () => openModal('pm-modal', 'Nuevo Medio de Pago');

// --- CARGA DE DATOS ---
async function loadCategories() {
  try {
    const res = await fetch('/api/categories', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
    categoriesCache = await res.json();
    catCountEl.textContent = categoriesCache.length;
    renderCategories(categoriesCache);
  } catch (err) { console.error('❌ Error cargando categorías:', err); }
}

async function loadPaymentMethods() {
  try {
    const res = await fetch('/api/payment-methods', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
    pmsCache = await res.json();
    pmCountEl.textContent = pmsCache.length;
    renderPaymentMethods(pmsCache);
  } catch (err) { console.error('❌ Error cargando medios de pago:', err); }
}

function renderCategories(categories) {
  categoryList.innerHTML = categories.map(c => `
    <div class="bg-surface-card p-4 border border-ui group transition-all hover:border-primary hover:shadow-xl hover:-translate-y-1 flex flex-col items-center text-center" style="border-radius:3rem">
      <div class="w-14 h-14 flex items-center justify-center text-3xl mb-3 shrink-0">
        ${escapeHtml(c.icon) || '🏷️'}
      </div>
      <div class="w-full mb-2">
        <h4 class="text-[8px] font-black uppercase tracking-tighter italic truncate w-full mb-0.5">${escapeHtml(c.name)}</h4>
        <p class="text-[6px] font-bold opacity-50 uppercase tracking-widest">
          ${c.type === 'income' ? '<span class="color-primary">Ingreso</span>' : '<span class="color-danger">Gasto</span>'}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button class="p-2 hover:text-primary transition-colors flex items-center justify-center" onclick="editCategory('${c.id}')" style="width:32px;height:32px">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
        </button>
        <button class="p-2 hover:text-blue-500 transition-colors flex items-center justify-center" onclick="cloneCategory('${c.id}')" style="width:32px;height:32px">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
        </button>
      </div>
    </div>
  `).join('');
}

function renderPaymentMethods(pms) {
  pmList.innerHTML = pms.map(pm => `
    <div class="bg-surface-card p-4 border border-ui group transition-all hover:border-primary hover:shadow-xl hover:-translate-y-1 flex flex-col items-center text-center" style="border-radius:3rem">
      <div class="w-14 h-14 flex items-center justify-center text-3xl mb-3 shrink-0">
        ${escapeHtml(pm.icon) || '💳'}
      </div>
      <div class="w-full mb-2">
        <h4 class="text-[8px] font-black uppercase tracking-tighter italic truncate w-full mb-0.5">${escapeHtml(pm.name)}</h4>
        <p class="text-[6px] font-bold opacity-50 uppercase tracking-widest italic">Activo</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="p-2 hover:text-primary transition-colors flex items-center justify-center" onclick="editPm('${pm.id}')" style="width:32px;height:32px">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
        </button>
        <button class="p-2 hover:text-blue-500 transition-colors flex items-center justify-center" onclick="clonePm('${pm.id}')" style="width:32px;height:32px">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
        </button>
      </div>
    </div>
  `).join('');
}

// --- ACCIONES CATEGORÍA ---
window.editCategory = (id) => {
  const c = categoriesCache.find(cat => cat.id === id);
  if (c) openModal('category-modal', 'Editar Categoría', c);
};

window.cloneCategory = (id) => {
  const c = categoriesCache.find(cat => cat.id === id);
  if (!c) return;
  const clone = { ...c, id: '', name: c.name + ' (copia)' };
  openModal('category-modal', 'Clonar Categoría', clone);
};

document.getElementById('category-form').onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('category-id').value;
  const name = document.getElementById('category-name').value;
  const type = document.getElementById('category-type').value;
  const icon = document.getElementById('category-icon').value || '🏷️';

  try {
    const url = id ? `/api/categories/${id}` : '/api/categories';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ name, type, icon })
    });
    if (res.ok) {
      closeModal('category-modal');
      await loadCategories();
    }
  } catch (err) { console.error(err); }
};

// --- ACCIONES MEDIO DE PAGO ---
window.editPm = (id) => {
  const pm = pmsCache.find(p => p.id === id);
  if (pm) openModal('pm-modal', 'Editar Medio de Pago', pm);
};

window.clonePm = (id) => {
  const pm = pmsCache.find(p => p.id === id);
  if (!pm) return;
  const clone = { ...pm, id: '', name: pm.name + ' (copia)' };
  openModal('pm-modal', 'Clonar Medio de Pago', clone);
};

document.getElementById('pm-form').onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('pm-id').value;
  const name = document.getElementById('pm-name').value;
  const icon = document.getElementById('pm-icon').value || '💳';
  const type = document.getElementById('pm-type').value || 'other';

  try {
    const url = id ? `/api/payment-methods/${id}` : '/api/payment-methods';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ name, type, icon })
    });
    if (res.ok) {
      closeModal('pm-modal');
      await loadPaymentMethods();
    }
  } catch (err) { console.error(err); }
};

logoutBtn.onclick = async () => { await signOut(); window.location.href = '/'; };

async function init() {
  session = await getSession();
  if (!session) { window.location.href = '/'; return; }
  await Promise.all([loadCategories(), loadPaymentMethods()]);
}

init();
