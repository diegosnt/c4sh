import { createClient } from './supabase-minimal.js'

// Intentamos obtener la config del server
async function getConfig() {
  // Primero chequeamos si ya están inyectadas (para compatibilidad local)
  if (window.__SUPABASE_URL__ && window.__SUPABASE_ANON_KEY__) {
    return {
      url: window.__SUPABASE_URL__,
      key: window.__SUPABASE_ANON_KEY__
    };
  }

  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    return {
      url: config.supabaseUrl,
      key: config.supabaseAnonKey
    };
  } catch (err) {
    console.error('Error cargando configuración de Supabase:', err);
    return { url: null, key: null };
  }
}

// Inicializamos el cliente de forma asíncrona
const config = await getConfig();

if (!config.url || !config.key) {
  console.error('Supabase no configurado. Verificá las variables de entorno.');
}

export const supabase = createClient(config.url, config.key)
