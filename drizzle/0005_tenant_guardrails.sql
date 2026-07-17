-- Tenant guardrails: additive, non-destructive constraints.
-- Rollback, if needed:
-- ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_professional_tenant_fk;
-- ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_service_tenant_fk;
-- ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_customer_tenant_fk;
-- ALTER TABLE professional_services DROP CONSTRAINT IF EXISTS professional_services_professional_tenant_fk;
-- ALTER TABLE professional_services DROP CONSTRAINT IF EXISTS professional_services_service_tenant_fk;
-- ALTER TABLE availability_exceptions DROP CONSTRAINT IF EXISTS availability_exceptions_professional_tenant_fk;
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS users_professional_tenant_fk;

DO $$ DECLARE bad_count integer;
BEGIN
  SELECT count(*) INTO bad_count
  FROM appointments a
  JOIN professionals p ON p.id = a.professional_id
  WHERE p.tenant_id <> a.tenant_id;
  IF bad_count > 0 THEN RAISE EXCEPTION 'appointments professional cross-tenant rows: %', bad_count; END IF;

  SELECT count(*) INTO bad_count
  FROM appointments a
  JOIN services s ON s.id = a.service_id
  WHERE s.tenant_id <> a.tenant_id;
  IF bad_count > 0 THEN RAISE EXCEPTION 'appointments service cross-tenant rows: %', bad_count; END IF;

  SELECT count(*) INTO bad_count
  FROM appointments a
  JOIN customers c ON c.id = a.customer_id
  WHERE a.customer_id IS NOT NULL AND c.tenant_id <> a.tenant_id;
  IF bad_count > 0 THEN RAISE EXCEPTION 'appointments customer cross-tenant rows: %', bad_count; END IF;

  SELECT count(*) INTO bad_count
  FROM professional_services ps
  JOIN professionals p ON p.id = ps.professional_id
  WHERE p.tenant_id <> ps.tenant_id;
  IF bad_count > 0 THEN RAISE EXCEPTION 'professional_services professional cross-tenant rows: %', bad_count; END IF;

  SELECT count(*) INTO bad_count
  FROM professional_services ps
  JOIN services s ON s.id = ps.service_id
  WHERE s.tenant_id <> ps.tenant_id;
  IF bad_count > 0 THEN RAISE EXCEPTION 'professional_services service cross-tenant rows: %', bad_count; END IF;

  SELECT count(*) INTO bad_count
  FROM availability_exceptions ae
  JOIN professionals p ON p.id = ae.professional_id
  WHERE p.tenant_id <> ae.tenant_id;
  IF bad_count > 0 THEN RAISE EXCEPTION 'availability_exceptions professional cross-tenant rows: %', bad_count; END IF;

  SELECT count(*) INTO bad_count
  FROM users u
  JOIN professionals p ON p.id = u.professional_id
  WHERE u.professional_id IS NOT NULL AND p.tenant_id <> u.tenant_id;
  IF bad_count > 0 THEN RAISE EXCEPTION 'users professional cross-tenant rows: %', bad_count; END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS professionals_tenant_id_id_idx ON professionals (tenant_id, id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS services_tenant_id_id_idx ON services (tenant_id, id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_id_id_idx ON customers (tenant_id, id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_id_id_idx ON users (tenant_id, id);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_professional_tenant_fk') THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_professional_tenant_fk
      FOREIGN KEY (tenant_id, professional_id)
      REFERENCES professionals (tenant_id, id)
      NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE appointments VALIDATE CONSTRAINT appointments_professional_tenant_fk;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_service_tenant_fk') THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_service_tenant_fk
      FOREIGN KEY (tenant_id, service_id)
      REFERENCES services (tenant_id, id)
      NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE appointments VALIDATE CONSTRAINT appointments_service_tenant_fk;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_customer_tenant_fk') THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_customer_tenant_fk
      FOREIGN KEY (tenant_id, customer_id)
      REFERENCES customers (tenant_id, id)
      NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE appointments VALIDATE CONSTRAINT appointments_customer_tenant_fk;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'professional_services_professional_tenant_fk') THEN
    ALTER TABLE professional_services
      ADD CONSTRAINT professional_services_professional_tenant_fk
      FOREIGN KEY (tenant_id, professional_id)
      REFERENCES professionals (tenant_id, id)
      NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE professional_services VALIDATE CONSTRAINT professional_services_professional_tenant_fk;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'professional_services_service_tenant_fk') THEN
    ALTER TABLE professional_services
      ADD CONSTRAINT professional_services_service_tenant_fk
      FOREIGN KEY (tenant_id, service_id)
      REFERENCES services (tenant_id, id)
      NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE professional_services VALIDATE CONSTRAINT professional_services_service_tenant_fk;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'availability_exceptions_professional_tenant_fk') THEN
    ALTER TABLE availability_exceptions
      ADD CONSTRAINT availability_exceptions_professional_tenant_fk
      FOREIGN KEY (tenant_id, professional_id)
      REFERENCES professionals (tenant_id, id)
      NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE availability_exceptions VALIDATE CONSTRAINT availability_exceptions_professional_tenant_fk;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_professional_tenant_fk') THEN
    ALTER TABLE users
      ADD CONSTRAINT users_professional_tenant_fk
      FOREIGN KEY (tenant_id, professional_id)
      REFERENCES professionals (tenant_id, id)
      NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE users VALIDATE CONSTRAINT users_professional_tenant_fk;
