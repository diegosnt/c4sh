import { Context, Next } from 'hono';
import { supabase } from '../lib/supabase.js';

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'No autorizado - Token faltante' }, 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    // Usamos el cliente de Supabase para obtener el usuario
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return c.json({ error: 'No autorizado - Token inválido' }, 401);
    }

    // Inyectar el usuario y el token en el contexto de Hono
    c.set('user', data.user);
    c.set('accessToken', token);
    await next();
  } catch (err) {
    return c.json({ error: 'Error interno del servidor en auth' }, 500);
  }
}
