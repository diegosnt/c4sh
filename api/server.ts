import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { logger as honoLogger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { rateLimiter } from 'hono-rate-limiter';
import { authMiddleware } from './middleware/auth.js';
import { getSupabase } from './lib/supabase.js';
import pino from 'pino';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';

dotenv.config();
const logger = pino();
const app = new Hono();

// --- UTILIDADES DE SANITIZACIÓN ---

const sqlSanitize = (val: string) => {
  if (typeof val !== 'string') return val;
  return val
    .trim()
    .replace(/\0/g, '')
    .replace(/'/g, "''");
};

// --- CONFIGURACIÓN DE SEGURIDAD ---
// 1. Security Headers (Equivalente a Helmet)
app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"], // Solo scripts locales e inyectados
    styleSrc: ["'self'", "'unsafe-inline'"],  // Solo CSS local e inyectado
    connectSrc: ["'self'", "https://*.supabase.co", "wss://*.supabase.co"], // Solo datos de Supabase
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
  description: z
    .string()
    .max(255)
    .transform(sqlSanitize)
    .optional()
    .nullable(),
  date: z.string().optional().nullable(),
});

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  logger.error('❌ CRITICAL: SUPABASE_URL o SUPABASE_ANON_KEY no están definidas en el .env');
}

app.use('*', honoLogger());

async function serveWithConfig(c: any, fileName: string) {
  try {
    const filePath = path.resolve(`./public/${fileName}`);
    let html = await fs.readFile(filePath, 'utf-8');
    
    const configScript = `
    <script>
      (function() {
        window.__SUPABASE_URL__ = "${process.env.SUPABASE_URL || ''}";
        window.__SUPABASE_ANON_KEY__ = "${process.env.SUPABASE_ANON_KEY || ''}";
        console.log('✅ Supabase config pre-loaded');
      })();
    </script>
    `;
    
    if (/<head/i.test(html)) {
      html = html.replace(/(<head[^>]*>)/i, `$1${configScript}`);
    } else {
      html = html.replace(/(<body[^>]*>)/i, `$1${configScript}`);
    }
    
    return c.html(html);
  } catch (err) {
    logger.error(`Error cargando ${fileName}:`, err);
    return c.text(`Error cargando ${fileName}`, 500);
  }
}

app.get('/', (c) => serveWithConfig(c, 'index.html'));
app.get('/index.html', (c) => serveWithConfig(c, 'index.html'));
app.get('/home.html', (c) => serveWithConfig(c, 'home.html'));

app.use('/*', serveStatic({ root: './public' }));

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date() });
});

app.get('/api/transactions', authMiddleware, async (c) => {
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

app.post('/api/transactions', authMiddleware, zValidator('json', transactionSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: 'Datos inválidos', details: result.error.format() }, 400);
  }
}), async (c) => {
  const user = c.get('user');
  const token = c.get('accessToken');
  const supabase = getSupabase(token);
  
  const { amount, category_id, description, date } = c.req.valid('json');

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      amount,
      category_id,
      description,
      date: date || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.delete('/api/transactions/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const token = c.get('accessToken');
  const supabase = getSupabase(token);
  const id = c.req.param('id');

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return c.json({ error: error.message }, 500);
  return c.body(null, 204);
});

const PORT = Number(process.env.PORT) || 3001;

try {
  const server = serve({
    fetch: app.fetch,
    port: PORT
  }, (info) => {
    console.log(`🚀 Servidor Hono corriendo en http://localhost:${info.port}`);
  });

  // Manejo de cierre manual
  const shutdown = () => {
    console.log('\n👋 Cerrando servidor...');
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

} catch (err: any) {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Error: El puerto ${PORT} está ocupado. Intentá de nuevo en unos segundos.`);
  } else {
    console.error('❌ Error al iniciar el servidor:', err);
  }
  process.exit(1);
}
