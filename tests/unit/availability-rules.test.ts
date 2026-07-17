import test from "node:test"
import assert from "node:assert/strict"
import { dateRangeDays, validateTimeBlocks } from "../../app/lib/availability-rules"

test("weekly blocks reject overlaps", () => {
  const errors = validateTimeBlocks([
    { weekday: 1, startTime: "09:00", endTime: "13:00" },
    { weekday: 1, startTime: "12:30", endTime: "16:00" },
  ])
  assert.ok(errors.includes("Los bloques no pueden superponerse"))
})

test("weekly blocks allow split days", () => {
  const errors = validateTimeBlocks([
    { weekday: 1, startTime: "09:00", endTime: "13:00" },
    { weekday: 1, startTime: "15:00", endTime: "19:00" },
  ])
  assert.deepEqual(errors, [])
})

test("exception date range counts inclusive days", () => {
  assert.equal(dateRangeDays("2026-07-16", "2026-07-18"), 3)
})
