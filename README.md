# Slotly

Agenda online para negocios de servicios. Este repositorio queda preparado como base de beta privada guiada, no como producto de produccion abierta.

## Estado actual

- Landing publica en `/` con estado honesto de beta privada.
- Pagina publica por negocio en `/{slug}`.
- Flujo de reserva en `/{slug}/reservar` usando servicios y profesionales reales.
- API publica de reserva con validacion server-side.
- Auth.js con credenciales para owner/staff.
- Dashboard privado inicial en `/dashboard`.
- Modelo Drizzle ampliado para users, customers, professional-services y availability-exceptions.
- Migracion SQL manual para prevenir solapes activos por profesional en PostgreSQL.

## Variables

Copia `.env.example` a `.env.local` y configura:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
AUTH_SECRET="replace-with-a-long-random-secret"
AUTH_TRUST_HOST="true"
SEED_OWNER_PASSWORD="replace-before-running-seed"
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
SLOTLY_RATE_LIMIT_REQUIRED="true"
RATE_LIMIT_LOGIN_LIMIT="8"
RATE_LIMIT_LOGIN_WINDOW_SECONDS="300"
RATE_LIMIT_BOOKING_LIMIT="20"
RATE_LIMIT_BOOKING_WINDOW_SECONDS="300"
RATE_LIMIT_PUBLIC_LIMIT="120"
RATE_LIMIT_PUBLIC_SLOTS_LIMIT="80"
RATE_LIMIT_PUBLIC_WINDOW_SECONDS="300"
HEALTHCHECK_TOKEN="replace-for-internal-health-detail"
```

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run test
npm run test:integration
npm run test:e2e:fixtures
npm run test:e2e
npm run test:cleanup
npm run rate-limit:check
npm run db:migrate
npm run db:seed
npm run db:check
```

## Migraciones

El proyecto ya no debe depender de `db push` como unica estrategia de produccion.

Orden recomendado en una base vacia de desarrollo:

```bash
npm run db:migrate
npm run db:seed
npm run db:check
```

`drizzle/0000_baseline.sql` representa el schema base creado desde Drizzle.

La migracion manual `drizzle/0001_private_beta.sql` agrega hardening adicional para la beta:

- estados bloqueantes: `pending`, `confirmed`;
- rango: `[starts_at, ends_at)`;
- scope: `professional_id`.
- extension requerida: `btree_gist`.

Antes de aplicar en una base existente, revisar datos duplicados o solapados.

## Credenciales demo

El seed crea:

- pagina publica: `/podologia-silvana`;
- login: `silvana@podologiasilvana.cl`;
- owner password por defecto: `SlotlyBeta2026!`, reemplazable con `SEED_OWNER_PASSWORD`;
- staff login: `camila@podologiasilvana.cl`;
- staff password por defecto: `SlotlyStaff2026!`, reemplazable con `SEED_STAFF_PASSWORD`.

El seed es idempotente para el tenant demo, usuarios, profesionales, servicios, disponibilidad y modulos. No borra datos reales.

## Reserva y concurrencia

La API publica no acepta `tenantId`, duracion, precio ni estado desde el cliente. El flujo deriva:

1. tenant desde `slug`;
2. servicio por `serviceId` y tenant;
3. profesional por `professionalId` y tenant;
4. duracion desde el servicio;
5. timezone desde el tenant;
6. estado inicial desde configuracion del tenant.

La creacion de `customer` + `appointment` se ejecuta como una unica sentencia SQL con CTEs. Si la cita falla, el cliente no queda creado de forma parcial.

La exclusion constraint `appointments_no_active_overlap` es la garantia final contra concurrencia. Permite citas consecutivas porque usa rango `[)`.

## Zonas horarias

La fecha y hora elegidas por el cliente se interpretan en la zona horaria del negocio, por defecto `America/Santiago`, y se convierten a UTC antes de almacenar.

## Seguridad publica

La reserva publica aplica:

