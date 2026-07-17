# Slotly private beta

Slotly esta listo para pilotos guiados, no para produccion abierta.

## Incorporar un negocio

1. Crear o sembrar el tenant en una base de desarrollo/beta.
2. Crear owner y staff con contrasenas entregadas por canal seguro.
3. Entrar como owner en `/login`.
4. Completar el checklist del Dashboard.
5. Revisar `/dashboard/configuracion`.
6. Crear servicios, profesionales, asignaciones y disponibilidad.
7. Publicar la pagina solo cuando la API permita los requisitos minimos.
8. Hacer una reserva de prueba desde `/{slug}/reservar`.
9. Revisar Agenda, Clientes y detalle de cita.

## Pruebas

```bash
npm run db:check
npm run test
npm run test:integration
npm run test:e2e:fixtures
npm run test:e2e
npm run test:cleanup
npm run lint
npm run build
```

Los fixtures E2E usan `slotly-e2e` y dominios `.test`. La limpieza borra solo ese tenant y sus datos relacionados.

## No incluido en beta

- Email real.
- Recordatorios.
- Pagos.
- Rate limiting activo.
- Upload seguro de logo.
- Historial de slugs.
- Observabilidad completa.
- Backups operacionales definidos por cliente.

## Soporte

Reportar problemas con:

- rol usado;
- modulo;
- hora aproximada;
- accion realizada;
- captura sin secretos ni passwords;
- resultado esperado.

## Readiness

Completado: auth, roles, tenant isolation, reserva publica, agenda, clientes, disponibilidad, servicios, profesionales y configuracion.

Pendiente antes de abrir al publico: rate limiting, email, upload seguro, observabilidad, terminos, soporte formal y estrategia de backups.
