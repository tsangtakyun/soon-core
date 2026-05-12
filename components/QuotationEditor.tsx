'use client'

import { type ChangeEvent, type ReactNode, useEffect, useMemo, useState } from 'react'

import {
  currencyOptions,
  invoicePhases,
  phaseColors,
  phaseDescriptions,
  type InvoiceCurrency,
  type InvoiceDiscount,
  type InvoicePhase,
} from '@/lib/invoice'
import {
  defaultQuotationSettings,
  mergeQuotationSettings,
  parseQuotation,
  type QuotationContent,
  type QuotationItem,
  type QuotationSettings,
} from '@/lib/quotation'
import { supabase } from '@/lib/supabase'
import type { CoreDoc } from '@/lib/types'

type Props = {
  doc: CoreDoc
  onBack: () => void
  onSaved: (doc: CoreDoc) => void
}

const quotationCopy = {
  zh: {
    back: '← 文件中心',
    chinese: '中文',
    english: 'English',
    quotation: '報價單',
    quoteNumber: '報價單號碼',
    date: '日期',
    validUntil: '有效期至',
    to: '致',
    companyName: '公司名稱',
    attn: '負責人',
    address: '地址',
    contact: '聯絡電話',
    email: 'Email',
    project: '項目名稱',
    phase: '階段',
    deliverable: '交付項目',
    details: '詳情',
    cost: '費用',
    addItem: '+ 新增項目',
    addDiscount: '+ 新增折扣',
    amountType: '金額',
    percentageType: '百分比',
    subtotal: '小計',
    discount: '折扣',
    tax: '稅項',
    total: '總計',
    paymentTerms: '付款條款',
    authorizedSignature: '授權簽署',
    clientSignature: '客戶簽署',
    name: '姓名',
    save: 'Save',
    saved: '已儲存',
    loading: '載入報價單設定中...',
    pdf: '匯出 PDF',
    word: '匯出 Word',
  },
  en: {
    back: '← Docs Center',
    chinese: '中文',
    english: 'English',
    quotation: 'QUOTATION',
    quoteNumber: 'Quote #',
    date: 'Date',
    validUntil: 'Valid Until',
    to: 'To',
    companyName: 'Company Name',
    attn: 'Attn',
    address: 'Address',
    contact: 'Contact Number',
    email: 'Email',
    project: 'Project',
    phase: 'Phase',
    deliverable: 'Deliverable',
    details: 'Details',
    cost: 'Cost',
    addItem: '+ Add item',
    addDiscount: '+ Add discount',
    amountType: 'Amount',
    percentageType: 'Percentage',
    subtotal: 'Subtotal',
    discount: 'Discount',
    tax: 'Tax',
    total: 'Total',
    paymentTerms: 'Payment Terms',
    authorizedSignature: 'Authorized Signature',
    clientSignature: 'Client Signature',
    name: 'Name',
    save: 'Save',
    saved: 'Saved',
    loading: 'Loading quotation settings...',
    pdf: 'Export PDF',
    word: 'Export Word',
  },
} as const