- rate limiting serverless mediante Upstash Redis REST cuando esta configurado;
- payload maximo basico;
- honeypot;
- validacion de UUIDs, fecha, hora, strings y email;
- consentimiento requerido;
- tenant derivado desde slug;
- errores publicos normalizados.

Si `SLOTLY_RATE_LIMIT_REQUIRED=true` y falta Upstash, los endpoints protegidos fallan cerrados con 429. En desarrollo local puede quedar desactivado de forma explicita. No se implementa rate limiting en memoria porque seria una falsa garantia serverless.

Endpoints protegidos:

- `/login`: 8 intentos por 300 segundos, clave anonimizada por IP/contexto.
- `/api/appointments`: 20 requests por 300 segundos, clave anonimizada por IP/contexto.
- `/api/public/[slug]`: 120 requests generales o 80 consultas de slots por 300 segundos, clave anonimizada por IP + slug.

Las claves usan SHA-256 truncado; no incluyen email completo, telefono, nombre, password, cookies ni tokens.

Diagnostico seguro de Upstash:

```bash
npm run rate-limit:check
```

El comando crea una clave temporal `slotly:diagnostic:*`, escribe, lee y elimina. La salida no imprime URL, hostname ni token.

En Vercel configura `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` y `SLOTLY_RATE_LIMIT_REQUIRED=true`. Si Upstash falla en desarrollo, se registra `rate_limit_error` y se permite continuar; si la proteccion es requerida, falla cerrado.

## Health check

`/api/health` devuelve estado minimo publico. Con `Authorization: Bearer HEALTHCHECK_TOKEN` agrega detalle no sensible sobre DB, `btree_gist` y `appointments_no_active_overlap`.

## Pruebas

```bash
npm run test
npm run test:integration
npm run test:e2e:fixtures
npm run test:e2e
npm run test:cleanup
```

Las unitarias cubren solapes, citas consecutivas y conversion de timezone.

Las de integracion requieren `DATABASE_URL`, migraciones aplicadas, seed y variables `TEST_SERVICE_ID` / `TEST_PROFESSIONAL_ID`. Sin esas variables se saltan o fallan de forma explicita; no deben usarse para declarar concurrencia validada si no corrieron contra PostgreSQL real.

Las E2E usan Playwright, servidor local y fixtures aislados con slug `slotly-e2e`. No deben ejecutarse contra produccion. Los traces y screenshots se retienen solo al fallar.

## Onboarding y beta privada

El owner ve en Dashboard el checklist `Prepara tu espacio de reservas`, calculado desde datos reales:

- negocio con nombre, slug y contacto;
- servicio activo;
- profesional activo;
- asignacion profesional-servicio activa;
- disponibilidad activa;
- pagina publicada;
- primera cita.

La API de configuracion bloquea `published` si faltan requisitos operativos minimos. Staff puede consultar configuracion, pero no modificarla.

Guia operativa: `docs/private-beta.md`.
Runbook: `docs/operations-runbook.md`.
Pilotos: `docs/pilot-onboarding.md`.
Backups/restore: `docs/backup-restore.md`.
Tenant guardrails: `docs/tenant-guardrails.md`.

## CI sugerido

Un workflow basico puede correr `npm ci`, `npm run lint`, `npm run test` y `npm run build` sin secretos. Integracion y E2E deben quedar en un job manual o protegido con una base aislada y variables seguras.

## Fuera de beta

No estan implementados como funciones reales:

- pagos online;
- WhatsApp o SMS;
- Google Calendar bidireccional;
- marketplace;
- apps moviles nativas;
- videollamadas;
- facturacion;
- automatizaciones complejas;
- IA;
- multiples sucursales;
- portal avanzado del cliente.

## Riesgos pendientes

- Configurar Upstash/Vercel Firewall en el entorno real sigue pendiente de infraestructura.
- Upload seguro de logo pendiente; se usa URL validada.
- Historial de slugs pendiente; existe advertencia de cambio.
- Alertas externas, restore real de Neon y terminos revisados legalmente siguen pendientes.
- Falta proveedor real de email; no se muestra como activo.
