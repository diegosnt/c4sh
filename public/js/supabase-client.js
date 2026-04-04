import { createClient } from './supabase-minimal.js'

const config = {
  url: window.__SUPABASE_URL__,
  key: window.__SUPABASE_ANON_KEY__
};

if (!config.url || !config.key) {
  console.error('Supabase no configurado. Verificá las variables de entorno.');
}

export const supabase = createClient(config.url, config.key);
