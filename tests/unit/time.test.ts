import test from "node:test"
import assert from "node:assert/strict"
import { databaseTimestampToUtcDate, rangesOverlap, timeToMinutes, utcDateToDatabaseTimestamp, zonedDateTimeToUtc, zonedWeekday } from "../../app/lib/time"

test("ranges allow consecutive appointments", () => {
  const aStart = new Date("2026-07-20T10:00:00Z")
  const aEnd = new Date("2026-07-20T10:30:00Z")
  const bStart = new Date("2026-07-20T10:30:00Z")
  const bEnd = new Date("2026-07-20T11:00:00Z")

  assert.equal(rangesOverlap(aStart, aEnd, bStart, bEnd), false)
})

test("ranges reject partial overlap", () => {
  const aStart = new Date("2026-07-20T10:00:00Z")
  const aEnd = new Date("2026-07-20T10:45:00Z")
  const bStart = new Date("2026-07-20T10:30:00Z")
  const bEnd = new Date("2026-07-20T11:00:00Z")

  assert.equal(rangesOverlap(aStart, aEnd, bStart, bEnd), true)
})

test("America/Santiago local time converts to UTC deterministically", () => {
  const utc = zonedDateTimeToUtc("2026-07-20", "09:00", "America/Santiago")
  assert.equal(utc?.toISOString(), "2026-07-20T13:00:00.000Z")
})

test("weekday is calculated in tenant timezone", () => {
  const utc = zonedDateTimeToUtc("2026-07-20", "09:00", "America/Santiago")
  assert.ok(utc)
  assert.equal(zonedWeekday(utc, "America/Santiago"), 1)
})

test("time to minutes", () => {
  assert.equal(timeToMinutes("09:30"), 570)
})

test("database timestamp without timezone is treated as UTC", () => {
  assert.equal(databaseTimestampToUtcDate("2026-07-27 14:00:00").toISOString(), "2026-07-27T14:00:00.000Z")
})

test("UTC date serializes to database timestamp literal", () => {
  assert.equal(utcDateToDatabaseTimestamp(new Date("2026-07-27T14:00:00.000Z")), "2026-07-27 14:00:00")
})
