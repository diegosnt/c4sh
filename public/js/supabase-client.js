import { createClient } from './supabase-minimal.js'

let config = { url: null, key: null };

async function loadConfig() {
  if (window.__SUPABASE_URL__ && window.__SUPABASE_ANON_KEY__) {
    config = { url: window.__SUPABASE_URL__, key: window.__SUPABASE_ANON_KEY__ };
    return;
  }
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      config = { url: data.supabaseUrl, key: data.supabaseAnonKey };
    }
  } catch (err) {
    console.error('Error cargando configuración de Supabase:', err);
  }
}

export async function getSupabaseClient() {
  if (!config.url || !config.key) {
    await loadConfig();
  }
  if (!config.url || !config.key) {
    console.error('Supabase no configurado. Verificá las variables de entorno.');
  }
  return createClient(config.url, config.key);
}
