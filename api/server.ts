import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { serveStatic } from '@hono/node-server/serve-static';
import { logger } from 'hono/logger';
import { rateLimiter } from 'hono-rate-limiter';
import { secureHeaders } from 'hono/secure-headers';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getSupabase } from './lib/supabase.js';
import { authMiddleware } from './middleware/auth.js';
import { AuthUser } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Inyecta las variables de Supabase directamente en el HTML servido,
// eliminando la necesidad de un endpoint /api/config público.
const serveHtmlWithConfig = async (c: any, filename: string) => {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
  const filePath = join(process.cwd(), 'public', filename);
  const html = await readFile(filePath, 'utf-8');
  const injected = html.replace(
    '</head>',
    `<script>window.__SUPABASE_URL__="${supabaseUrl}";window.__SUPABASE_ANON_KEY__="${supabaseAnonKey}";if('serviceWorker'in navigator){navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()));}</script></head>`
  );
  return c.html(injected);
};

// Definición de tipos para el contexto de Hono
type Env = {
  Variables: {
    user: AuthUser;
    accessToken: string;
  };
};

const app = new Hono<Env>();
const api = new Hono<Env>();

// --- SEGURIDAD INDUSTRIAL ---
// 1. Headers de seguridad (CSP, HSTS, XSS, Frame Options, etc.)
app.use('*', secureHeaders());

// 2. Logger con sanitización
app.use('*', logger());

// 3. Rate Limiter (100 req/min por IP)
// En producción (Vercel), x-forwarded-for es seteado por la CDN y es confiable.
// Solo tomamos la primera IP de la lista y validamos que sea una IP real.
// En desarrollo local, usamos la IP de la conexión TCP real (no falsificable por el cliente).
const keyGenerator = (c: any): string => {
  if (process.env.NODE_ENV === 'production') {
    const forwarded = c.req.header('x-forwarded-for');
    if (forwarded) {
      const ip = forwarded.split(',')[0].trim();
      if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || /^[a-f0-9:]+$/i.test(ip)) return ip;
    }
    return c.req.header('x-real-ip') || 'anonymous';
  }
  try {
    return getConnInfo(c).remote.address || 'anonymous';
  } catch {
    return 'anonymous';
  }
};

const limiter = rateLimiter({
  windowMs: 1 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-6",
  keyGenerator,
});
app.use('/api/*', limiter);

// --- ESQUEMAS DE VALIDACIÓN ---
const uuidParamSchema = z.object({
  id: z.string().uuid({ message: 'ID inválido' })
});

const categorySchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(50, "Máximo 50 caracteres"),
  icon: z.string().trim().max(10, "Emoji inválido").optional().nullable().default('🏷️'),
  type: z.enum(['income', 'expense']),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional().nullable().default('#3b82f6')
});

const paymentMethodSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(50, "Máximo 50 caracteres"),
  type: z.enum(['cash', 'debit', 'credit', 'other']),
  icon: z.string().trim().max(10, "Emoji inválido").optional().nullable().default('💳')
});

const transactionSchema = z.object({
  amount: z.union([z.string(), z.number()])
    .transform((val) => typeof val === 'string' ? parseFloat(val) : val)
    .refine((val) => !isNaN(val) && val !== 0, { message: "Monto inválido" })
    .refine((val) => Math.abs(val) < 1000000000, { message: "Monto excesivo" }),
  category_id: z.string().uuid({ message: "ID de categoría inválido" }),
  payment_method_id: z.string().uuid({ message: "ID de medio de pago inválido" }),
  description: z.string().trim().max(250, "Máximo 250 caracteres").optional().nullable(),
  date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
});

// --- API ROUTES ---

api.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date() }));

api.get('/payment-methods', authMiddleware, async (c) => {
  const user = c.get('user');
  const token = c.get('accessToken');
  const supabase = getSupabase(token);
  
  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, name, type, icon')
    .eq('user_id', user.id);
  
  if (error) return c.json({ error: error.message }, 500);
  
  if (data.length === 0) {
    const { data: newData, error: insertError } = await supabase
      .from('payment_methods')
      .insert({ user_id: user.id, name: 'Efectivo', type: 'cash', icon: '💵' })
      .select('id, name, type, icon')
      .single();
    
    if (insertError) return c.json({ error: insertError.message }, 500);
    return c.json([newData]);
  }
  
  return c.json(data);
});

