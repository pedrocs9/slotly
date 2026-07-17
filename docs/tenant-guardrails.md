# Tenant guardrails

Slotly deriva todo contexto privado desde la sesion validada en servidor. Las APIs privadas no deben aceptar `tenantId`, `userId`, `role` ni `professionalId` como fuente de autoridad desde el cliente.

## Autorizacion

La capa central vive en `app/lib/authorization.ts`.

Roles:

- `owner`: administra configuracion, servicios, profesionales, disponibilidad estructural, citas, clientes y bloqueos.
- `staff`: lee informacion operativa, gestiona sus citas/clientes y puede crear bloqueos para su propio profesional cuando la regla de negocio lo permite. No modifica configuracion global, servicios, profesionales ni disponibilidad estructural.

Permisos principales:

- `tenant.settings.read`
- `tenant.settings.write`
- `appointments.read`
- `appointments.create`
- `appointments.update`
- `customers.read`
- `customers.write`
- `services.read`
- `services.write`
- `professionals.read`
- `professionals.write`
- `availability.read`
- `availability.write`
- `exceptions.read`
- `exceptions.write`

Errores:

- `401`: no existe sesion valida o la sesion es inconsistente.
- `403`: sesion valida sin permiso.
- `404`: recurso inexistente o no visible dentro del tenant.
- `409`: conflicto de dominio.
- `422`: validacion semantica cuando aplique.

## Ownership

Los helpers tenant-scoped viven en `app/lib/resource-access.ts`. Toda ruta que recibe un ID debe resolver el recurso con `id` y `tenantId` en la misma consulta antes de leer, modificar, relacionar o devolver datos.

Para profesionales:

- owner puede acceder a profesionales de su tenant.
- staff solo puede acceder a su propio profesional cuando la operacion es professional-scoped.
- profesionales de otro tenant se tratan como no encontrados.

## Garantias en PostgreSQL

La migracion `drizzle/0005_tenant_guardrails.sql` agrega:

- indices unicos compuestos `(tenant_id, id)` para recursos tenant-scoped criticos;
- FKs compuestas para impedir citas, asignaciones, excepciones y usuarios con relaciones cross-tenant;
- diagnosticos previos que detienen la migracion si ya existen datos inconsistentes.

Limitacion conocida: `availability` no tiene `tenant_id`; se blinda por FK a `professionals` y por consultas con join cuando se requiere ownership. Futuro recomendado: agregar `tenant_id` a `availability` de forma aditiva y backfilled.

## Transacciones y atomicidad

El proyecto usa `@neondatabase/serverless` con `neon()` y `drizzle-orm/neon-http`. Con este adaptador no se debe simular una transaccion interactiva enviando `BEGIN`, varias queries y `COMMIT` como comandos separados.

Patrones permitidos:

- una unica sentencia SQL atomica con CTEs;
- constraints declarativos de PostgreSQL como defensa final;
- operaciones Drizzle de una sola escritura;
- un driver transaccional real solo si se introduce de forma justificada.

Patrones prohibidos:

- `await sql\`BEGIN\`` seguido de varias queries independientes y `COMMIT`;
- crear recursos relacionados en pasos no atomicos;
- validar ownership despues de leer por ID global.

## Checklist para nuevas APIs

- [ ] El tenant viene de la sesion.
- [ ] La consulta incluye tenantId.
- [ ] Se verifico permiso.
- [ ] Los recursos relacionados pertenecen al tenant.
- [ ] La operacion es atomica.
- [ ] Existen tests cross-tenant.
- [ ] Los errores no filtran informacion.
- [ ] Los logs no contienen datos sensibles.
