import { signIn, onAuthChange } from './auth.js'

const loginForm = document.getElementById('login-form')
const errorDiv = document.getElementById('error')
const submitBtn = document.getElementById('submit-btn')

onAuthChange((session) => {
  if (session) {
    window.location.href = 'home.html'
  }
})

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  
  submitBtn.disabled = true
  submitBtn.textContent = 'Iniciando...'
  errorDiv.textContent = ''

  try {
    await signIn(email, password)
  } catch (err) {
    errorDiv.innerHTML = `
      <div class="p-3 rounded-md bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-center text-sm mb-4 shadow-sm">
        ${err.message}
      </div>
    `;
    submitBtn.disabled = false
    submitBtn.textContent = 'Iniciar sesión'
  }
})
