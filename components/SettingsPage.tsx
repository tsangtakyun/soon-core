'use client'

import { type ChangeEvent, type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react'

import { DashboardShell } from '@/components/DashboardShell'
import { buildInvoiceNumber, currencyOptions, normaliseCurrency, settingsRateGroups } from '@/lib/invoice'
import { buildQuoteNumber, defaultQuotationSettings, mergeQuotationSettings, type QuotationSettings } from '@/lib/quotation'
import { supabase } from '@/lib/supabase'

type SignatureMode = 'draw' | 'upload'
type PanelKey =
  | 'user'
  | 'company'
  | 'brand'
  | 'payment'
  | 'paymentTerms'
  | 'invoice'
  | 'rates'
  | 'signature'
  | 'api'
  | 'replyEmail'
  | 'replyMessage'
  | 'replyFans'
type ReplyInboxType = 'email' | 'message' | 'fans'
type ReplySettingDraft = {
  user_id: string
  inbox_type: ReplyInboxType
  assistant_name: string
  tone: 'professional' | 'friendly' | 'casual'
  reply_length: 'brief' | 'standard' | 'detailed'
  creator_context: string
  avoid_topics: string
}

const navGroups: Array<{
  icon: string
  title: string
  items: Array<{ key: PanelKey; label: string }>
}> = [
  {
    icon: '👤',
    title: '帳戶',
    items: [
      { key: 'user', label: '基本資料' },
      { key: 'company', label: '公司資料' },
      { key: 'brand', label: '品牌' },
    ],
  },
  {
    icon: '💳',
    title: '財務',
    items: [
      { key: 'payment', label: '付款資料' },
      { key: 'paymentTerms', label: '付款條款' },
      { key: 'invoice', label: '發票設定' },
      { key: 'rates', label: '預設費率' },
      { key: 'signature', label: '簽署設定' },
    ],
  },
  { icon: '🔗', title: '整合', items: [{ key: 'api', label: 'API 連接' }] },
  {
    icon: '💬',
    title: '回覆中心',
    items: [
      { key: 'replyEmail', label: 'Email 助理' },
      { key: 'replyMessage', label: 'Message 助理' },
      { key: 'replyFans', label: 'Fans 助理' },
    ],
  },
]

const panelMeta: Record<PanelKey, { title: string; subtitle: string }> = {
  user: { title: '基本資料', subtitle: '設定你喺 SOON CORE 入面顯示嘅名稱同頭像。' },
  company: { title: '公司資料', subtitle: '公司名稱、聯絡資料同文件用 Logo。' },
  brand: { title: '品牌', subtitle: '上傳文件標頭，供文件模板輸出使用。' },
  payment: { title: '付款資料', subtitle: '銀行、FPS、PayPal 同支票付款設定。' },
  paymentTerms: { title: '付款條款', subtitle: '設定付款期限同逾期利息。' },
  invoice: { title: '發票設定', subtitle: '管理發票 / 報價單號碼、貨幣同稅率。' },
  rates: { title: '預設費率', subtitle: '設定 Invoice 預設 service rate。' },
  signature: { title: '簽署設定', subtitle: '設定授權人姓名同簽名圖。' },
  api: { title: 'API 連接', subtitle: '管理 YouTube / Meta 等外部 API 設定。' },
  replyEmail: { title: 'Email 助理', subtitle: 'Email inbox 嘅回覆語氣同背景資料。' },
  replyMessage: { title: 'Message 助理', subtitle: 'Message inbox 嘅回覆語氣同背景資料。' },
  replyFans: { title: 'Fans 助理', subtitle: 'Fans inbox 嘅回覆語氣同背景資料。' },
}

const replyPanelMap: Partial<Record<PanelKey, ReplyInboxType>> = {
  replyEmail: 'email',
  replyMessage: 'message',
  replyFans: 'fans',
}

const createReplySetting = (inboxType: ReplyInboxType): ReplySettingDraft => ({
  user_id: 'tommy',
  inbox_type: inboxType,
  assistant_name: 'Mayan',
  tone: 'friendly',
  reply_length: 'standard',
  creator_context: '',
  avoid_topics: '',
})

export function SettingsPage() {
  const [settings, setSettings] = useState<QuotationSettings>(defaultQuotationSettings)
  const [activePanel, setActivePanel] = useState<PanelKey>('user')
  const [saved, setSaved] = useState(false)
  const [signatureSaved, setSignatureSaved] = useState(false)
  const [signatureMode, setSignatureMode] = useState<SignatureMode>('draw')
  const [isDrawing, setIsDrawing] = useState(false)
  const [replySettings, setReplySettings] = useState<Record<ReplyInboxType, ReplySettingDraft>>({
    email: createReplySetting('email'),
    message: createReplySetting('message'),
    fans: createReplySetting('fans'),
  })
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    const [{ data }, { data: replyData }] = await Promise.all([
      supabase.from('settings').select('*').eq('user_id', 'tommy').maybeSingle(),
      supabase.from('reply_settings').select('*').eq('user_id', 'tommy'),
    ])
    if (data) setSettings(mergeQuotationSettings(data))

    const nextReplySettings = {
      email: createReplySetting('email'),
      message: createReplySetting('message'),
      fans: createReplySetting('fans'),
    }
    ;((replyData ?? []) as ReplySettingDraft[]).forEach((item) => {
      nextReplySettings[item.inbox_type] = { ...createReplySetting(item.inbox_type), ...item }
    })
    setReplySettings(nextReplySettings)
  }

  function update<K extends keyof QuotationSettings>(key: K, value: QuotationSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  function updateRate(key: string, value: string) {
    setSettings((current) => ({
      ...current,
      default_rates: { ...current.default_rates, [key]: Number(value || 0) },
    }))
    setSaved(false)
  }

  function updateReplySetting<K extends keyof ReplySettingDraft>(inboxType: ReplyInboxType, key: K, value: ReplySettingDraft[K]) {
    setReplySettings((current) => ({
      ...current,
      [inboxType]: { ...current[inboxType], [key]: value },
    }))
    setSaved(false)
  }

  function readImage(event: ChangeEvent<HTMLInputElement>, onLoad: (value: string) => void) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onLoad(String(reader.result ?? ''))
    reader.readAsDataURL(file)
  }

  function uploadSignature(event: ChangeEvent<HTMLInputElement>) {
    readImage(event, (value) => {
      const image = new Image()
      image.onload = () => update('signature_base64', autoCropSignature(image))
      image.src = value
    })
  }

  function pointerPosition(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function startSignatureDraw(event: PointerEvent<HTMLCanvasElement>) {
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    const position = pointerPosition(event)
    context.strokeStyle = '#000000'
    context.lineWidth = 2
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.beginPath()
    context.moveTo(position.x, position.y)
    setIsDrawing(true)
  }

  function drawSignature(event: PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    const position = pointerPosition(event)
    context.lineTo(position.x, position.y)
    context.stroke()
  }

  function finishSignatureDraw() {
    if (!isDrawing) return
    setIsDrawing(false)
    const dataUrl = canvasRef.current ? autoCropSignature(canvasRef.current) : ''
    if (dataUrl) update('signature_base64', dataUrl)
  }

  function clearSignature() {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    update('signature_base64', '')
  }

  async function saveSettingsOnly() {
    const { error } = await supabase.from('settings').upsert(
      { user_id: 'tommy', ...settings, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    if (error) {
      window.alert(error.message)
      return false
    }
    window.dispatchEvent(new Event('soon-data-updated'))
    return true
  }

  async function saveReplyOnly(inboxType: ReplyInboxType) {
    const { error } = await supabase.from('reply_settings').upsert(replySettings[inboxType], { onConflict: 'user_id,inbox_type' })
    if (error) {
      window.alert(error.message)
      return false
    }
    return true
  }

  async function saveCurrentPanel() {
    const inboxType = replyPanelMap[activePanel]
    const ok = inboxType ? await saveReplyOnly(inboxType) : await saveSettingsOnly()
    if (!ok) return
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2200)
  }

  async function saveSignature() {
    const ok = await saveSettingsOnly()
    if (!ok) return
    setSignatureSaved(true)
    window.setTimeout(() => setSignatureSaved(false), 2000)
  }

  const meta = panelMeta[activePanel]

  return (
    <DashboardShell activeSection="settings">
      <section className="settings-board">
        <aside className="settings-local-sidebar">
          <div className="settings-local-title">設定</div>
          {navGroups.map((group) => (
            <nav key={group.title} className="settings-local-group" aria-label={group.title}>
              <div className="settings-local-group-title">
                <span>{group.icon}</span>
                <span>{group.title}</span>
              </div>
              {group.items.map((item) => (
                <button
                  key={item.key}
                  className={activePanel === item.key ? 'active' : ''}
                  type="button"
                  onClick={() => setActivePanel(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          ))}
        </aside>

        <main className="settings-detail">
          <select className="settings-mobile-select" value={activePanel} onChange={(event) => setActivePanel(event.target.value as PanelKey)}>
            {navGroups.flatMap((group) => group.items).map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>

          <header className="settings-detail-head">
            <div>
              <h1>{meta.title}</h1>
              <p>{meta.subtitle}</p>
            </div>
          </header>

          <div className="settings-detail-divider" />
          <div className="settings-detail-form">{renderPanel()}</div>

          <div className="settings-section-save">
            {saved && <span>已儲存</span>}
            <button className="primary-button" type="button" onClick={() => void saveCurrentPanel()}>
              儲存
            </button>
          </div>
        </main>
      </section>
    </DashboardShell>
  )

  function renderPanel() {
    const replyInbox = replyPanelMap[activePanel]
    if (replyInbox) return <ReplyPanel inboxType={replyInbox} item={replySettings[replyInbox]} onChange={updateReplySetting} />

    switch (activePanel) {
      case 'user':
        return (
          <>
            <label>
              Display name
              <input value={settings.display_name} onChange={(event) => update('display_name', event.target.value)} />
            </label>
            <label>
              頭像 / Logo upload
              <div className="settings-logo-row">
                {settings.logo_base64 ? <img src={settings.logo_base64} alt="" /> : <span className="settings-logo-placeholder">Logo</span>}
                <input type="file" accept="image/*" onChange={(event) => readImage(event, (value) => update('logo_base64', value))} />
              </div>
            </label>
          </>
        )
      case 'company':
        return (
          <>
            <label>
              公司名稱
              <input value={settings.company_name} onChange={(event) => update('company_name', event.target.value)} />
            </label>
            <label>
              Email
              <input value={settings.email} onChange={(event) => update('email', event.target.value)} />
            </label>
            <label>
              電話
              <input value={settings.phone} onChange={(event) => update('phone', event.target.value)} />
            </label>
            <label>
              地址
              <textarea value={settings.address} onChange={(event) => update('address', event.target.value)} rows={3} />
            </label>
            <label>
              公司 Logo upload
              <div className="settings-logo-row">
                {settings.logo_base64 ? <img src={settings.logo_base64} alt="" /> : <span className="settings-logo-placeholder">Logo</span>}
                <input type="file" accept="image/*" onChange={(event) => readImage(event, (value) => update('logo_base64', value))} />
              </div>
            </label>
          </>
        )
      case 'brand':
        return (
          <label>
            文件標頭
            <span className="settings-field-help">建議解析度：580x80px，PNG 透明背景</span>
            <div className="document-header-upload">
              {settings.document_header_base64 ? (
                <img src={settings.document_header_base64} alt="Document header preview" />
              ) : (
                <span>點擊上傳文件標頭</span>
              )}
              <input type="file" accept="image/*" onChange={(event) => readImage(event, (value) => update('document_header_base64', value))} />
            </div>
          </label>
        )
      case 'payment':
        return (
          <>
            <label>
              銀行名稱
              <input value={settings.bank_name} onChange={(event) => update('bank_name', event.target.value)} />
            </label>
            <label>
              戶口名稱
              <input value={settings.account_name} onChange={(event) => update('account_name', event.target.value)} />
            </label>
            <label>
              戶口號碼
              <input value={settings.account_number} onChange={(event) => update('account_number', event.target.value)} />
            </label>
            <label>
              FPS / PayMe ID
              <input value={settings.fps_id} onChange={(event) => update('fps_id', event.target.value)} />
            </label>
            <label>
              PayPal Email
              <input value={settings.paypal_email} onChange={(event) => update('paypal_email', event.target.value)} />
            </label>
            {[
              ['bank_transfer_enabled', 'Bank Transfer'],
              ['cheque_enabled', 'Cheque'],
              ['fps_enabled', 'FPS / PayMe'],
              ['paypal_enabled', 'PayPal'],
            ].map(([key, label]) => (
              <label className="payment-method-item" key={key}>
                <input
                  type="checkbox"
                  checked={Boolean(settings[key as keyof QuotationSettings])}
                  onChange={(event) => update(key as keyof QuotationSettings, event.target.checked as never)}
                />
                <span>{label}</span>
              </label>
            ))}
            <label>
              支票抬頭
              <input value={settings.cheque_payable_to} onChange={(event) => update('cheque_payable_to', event.target.value)} />
            </label>
            <label>
              郵寄地址
              <textarea value={settings.cheque_address} onChange={(event) => update('cheque_address', event.target.value)} rows={3} />
            </label>
          </>
        )
      case 'paymentTerms':
        return (
          <>
            <label>
              付款期限
              <input type="number" min="0" value={settings.payment_days} onChange={(event) => update('payment_days', Number(event.target.value || 0))} />
            </label>
            <label>
              逾期利息
              <input type="number" min="0" value={settings.interest_rate} onChange={(event) => update('interest_rate', Number(event.target.value || 0))} />
            </label>
          </>
        )
      case 'invoice':
        return (
          <>
            <label>
              發票號碼前綴
              <input value={settings.invoice_prefix} onChange={(event) => update('invoice_prefix', event.target.value)} />
            </label>
            <div className="settings-readonly-row">
              <span>發票號碼格式</span>
              <strong>預覽：{buildInvoiceNumber(settings.invoice_prefix, new Date().getFullYear(), settings.invoice_start_number)}</strong>
            </div>
            <label>
              起始號碼
              <input type="number" min="1" value={settings.invoice_start_number} onChange={(event) => update('invoice_start_number', Number(event.target.value || 1))} />
            </label>
            <div className="settings-readonly-row">
              <span>目前號碼</span>
              <strong>{settings.invoice_current_number}</strong>
            </div>
            <label>
              報價單號碼前綴
              <input value={settings.quote_prefix} onChange={(event) => update('quote_prefix', event.target.value)} />
            </label>
            <div className="settings-readonly-row">
              <span>報價單號碼格式</span>
              <strong>預覽：{buildQuoteNumber(settings, 1)}</strong>
            </div>
            <label>
              預設貨幣
              <select value={settings.default_currency} onChange={(event) => update('default_currency', normaliseCurrency(event.target.value))}>
                {currencyOptions.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tax rate %
              <input type="number" min="0" value={settings.tax_rate} onChange={(event) => update('tax_rate', Number(event.target.value || 0))} />
            </label>
          </>
        )
      case 'rates':
        return (
          <div className="settings-rate-groups">
            {settingsRateGroups.map((group) => (
              <div key={group.phase} className="settings-rate-group">
                <h3>{group.phase}</h3>
                {group.items.map((item) => (
                  <label key={item}>
                    {item}
                    <input type="number" min="0" value={settings.default_rates[item] ?? 0} onChange={(event) => updateRate(item, event.target.value)} />
                  </label>
                ))}
              </div>
            ))}
          </div>
        )
      case 'signature':
        return (
          <>
            <label>
              授權人姓名
              <input value={settings.authorized_name} onChange={(event) => update('authorized_name', event.target.value)} />
            </label>
            <div className="signature-mode-toggle">
              <button className={signatureMode === 'draw' ? 'active' : ''} type="button" onClick={() => setSignatureMode('draw')}>手寫</button>
              <button className={signatureMode === 'upload' ? 'active' : ''} type="button" onClick={() => setSignatureMode('upload')}>上傳圖片</button>
            </div>
            {signatureMode === 'draw' ? (
              <div className="signature-canvas-wrap">
                <canvas ref={canvasRef} width={400} height={120} onPointerDown={startSignatureDraw} onPointerMove={drawSignature} onPointerUp={finishSignatureDraw} onPointerLeave={finishSignatureDraw} />
                <button className="ghost-button inline-ghost-button" type="button" onClick={clearSignature}>清除</button>
              </div>
            ) : (
              <label>
                上傳簽名圖片
                <div className="signature-upload-row">
                  {settings.signature_base64 && <img src={settings.signature_base64} alt="" />}
                  <input type="file" accept="image/*" onChange={uploadSignature} />
                </div>
              </label>
            )}
            <div className="signature-save-row">
              <button className="signature-save-button" type="button" onClick={() => void saveSignature()}>儲存簽名</button>
              {signatureSaved && <span>已儲存</span>}
            </div>
          </>
        )
      case 'api':
        return (
          <>
            <div className="api-status-row">
              <span className={settings.youtube_client_id && settings.youtube_client_secret ? 'api-status connected' : 'api-status'}>
                YouTube {settings.youtube_client_id && settings.youtube_client_secret ? '✓ 已連接' : '未連接'}
              </span>
              <span className={settings.meta_app_id || settings.meta_app_secret ? 'api-status connected' : 'api-status'}>
                Meta {settings.meta_app_id || settings.meta_app_secret ? '✓ 已連接' : '未連接'}
              </span>
            </div>
            <label>
              YouTube Data API Key / Client ID
              <input value={settings.youtube_client_id} onChange={(event) => update('youtube_client_id', event.target.value)} />
            </label>
            <label>
              YouTube Client Secret
              <input type="password" value={settings.youtube_client_secret} onChange={(event) => update('youtube_client_secret', event.target.value)} />
            </label>
            <label>
              Meta Access Token / App ID
              <input value={settings.meta_app_id} onChange={(event) => update('meta_app_id', event.target.value)} />
            </label>
            <label>
              Meta App Secret
              <input type="password" value={settings.meta_app_secret} onChange={(event) => update('meta_app_secret', event.target.value)} />
            </label>
          </>
        )
    }
  }
}

function ReplyPanel({
  inboxType,
  item,
  onChange,
}: {
  inboxType: ReplyInboxType
  item: ReplySettingDraft
  onChange: <K extends keyof ReplySettingDraft>(inboxType: ReplyInboxType, key: K, value: ReplySettingDraft[K]) => void
}) {
  return (
    <>
      <label>
        助理名稱
        <input value={item.assistant_name} onChange={(event) => onChange(inboxType, 'assistant_name', event.target.value)} />
      </label>
      <div className="settings-mini-toggle">
        {[
          { value: 'professional', label: '專業' },
          { value: 'friendly', label: '親切' },
          { value: 'casual', label: '活潑' },
        ].map((option) => (
          <button key={option.value} className={item.tone === option.value ? 'active' : ''} type="button" onClick={() => onChange(inboxType, 'tone', option.value as ReplySettingDraft['tone'])}>
            {option.label}
          </button>
        ))}
      </div>
      <div className="settings-mini-toggle">
        {[
          { value: 'brief', label: '簡短' },
          { value: 'standard', label: '標準' },
          { value: 'detailed', label: '詳細' },
        ].map((option) => (
          <button key={option.value} className={item.reply_length === option.value ? 'active' : ''} type="button" onClick={() => onChange(inboxType, 'reply_length', option.value as ReplySettingDraft['reply_length'])}>
            {option.label}
          </button>
        ))}
      </div>
      <label>
        Creator 背景資料
        <textarea value={item.creator_context} placeholder="介紹你係邊個、做咩類型內容、目標觀眾..." rows={5} onChange={(event) => onChange(inboxType, 'creator_context', event.target.value)} />
      </label>
      <label>
        唔回覆話題
        <textarea value={item.avoid_topics} placeholder="例如：唔報價、唔透露個人資料..." rows={4} onChange={(event) => onChange(inboxType, 'avoid_topics', event.target.value)} />
      </label>
    </>
  )
}

function autoCropSignature(source: HTMLImageElement | HTMLCanvasElement) {
  const sourceWidth = source instanceof HTMLImageElement ? source.naturalWidth : source.width
  const sourceHeight = source instanceof HTMLImageElement ? source.naturalHeight : source.height
  const canvas = document.createElement('canvas')
  canvas.width = Number(sourceWidth)
  canvas.height = Number(sourceHeight)
  const context = canvas.getContext('2d')
  if (!context || canvas.width === 0 || canvas.height === 0) return ''

  context.drawImage(source, 0, 0)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  const data = pixels.data
  let minX = canvas.width
  let minY = canvas.height
  let maxX = 0
  let maxY = 0

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const alpha = data[(y * canvas.width + x) * 4 + 3]
      if (alpha > 10) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }

  if (minX > maxX || minY > maxY) return canvas.toDataURL('image/png')

  const padding = 8
  minX = Math.max(0, minX - padding)
  minY = Math.max(0, minY - padding)
  maxX = Math.min(canvas.width, maxX + padding)
  maxY = Math.min(canvas.height, maxY + padding)

  const cropW = Math.max(1, maxX - minX)
  const cropH = Math.max(1, maxY - minY)
  const cropCanvas = document.createElement('canvas')
  cropCanvas.width = cropW
  cropCanvas.height = cropH
  const cropContext = cropCanvas.getContext('2d')
  if (!cropContext) return canvas.toDataURL('image/png')
  cropContext.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH)
  return cropCanvas.toDataURL('image/png')
}
