# 💰 c4sh - Finanzas Personales (Security-First)

**c4sh** es una aplicación ultra-minimalista, moderna y blindada para el seguimiento de finanzas personales. Diseñada bajo la filosofía de "menos es más", se enfoca en la velocidad de uso, la legibilidad extrema y la protección total de datos sensibles.

## 🚀 Tech Stack

- **Backend**: [Hono](https://hono.dev/) + [Node.js](https://nodejs.org/). Performance extrema con arquitectura de middleware moderna.
- **Frontend**: [Tailwind CSS](https://tailwindcss.com/) + Vanilla JS. UI basada en utilidades con un peso final de CSS < 15KB.
- **Base de Datos & Auth**: [Supabase](https://supabase.com/) (PostgreSQL) con **Row Level Security (RLS)** estricto.
- **Validación**: [Zod](https://zod.dev/) con esquemas de blindaje contra inyección y denegación de servicio.

## 🛡️ Blindaje de Seguridad Industrial (Búnker MVP)

La aplicación implementa múltiples capas de protección activa:

1.  **Row Level Security (RLS) Avanzado**: Aislamiento total a nivel de base de datos. Ningún usuario puede acceder, editar o borrar datos de otro, validado directamente en PostgreSQL.
2.  **Hono Secure Headers**: Implementación de CSP (Content Security Policy), HSTS (Strict-Transport-Security), X-Frame-Options (Anti-Clickjacking) y X-Content-Type-Options (Anti-Sniffing).
3.  **Validación & Sanitización Estricta**:
    - Esquemas de Zod con límites de longitud (`.max()`) y validación de tipos.
    - Sanitización manual de SQL para prevenir ataques de inyección en campos de texto.
    - Control de caracteres nulos y escape de secuencias peligrosas.
4.  **Rate Limiting Dinámico**: Protección contra ataques de fuerza bruta (100 req/min por IP).
5.  **Aislamiento de Auth**: Separación de datos sensibles (`auth.users`) de datos de perfil (`profiles`).

## 🌓 Características Pro

- **Gestión Total de Entidades**: Modales interactivos de Tailwind CSS para crear y editar Categorías y Medios de Pago sin salir del dashboard.
- **Dashboard en Tiempo Real**: Resumen de Saldo, Ingresos y Gastos con cálculo instantáneo.
- **Personalización Visual**: Soporte completo para Emojis en Categorías (🏠, 🍔, 💰) y Medios de Pago (💳, 🏦, 💵).
- **Control de Fechas**: Registro de transacciones con fechas pasadas o futuras mediante un Date Picker nativo.
- **Modo Dual Automático**: Detección de preferencia del sistema (Dark/Light) con persistencia en `localStorage`.
- **Zero Latency UI**: Interfaz optimizada para carga instantánea y feedback visual inmediato en la edición de gastos.

## 🛠️ Instalación y Setup

### 1. Clonar y dependencias
```bash
pnpm install
```

### 2. Configuración de Entorno (`.env`)
```env
SUPABASE_URL=tu_url_de_supabase
SUPABASE_ANON_KEY=tu_anon_key_de_supabase
PORT=3001
```

### 3. Base de Datos (SQL Editor)
Ejecutar los scripts de la carpeta `/sql` en este orden:
1.  `00_init.sql` (Tablas base)
2.  `01_rls.sql` (Políticas iniciales)
3.  `02_payment_methods.sql` (Soporte para medios de pago)
4.  `03_pm_icon.sql` (Iconos para medios de pago)
5.  `04_security_audit.sql` (Sello de seguridad y blindaje final)
6.  `05_profiles_insert_rls.sql` (Policy INSERT faltante en profiles)

### 4. Desarrollo
```bash
# Terminal 1: Servidor Backend
pnpm dev

# Terminal 2: Compilador de Tailwind (Watcher)
pnpm dev:css
```

## 📂 Estructura del Proyecto

```text
├── api/
│   ├── lib/            # Cliente Supabase y utilidades
│   ├── middleware/     # Auth y lógica de blindaje
│   └── server.ts       # Servidor Hono, Zod Schemas y Endpoints
├── public/
│   ├── css/            # Tailwind Input & Compiled Style
│   ├── js/             # Lógica de Dashboard, Auth y Supabase
│   └── home.html       # UI Principal con Modales
├── sql/                # Scripts de evolución de DB y Seguridad
└── tailwind.config.js  # Configuración del motor de diseño
```

---

## ✅ Tareas Pendientes

### Optimización

- [ ] **[O1] Implementar paginación en `/api/transactions`** — Agregar soporte para `?limit=` y `?offset=` (o cursor-based) en el endpoint de transacciones.
- [ ] **[O2] Crear índices en columnas `user_id`** — `CREATE INDEX` en `categories.user_id`, `transactions.user_id`, `payment_methods.user_id`.
- [ ] **[O3] Cachear el cliente Supabase autenticado por token** — Evitar instanciar `createClient()` en cada request.
- [ ] **[O4] Recargar solo los datos que cambian post-operación** — Después de guardar una transacción, solo recargar transacciones.
- [ ] **[O5] Optimizar re-renders del listado** — Usar actualizaciones incrementales del DOM en lugar de reconstruir toda la lista.
- [ ] **[O6] Separar el onboarding del flujo de carga de datos** — Crear un endpoint o función dedicada para inicializar datos del primer uso.
- [ ] **[O7] Agregar estados de loading y error en la UI** — Mostrar feedback visual mientras se cargan datos y cuando una operación falla.
- [ ] **[O8] Agregar endpoints `DELETE` para categorías y medios de pago** — Completar el CRUD de entidades.
- [ ] **[O9] Reemplazar `supabase-minimal.js` por el SDK oficial** — Usar `@supabase/supabase-js` en el frontend para tener token refresh, manejo de errores robusto y menos mantenimiento.

---
Diseñado con ❤️ por un arquitecto apasionado por la seguridad y el código limpio. ¡A darle que vuela! 🚀💰🛡️
