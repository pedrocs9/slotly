import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as dotenv from "dotenv"
import * as schema from "./schema"

dotenv.config({ path: ".env.local" })

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

async function seed() {
  console.log("🌱 Iniciando seed de Podología Clínica Ana García...")

  // 1. Crear tenant
  const [tenant] = await db.insert(schema.tenants).values({
    name: "Podología Clínica Silvana Álvarez",
    slug: "podologia-silvana",
    plan: "pro",
    timezone: "America/Santiago",
    phone: "+56 9 8765 4321",
    email: "contacto@podologiaana.cl",
    address: "Av. Providencia 1234, Of. 502, Providencia, Santiago",
    description: "Clínica de podología profesional con más de 10 años de experiencia. Especialistas en salud y bienestar del pie, biomecánica y preparados artesanales.",
    active: true,
  }).returning()

  console.log("✓ Tenant creado:", tenant.name)

  // 2. Crear profesional principal (dueña)
  const [ana] = await db.insert(schema.professionals).values({
    tenant_id: tenant.id,
    name: "Silvana Álvarez",
    email: "silvana@podologiasilvana.cl",
    role: "owner",
    active: true,
  }).returning()

  console.log("✓ Profesional creada:", ana.name)

  // 3. Crear servicios reales de podología
  const serviciosData = [
    {
      name: "Podología Clínica",
      description: "Tratamiento integral del pie que incluye corte y arreglo de uñas, eliminación de callosidades, durezas y helomas. Ideal para el cuidado preventivo y tratamiento de afecciones del pie.",
      duration_min: 60,
      price: "25000",
      color: "#4A6741",
    },
    {
      name: "Quiropodia",
      description: "Limpieza profunda y tratamiento estético del pie. Incluye exfoliación, hidratación, corte y limado de uñas. Deja tus pies suaves e hidratados.",
      duration_min: 45,
      price: "18000",
      color: "#6B8F68",
    },
    {
      name: "Biomecánica y Estudio de la Pisada",
      description: "Análisis completo de la marcha y pisada mediante plataforma de presiones. Incluye informe detallado y recomendaciones de tratamiento y calzado.",
      duration_min: 90,
      price: "45000",
      color: "#2E4A2B",
    },
    {
      name: "Plantillas Ortopédicas Personalizadas",
      description: "Elaboración de plantillas a medida según el estudio biomecánico. Fabricadas con materiales de alta calidad para corregir alteraciones de la pisada y aliviar el dolor.",
      duration_min: 30,
      price: "65000",
      color: "#3D5C3B",
    },
    {
      name: "Cirugía Ungueal — Uña Encarnada",
      description: "Tratamiento definitivo de la onicocriptosis (uña encarnada) mediante técnica de matricectomía parcial bajo anestesia local. Procedimiento ambulatorio, sin puntos.",
      duration_min: 60,
      price: "35000",
      color: "#B87044",
    },
    {
      name: "Podología Estética",
      description: "Servicio estético completo que incluye esmaltado semipermanente, nail art, hidratación profunda con parafina y masaje relajante de pies y pantorrillas.",
      duration_min: 75,
      price: "22000",
      color: "#C4845A",
    },
    {
      name: "Tratamiento Pie Diabético",
      description: "Atención especializada para pacientes con diabetes. Revisión vascular y neurológica, cuidado de uñas y piel con protocolo de seguridad específico para pie de riesgo.",
      duration_min: 60,
      price: "30000",
      color: "#8B4513",
    },
    {
      name: "Tratamiento de Hongos (Onicomicosis)",
      description: "Diagnóstico y tratamiento de hongos en uñas y piel del pie. Incluye desbridamiento de la uña afectada y aplicación de antifúngico de alta concentración.",
      duration_min: 45,
      price: "28000",
      color: "#556B2F",
    },
    {
      name: "Verruga Plantar",
      description: "Tratamiento de papilomas plantares mediante crioterapia o ácido salicílico según el caso. Protocolo de seguimiento hasta la resolución completa.",
      duration_min: 45,
      price: "25000",
      color: "#8B7355",
    },
    {
      name: "Revisión y Control",
      description: "Consulta de seguimiento para pacientes en tratamiento. Revisión del avance, ajuste del plan terapéutico y resolución de dudas.",
      duration_min: 30,
      price: "12000",
      color: "#5F9EA0",
    },
  ]

  const servicios = await db.insert(schema.services).values(
    serviciosData.map(s => ({ ...s, tenant_id: tenant.id, active: true }))
  ).returning()

  console.log(`✓ ${servicios.length} servicios creados`)

  // 4. Crear disponibilidad semanal de Ana
  const disponibilidad = [
    { weekday: 1, start_time: "09:00", end_time: "19:00" }, // Lunes
    { weekday: 2, start_time: "09:00", end_time: "19:00" }, // Martes
    { weekday: 3, start_time: "09:00", end_time: "19:00" }, // Miércoles
    { weekday: 4, start_time: "09:00", end_time: "19:00" }, // Jueves
    { weekday: 5, start_time: "09:00", end_time: "17:00" }, // Viernes
    { weekday: 6, start_time: "09:00", end_time: "13:00" }, // Sábado
  ]

  await db.insert(schema.availability).values(
    disponibilidad.map(d => ({ ...d, professional_id: ana.id }))
  )

  console.log("✓ Disponibilidad semanal creada")

  // 5. Activar módulos del plan pro
  const modulos = ["reminders", "crm", "reports"] as const

  await db.insert(schema.tenantModules).values(
    modulos.map(m => ({
      tenant_id: tenant.id,
      module: m,
      active: true,
      price: "0",
    }))
  )

  console.log("✓ Módulos activados:", modulos.join(", "))
  console.log("\n✅ Seed completado exitosamente")
  console.log("📌 Página pública: /podologia-ana")
  console.log("📌 Panel admin:    /dashboard/podologia-ana")

  process.exit(0)
}

seed().catch((err) => {
  console.error("❌ Error en seed:", err)
  process.exit(1)
})