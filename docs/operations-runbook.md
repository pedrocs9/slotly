# Slotly operations runbook

Este runbook aplica a pilotos privados guiados. No contiene secretos.

## Severidades

- P0: fuga cross-tenant, reservas duplicadas confirmadas por constraint fallida, corrupcion DB, autenticacion comprometida. Objetivo interno: detener cambios y responder el mismo dia.
- P1: reservas publicas caidas, Agenda inutilizable, login general caido. Objetivo interno: diagnostico inicial en horas habiles.
- P2: modulo secundario con fallo o error visual importante. Objetivo interno: triage en el siguiente ciclo de soporte.
- P3: defecto menor sin impacto operativo.

## Reserva duplicada

1. No borrar citas sin preservar evidencia.
2. Revisar logs por `booking_conflict`, `booking_created` y `appointments_no_active_overlap`.
3. Confirmar que existe `appointments_no_active_overlap` con `/api/health` usando token interno.
4. Identificar tenant, profesional y rango horario por IDs internos.
5. Si la constraint falta, detener reservas publicas y restaurar desde backup/branch.

## DB caida

1. Revisar `/api/health`.
2. Confirmar estado en Neon.
3. Informar a pilotos por canal manual definido.
4. No ejecutar migraciones mientras el estado sea incierto.

## Login fallando

1. Revisar `login_rejected`, `login_rate_limited` y estado de Auth.
2. Confirmar que usuario y tenant esten activos.
3. Revisar si falta configuracion de rate limit en produccion.

## Pagina publica caida

1. Confirmar tenant activo y `booking_page_status`.
2. Revisar slug.
3. Consultar `/api/public/{slug}`.
4. Revisar logs `booking_rejected` o errores 500 por requestId.

## Error de migracion

1. Detener despliegue.
2. Confirmar backup/branch anterior.
3. Ejecutar `npm run db:check`.
4. Revisar SQL aplicado y constraints.
5. Restaurar rama/branch de Neon si corresponde.

## Datos cross-tenant

Incidente P0. Suspender acceso afectado, preservar logs, no mutar datos, revisar queries por `tenant_id`, y notificar internamente antes de reactivar.

## Antes de migrar

1. Confirmar que no es produccion accidental.
2. Crear branch/snapshot en Neon.
3. Ejecutar `npm run db:check`.
4. Aplicar migracion.
5. Ejecutar `npm run db:check`, `npm run test:integration`, smoke E2E.
6. Mantener rollback o branch anterior hasta validar pilotos.
