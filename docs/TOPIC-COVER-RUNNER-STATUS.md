# Topic Cover Feedback Runner Status

Date: 2026-09-19 (Europe/London)

## Outcome

The real SOON Core topic-cover report completed the trusted Feedback Engineering Runner flow through an isolated fix, fixed tests, Preview verification, explicit promotion approval, and a Production deployment. No topic records or cover URLs were changed.

## Real report and task

- Reference: `SOON-20260919-1FE798`
- Report ID: `f1ed8402-9d76-4d24-87a4-52301609a1d9`
- Engineering task ID: `05830a6b-2f80-4fd1-9f57-8ae92a327a4b`
- Stored engineering task state: `preview_ready` (the current Feedback UI has no exposed transition for this field)
- Stored report state: `pending_review` (the current Feedback UI has no exposed resolved control)
- Operational waiting action: `completed`
- Runner state: `connected`
- Runner attempt: `1`
- Runner evidence: 6 command entries, 3 test entries, and 2 deployment entries

## Production reproduction

On the authenticated production `/topic-library` page:

- Core covers from `fqnnjwxxwxggreoognkv.supabase.co` loaded normally.
- EGG-synchronised covers from `auth.egg.sooncreator.network` reached the page but Next.js `/_next/image` returned `400 INVALID_IMAGE_OPTIMIZE_REQUEST`.
- A failed image could coexist with the permanent fallback, exposing broken image alt text.
- The direct EGG storage object itself returned `200 image/jpeg`, so the failure was in the Core image optimiser allowlist and card render state, not the source object.

Root cause confirmed in code:

- `next.config.ts` allowed only `*.supabase.co`, not the exact EGG media hostname.
- `TopicLibraryAdmin.tsx` rendered the image and fallback together without load/error state.

## Trusted runner execution

- Base commit: `da92db5810343b81b0973d98438f86f46c7171ef`
- Candidate commit: `3eb2263f3e1c0e0b2d7d1b5919a911a028ac3837`
- Branch: `automation/feedback-soon-20260919-1fe798-1`
- Isolated worktree: `/tmp/soon-feedback-worktrees/05830a6b-2f80-4fd1-9f57-8ae92a327a4b-1`

Changed files in the candidate commit:

- `next.config.ts`: adds only the exact HTTPS hostname `auth.egg.sooncreator.network`.
- `components/TopicCardCover.tsx`: fail-closed loading, success, and error states.
- `components/TopicLibraryAdmin.tsx`: uses the cover state component and resets it when the source changes.
- `scripts/verify-topic-covers.mjs`: regression tests for host matching, hostile variants, image success/failure, missing covers, and reload behaviour.

## Automated verification

Passed in the isolated runner worktree:

- `node scripts/verify-topic-covers.mjs`
- Scoped ESLint for changed files
- TypeScript `--noEmit --incremental false`
- Feedback contract regression checks
- `npm run build` (Next.js production build, 95 pages)
- `git diff --check`

The hostname regression test accepts the exact EGG HTTPS host and existing Core Supabase host, and rejects HTTP, sibling/subdomains, attacker suffixes, port `8443`, and localhost.

## Preview deployment

- Preview: https://soon-core-2mounbrlf-tsangtakyun-4639s-projects.vercel.app
- Deployment ID: `dpl_DwyUGjudkDjWLLXSGSAo1vtwvugh`
- Vercel state: `READY`
- Deployment target: Preview (`target: null`), not Production

Live Preview evidence:

- EGG optimiser request: `200 image/jpeg`
- Core optimiser request: `200 image/jpeg`
- Desktop authenticated `/topic-library`: 51 cards; multiple EGG and Core covers have positive `naturalWidth`, are visible, and no visible broken image remains.
- Desktop reload: four sampled EGG covers and four sampled Core covers still load; no visible broken image.
- Mobile `390 x 844`: after real scrolling, 10 EGG covers and 5 Core covers loaded; the two visible cards both had usable images and no fallback; no visible broken image.
- The database-wide follow-up audit found no genuine no-cover records: all 51 topics have a populated `cover_url`. A fallback visible before a lazy image loads is therefore not evidence that a source is missing.
- Preview console: no errors or warnings during the verification.

## Production screenshot follow-up

The two screenshots captured at 22:04 London time show the unchanged Production alias, not the runner Preview.

Read-only audit of all 51 topic records:

- Total topics: 51
- Populated `cover_url`: 51
- Missing `cover_url`: 0
- Direct source response: 51/51 returned `206 image/jpeg`
- Production optimiser response: 40/51 returned `200 image/jpeg`
- Production optimiser failure: 11/51 returned `400 INVALID_IMAGE_OPTIMIZE_REQUEST`
- All 11 failures use the exact host `auth.egg.sooncreator.network`; the ten cards visible across the screenshots are part of this group, together with the Yangzhi-gam-lou shaved-ice topic.
- Runner Preview optimiser response for the EGG host: `200 image/jpeg`.

Conclusion: the screenshots did not represent uncaptured or lost covers. The underlying 51 source images existed; the old Production image optimiser rejected the 11 EGG-hosted covers. The approved cover-only integration was subsequently promoted and verified in Production.

## Production promotion

- Explicit approval source: SOON Chief task `01a0b4df-9d0a-7093-97ec-2a671ac5ffe9`
- Integrated cover commit: `0534095a131dd5520badf7160ada405c0703fc9c`
- Production deployment ID: `dpl_6zZueF1qn1ahAHJHixHoSTmwMu6a`
- Immutable deployment: https://soon-core-90vqpdsrc-tsangtakyun-4639s-projects.vercel.app
- Production alias: https://soon-core.vercel.app
- Deployment state: `READY`

The Production snapshot was deliberately limited to the approved cover fix. The separate login-cookie candidate was not included.

Post-deployment evidence:

- Direct source audit: 51/51 returned usable `image/jpeg` responses.
- Production `/_next/image` audit: 51/51 returned `200 image/jpeg`; failures: 0.
- Authenticated desktop reload: the current 19 September cards and the previously failing 10 September EGG cards render real covers with no broken-image presentation.
- Full lazy-load scroll: 51/51 cards reached `complete=true` with positive `naturalWidth`; failed images: 0; visible fallbacks after all cards loaded: 0.
- Mobile viewport `390 x 844`: cover image loads successfully; viewport override was reset after the check.
- The permanent fallback is now hidden after image load and is used only while loading or on a genuine error.

## Screenshot privacy

The user screenshot was attached privately to the report through `/api/feedback/attachments/7a4ee448-3b45-48bd-86e3-7f91d379fd6d`. It was not committed, copied into the repository, or published as a public asset.

## Current state

Production promotion and verification are complete, deployment evidence has been written into the original report conversation, and the homepage waiting action has been marked complete. The report/task status fields remain stale because the current Feedback UI does not expose their final state transitions. Future genuinely missing source images remain an editorial-data case; this incident was an image-host allowlist/render-state defect and is operationally closed.
