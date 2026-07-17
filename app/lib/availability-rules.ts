export type TimeBlockInput = {
  id?: string
  weekday: number
  startTime: string
  endTime: string
  active?: boolean
}

export function isTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value)
}

export function timeToMinutesSafe(value: string) {
  if (!isTime(value)) return null
  const [hour, minute] = value.split(":").map(Number)
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return hour * 60 + minute
}

export function validateTimeBlocks(blocks: TimeBlockInput[]) {
  const errors: string[] = []
  const normalized = blocks
    .filter((block) => block.active !== false)
    .map((block) => ({
      ...block,
      start: timeToMinutesSafe(block.startTime),
      end: timeToMinutesSafe(block.endTime),
    }))
    .sort((a, b) => (a.start ?? 0) - (b.start ?? 0))

  for (const block of normalized) {
    if (block.weekday < 0 || block.weekday > 6) errors.push("Dia invalido")
    if (block.start === null || block.end === null) errors.push("Hora invalida")
    if (block.start !== null && block.end !== null && block.start >= block.end) errors.push("La hora de inicio debe ser menor que la de termino")
    if (block.start !== null && block.end !== null && block.end - block.start < 15) errors.push("Cada bloque debe durar al menos 15 minutos")
  }

  for (let index = 1; index < normalized.length; index++) {
    const previous = normalized[index - 1]
    const current = normalized[index]
    if (previous.end !== null && current.start !== null && current.start < previous.end) {
      errors.push("Los bloques no pueden superponerse")
    }
  }

  return [...new Set(errors)]
}

export function dateRangeDays(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00.000Z`)
  const endDate = new Date(`${end}T00:00:00.000Z`)
  return Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1
}
