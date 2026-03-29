import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { serve } from '@hono/node-server';
import { logger as honoLogger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { rateLimiter } from 'hono-rate-limiter';
import { authMiddleware } from './middleware/auth.js';
import { getSupabase } from './lib/supabase.js';
import pino from 'pino';
import dotenv from 'dotenv';

dotenv.config();
const logger = pino();
const app = new Hono().basePath('/api');

// --- UTILIDADES DE SANITIZACIÓN ---
const sqlSanitize = (val: string) => {
  if (typeof val !== 'string') return val;
  return val.trim().replace(/\0/g, '').replace(/'/g, "''");
};

// --- CONFIGURACIÓN DE SEGURIDAD ---
app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    connectSrc: ["'self'", "https://*.supabase.co", "wss://*.supabase.co"],
    imgSrc: ["'self'", "data:", "https://*.supabase.co"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: [],
  },
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  referrerPolicy: 'strict-origin-when-cross-origin',
}));

const limiter = rateLimiter({
  windowMs: 1 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-6",
  keyGenerator: (c) => c.req.header("x-forwarded-for") || c.req.header("remote-addr") || "anonymous",
});
app.use('*', limiter);

const transactionSchema = z.object({
  amount: z.union([z.string(), z.number()])
    .transform((val) => typeof val === 'string' ? parseFloat(val) : val)
    .refine((val) => !isNaN(val) && val !== 0, { message: "Monto inválido" }),
  category_id: z.string().uuid({ message: "ID de categoría inválido" }),
  description: z.string().max(255).transform(sqlSanitize).optional().nullable(),
  date: z.string().optional().nullable(),
});

app.use('*', honoLogger());

// --- ROUTES ---

// Endpoint para que el front obtenga la config
app.get('/config', (c) => {
  return c.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY
  });
});

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date() }));

app.get('/transactions', authMiddleware, async (c) => {
  const user = c.get('user');
  const token = c.get('accessToken');
  const supabase = getSupabase(token);
  const { data, error } = await supabase
    .from('transactions')
    .select('*, categories(name, icon, color, type)')
    .eq('user_id', user.id)
    .order('date', { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.post('/transactions', authMiddleware, zValidator('json', transactionSchema, (result, c) => {
  if (!result.success) return c.json({ error: 'Datos inválidos', details: result.error.format() }, 400);
}), async (c) => {
  const user = c.get('user');
  const token = c.get('accessToken');
  const supabase = getSupabase(token);
  const { amount, category_id, description, date } = c.req.valid('json');
  const { data, error } = await supabase
    .from('transactions')
    .insert({ user_id: user.id, amount, category_id, description, date: date || new Date().toISOString() })
    .select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.delete('/transactions/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const token = c.get('accessToken');
  const supabase = getSupabase(token);
  const id = c.req.param('id');
  const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id);
  if (error) return c.json({ error: error.message }, 500);
  return c.body(null, 204);
});

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
