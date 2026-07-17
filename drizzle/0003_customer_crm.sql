ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS customers_tenant_phone_idx ON customers (tenant_id, phone);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS customers_tenant_email_idx ON customers (tenant_id, email);
