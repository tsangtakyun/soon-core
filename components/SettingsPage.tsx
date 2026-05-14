'use client'

import { type ChangeEvent, type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react'

import { DashboardShell } from '@/components/DashboardShell'
import { buildInvoiceNumber, currencyOptions, normaliseCurrency, settingsRateGroups } from '@/lib/invoice'
import { buildQuoteNumber, defaultQuotationSettings, mergeQuotationSettings, type QuotationSettings } from '@/lib/quotation'
import { supabase } from '@/lib/supabase'

type SignatureMode = 'draw' | 'upload'
type SectionKey =
  | 'user'
  | 'company'
  | 'payment'
  | 'paymentTerms'
  | 'invoice'
  | 'rates'
  | 'signature'
  | 'api'
  | 'reply'
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

const defaultCollapsed: Record<SectionKey, boolean> = {
  user: false,
  company: true,
  payment: false,
  paymentTerms: true,
  invoice: true,
  rates: true,
  signature: true,
  api: false,
  reply: false,
}

const replyInboxOptions: Array<{ value: ReplyInboxType; label: string }> = [
  { value: 'email', label: 'Email' },
  { value: 'message', label: 'Message' },
  { value: 'fans', label: 'Fans' },
]

const createReplySetting = (inboxType: ReplyInboxType): ReplySettingDraft => ({
  user_id: 'tommy',
  inbox_type: inboxType,
  assistant_name: 'Mayan',
  tone: 'friendly',
  reply_length: 'standard',
  creator_context: '',
  avoid_topics: '',
})

const collapsedKey = (key: SectionKey) => `soon-settings-${key}-collapsed`

export function SettingsPage() {
  const [settings, setSettings] = useState<QuotationSettings>(defaultQuotationSettings)
  const [saved, setSaved] = useState(false)
  const [signatureSaved, setSignatureSaved] = useState(false)
  const [signatureMode, setSignatureMode] = useState<SignatureMode>('draw')
  const [isDrawing, setIsDrawing] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>(defaultCollapsed)
  const [replySettings, setReplySettings] = useState<Record<ReplyInboxType, ReplySettingDraft>>({
    email: createReplySetting('email'),
    message: createReplySetting('message'),
    fans: createReplySetting('fans'),
  })
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    void load()
    setCollapsed(
      Object.fromEntries(
        (Object.keys(defaultCollapsed) as SectionKey[]).map((key) => {
          const stored = window.localStorage.getItem(collapsedKey(key))
          return [key, stored === null ? defaultCollapsed[key] : stored === 'true']
        })
      ) as Record<SectionKey, boolean>
    )
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

  function toggleSection(key: SectionKey) {
    setCollapsed((current) => {
      const next = { ...current, [key]: !current[key] }
      window.localStorage.setItem(collapsedKey(key), String(next[key]))
      return next
    })
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

  function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => update('logo_base64', String(reader.result ?? ''))
    reader.readAsDataURL(file)
  }

  function uploadSignature(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => update('signature_base64', autoCropSignature(image))
      image.src = String(reader.result ?? '')
    }
    reader.readAsDataURL(file)
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

  async function save() {
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

  async function saveReplySettings() {
    const payload = replyInboxOptions.map((inbox) => replySettings[inbox.value])
    const { error } = await supabase.from('reply_settings').upsert(payload, { onConflict: 'user_id,inbox_type' })
    if (error) {
      window.alert(error.message)
      return false
    }
    return true
  }

  async function saveAll() {
    const settingsSaved = await save()
    if (!settingsSaved) return
    const replySaved = await saveReplySettings()
    if (!replySaved) return
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2500)
  }

  async function saveSignature() {
    const { error } = await supabase.from('settings').upsert(
      {
        user_id: 'tommy',
        signature_base64: settings.signature_base64,
        authorized_name: settings.authorized_name,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (error) {
      window.alert(error.message)
      return
    }
    setSignatureSaved(true)
    window.dispatchEvent(new Event('soon-data-updated'))
    window.setTimeout(() => setSignatureSaved(false), 2000)
  }

  return (
    <DashboardShell activeSection="settings">
      <section className="settings-page settings-page-v2">
        <header className="settings-page-head">
          <div>
            <h1>設定</h1>
            <p>管理帳戶、財務、整合同回覆設定</p>
          </div>
          <div className="settings-fixed-save">
            {saved && <span>已儲存</span>}
            <button className="primary-button" type="button" onClick={() => void saveAll()}>
              儲存設定
            </button>
          </div>
        </header>

        <SettingsGroup icon="👤" title="帳戶" subtitle="用戶資料同公司設定">
          <SettingsSubsection title="用戶資料" collapsed={collapsed.user} onToggle={() => toggleSection('user')}>
            <label>
              Display name
              <input value={settings.display_name} onChange={(event) => update('display_name', event.target.value)} />
            </label>
            <label>
              頭像 / Logo upload
              <div className="settings-logo-row">
                {settings.logo_base64 ? <img src={settings.logo_base64} alt="" /> : <span className="settings-logo-placeholder">Logo</span>}
                <input type="file" accept="image/*" onChange={uploadLogo} />
              </div>
            </label>
          </SettingsSubsection>

          <SettingsSubsection title="公司資料" collapsed={collapsed.company} onToggle={() => toggleSection('company')}>
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
                <input type="file" accept="image/*" onChange={uploadLogo} />
              </div>
            </label>
          </SettingsSubsection>
        </SettingsGroup>

        <SettingsGroup icon="💳" title="財務" subtitle="財務相關設定">
          <SettingsSubsection title="付款資料" collapsed={collapsed.payment} onToggle={() => toggleSection('payment')}>
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
            <label className="payment-method-item">
              <input type="checkbox" checked={settings.bank_transfer_enabled} onChange={(event) => update('bank_transfer_enabled', event.target.checked)} />
              <span>Bank Transfer</span>
            </label>
            <label className="payment-method-item">
              <input type="checkbox" checked={settings.cheque_enabled} onChange={(event) => update('cheque_enabled', event.target.checked)} />
              <span>Cheque</span>
            </label>
            <label className="payment-method-item">
              <input type="checkbox" checked={settings.fps_enabled} onChange={(event) => update('fps_enabled', event.target.checked)} />
              <span>FPS / PayMe</span>
            </label>
            <label className="payment-method-item">
              <input type="checkbox" checked={settings.paypal_enabled} onChange={(event) => update('paypal_enabled', event.target.checked)} />
              <span>PayPal</span>
            </label>
            <label>
              支票抬頭
              <input value={settings.cheque_payable_to} onChange={(event) => update('cheque_payable_to', event.target.value)} />
            </label>
            <label>
              郵寄地址
              <textarea value={settings.cheque_address} onChange={(event) => update('cheque_address', event.target.value)} rows={3} />
            </label>
          </SettingsSubsection>

          <SettingsSubsection title="付款條款設定" collapsed={collapsed.paymentTerms} onToggle={() => toggleSection('paymentTerms')}>
            <label>
              付款期限
              <input type="number" min="0" value={settings.payment_days} onChange={(event) => update('payment_days', Number(event.target.value || 0))} />
            </label>
            <label>
              逾期利息
              <input type="number" min="0" value={settings.interest_rate} onChange={(event) => update('interest_rate', Number(event.target.value || 0))} />
            </label>
          </SettingsSubsection>

          <SettingsSubsection title="發票設定" collapsed={collapsed.invoice} onToggle={() => toggleSection('invoice')}>
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
            <div className="settings-readonly-row">
              <span>報價單目前號碼</span>
              <strong>{settings.quote_current_number}</strong>
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
          </SettingsSubsection>

          <SettingsSubsection title="Invoice 預設費率" collapsed={collapsed.rates} onToggle={() => toggleSection('rates')}>
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
          </SettingsSubsection>

          <SettingsSubsection title="簽署設定" collapsed={collapsed.signature} onToggle={() => toggleSection('signature')}>
            <label>
              授權人姓名
              <input value={settings.authorized_name} onChange={(event) => update('authorized_name', event.target.value)} />
            </label>
            <div className="signature-mode-toggle">
              <button className={signatureMode === 'draw' ? 'active' : ''} type="button" onClick={() => setSignatureMode('draw')}>
                手寫
              </button>
              <button className={signatureMode === 'upload' ? 'active' : ''} type="button" onClick={() => setSignatureMode('upload')}>
                上傳圖片
              </button>
            </div>
            {signatureMode === 'draw' ? (
              <div className="signature-canvas-wrap">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={120}
                  onPointerDown={startSignatureDraw}
                  onPointerMove={drawSignature}
                  onPointerUp={finishSignatureDraw}
                  onPointerLeave={finishSignatureDraw}
                />
                <button className="ghost-button inline-ghost-button" type="button" onClick={clearSignature}>
                  清除
                </button>
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
              <button className="signature-save-button" type="button" onClick={() => void saveSignature()}>
                儲存簽名
              </button>
              {signatureSaved && <span>已儲存</span>}
            </div>
          </SettingsSubsection>
        </SettingsGroup>

        <SettingsGroup icon="🔗" title="整合" subtitle="API 連接設定">
          <SettingsSubsection title="API 連接設定" collapsed={collapsed.api} onToggle={() => toggleSection('api')}>
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
          </SettingsSubsection>
        </SettingsGroup>

        <SettingsGroup icon="💬" title="回覆中心" subtitle="虛擬助理設定">
          <SettingsSubsection title="回覆設定" collapsed={collapsed.reply} onToggle={() => toggleSection('reply')}>
            <div className="reply-settings-grid">
              {replyInboxOptions.map((inbox) => {
                const item = replySettings[inbox.value]
                return (
                  <section className="reply-settings-card" key={inbox.value}>
                    <h3>{inbox.label}</h3>
                    <label>
                      助理名稱
                      <input value={item.assistant_name} onChange={(event) => updateReplySetting(inbox.value, 'assistant_name', event.target.value)} />
                    </label>
                    <div className="settings-mini-toggle">
                      {[
                        { value: 'professional', label: '專業' },
                        { value: 'friendly', label: '親切' },
                        { value: 'casual', label: '活潑' },
                      ].map((option) => (
                        <button key={option.value} className={item.tone === option.value ? 'active' : ''} type="button" onClick={() => updateReplySetting(inbox.value, 'tone', option.value as ReplySettingDraft['tone'])}>
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
                        <button key={option.value} className={item.reply_length === option.value ? 'active' : ''} type="button" onClick={() => updateReplySetting(inbox.value, 'reply_length', option.value as ReplySettingDraft['reply_length'])}>
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <label>
                      Creator 背景資料
                      <textarea value={item.creator_context} placeholder="介紹你係邊個、做咩類型內容、目標觀眾..." rows={4} onChange={(event) => updateReplySetting(inbox.value, 'creator_context', event.target.value)} />
                    </label>
                    <label>
                      唔回覆話題
                      <textarea value={item.avoid_topics} placeholder="例如：唔報價、唔透露個人資料..." rows={3} onChange={(event) => updateReplySetting(inbox.value, 'avoid_topics', event.target.value)} />
                    </label>
                  </section>
                )
              })}
            </div>
          </SettingsSubsection>
        </SettingsGroup>
      </section>
    </DashboardShell>
  )
}

function SettingsGroup({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: string
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <section className="settings-group-card">
      <header className="settings-group-head">
        <span>{icon}</span>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </header>
      <div className="settings-group-body">{children}</div>
    </section>
  )
}

function SettingsSubsection({
  title,
  collapsed,
  onToggle,
  children,
}: {
  title: string
  collapsed: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className={`settings-subsection ${collapsed ? 'collapsed' : 'expanded'}`}>
      <button className="settings-subsection-header" type="button" onClick={onToggle} aria-expanded={!collapsed}>
        <span>{title}</span>
        <strong>{collapsed ? '▶' : '▼'}</strong>
      </button>
      <div className="settings-subsection-body">{children}</div>
    </section>
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
