import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260919140000_product_feedback_reporting_v1.sql', import.meta.url), 'utf8')
const route = readFileSync(new URL('../app/api/feedback/reports/route.ts', import.meta.url), 'utf8')
const middleware = readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8')

for (const table of [
  'product_feedback_reporter_access',
  'product_feedback_reports',
  'product_feedback_attachments',
  'product_feedback_messages',
  'product_feedback_status_history',
]) {
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`))
  assert.match(migration, new RegExp(`grant all on public\\.${table} to service_role`))
}

assert.match(migration, /'product-feedback-private'[\s\S]+false/)
assert.match(route, /after\(\(\) => triageFeedbackReport\(report\.id\)\)/)
assert.ok(route.indexOf("insert({") < route.indexOf('after(() => triageFeedbackReport'), 'report must be saved before AI triage')
assert.match(route, /MAX_SCREENSHOTS/)
assert.match(route, /MAX_AUDIO_BYTES/)
assert.match(middleware, /feedbackOnly/)
assert.match(middleware, /Feedback-only account/)

console.log('feedback contract regression checks: PASS')
