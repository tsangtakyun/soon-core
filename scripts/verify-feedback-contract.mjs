import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260919140000_product_feedback_reporting_v1.sql', import.meta.url), 'utf8')
const v2Migration = readFileSync(new URL('../supabase/migrations/20260919170000_feedback_home_shared_board_v2.sql', import.meta.url), 'utf8')
const v3Migration = readFileSync(new URL('../supabase/migrations/20260919193000_feedback_engineering_handoff_v3.sql', import.meta.url), 'utf8')
const route = readFileSync(new URL('../app/api/feedback/reports/route.ts', import.meta.url), 'utf8')
const messageRoute = readFileSync(new URL('../app/api/feedback/reports/[id]/messages/route.ts', import.meta.url), 'utf8')
const attachmentRoute = readFileSync(new URL('../app/api/feedback/reports/[id]/attachments/route.ts', import.meta.url), 'utf8')
const home = readFileSync(new URL('../components/HomeFeedbackBoard.tsx', import.meta.url), 'utf8')
const products = readFileSync(new URL('../lib/feedback-shared.ts', import.meta.url), 'utf8')
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
assert.match(route, /MAX_GENERAL_FILES/)
assert.match(messageRoute, /triageFeedbackReport\(id, data\.id\)/)
assert.ok(messageRoute.indexOf("product_feedback_messages').insert") < messageRoute.indexOf('triageFeedbackReport(id, data.id)'), 'message must be saved before AI triage')
assert.match(v2Migration, /product_feedback_engineering_tasks/)
assert.match(v2Migration, /execution_status text not null default 'not_connected'/)
assert.match(v3Migration, /'awaiting_engineering'/)
assert.match(v3Migration, /runner_status text not null default 'not_connected'/)
assert.match(v2Migration, /'soon_core'/)
for (const label of ['Sooncreator.network', 'egg.sooncreator.network', 'EGG App', 'SOON-Core']) assert.match(products, new RegExp(label.replace('.', '\\.')))
assert.match(home, /Tommy × Renee 共同測試板/)
assert.match(home, /有甚麼問題或建議？/)
assert.match(home, /重試附件上載/)
assert.match(attachmentRoute, /MAX_ATTACHMENT_REQUEST_BYTES/)
assert.match(attachmentRoute, /triageFeedbackReport\(id, messageId \?\? undefined\)/)
assert.match(middleware, /feedbackOnly/)
assert.match(middleware, /Feedback-only account/)

console.log('feedback contract regression checks: PASS')
