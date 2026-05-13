'use client'

import { type ChangeEvent, type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react'

import { DashboardShell } from '@/components/DashboardShell'
import { buildInvoiceNumber, currencyOptions, normaliseCurrency, settingsRateGroups } from '@/lib/invoice'
import { buildQuoteNumber, defaultQuotationSettings, mergeQuotationSettings, type QuotationSettings } from '@/lib/quotation'
import { supabase } from '@/lib/supabase'

type SignatureMode = 'draw' | 'upload'
type SectionKey = 'user' | 'company' | 'payment' | 'api' | 'paymentTerms' | 'signature' | 'invoice' | 'rates' | 'tax'

const collapsedStorageKey = 'soon-settings-collapsed'

const defaultCollapsed: Record<SectionKey, boolean> = {
  user: false,
  company: false,
  payment: true,
  api: true,
  paymentTerms: true,
  signature: false,
  invoice: true,
  rates: true,
  tax: true,
}

export function SettingsPage() {
  const [settings, setSettings] = useState<QuotationSettings>(defaultQuotationSettings)
  const [saved, setSaved] = useState(false)
  const [signatureSaved, setSignatureSaved] = useState(false)
  const [signatureMode, setSignatureMode] = useState<SignatureMode>('draw')
  const [isDrawing, setIsDrawing] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>(defaultCollapsed)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    void load()
    const stored = window.localStorage.getItem(collapsedStorageKey)
    if (!stored) return
    try {
      setCollapsed({ ...defaultCollapsed, ...(JSON.parse(stored) as Partial<Record<SectionKey, boolean>>) })
    } catch {
      setCollapsed(defaultCollapsed)
    }
  }, [])

  async function load() {
    const { data } = await supabase.from('settings').select('*').eq('user_id', 'tommy').maybeSingle()
    if (data) setSettings(mergeQuotationSettings(data))
  }

  function toggleSection(key: SectionKey) {
    setCollapsed((current) => {
      const next = { ...current, [key]: !current[key] }
      window.localStorage.setItem(collapsedStorageKey, JSON.stringify(next))
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
      return
    }
    setSaved(true)
    window.dispatchEvent(new Event('soon-data-updated'))
  }

  async function saveSignature() {
    const { error } = await supabase.from('settings').upsert(
      {
        user_id: 'tommy',
        signature_base64: settings.signature_base64,
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
      <section className="settings-page">
        <header className="docs-header settings-header">
          <div>
            <h1>設定</h1>
            <p>管理用戶資料、公司資料、付款資料、文件編號、費率同簽署設定</p>
          </div>
          <div className="settings-save-row">
            {saved && <span>已儲存</span>}
            <button className="primary-button" type="button" onClick={() => void save()}>
              儲存設定
            </button>
          </div>
        </header>

        <SettingsCard title="用戶資料" collapsed={collapsed.user} onToggle={() => toggleSection('user')}>
          <label>
            Display name
            <input value={settings.display_name} onChange={(event) => update('display_name', event.target.value)} />
          </label>
        </SettingsCard>

        <SettingsCard title="公司資料" collapsed={collapsed.company} onToggle={() => toggleSection('company')}>
          <label>
            公司名稱
            <input value={settings.company_name} onChange={(event) => update('company_name', event.target.value)} />
          </label>
          <label>
            Logo upload
            <div className="settings-logo-row">
              {settings.logo_base64 ? <img src={settings.logo_base64} alt="" /> : <span className="settings-logo-placeholder">Logo</span>}
              <input type="file" accept="image/*" onChange={uploadLogo} />
            </div>
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
        </SettingsCard>

        <SettingsCard title="付款資料" collapsed={collapsed.payment} onToggle={() => toggleSection('payment')}>
          <label>
            銀行名稱
            <input value={settings.bank_name} onChange={(event) => update('bank_name', event.target.value)} />
          </label>
          <label>
            Account Name
            <input value={settings.account_name} onChange={(event) => update('account_name', event.target.value)} />
          </label>
          <label>
            Account Number
            <input value={settings.account_number} onChange={(event) => update('account_number', event.target.value)} />
          </label>
          <label>
            預設貨幣
            <select value={settings.default_currency} onChange={(event) => update('default_currency', normaliseCurrency(event.target.value))}>
              {currencyOptions.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </label>
        </SettingsCard>

        <SettingsCard title="API 連接設定" collapsed={collapsed.api} onToggle={() => toggleSection('api')}>
          <div className="api-status-row">
            <span className={settings.youtube_client_id && settings.youtube_client_secret ? 'api-status connected' : 'api-status'}>
              YouTube {settings.youtube_client_id && settings.youtube_client_secret ? '✓ 已連接' : '未連接'}
            </span>
            <span className={settings.meta_app_id && settings.meta_app_secret ? 'api-status connected' : 'api-status'}>
              Meta {settings.meta_app_id && settings.meta_app_secret ? '✓ 已連接' : '未連接'}
            </span>
          </div>
          <label>
            YouTube Data API Client ID
            <input value={settings.youtube_client_id} onChange={(event) => update('youtube_client_id', event.target.value)} />
          </label>
          <label>
            YouTube Data API Client Secret
            <input type="password" value={settings.youtube_client_secret} onChange={(event) => update('youtube_client_secret', event.target.value)} />
          </label>
          <label>
            Meta Business API App ID
            <input value={settings.meta_app_id} onChange={(event) => update('meta_app_id', event.target.value)} />
          </label>
          <label>
            Meta Business API App Secret
            <input type="password" value={settings.meta_app_secret} onChange={(event) => update('meta_app_secret', event.target.value)} />
          </label>
          <button className="primary-button" type="button" onClick={() => void save()}>Save API Settings</button>
        </SettingsCard>

        <SettingsCard title="發票設定" collapsed={collapsed.invoice} onToggle={() => toggleSection('invoice')}>
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
        </SettingsCard>

        <SettingsCard title="付款條款設定" collapsed={collapsed.paymentTerms} onToggle={() => toggleSection('paymentTerms')}>
          <label className="settings-toggle-row">
            <input type="checkbox" checked={settings.bank_transfer_enabled} onChange={(event) => update('bank_transfer_enabled', event.target.checked)} />
            Bank Transfer
          </label>
          <label className="settings-toggle-row">
            <input type="checkbox" checked={settings.cheque_enabled} onChange={(event) => update('cheque_enabled', event.target.checked)} />
            Cheque
          </label>
          <label>
            支票抬頭
            <input value={settings.cheque_payable_to} onChange={(event) => update('cheque_payable_to', event.target.value)} />
          </label>
          <label>
            郵寄地址
            <textarea value={settings.cheque_address} onChange={(event) => update('cheque_address', event.target.value)} rows={3} />
          </label>
          <label className="settings-toggle-row">
            <input type="checkbox" checked={settings.fps_enabled} onChange={(event) => update('fps_enabled', event.target.checked)} />
            FPS / PayMe
          </label>
          <label>
            FPS ID / 電話號碼
            <input value={settings.fps_id} onChange={(event) => update('fps_id', event.target.value)} />
          </label>
          <label className="settings-toggle-row">
            <input type="checkbox" checked={settings.paypal_enabled} onChange={(event) => update('paypal_enabled', event.target.checked)} />
            PayPal
          </label>
          <label>
            PayPal Email
            <input value={settings.paypal_email} onChange={(event) => update('paypal_email', event.target.value)} />
          </label>
          <label>
            付款期限
            <input type="number" min="0" value={settings.payment_days} onChange={(event) => update('payment_days', Number(event.target.value || 0))} />
          </label>
          <label>
            逾期利息
            <input type="number" min="0" value={settings.interest_rate} onChange={(event) => update('interest_rate', Number(event.target.value || 0))} />
          </label>
        </SettingsCard>

        <SettingsCard title="簽署設定" collapsed={collapsed.signature} onToggle={() => toggleSection('signature')}>
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
              <canvas
                ref={canvasRef}
                width={400}
                height={120}
                onPointerDown={startSignatureDraw}
                onPointerMove={drawSignature}
                onPointerUp={finishSignatureDraw}
                onPointerLeave={finishSignatureDraw}
              />
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
        </SettingsCard>

        <SettingsCard title="Invoice 預設費率" collapsed={collapsed.rates} onToggle={() => toggleSection('rates')}>
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
        </SettingsCard>

        <SettingsCard title="稅率" collapsed={collapsed.tax} onToggle={() => toggleSection('tax')}>
          <label>
            Tax rate %
            <input type="number" min="0" value={settings.tax_rate} onChange={(event) => update('tax_rate', Number(event.target.value || 0))} />
          </label>
        </SettingsCard>
      </section>
    </DashboardShell>
  )
}

function SettingsCard({
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
    <section className={`settings-card ${collapsed ? 'collapsed' : 'expanded'}`}>
      <button className="settings-card-header" type="button" onClick={onToggle} aria-expanded={!collapsed}>
        <h2>{title}</h2>
        <span>{collapsed ? '▶' : '▼'}</span>
      </button>
      <div className="settings-card-body">{children}</div>
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
