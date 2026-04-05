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
  errorDiv.classList.remove('visible')

  try {
    await signIn(email, password)
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.classList.add('visible');
    submitBtn.disabled = false
    submitBtn.textContent = 'Iniciar sesión'
  }
})
