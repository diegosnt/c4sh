# C4SH — Finanzas Personales

Aplicación minimalista para el seguimiento de transacciones y planificación de presupuesto anual. Diseñada con foco en velocidad de uso, seguridad estricta y una UI completamente tematizable con soporte de dark mode.

---

## Tech Stack

| Capa | Tecnología |
|------|-----------|
| Backend | [Hono](https://hono.dev/) + Node.js via [tsx](https://github.com/privatenumber/tsx) |
| Frontend | Tailwind CSS (compilado) + Vanilla JS (ES Modules) |
| Base de datos & Auth | [Supabase](https://supabase.com/) (PostgreSQL + RLS) |
| Validación | [Zod](https://zod.dev/) |
| Deploy | [Vercel](https://vercel.com/) |

---

## Páginas

### Login (`/index.html`)
- Autenticación con Supabase Auth (email + password)
- Manejo de sesión persistente con redirección automática
- Diseño limpio y responsivo

### Transacciones (`/home.html`)
- Registro de ingresos y gastos con categoría, medio de pago, fecha y descripción
- Dashboard en tiempo real: saldo neto, total ingresos, total gastos
- CRUD completo de transacciones
- Gestión rápida de categorías y medios de pago desde modales inline

### Presupuesto Anual (`/estimated.html`)
- Tabla matricial: rubros × 12 meses del año seleccionado
- Selector de año para navegar históricos
- **Celdas dinámicas**: cada celda muestra el monto planificado (naranja) o ejecutado (teal) del período
- **Edición de montos**: actualización instantánea con hasta 2 decimales
- **Check de pago**: control visual de obligaciones cumplidas por mes; resaltado visual de pagos pendientes en el mes actual
- **Barra de herramientas**: cálculo automático de Total Mes (consolidado), Pagado y Pendiente

### Ajustes (`/settings.html`)
- Gestión centralizada de diccionarios de la aplicación
- **Categorías**: CRUD completo de categorías con ícono/emoji, nombre y tipo (ingreso/gasto)
- **Medios de Pago**: CRUD completo de métodos (Efectivo, Débito, Crédito, etc.)
- **Clonación**: función para duplicar categorías o medios de pago existentes y agilizar la carga de datos
- Contador de elementos configurados por sección

---

## Modelo de datos

```
auth.users                     — Usuarios (Supabase Auth)

categories                     — Categorías de transacciones
  id, user_id, name, icon, color, type (income|expense)

payment_methods                — Medios de pago
  id, user_id, name, type (cash|debit|credit|other), icon

transactions                   — Transacciones
  id, user_id, amount, category_id, payment_method_id, description, date

item_types                     — Tipos de rubro de presupuesto
  id, user_id, name

estimated_expense_items        — Rubros de presupuesto
  id, user_id, name, icon, order_index, notes, type_id

estimated_expense_values       — Valores mensuales por rubro
  id, user_id, item_id, period (YYYY-MM), estimated_amount, real_amount, paid
```

Todas las tablas tienen RLS habilitado — cada usuario solo accede a sus propios datos.

---

## Arquitectura CSS

El sistema de diseño está separado en tres archivos:

```
public/css/
├── style.css    — Output compilado de Tailwind (no editar)
├── theme.css    — Paleta de colores con variables CSS (light + dark mode)
└── app.css      — Componentes, modales, tabla, utilidades de color
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

El dark mode está implementado vía `[data-bs-theme="dark"]` con las mismas variables ajustadas en lightness. Se activa con el botón 🌓 en el header y persiste en `localStorage`.

---

## Seguridad

- **Row Level Security (RLS)**: aislamiento total a nivel de base de datos por `user_id`
- **JWT Middleware**: validación de sesión de Supabase en cada request a la API (inyecta `user` y `accessToken` en el contexto)
- **Secure Headers** (Hono): CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- **Validación con Zod**: tipos, longitudes máximas y sanitización en todos los endpoints
- **Rate Limiting**: 100 req/min por IP general, 20 req/min en endpoints de escritura
- **XSS Protection**: escape de HTML en todo contenido dinámico generado por el cliente

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
PORT=3000
```

### 3. Desarrollo
```bash
# Terminal 1 — Servidor backend + static files
pnpm dev

# Terminal 2 — Compilador Tailwind (watcher)
pnpm dev:css
```

---

## Estructura del proyecto

```
c4sh/
├── api/
│   ├── lib/                    — Cliente Supabase autenticado
│   ├── middleware/              — Validación JWT (auth.ts)
│   └── server.ts               — Servidor Hono: endpoints, schemas Zod, static serving
├── public/
│   ├── css/
│   │   ├── theme.css           — Paleta de colores (único archivo a modificar)
│   │   ├── app.css             — Componentes, modales, tabla, utilidades de color
│   │   ├── input.css           — Entry point de Tailwind
│   │   └── style.css           — CSS compilado (generado, no editar)
│   ├── js/
│   │   ├── auth.js             — Gestión de sesión Supabase
│   │   ├── app.js              — Lógica del login
│   │   ├── finance.js          — Lógica de Transacciones
│   │   ├── estimated.js        — Lógica de Presupuesto Anual
│   │   ├── settings.js         — Lógica de Configuración (Categorías/Pagos)
│   │   └── supabase-client.js  — Cliente Supabase frontend
│   ├── index.html              — Login
│   ├── home.html               — Transacciones
│   ├── estimated.html          /* Presupuesto Anual */
│   └── settings.html           /* Ajustes */
├── tailwind.config.js
├── vercel.json
└── package.json
```

---

## Tareas pendientes

### Backend & Performance
- [ ] Paginación en `/api/transactions` — soporte para `?limit=` y `?offset=`
- [ ] Índices en columnas `user_id` en todas las tablas
- [ ] Implementar borrado lógico o físico (DELETE) para categorías y medios de pago
- [ ] Recargar solo los datos que cambian post-operación (Partial hydration)

### UX/UI
- [ ] Estados de loading (skeletons) y manejo de errores global en la UI
- [ ] Estadísticas visuales (gráficos) por tipo de rubro y categoría
- [ ] Filtros avanzados en la lista de transacciones

### Deuda técnica
- [ ] Migrar lógica de `supabase-minimal.js` al SDK oficial (`supabase-client.js`)
- [ ] Implementar tests unitarios para los middlewares de Hono
- [ ] Tipado compartido entre backend y frontend (tRPC o similar)