export function QuotationEditor({ doc, onBack, onSaved }: Props) {
  const [settings, setSettings] = useState<QuotationSettings>(defaultQuotationSettings)
  const [quote, setQuote] = useState<QuotationContent>(parseQuotation(null))
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const t = quotationCopy[quote.language]

  useEffect(() => {
    void loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    const { data } = await supabase.from('settings').select('*').eq('user_id', 'tommy').maybeSingle()
    const loaded = mergeQuotationSettings(data)
    setSettings(loaded)
    setQuote(parseQuotation(doc.content, loaded))
    setLoading(false)
  }

  const totals = useMemo(() => {
    const subtotal = quote.items.reduce((sum, item) => sum + Number(item.cost || 0), 0)
    const discount = quote.discount
      ? quote.discount.type === 'percentage'
        ? subtotal * (quote.discount.value / 100)
        : quote.discount.value
      : 0
    const taxable = Math.max(0, subtotal - discount)
    const tax = taxable * (Number(quote.taxRate || 0) / 100)
    return { subtotal, discount, tax, total: taxable + tax }
  }, [quote])

  function update<K extends keyof QuotationContent>(key: K, value: QuotationContent[K]) {
    setQuote((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  function updateItem(id: string, patch: Partial<QuotationItem>) {
    setQuote((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== id) return item
        const next = { ...item, ...patch }
        if (patch.phase) {
          next.deliverable = phaseDescriptions[patch.phase][0]
        }
        if (patch.deliverable === 'Custom') {
          next.deliverable = ''
        }
        return next
      }),
    }))
    setSaved(false)
  }

  async function save() {
    const payload = { ...quote, updatedAt: new Date().toISOString() }
    const { data, error } = await supabase
      .from('docs')
      .update({ title: quote.quoteNumber || 'Quotation', content: JSON.stringify(payload) })
      .eq('id', doc.id)
      .select()
      .single()
    if (error) {
      window.alert(error.message)
      return
    }
    setQuote(payload)
    setSaved(true)
    onSaved(data as CoreDoc)
    window.dispatchEvent(new Event('soon-data-updated'))
  }

  function addItem() {
    setQuote((current) => ({
      ...current,
      items: [...current.items, { id: crypto.randomUUID(), phase: 'Pre-production', deliverable: '', details: '', cost: 0 }],
    }))
    setSaved(false)
  }

  function exportPdf() {
    window.print()
  }

  function exportWord() {
    const html = buildWordHtml(quote, t, totals)
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${sanitizeFilename(quote.quoteNumber || 'quotation')}.doc`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="invoice-loading">{t.loading}</div>

  return (
    <section className="brief-editor-page">
      <header className="brief-toolbar invoice-toolbar soon-no-print">
        <div className="brief-toolbar-left">
          <button type="button" onClick={onBack}>{t.back}</button>
          <div className="brief-language-toggle">
            <button className={quote.language === 'zh' ? 'active' : ''} type="button" onClick={() => update('language', 'zh')}>{t.chinese}</button>
            <button className={quote.language === 'en' ? 'active' : ''} type="button" onClick={() => update('language', 'en')}>{t.english}</button>
          </div>
          <select className="invoice-currency-select" value={quote.currency} onChange={(event) => update('currency', event.target.value as InvoiceCurrency)}>
            {currencyOptions.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
          </select>
        </div>
        <span className="invoice-toolbar-spacer" />
        <input className="invoice-toolbar-number" value={quote.quoteNumber} onChange={(event) => update('quoteNumber', event.target.value)} />
        <span className="invoice-toolbar-spacer" />
        <div className="brief-toolbar-actions">
          {saved && <span>{t.saved}</span>}
          <button className="export-button export-pdf-button" type="button" onClick={exportPdf}>{t.pdf}</button>
          <button className="export-button export-word-button" type="button" onClick={exportWord}>{t.word}</button>
          <button className="primary-button" type="button" onClick={() => void save()}>{t.save}</button>
        </div>
      </header>

      <article className="invoice-document quotation-document soon-print-doc">
        <section className="invoice-header">
          <div className="invoice-company">
            <label className="invoice-logo">
              {quote.logoDataUrl ? <img src={quote.logoDataUrl} alt="" /> : <span>Logo</span>}
              <input type="file" accept="image/*" onChange={(event) => uploadLogo(event)} />
            </label>
            <input className="invoice-company-name" value={quote.companyName} onChange={(event) => update('companyName', event.target.value)} />
            <input value={quote.email} onChange={(event) => update('email', event.target.value)} placeholder="Email" />
            <input value={quote.phone} onChange={(event) => update('phone', event.target.value)} placeholder="Phone" />
            <textarea value={quote.address} onChange={(event) => update('address', event.target.value)} placeholder={t.address} rows={2} />
          </div>
          <div className="invoice-meta-box">
            <h1>{t.quotation}</h1>
            <MetaRow label={t.quoteNumber}><input value={quote.quoteNumber} onChange={(event) => update('quoteNumber', event.target.value)} /></MetaRow>
            <MetaRow label={t.date}><input type="date" value={quote.quoteDate} onChange={(event) => update('quoteDate', event.target.value)} /></MetaRow>
            <MetaRow label={t.validUntil}><input type="date" value={quote.validUntil} onChange={(event) => update('validUntil', event.target.value)} /></MetaRow>
          </div>
        </section>

        <section className="invoice-block quotation-client-grid">
          <label>{t.companyName}<input value={quote.clientCompany} onChange={(event) => update('clientCompany', event.target.value)} /></label>
          <label>{t.attn}<input value={quote.attention} onChange={(event) => update('attention', event.target.value)} /></label>
          <label>{t.address}<input value={quote.clientAddress} onChange={(event) => update('clientAddress', event.target.value)} /></label>
          <label>{t.contact}<input value={quote.clientPhone} onChange={(event) => update('clientPhone', event.target.value)} /></label>
          <label>{t.email}<input value={quote.clientEmail} onChange={(event) => update('clientEmail', event.target.value)} /></label>
        </section>

        <section className="quotation-project-row">
          <label>{t.project}<input value={quote.projectName} onChange={(event) => update('projectName', event.target.value)} /></label>
          <label>{t.quoteNumber}<input value={quote.quoteNumber} onChange={(event) => update('quoteNumber', event.target.value)} /></label>
        </section>

        <table className="quotation-items-table">
          <colgroup>
            <col className="quote-col-index" />
            <col className="quote-col-phase" />
            <col className="quote-col-deliverable" />
            <col className="quote-col-details" />
            <col className="quote-col-cost" />
            <col className="quote-col-action soon-no-print" />
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th>{t.phase}</th>
              <th>{t.deliverable}</th>
              <th>{t.details}</th>
              <th>{t.cost} ({quote.currency})</th>
              <th className="soon-no-print" />
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>
                  <select
                    className="phase-select"
                    style={{ color: phaseColors[item.phase] }}
                    value={item.phase}
                    onChange={(event) => updateItem(item.id, { phase: event.target.value as InvoicePhase })}
                  >
                    {invoicePhases.map((phase) => <option key={phase} value={phase}>{phase}</option>)}
                  </select>
                </td>
                <td>
                  <select value={phaseDescriptions[item.phase].includes(item.deliverable) ? item.deliverable : 'Custom'} onChange={(event) => updateItem(item.id, { deliverable: event.target.value })}>
                    {phaseDescriptions[item.phase].map((description) => <option key={description} value={description}>{description}</option>)}
                  </select>
                  {!phaseDescriptions[item.phase].includes(item.deliverable) && (
                    <input value={item.deliverable} onChange={(event) => updateItem(item.id, { deliverable: event.target.value })} />
                  )}
                </td>
                <td><textarea rows={3} value={item.details} onChange={(event) => updateItem(item.id, { details: event.target.value })} /></td>
                <td><input type="number" value={item.cost} onChange={(event) => updateItem(item.id, { cost: Number(event.target.value || 0) })} placeholder="XXXX" /></td>
                <td className="soon-no-print"><button type="button" onClick={() => update('items', quote.items.filter((current) => current.id !== item.id))}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="add-row-button soon-no-print" type="button" onClick={addItem}>{t.addItem}</button>

        <DiscountRow discount={quote.discount} currency={quote.currency} label={t.discount} copy={t} totals={totals} onChange={(discount) => update('discount', discount)} />

        <section className="invoice-totals">
          <div><span>{t.subtotal}</span><strong>{formatCurrency(quote.currency, totals.subtotal)}</strong></div>
          {quote.discount && <div><span>{t.discount}</span><strong>-{formatCurrency(quote.currency, totals.discount)}</strong></div>}
          <div><span>{t.tax} (<input type="number" value={quote.taxRate} onChange={(event) => update('taxRate', Number(event.target.value || 0))} />%)</span><strong>{formatCurrency(quote.currency, totals.tax)}</strong></div>
          <div className="invoice-total"><span>{t.total}</span><strong>{formatCurrency(quote.currency, totals.total)}</strong></div>
        </section>

        <section className="invoice-payment">
          <h2>{t.paymentTerms}</h2>
          <textarea value={quote.paymentTerms} onChange={(event) => update('paymentTerms', event.target.value)} rows={10} />
        </section>

        <section className="quotation-signatures">
          <SignatureBlock title={t.authorizedSignature} signatureBase64={quote.signatureBase64} nameLabel={t.name} dateLabel={t.date} name={quote.authorizedName} date={quote.authorizedDate} onName={(value) => update('authorizedName', value)} onDate={(value) => update('authorizedDate', value)} />
          <SignatureBlock title={t.clientSignature} nameLabel={t.name} dateLabel={t.date} name={quote.clientSignatureName} date={quote.clientSignatureDate} onName={(value) => update('clientSignatureName', value)} onDate={(value) => update('clientSignatureDate', value)} />
        </section>
      </article>
    </section>
  )

  function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => update('logoDataUrl', String(reader.result ?? ''))
    reader.readAsDataURL(file)
  }
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return <label className="invoice-meta-row"><span>{label}</span>{children}</label>
}

function DiscountRow({
  discount,
  currency,
  label,
  copy,
  totals,
  onChange,
}: {
  discount: InvoiceDiscount | null
  currency: InvoiceCurrency
  label: string
  copy: (typeof quotationCopy)[QuotationContent['language']]
  totals: { discount: number }
  onChange: (discount: InvoiceDiscount | null) => void
}) {
  if (!discount) {
    return <button className="add-row-button soon-no-print" type="button" onClick={() => onChange({ label, type: 'amount', value: 0 })}>{copy.addDiscount}</button>
  }
  return (
    <div className="invoice-discount-row soon-no-print">
      <input value={discount.label} onChange={(event) => onChange({ ...discount, label: event.target.value })} />
      <select value={discount.type} onChange={(event) => onChange({ ...discount, type: event.target.value as 'amount' | 'percentage' })}>
        <option value="amount">{copy.amountType}</option>
        <option value="percentage">{copy.percentageType}</option>
      </select>
      <input type="number" value={discount.value} onChange={(event) => onChange({ ...discount, value: Number(event.target.value || 0) })} />
      <strong>-{formatCurrency(currency, totals.discount)}</strong>
      <button type="button" onClick={() => onChange(null)}>×</button>
    </div>
  )
}

function SignatureBlock({
  title,
  signatureBase64,
  nameLabel,
  dateLabel,
  name,
  date,
  onName,
  onDate,
}: {
  title: string
  signatureBase64?: string
  nameLabel: string
  dateLabel: string
  name: string
  date: string
  onName: (value: string) => void
  onDate: (value: string) => void
}) {
  return (
    <div className="sig-col">
      <h3 className="sig-title">{title}</h3>
      <div className="sig-image-area">
        {signatureBase64 && <img className="quotation-signature-image" src={signatureBase64} alt="" />}
      </div>
      <div className="sig-line" />
      <label className="sig-name"><span>{nameLabel}:</span><input value={name} onChange={(event) => onName(event.target.value)} /></label>
      <label className="sig-date"><span>{dateLabel}:</span><input value={date} onChange={(event) => onDate(event.target.value)} /></label>
    </div>
  )
}

function money(value: number) {
  return value.toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCurrency(currency: InvoiceCurrency, value: number) {
  return `${currency}${money(value)}`
}

function buildWordHtml(quote: QuotationContent, t: (typeof quotationCopy)[QuotationContent['language']], totals: { subtotal: number; discount: number; tax: number; total: number }) {
  const rows = quote.items.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.phase)}</td><td>${escapeHtml(item.deliverable)}</td><td>${escapeHtml(item.details).replaceAll('\n', '<br>')}</td><td>${formatCurrency(quote.currency, item.cost)}</td></tr>`).join('')
  const signature = quote.signatureBase64 ? `<img src="${quote.signatureBase64}" style="max-width:200px;max-height:80px;display:block;margin-bottom:8px">` : ''
  return `<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:40px;color:#1a1a1a}h1{color:#7c3aed}table{border-collapse:collapse;width:100%;margin:20px 0}td,th{border:1px solid #e5e5e5;padding:8px 12px;font-size:13px;text-align:left}.right{text-align:right;white-space:pre-wrap}.sig{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:48px}.line{border-top:1px solid #1a1a1a;margin:34px 0 12px}</style></head><body><h1>${t.quotation}</h1><p><strong>${escapeHtml(quote.companyName)}</strong><br>${escapeHtml(quote.email)}<br>${escapeHtml(quote.phone)}<br>${escapeHtml(quote.address)}</p><p><strong>${t.quoteNumber}:</strong> ${escapeHtml(quote.quoteNumber)}<br><strong>${t.date}:</strong> ${quote.quoteDate}<br><strong>${t.validUntil}:</strong> ${quote.validUntil}</p><h2>${t.to}</h2><p>${escapeHtml(quote.clientCompany)}<br>${escapeHtml(quote.attention)}<br>${escapeHtml(quote.clientAddress)}<br>${escapeHtml(quote.clientPhone)}<br>${escapeHtml(quote.clientEmail)}</p><h2>${escapeHtml(quote.projectName)}</h2><table><tr><th>#</th><th>${t.phase}</th><th>${t.deliverable}</th><th>${t.details}</th><th>${t.cost}</th></tr>${rows}</table><p class="right">${t.subtotal}: ${formatCurrency(quote.currency, totals.subtotal)}<br>${t.tax}: ${formatCurrency(quote.currency, totals.tax)}<br><strong>${t.total}: ${formatCurrency(quote.currency, totals.total)}</strong></p><h2>${t.paymentTerms}</h2><p style="white-space:pre-wrap">${escapeHtml(quote.paymentTerms)}</p><div class="sig"><div><h3>${t.authorizedSignature}</h3>${signature}<div class="line"></div><p>${t.name}: ${escapeHtml(quote.authorizedName)}<br>${t.date}: ${quote.authorizedDate}</p></div><div><h3>${t.clientSignature}</h3><div class="line"></div><p>${t.name}: ${escapeHtml(quote.clientSignatureName)}<br>${t.date}: ${quote.clientSignatureDate}</p></div></div></body></html>`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char] ?? char)
}

function sanitizeFilename(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').toLowerCase() || 'quotation'
}
