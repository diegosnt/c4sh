import { Context, Next } from 'hono';
import { supabase } from '../lib/supabase.js';
import { User } from '@supabase/supabase-js';

type Env = {
  Variables: {
    user: User;
    accessToken: string;
  };
};

export async function authMiddleware(c: Context<Env>, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'No autorizado - Token faltante' }, 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    // Forzamos el tipo a 'any' temporalmente para evitar el error de build de Vercel
    // pero manteniendo la funcionalidad correcta.
    const { data, error } = await (supabase.auth as any).getUser(token);

    if (error || !data?.user) {
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
