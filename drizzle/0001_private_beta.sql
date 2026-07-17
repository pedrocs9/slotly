CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE appointment_source AS ENUM ('public', 'manual', 'phone', 'whatsapp', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE exception_kind AS ENUM ('unavailable', 'available');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE tenant_status AS ENUM ('active', 'inactive', 'private_beta');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status tenant_status DEFAULT 'private_beta' NOT NULL;
--> statement-breakpoint
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS booking_min_notice_min integer DEFAULT 120 NOT NULL;
--> statement-breakpoint
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS booking_horizon_days integer DEFAULT 45 NOT NULL;
--> statement-breakpoint
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slot_interval_min integer DEFAULT 30 NOT NULL;
--> statement-breakpoint
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS auto_confirm_appointments boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cancellation_policy text;
--> statement-breakpoint
ALTER TABLE availability ADD COLUMN IF NOT EXISTS active boolean DEFAULT true NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name varchar(100) NOT NULL,
  email varchar(100),
  phone varchar(30),
  notes text,
  created_at timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS professional_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  professional_id uuid NOT NULL REFERENCES professionals(id),
  service_id uuid NOT NULL REFERENCES services(id),
  active boolean DEFAULT true NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS availability_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  professional_id uuid NOT NULL REFERENCES professionals(id),
  kind exception_kind NOT NULL,
  reason varchar(160),
  starts_at timestamp NOT NULL,
  ends_at timestamp NOT NULL,
  all_day boolean DEFAULT false NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  professional_id uuid REFERENCES professionals(id),
  name varchar(100) NOT NULL,
  email varchar(100) NOT NULL,
  password_hash text NOT NULL,
  role role DEFAULT 'staff' NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id);
--> statement-breakpoint
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS source appointment_source DEFAULT 'public' NOT NULL;
--> statement-breakpoint
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_reason text;
--> statement-breakpoint
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS services_tenant_name_idx ON services (tenant_id, name);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS availability_professional_block_idx ON availability (professional_id, weekday, start_time, end_time);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS professional_services_unique_idx ON professional_services (professional_id, service_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS tenant_modules_tenant_module_idx ON tenant_modules (tenant_id, module);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS users_tenant_idx ON users (tenant_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS customers_tenant_idx ON customers (tenant_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS customers_email_idx ON customers (email);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS professional_services_tenant_idx ON professional_services (tenant_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS availability_exceptions_tenant_professional_idx ON availability_exceptions (tenant_id, professional_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS appointments_tenant_idx ON appointments (tenant_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS appointments_professional_date_idx ON appointments (professional_id, starts_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS appointments_customer_idx ON appointments (customer_id);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'appointments_no_active_overlap'
      AND conrelid = 'appointments'::regclass
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_no_active_overlap
      EXCLUDE USING gist (
        professional_id WITH =,
        tsrange(starts_at, ends_at, '[)') WITH &&
      )
      WHERE (status IN ('pending', 'confirmed'));
  END IF;
END $$;
