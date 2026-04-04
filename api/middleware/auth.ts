import { Context, Next } from 'hono';
import { supabase } from '../lib/supabase.js';
import { AuthUser } from '@supabase/supabase-js';

type Env = {
  Variables: {
    user: AuthUser;
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
    const { data, error } = await supabase.auth.getUser(token);

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
