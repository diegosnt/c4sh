# C4SH — Finanzas Personales

Aplicación minimalista para el seguimiento de transacciones y planificación de presupuesto anual. Diseñada con foco en velocidad de uso, seguridad estricta y una UI completamente tematizable.

---

## Tech Stack

| Capa | Tecnología |
|------|-----------|
| Backend | [Hono](https://hono.dev/) + Node.js via [tsx](https://github.com/privatenumber/tsx) |
| Frontend | Tailwind CSS (compilado) + Vanilla JS (ES Modules) |
| Base de datos & Auth | [Supabase](https://supabase.com/) (PostgreSQL + RLS) |
| Validación | [Zod](https://zod.dev/) |
| Logging | [Pino](https://getpino.io/) |

---

## Páginas

### Login (`/index.html`)
- Formulario de autenticación integrado con Supabase Auth
- Diseño consistente con el resto de la app: misma tipografía, paleta y card flotante
- Manejo de errores con clase `.login-error` desde `app.css`

### Transacciones (`/home.html`)
- Registro de ingresos y gastos con categoría, medio de pago, fecha y nota
- Dashboard en tiempo real: saldo neto, total ingresos, total gastos
- CRUD completo: crear, editar y eliminar transacciones
- Gestión de categorías y medios de pago desde modales inline

### Presupuesto Anual (`/estimated.html`)
- Definición de rubros de gasto con estimado mensual y ejecución real
- Tabla matricial: rubros × 12 meses del año seleccionado
- Edición de montos (planificado / ejecutado) por celda desde modal
- Totales por rubro, por mes y consolidado anual
- Renombrar rubros tocando su nombre directamente en la tabla
- Selector de año para navegar históricos

---

## Arquitectura CSS

El sistema de diseño está separado en tres archivos:

```
public/css/
├── style.css    — Output compilado de Tailwind (no editar)
├── theme.css    — Paleta de colores: 6 variables CSS
└── app.css      — Componentes compartidos + utilidades de color
```

### Cambiar paleta de colores

Solo se edita `theme.css`. Toda la app se actualiza automáticamente:

```css
:root {
  --primary:    #4B9DA9;   /* Header / acentos de datos  */
  --accent:     #F6F3C2;   /* Barra de herramientas      */
  --warning:    #E37434;   /* Borde inferior / botones   */
  --danger:     #91C6BC;   /* Gastos / botón salir       */
  --background: #4B9DA9;   /* Fondo del body             */
  --surface:    #91C6BC;   /* Contenedor principal       */
}
```

### Clases utilitarias de color

Los HTML y JS usan clases semánticas en lugar de hex hardcodeados:

| Clase | Propiedad |
|-------|-----------|
| `color-primary` | `color: var(--primary)` |
| `color-warning` | `color: var(--warning)` |
| `color-danger` | `color: var(--danger)` |
| `bg-color-primary` | `background-color: var(--primary)` |
| `bg-color-danger` | `background-color: var(--danger)` |
| `bg-color-primary-soft` | fondo primario al 8% de opacidad |
| `bg-color-warning-soft` | fondo warning al 8% de opacidad |
| `border-color-primary` | `border-color: var(--primary)` |
| `border-color-warning` | `border-color: var(--warning)` |
| `border-color-primary-soft` | borde primario al 10% de opacidad |
| `border-color-warning-soft` | borde warning al 10% de opacidad |
| `hover-color-primary` | color primario en hover |
| `hover-color-warning` | color warning en hover |
| `hover-color-danger` | color danger en hover |
| `hover-border-accent` | borde accent en hover |

---

## Seguridad

- **Row Level Security (RLS)**: aislamiento total a nivel de base de datos por `user_id`
- **Secure Headers** (Hono): CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- **Validación con Zod**: límites de longitud, tipos y sanitización contra inyección SQL
- **Rate Limiting**: 100 req/min por IP via `hono-rate-limiter`
- **Separación auth/perfil**: `auth.users` separado de datos de aplicación

---

## Instalación

### 1. Dependencias
```bash
pnpm install
```

### 2. Variables de entorno (`.env`)
```env
SUPABASE_URL=tu_url_de_supabase
SUPABASE_ANON_KEY=tu_anon_key_de_supabase
PORT=3001
```

### 3. Desarrollo
```bash
# Terminal 1 — Servidor backend
pnpm dev

# Terminal 2 — Compilador Tailwind (watcher)
pnpm dev:css
```

---

## Estructura del proyecto

```
c4sh/
├── api/
│   ├── lib/                    — Cliente Supabase
│   ├── middleware/              — Autenticación JWT
│   └── server.ts               — Servidor Hono, endpoints y schemas Zod
├── public/
│   ├── css/
│   │   ├── theme.css           — Paleta de colores (único archivo a modificar)
│   │   ├── app.css             — Componentes, login, utilidades de color
│   │   ├── input.css           — Entry point de Tailwind
│   │   └── style.css           — CSS compilado (generado, no editar)
│   ├── js/
│   │   ├── auth.js             — Gestión de sesión con Supabase
│   │   ├── app.js              — Lógica del login
│   │   ├── finance.js          — Lógica de Transacciones
│   │   ├── estimated.js        — Lógica de Presupuesto Anual
│   │   └── supabase-client.js  — Cliente Supabase frontend
│   ├── index.html              — Login
│   ├── home.html               — Transacciones
│   └── estimated.html          — Presupuesto Anual
├── sql/                        — Scripts de evolución de base de datos
├── tailwind.config.js
└── vercel.json
```

---

## Tareas pendientes

### Performance
- [ ] Paginación en `/api/transactions` — soporte para `?limit=` y `?offset=`
- [ ] Índices en columnas `user_id` en todas las tablas
- [ ] Cachear el cliente Supabase autenticado por token (evitar instanciar en cada request)
- [ ] Recargar solo los datos que cambian post-operación (no toda la lista)
- [ ] Actualizaciones incrementales del DOM en el listado de transacciones

### UX
- [ ] Estados de loading y error en la UI (feedback visual durante operaciones)
- [ ] Endpoints DELETE para categorías y medios de pago

### Deuda técnica
- [ ] Reemplazar `supabase-minimal.js` por el SDK oficial en todos los módulos frontend
