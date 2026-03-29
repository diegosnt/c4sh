# 💰 c4sh - Finanzas

**c4sh** es una aplicación ultra-minimalista, moderna y segura para el seguimiento de finanzas personales. Diseñada bajo la filosofía de "menos es más", se enfoca en la velocidad de uso, la legibilidad y la integridad de los datos.

## 🚀 Tech Stack

- **Backend**: [Hono](https://hono.dev/) + [Node.js](https://nodejs.org/) (ESM). Elegido por su performance extrema y zero dependencias legadas.
- **Lenguaje**: [TypeScript](https://www.typescript.org/) para un desarrollo robusto y tipado estricto.
- **Base de Datos & Auth**: [Supabase](https://supabase.com/) (PostgreSQL).
- **Frontend**: HTML5 + Vanilla JS + [Simple.css](https://simplecss.org/). Minimalismo puro basado en HTML semántico.
- **Validación**: [Zod](https://zod.dev/) para asegurar la integridad de los datos en runtime.

## 🛡️ Seguridad (Blindaje MVP)

La aplicación no es solo un prototipo, cuenta con capas de seguridad industrial:

1.  **Row Level Security (RLS)**: Cada usuario solo puede ver y modificar sus propios datos directamente en PostgreSQL.
2.  **Validación con Zod**: Los datos de entrada son validados y transformados antes de tocar la lógica de negocio.
3.  **Sanitización SQL**: Capa manual de limpieza de strings (remoción de bytes nulos y escape de comillas) integrada en los esquemas de validación.
4.  **Rate Limiting**: Protección contra ataques de fuerza bruta y abuso de API (100 req/min por IP).
5.  **Security Headers**: Implementación de CSP, Anti-Clickjacking y protección contra Sniffing mediante headers de seguridad modernos.
6.  **JWT Auth**: Autenticación persistente y segura delegada a Supabase Auth.

## 🌓 Características

- **Dashboard Dinámico**: Saldo total, ingresos y gastos calculados en tiempo real.
- **Categorías Inteligentes**: Auto-generación de categorías básicas (Sueldo, Comida, Alquiler, etc.) en la primera sesión.
- **Modo Dual**: Soporte para Modo Claro y Oscuro, persistente en `localStorage` y con detección automática del sistema.
- **Responsive por Naturaleza**: Gracias a Simple.css, la app vuela y se ve perfecta en móviles y desktop.
- **Zero Bundlers**: Inyección dinámica de configuración de entorno para un despliegue sin bardo de compilación en el frontend.

## 🛠️ Instalación y Setup

### 1. Clonar y dependencias
```bash
pnpm install
```

### 2. Configuración de Entorno
Crea un archivo `.env` basado en el ejemplo:
```env
SUPABASE_URL=tu_url
SUPABASE_ANON_KEY=tu_clave_anonima
PORT=3000
```

### 3. Base de Datos
Ejecuta los scripts en la carpeta `/sql` en el Editor SQL de tu proyecto Supabase (en orden: `00_init.sql` y luego `01_rls.sql`).

### 4. Desarrollo
```bash
pnpm dev
```
La app levantará en `http://localhost:3000`.

## 📂 Estructura del Proyecto

```text
├── api/
│   ├── lib/            # Utilidades y cliente Supabase
│   ├── middleware/     # Auth y validaciones
│   └── server.ts       # Servidor Hono y rutas
├── public/             # Frontend (HTML/JS/CSS)
├── sql/                # Scripts de base de datos
├── .env                # Variables de entorno (no commitear!)
└── tsconfig.json       # Configuración de TypeScript
```

---
Diseñado con ❤️ por un arquitecto apasionado por el código limpio. ¡Dale que vuela! 🚀✨
