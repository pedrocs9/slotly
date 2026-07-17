import { boolean, decimal, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar, time } from "drizzle-orm/pg-core"

// Enums
export const planEnum = pgEnum("plan", ["free", "pro", "business"])
export const moduleEnum = pgEnum("module", ["reminders", "google_cal", "multi_staff", "crm", "payments", "reports"])
export const roleEnum = pgEnum("role", ["owner", "staff"])
export const positionEnum = pgEnum("position", ["gk", "def", "mid", "fwd"])
export const statusEnum = pgEnum("status", ["pending", "confirmed", "cancelled", "done", "completed", "no_show"])
export const bookedByEnum = pgEnum("booked_by", ["client", "staff"])
export const appointmentSourceEnum = pgEnum("appointment_source", ["public", "manual", "phone", "whatsapp", "other"])
export const exceptionKindEnum = pgEnum("exception_kind", ["unavailable", "available"])
export const tenantStatusEnum = pgEnum("tenant_status", ["active", "inactive", "private_beta"])

// Tenants — cada negocio que usa Slotly
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  plan: planEnum("plan").default("free").notNull(),
  timezone: varchar("timezone", { length: 50 }).default("America/Santiago").notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 100 }),
  address: varchar("address", { length: 200 }),
  description: text("description"),
  logo_url: text("logo_url"),
  active: boolean("active").default(true).notNull(),
  status: tenantStatusEnum("status").default("private_beta").notNull(),
  booking_min_notice_min: integer("booking_min_notice_min").default(120).notNull(),
  booking_horizon_days: integer("booking_horizon_days").default(45).notNull(),
  slot_interval_min: integer("slot_interval_min").default(30).notNull(),
  auto_confirm_appointments: boolean("auto_confirm_appointments").default(false).notNull(),
  cancellation_policy: text("cancellation_policy"),
  booking_page_status: varchar("booking_page_status", { length: 20 }).default("published").notNull(),
  brand_color: varchar("brand_color", { length: 7 }).default("#5b6ee1").notNull(),
  post_booking_instructions: text("post_booking_instructions"),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  slugIdx: uniqueIndex("tenants_slug_idx").on(table.slug),
}))

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id),
  professional_id: uuid("professional_id").references(() => professionals.id),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 100 }).notNull(),
  password_hash: text("password_hash").notNull(),
  role: roleEnum("role").default("staff").notNull(),
  active: boolean("active").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  emailIdx: uniqueIndex("users_email_idx").on(table.email),
  tenantIdx: index("users_tenant_idx").on(table.tenant_id),
  tenantIdIdx: uniqueIndex("users_tenant_id_id_idx").on(table.tenant_id, table.id),
}))

// Profesionales — dueños y staff de cada negocio
export const professionals = pgTable("professionals", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 100 }).notNull().unique(),
  role: roleEnum("role").default("staff").notNull(),
  avatar_url: text("avatar_url"),
  google_calendar_id: text("google_calendar_id"),
  active: boolean("active").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("professionals_tenant_idx").on(table.tenant_id),
  tenantIdIdx: uniqueIndex("professionals_tenant_id_id_idx").on(table.tenant_id, table.id),
}))

// Servicios — lo que ofrece el negocio
export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  duration_min: integer("duration_min").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }),
  color: varchar("color", { length: 7 }).default("#4A6741"),
  active: boolean("active").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("services_tenant_idx").on(table.tenant_id),
  tenantIdIdx: uniqueIndex("services_tenant_id_id_idx").on(table.tenant_id, table.id),
  tenantNameIdx: uniqueIndex("services_tenant_name_idx").on(table.tenant_id, table.name),
}))

export const professionalServices = pgTable("professional_services", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id),
  professional_id: uuid("professional_id").notNull().references(() => professionals.id),
  service_id: uuid("service_id").notNull().references(() => services.id),
  active: boolean("active").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueAssignment: uniqueIndex("professional_services_unique_idx").on(table.professional_id, table.service_id),
  tenantIdx: index("professional_services_tenant_idx").on(table.tenant_id),
}))

// Disponibilidad semanal por profesional
export const availability = pgTable("availability", {
  id: uuid("id").primaryKey().defaultRandom(),
  professional_id: uuid("professional_id").notNull().references(() => professionals.id),
  weekday: integer("weekday").notNull(), // 0=Dom, 1=Lun, ..., 6=Sab
  start_time: time("start_time").notNull(),
  end_time: time("end_time").notNull(),
  active: boolean("active").default(true).notNull(),
}, (table) => ({
  professionalIdx: index("availability_professional_idx").on(table.professional_id),
  uniqueBlock: uniqueIndex("availability_professional_block_idx").on(table.professional_id, table.weekday, table.start_time, table.end_time),
}))

export const availabilityExceptions = pgTable("availability_exceptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id),
  professional_id: uuid("professional_id").notNull().references(() => professionals.id),
  kind: exceptionKindEnum("kind").notNull(),
  reason: varchar("reason", { length: 160 }),
  starts_at: timestamp("starts_at").notNull(),
  ends_at: timestamp("ends_at").notNull(),
  all_day: boolean("all_day").default(false).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantProfessionalIdx: index("availability_exceptions_tenant_professional_idx").on(table.tenant_id, table.professional_id),
}))

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 100 }),
  phone: varchar("phone", { length: 30 }),
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("customers_tenant_idx").on(table.tenant_id),
  tenantIdIdx: uniqueIndex("customers_tenant_id_id_idx").on(table.tenant_id, table.id),
  emailIdx: index("customers_email_idx").on(table.email),
  tenantEmailIdx: index("customers_tenant_email_idx").on(table.tenant_id, table.email),
  tenantPhoneIdx: index("customers_tenant_phone_idx").on(table.tenant_id, table.phone),
}))

// Citas
export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id),
  professional_id: uuid("professional_id").notNull().references(() => professionals.id),
  service_id: uuid("service_id").notNull().references(() => services.id),
  customer_id: uuid("customer_id").references(() => customers.id),
  client_name: varchar("client_name", { length: 100 }).notNull(),
  client_phone: varchar("client_phone", { length: 20 }),
  client_email: varchar("client_email", { length: 100 }),
  starts_at: timestamp("starts_at").notNull(),
  ends_at: timestamp("ends_at").notNull(),
  status: statusEnum("status").default("pending").notNull(),
  source: appointmentSourceEnum("source").default("public").notNull(),
  notes: text("notes"),
  cancellation_reason: text("cancellation_reason"),
  booked_by: bookedByEnum("booked_by").default("client").notNull(),
  google_event_id: text("google_event_id"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("appointments_tenant_idx").on(table.tenant_id),
  professionalDateIdx: index("appointments_professional_date_idx").on(table.professional_id, table.starts_at),
  customerIdx: index("appointments_customer_idx").on(table.customer_id),
}))

// Módulos activos por tenant
export const tenantModules = pgTable("tenant_modules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id),
  module: moduleEnum("module").notNull(),
  active: boolean("active").default(true).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantModuleIdx: uniqueIndex("tenant_modules_tenant_module_idx").on(table.tenant_id, table.module),
}))
