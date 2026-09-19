import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const { hasRemoteMatch } = require('next/dist/shared/lib/match-remote-pattern')

function load(relativePath, overrides = {}) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  })
  const context = {
    exports: {},
    require: (name) => overrides[name] ?? require(name),
    process: { cwd: () => process.cwd() },
  }
  vm.runInNewContext(outputText, context)
  return context.exports
}

const config = load('../next.config.ts').default
const allowed = (url) => hasRemoteMatch([], config.images.remotePatterns, new URL(url))
const egg = 'https://auth.egg.sooncreator.network/storage/v1/object/public/egg-topic-media/check.jpg'
const core = 'https://fqnnjwxxwxggreoognkv.supabase.co/storage/v1/object/public/topic-covers/check.jpg'
assert.ok(allowed(egg), 'EGG covers must pass the actual Next.js remote matcher')
assert.ok(allowed(core), 'existing Core covers must remain allowed')
for (const url of [
  egg.replace('https:', 'http:'),
  egg.replace('auth.egg.', 'other.egg.'),
  egg.replace('auth.egg.', 'sub.auth.egg.'),
  egg.replace('.network/', '.network.attacker.invalid/'),
  egg.replace('.network/', '.network:8443/'),
  'https://127.0.0.1/check.jpg',
]) assert.equal(allowed(url), false, `must reject ${url}`)

function mount(src) {
  let state
  const { TopicCardCover } = load('../components/TopicCardCover.tsx', {
    'next/image': 'mock-image',
    react: {
      useState(initial) {
        state ??= initial
        return [state, (next) => { state = next }]
      },
    },
  })
  return () => Array.from(TopicCardCover({ src, alt: 'Cover description', children: 'fallback' }).props.children)
}

for (const src of [egg, core]) {
  const render = mount(src)
  let [fallback, image] = render()
  assert.equal(fallback, 'fallback')
  assert.equal(image.props.style.visibility, 'hidden')
  image.props.onLoad({ currentTarget: { naturalWidth: 640 } })
  ;[fallback, image] = render()
  assert.equal(fallback, null, 'loaded covers must remove fallback text')
  assert.equal(image.props.style.visibility, 'visible')
  assert.equal(image.props.src, src)
  image.props.onError()
  assert.deepEqual(render(), ['fallback', null], 'failed covers must remove the image')

  const failed = mount(src)
  failed()[1].props.onError()
  assert.deepEqual(failed(), ['fallback', null])

  const emptyImage = mount(src)
  emptyImage()[1].props.onLoad({ currentTarget: { naturalWidth: 0 } })
  assert.deepEqual(emptyImage(), ['fallback', null])

  const reloaded = mount(src)
  assert.equal(reloaded()[1].props.style.visibility, 'hidden')
  reloaded()[1].props.onLoad({ currentTarget: { naturalWidth: 640 } })
  assert.equal(reloaded()[0], null)
}
for (const src of [null, '']) {
  const [fallback, image] = mount(src)()
  assert.equal(fallback, 'fallback')
  assert.ok(!image, 'missing covers must not render an image')
}

const admin = readFileSync(new URL('../components/TopicLibraryAdmin.tsx', import.meta.url), 'utf8')
assert.match(admin, /<TopicCardCover\s+key=\{topic\.cover_url\}/,
  'changing a card source must remount its loading state')
console.log('topic cover regression checks: PASS')