api.post('/payment-methods', authMiddleware, zValidator('json', paymentMethodSchema), async (c) => {
  const user = c.get('user');
  const token = c.get('accessToken');
  const supabase = getSupabase(token);
  const { name, type, icon } = c.req.valid('json');
  
  const { data, error } = await supabase
    .from('payment_methods')
    .insert({ user_id: user.id, name, type, icon })
    .select().single();
    
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

api.put('/payment-methods/:id', authMiddleware, zValidator('param', uuidParamSchema), zValidator('json', paymentMethodSchema), async (c) => {
  const user = c.get('user');
  const token = c.get('accessToken');
  const supabase = getSupabase(token);
  const { id } = c.req.valid('param');
  const { name, type, icon } = c.req.valid('json');
  
  const { data, error } = await supabase
    .from('payment_methods')
    .update({ name, type, icon })
    .eq('id', id)
    .eq('user_id', user.id)
    .select().single();
    
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

api.get('/transactions', authMiddleware, async (c) => {
  const user = c.get('user');
  const token = c.get('accessToken');
  const supabase = getSupabase(token);
  const { data, error } = await supabase
    .from('transactions')
    .select('*, categories(name, icon, color, type), payment_methods(name, icon)')
    .eq('user_id', user.id)
    .order('date', { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

api.post('/transactions', authMiddleware, zValidator('json', transactionSchema), async (c) => {
  const user = c.get('user');
  const token = c.get('accessToken');
  const supabase = getSupabase(token);
  const { amount, category_id, payment_method_id, description, date } = c.req.valid('json');
  const { data, error } = await supabase
    .from('transactions')
    .insert({ 
      user_id: user.id, 
      amount, 
      category_id, 
      payment_method_id,
      description, 
      date: date || new Date().toISOString() 
    })
    .select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

api.put('/transactions/:id', authMiddleware, zValidator('param', uuidParamSchema), zValidator('json', transactionSchema), async (c) => {
  const user = c.get('user');
  const token = c.get('accessToken');
  const supabase = getSupabase(token);
  const { id } = c.req.valid('param');
  const { amount, category_id, payment_method_id, description, date } = c.req.valid('json');
  
  const { data, error } = await supabase
    .from('transactions')
    .update({ amount, category_id, payment_method_id, description, date })
    .eq('id', id)
    .eq('user_id', user.id)
    .select().single();
    
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

api.get('/categories', authMiddleware, async (c) => {
  const user = c.get('user');
  const token = c.get('accessToken');
  const supabase = getSupabase(token);
  const { data, error } = await supabase.from('categories').select('*').eq('user_id', user.id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

api.post('/categories', authMiddleware, zValidator('json', categorySchema), async (c) => {
  const user = c.get('user');
  const token = c.get('accessToken');
  const supabase = getSupabase(token);
  const { name, icon, color, type } = c.req.valid('json');
  
  const { data, error } = await supabase
    .from('categories')
    .insert({ user_id: user.id, name, icon, color, type })
    .select().single();
    
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

api.put('/categories/:id', authMiddleware, zValidator('param', uuidParamSchema), zValidator('json', categorySchema), async (c) => {
  const user = c.get('user');
  const token = c.get('accessToken');
  const supabase = getSupabase(token);
  const { id } = c.req.valid('param');
  const { name, icon, color, type } = c.req.valid('json');
  
  const { data, error } = await supabase
    .from('categories')
    .update({ name, icon, color, type })
    .eq('id', id)
    .eq('user_id', user.id)
    .select().single();
    
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

api.delete('/transactions/:id', authMiddleware, zValidator('param', uuidParamSchema), async (c) => {
  const user = c.get('user');
  const token = c.get('accessToken');
  const supabase = getSupabase(token);
  const { id } = c.req.valid('param');
  const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id);
  if (error) return c.json({ error: error.message }, 500);
  return c.body(null, 204);
});

// --- MAIN APP ---

// Montar la API
app.route('/api', api);

// Servir HTMLs con config de Supabase inyectada (nunca via endpoint público)
app.get('/', (c) => serveHtmlWithConfig(c, 'index.html'));
app.get('/index.html', (c) => serveHtmlWithConfig(c, 'index.html'));
app.get('/home.html', (c) => serveHtmlWithConfig(c, 'home.html'));

// Servir el resto de archivos estáticos (css, js, etc.)
app.use('/*', serveStatic({ root: './public' }));

// Manejar favicon.ico para evitar 404
app.get('/favicon.ico', (c) => c.body(null, 204));

// --- EXPORT PARA VERCEL ---
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);

// --- INICIO LOCAL ---
if (process.env.NODE_ENV !== 'production') {
  const PORT = Number(process.env.PORT) || 3001;
  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`🚀 Servidor Local corriendo en http://localhost:${info.port}`);
  });
}

export default app;
