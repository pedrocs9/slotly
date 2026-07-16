import { boolean, decimal, integer, pgEnum, pgTable, text, timestamp, uuid, varchar, time } from "drizzle-orm/pg-core"

// Enums
export const planEnum = pgEnum("plan", ["free", "pro", "business"])
export const moduleEnum = pgEnum("module", ["reminders", "google_cal", "multi_staff", "crm", "payments", "reports"])
export const roleEnum = pgEnum("role", ["owner", "staff"])
export const positionEnum = pgEnum("position", ["gk", "def", "mid", "fwd"])
export const statusEnum = pgEnum("status", ["pending", "confirmed", "cancelled", "done"])
export const bookedByEnum = pgEnum("booked_by", ["client", "staff"])

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
  created_at: timestamp("created_at").defaultNow().notNull(),
})

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
})

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
})

// Disponibilidad semanal por profesional
export const availability = pgTable("availability", {
  id: uuid("id").primaryKey().defaultRandom(),
  professional_id: uuid("professional_id").notNull().references(() => professionals.id),
  weekday: integer("weekday").notNull(), // 0=Dom, 1=Lun, ..., 6=Sab
  start_time: time("start_time").notNull(),
  end_time: time("end_time").notNull(),
})

// Citas
export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id),
  professional_id: uuid("professional_id").notNull().references(() => professionals.id),
  service_id: uuid("service_id").notNull().references(() => services.id),
  client_name: varchar("client_name", { length: 100 }).notNull(),
  client_phone: varchar("client_phone", { length: 20 }),
  client_email: varchar("client_email", { length: 100 }),
  starts_at: timestamp("starts_at").notNull(),
  ends_at: timestamp("ends_at").notNull(),
  status: statusEnum("status").default("pending").notNull(),
  notes: text("notes"),
  booked_by: bookedByEnum("booked_by").default("client").notNull(),
  google_event_id: text("google_event_id"),
  created_at: timestamp("created_at").defaultNow().notNull(),
})

// Módulos activos por tenant
export const tenantModules = pgTable("tenant_modules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenant_id: uuid("tenant_id").notNull().references(() => tenants.id),
  module: moduleEnum("module").notNull(),
  active: boolean("active").default(true).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }),
  created_at: timestamp("created_at").defaultNow().notNull(),
})