# Backup and restore strategy

Slotly usa PostgreSQL en Neon durante beta privada. La estrategia recomendada depende de capacidades habilitadas en el proyecto Neon.

## Antes de pilotos

- Confirmar retencion de point-in-time restore.
- Confirmar permisos para crear branches.
- Confirmar procedimiento de restore con PG Studio.
- Documentar region, proyecto y responsable operativo fuera del repositorio.

## Prueba de restore en desarrollo

1. Crear branch/snapshot desde Neon antes de insertar fixture.
2. Ejecutar `npm run test:e2e:fixtures`.
3. Confirmar que existe `/slotly-e2e`.
4. Crear una rama desde el punto anterior o restaurar el snapshot en entorno no productivo.
5. Verificar que el tenant fixture no existe en la rama restaurada.
6. Registrar tiempo, responsable y limitaciones.
7. Ejecutar `npm run test:cleanup` en la rama activa si corresponde.

No se debe probar restore contra produccion. Si no hay API/CLI de Neon disponible en el entorno local, la prueba queda como procedimiento manual obligatorio antes de incorporar pilotos adicionales.

## Migraciones

No aplicar migraciones sin branch/backup verificable y `db:check` previo.
