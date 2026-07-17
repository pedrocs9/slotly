export type Slot = {
  startsAt: Date
  endsAt: Date
  label: string
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  )

  return asUtc - date.getTime()
}

export function zonedDateTimeToUtc(date: string, time: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null

  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone)
  const corrected = new Date(utcGuess.getTime() - offset)
  const correctedOffset = getTimeZoneOffsetMs(corrected, timeZone)

  return new Date(utcGuess.getTime() - correctedOffset)
}

export function utcToZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)

  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

export function zonedWeekday(date: Date, timeZone: string) {
  const parts = utcToZonedParts(date, timeZone)
  const localMidnight = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))
  return new Date(localMidnight).getUTCDay()
}

export function timeToMinutes(value: string) {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number)
  return hour * 60 + minute
}

export function minutesToTime(value: number) {
  const hour = Math.floor(value / 60).toString().padStart(2, "0")
  const minute = (value % 60).toString().padStart(2, "0")
  return `${hour}:${minute}`
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart
}

export function databaseTimestampToUtcDate(value: Date | string) {
  if (value instanceof Date) return value
  const normalized = value.includes("T") ? value : value.replace(" ", "T")
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : `${normalized}Z`
  return new Date(withZone)
}

export function utcDateToDatabaseTimestamp(value: Date) {
  return value.toISOString().slice(0, 19).replace("T", " ")
}
