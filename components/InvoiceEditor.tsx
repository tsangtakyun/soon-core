'use client'

import { type ChangeEvent, useEffect, useMemo, useState } from 'react'

import {
  createEmptyInvoice,
  createLineItem,
  currencyOptions,
  defaultSettings,
  invoicePhases,
  normaliseCurrency,
  parseInvoice,
  phaseColors,
  phaseDescriptions,
  type InvoiceContent,
  type InvoiceCurrency,
  type InvoiceLineItem,
  type InvoicePhase,
  type InvoiceSettings,
} from '@/lib/invoice'
import { parseQuotation } from '@/lib/quotation'
import { supabase } from '@/lib/supabase'
import type { CoreDoc } from '@/lib/types'

type Props = {
  doc: CoreDoc
  onBack: () => void
  onSaved: (doc: CoreDoc) => void
}

const invoiceCopy = {
  zh: {
    back: '← 文件中心',
    chinese: '中文',
    english: 'English',
    currency: '貨幣',
    invoice: '發票',
    invoiceNumber: '發票號碼',
    invoiceDate: '發票日期',
    dueDate: '到期日',
    billedTo: '開單予',
    customerName: '客戶名稱',
    address: '地址',
    taxId: '稅務編號',
    phase: '階段',
    description: '項目描述',
    rate: '單價',
    qty: '數量/小時',
    amount: '金額',
    subtotal: '小計',
    discount: '折扣',
    tax: '稅項',
    total: '總計',
    payment: '付款資料',
    paymentDueDate: '付款限期',
    bankName: '銀行名稱',
    accountName: '戶口名稱',
    accountNumber: '戶口號碼',
    notes: '備注',
    notesPlaceholder: '備注 / Additional notes',
    addItem: '+ 新增項目',
    addDiscount: '+ 新增折扣',
    amountType: '金額',
    percentageType: '百分比',
    save: 'Save',
    saved: '已儲存',
    loading: '載入 Invoice 設定中...',
    pdf: '匯出 PDF',
    word: '匯出 Word',
    customDescription: '自訂項目描述',
  },
  en: {
    back: '← Docs Center',
    chinese: '中文',
    english: 'English',
    currency: 'Currency',
    invoice: 'INVOICE',
    invoiceNumber: 'Invoice #',
    invoiceDate: 'Invoice Date',
    dueDate: 'Due Date',
    billedTo: 'Billed To',
    customerName: 'Customer Name',
    address: 'Address',
    taxId: 'Tax ID',
    phase: 'Phase',
    description: 'Description',
    rate: 'Rate',
    qty: 'Qty/Hours',
    amount: 'Amount',
    subtotal: 'Subtotal',
    discount: 'Discount',
    tax: 'Tax',
    total: 'Total',
    payment: 'Payment Information',
    paymentDueDate: 'Payment Due Date',
    bankName: 'Bank Name',
    accountName: 'Account Name',
    accountNumber: 'Account Number',
    notes: 'Notes',
    notesPlaceholder: 'Additional notes',
    addItem: '+ Add item',
    addDiscount: '+ Add discount',
    amountType: 'Amount',
    percentageType: 'Percentage',
    save: 'Save',
    saved: 'Saved',
    loading: 'Loading invoice settings...',
    pdf: 'Export PDF',
    word: 'Export Word',
    customDescription: 'Custom description',
  },
} as const

export function InvoiceEditor({ doc, onBack, onSaved }: Props) {
  const [settings, setSettings] = useState<InvoiceSettings>(defaultSettings)
  const [invoice, setInvoice] = useState<InvoiceContent>(createEmptyInvoice())
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [quoteDocs, setQuoteDocs] = useState<CoreDoc[]>([])
  const [quotePickerOpen, setQuotePickerOpen] = useState(false)
  const [toast, setToast] = useState('')
  const copy = invoiceCopy[invoice.language]

  useEffect(() => {
    void loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    const { data } = await supabase.from('settings').select('*').eq('user_id', 'tommy').maybeSingle()
    const loaded: InvoiceSettings = data
      ? {
          display_name: data.display_name ?? 'Tommy',
          logo_base64: data.logo_base64 ?? '',
          company_name: data.company_name ?? '',
          email: data.email ?? '',
          phone: data.phone ?? '',
          address: data.address ?? '',
          bank_name: data.bank_name ?? '',
          account_name: data.account_name ?? '',
          account_number: data.account_number ?? '',
          default_currency: normaliseCurrency(data.default_currency),
          invoice_prefix: data.invoice_prefix ?? 'INV',
          invoice_start_number: Number(data.invoice_start_number ?? 1),
          invoice_current_number: Number(data.invoice_current_number ?? 0),
          tax_rate: Number(data.tax_rate ?? 0),
          default_rates: (data.default_rates ?? {}) as Record<string, number>,
        }
      : defaultSettings

    setSettings(loaded)
    setInvoice(parseInvoice(doc.content, loaded))
    setLoading(false)
  }

  async function openQuotePicker() {
    const { data, error } = await supabase
      .from('docs')
      .select('*')
      .filter('template_type', 'eq', 'quotation')
      .order('created_at', { ascending: false })
    if (error) {
      window.alert(error.message)
      return
    }
    setQuoteDocs((data ?? []) as CoreDoc[])
    setQuotePickerOpen(true)
  }

  function importQuotation(doc: CoreDoc) {
    const quote = parseQuotation(doc.content)
    const importedItems: InvoiceLineItem[] = quote.items.map((item) => {
      const descriptionInTemplate = phaseDescriptions[item.phase]?.includes(item.deliverable)
      return {
        id: crypto.randomUUID(),
        phase: item.phase,
        description: descriptionInTemplate ? item.deliverable : 'Custom',
        customDescription: descriptionInTemplate ? '' : item.deliverable,
        rate: Number(item.cost || 0),
        quantity: 1,
      }
    })

    setInvoice((current) => ({
      ...current,
      sourceQuoteNumber: quote.quoteNumber,
      billedToName: quote.clientCompany,
      billedToAddress: quote.clientAddress,
      billedToPhone: quote.clientPhone,
      billedToEmail: quote.clientEmail,
      lineItems: importedItems.length > 0 ? importedItems : current.lineItems,
    }))
    setQuotePickerOpen(false)
    setSaved(false)
    setToast(`已匯入報價單 ${quote.quoteNumber}`)
    window.setTimeout(() => setToast(''), 2500)
  }

  const totals = useMemo(() => {
    const subtotal = invoice.lineItems.reduce((sum, item) => sum + lineAmount(item), 0)
    const discount = invoice.discount
      ? invoice.discount.type === 'percentage'
        ? subtotal * (invoice.discount.value / 100)
        : invoice.discount.value
      : 0
    const taxable = Math.max(0, subtotal - discount)
    const tax = taxable * (Number(invoice.taxRate || 0) / 100)
    return { subtotal, discount, tax, total: taxable + tax }
  }, [invoice])

  function update<K extends keyof InvoiceContent>(key: K, value: InvoiceContent[K]) {
    setInvoice((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  function updateItem(id: string, patch: Partial<InvoiceLineItem>) {
    setInvoice((current) => ({
      ...current,
      lineItems: current.lineItems.map((item) => {
        if (item.id !== id) return item
        const next = { ...item, ...patch }
        if (patch.phase) {
          next.description = phaseDescriptions[patch.phase][0]
          next.customDescription = ''
          next.rate = Number(settings.default_rates[next.description] ?? 0)
        }
        if (patch.description) {
          next.rate = patch.description === 'Custom' ? 0 : Number(settings.default_rates[patch.description] ?? 0)
        }
        return next
      }),
    }))
    setSaved(false)
  }

  async function save() {
    const payload = { ...invoice, updatedAt: new Date().toISOString() }
    const { data, error } = await supabase
      .from('docs')
      .update({
        title: invoice.invoiceNumber || 'Invoice',
        content: JSON.stringify(payload),
        invoice_amount: totals.total,
        invoice_client: invoice.billedToName || null,
        invoice_date: invoice.invoiceDate || null,
        invoice_due_date: invoice.dueDate || null,
        invoice_currency: invoice.currency,
      })
      .eq('id', doc.id)
      .select()
      .single()
    if (error) {
      window.alert(error.message)
      return
    }
    setInvoice(payload)
    setSaved(true)
    onSaved(data as CoreDoc)
    window.dispatchEvent(new Event('soon-data-updated'))
  }

  function addItem() {
    setInvoice((current) => ({
      ...current,
      lineItems: [...current.lineItems, createLineItem(settings)],
    }))
    setSaved(false)
  }

  function exportPdf() {
    window.print()
  }

  function exportWord() {
    const html = buildInvoiceWord(invoice, copy, totals)
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${sanitizeFilename(invoice.invoiceNumber || 'invoice')}.doc`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <section className="brief-editor-page">
        <div className="invoice-loading">{copy.loading}</div>
      </section>
    )
  }

  return (
    <section className="brief-editor-page">
      <header className="brief-toolbar invoice-toolbar soon-no-print">
        <div className="brief-toolbar-left">
          <button type="button" onClick={onBack}>
            {copy.back}
          </button>
          <div className="brief-language-toggle">
            <button className={invoice.language === 'zh' ? 'active' : ''} type="button" onClick={() => update('language', 'zh')}>
              {copy.chinese}
            </button>
            <button className={invoice.language === 'en' ? 'active' : ''} type="button" onClick={() => update('language', 'en')}>
              {copy.english}
            </button>
          </div>
          <div className="quote-import-wrap">
            <button className="quote-import-button" type="button" onClick={() => void openQuotePicker()}>
              ↓ 匯入報價單
            </button>
          </div>
          <select
            className="invoice-currency-select"
            aria-label={copy.currency}
            value={invoice.currency}
            onChange={(event) => update('currency', event.target.value as InvoiceCurrency)}
          >
            {currencyOptions.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </div>
        <span className="invoice-toolbar-spacer" />
        <input
          className="invoice-toolbar-number"
          value={invoice.invoiceNumber}
          onChange={(event) => update('invoiceNumber', event.target.value)}
        />
        <span className="invoice-toolbar-spacer" />
        <div className="brief-toolbar-actions">
          {saved && <span>{copy.saved}</span>}
          {toast && <span>{toast}</span>}
          <button className="export-button export-pdf-button" type="button" onClick={exportPdf}>
            {copy.pdf}
          </button>
          <button className="export-button export-word-button" type="button" onClick={exportWord}>
            {copy.word}
          </button>
          <button className="primary-button" type="button" onClick={() => void save()}>
            {copy.save}
          </button>
        </div>
      </header>

      {quotePickerOpen && (
        <div className="quote-import-popover soon-no-print">
          <div className="quote-import-popover-head">
            <strong>匯入報價單</strong>
            <button type="button" onClick={() => setQuotePickerOpen(false)}>關閉</button>
          </div>
          <div className="quote-import-menu">
            {quoteDocs.map((quoteDoc) => {
              const quote = parseQuotation(quoteDoc.content)
              return (
                <button key={quoteDoc.id} type="button" onClick={() => importQuotation(quoteDoc)}>
                  <strong>{quote.quoteNumber}</strong>
                  <span>{quote.projectName || '未命名項目'}</span>
                  <em>{quote.quoteDate || new Date(quoteDoc.created_at).toLocaleDateString('zh-HK')}</em>
                  <small>{quote.clientCompany || '-'}</small>
                </button>
              )
            })}
            {quoteDocs.length === 0 && <p>未有報價單</p>}
          </div>
        </div>
      )}

      <article className="invoice-document soon-print-doc">
        <section className="invoice-header">
          <div className="invoice-company">
            <label className="invoice-logo">
              {invoice.logoDataUrl ? <img src={invoice.logoDataUrl} alt="" /> : <span>Logo</span>}
              <input type="file" accept="image/*" onChange={(event) => uploadLogo(event)} />
            </label>
            <input className="invoice-company-name" value={invoice.companyName} onChange={(event) => update('companyName', event.target.value)} />
            <input value={invoice.email} onChange={(event) => update('email', event.target.value)} placeholder="Email" />
            <input value={invoice.phone} onChange={(event) => update('phone', event.target.value)} placeholder="Phone" />
            <textarea value={invoice.address} onChange={(event) => update('address', event.target.value)} placeholder={copy.address} rows={2} />
          </div>
          <div className="invoice-meta-box">
            <h1>{copy.invoice}</h1>
            <label className="invoice-meta-row">
              <span>{copy.invoiceNumber}</span>
              <input value={invoice.invoiceNumber} onChange={(event) => update('invoiceNumber', event.target.value)} />
            </label>
            <label className="invoice-meta-row">
              <span>{copy.invoiceDate}</span>
              <input type="date" value={invoice.invoiceDate} onChange={(event) => update('invoiceDate', event.target.value)} />
            </label>
            <label className="invoice-meta-row">
              <span>{copy.dueDate}</span>
              <input type="date" value={invoice.dueDate} onChange={(event) => update('dueDate', event.target.value)} />
            </label>
            {invoice.sourceQuoteNumber && (
              <div className="invoice-meta-row invoice-source-quote">
                <span>來源報價單</span>
                <strong>{invoice.sourceQuoteNumber}</strong>
              </div>
            )}
          </div>
        </section>

        <section className="invoice-block">
          <h2>{copy.billedTo}</h2>
          <input value={invoice.billedToName} onChange={(event) => update('billedToName', event.target.value)} placeholder={copy.customerName} />
          <input value={invoice.billedToAddress} onChange={(event) => update('billedToAddress', event.target.value)} placeholder={copy.address} />
          <input value={invoice.billedToPhone} onChange={(event) => update('billedToPhone', event.target.value)} placeholder="聯絡電話" />
          <input value={invoice.billedToEmail} onChange={(event) => update('billedToEmail', event.target.value)} placeholder="Email" />
          <input value={invoice.billedToTaxId} onChange={(event) => update('billedToTaxId', event.target.value)} placeholder={copy.taxId} />
        </section>

        <table className="invoice-items-table">
          <thead>
            <tr>
              <th>{copy.phase}</th>
              <th>{copy.description}</th>
              <th>{copy.rate} ({invoice.currency})</th>
              <th>{copy.qty}</th>
              <th>{copy.amount} ({invoice.currency})</th>
              <th className="soon-no-print" />
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((item) => (
              <tr key={item.id}>
                <td>
                  <select
                    className="phase-select"
                    style={{ color: phaseColors[item.phase] }}
                    value={item.phase}
                    onChange={(event) => updateItem(item.id, { phase: event.target.value as InvoicePhase })}
                  >
                    {invoicePhases.map((phase) => (
                      <option key={phase} value={phase}>
                        {phase}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select value={item.description} onChange={(event) => updateItem(item.id, { description: event.target.value })}>
                    {phaseDescriptions[item.phase].map((description) => (
                      <option key={description} value={description}>
                        {description}
                      </option>
                    ))}
                  </select>
                  {item.description === 'Custom' && (
                    <input
                      value={item.customDescription}
                      onChange={(event) => updateItem(item.id, { customDescription: event.target.value })}
                      placeholder={copy.customDescription}
                    />
                  )}
                </td>
                <td>
                  <input type="number" value={item.rate} onChange={(event) => updateItem(item.id, { rate: Number(event.target.value || 0) })} />
                </td>
                <td>
                  <input type="number" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value || 0) })} />
                </td>
                <td>{formatCurrency(invoice.currency, lineAmount(item))}</td>
                <td className="soon-no-print">
                  <button type="button" onClick={() => update('lineItems', invoice.lineItems.filter((current) => current.id !== item.id))}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="add-row-button soon-no-print" type="button" onClick={addItem}>
          {copy.addItem}
        </button>

        <div className="invoice-discount-row soon-no-print">
          {!invoice.discount ? (
            <button className="add-row-button" type="button" onClick={() => update('discount', { label: copy.discount, type: 'amount', value: 0 })}>
              {copy.addDiscount}
            </button>
          ) : (
            <>
              <input value={invoice.discount.label} onChange={(event) => update('discount', { ...invoice.discount!, label: event.target.value })} />
              <select value={invoice.discount.type} onChange={(event) => update('discount', { ...invoice.discount!, type: event.target.value as 'amount' | 'percentage' })}>
                <option value="amount">{copy.amountType}</option>
                <option value="percentage">{copy.percentageType}</option>
              </select>
              <input type="number" value={invoice.discount.value} onChange={(event) => update('discount', { ...invoice.discount!, value: Number(event.target.value || 0) })} />
              <strong>-{formatCurrency(invoice.currency, totals.discount)}</strong>
              <button type="button" onClick={() => update('discount', null)}>
                ×
              </button>
            </>
          )}
        </div>

        <section className="invoice-totals">
          <div>
            <span>{copy.subtotal}</span>
            <strong>{formatCurrency(invoice.currency, totals.subtotal)}</strong>
          </div>
          {invoice.discount && (
            <div>
              <span>{copy.discount}</span>
              <strong>-{formatCurrency(invoice.currency, totals.discount)}</strong>
            </div>
          )}
          <div>
            <span>
              {copy.tax} (
              <input value={invoice.taxRate} type="number" onChange={(event) => update('taxRate', Number(event.target.value || 0))} />%)
            </span>
            <strong>{formatCurrency(invoice.currency, totals.tax)}</strong>
          </div>
          <div className="invoice-total">
            <span>{copy.total}</span>
            <strong>{formatCurrency(invoice.currency, totals.total)}</strong>
          </div>
        </section>

        <section className="invoice-payment">
          <h2>{copy.payment}</h2>
          <div>
            <span>{copy.paymentDueDate}</span>
            <strong>{invoice.dueDate || '-'}</strong>
          </div>
          <label>
            {copy.bankName}
            <input value={invoice.bankName} onChange={(event) => update('bankName', event.target.value)} placeholder={copy.bankName} />
          </label>
          <label>
            {copy.accountName}
            <input value={invoice.accountName} onChange={(event) => update('accountName', event.target.value)} placeholder={copy.accountName} />
          </label>
          <label>
            {copy.accountNumber}
            <input value={invoice.accountNumber} onChange={(event) => update('accountNumber', event.target.value)} placeholder={copy.accountNumber} />
          </label>
          <label>
            {copy.notes}
            <textarea value={invoice.notes} onChange={(event) => update('notes', event.target.value)} placeholder={copy.notesPlaceholder} rows={3} />
          </label>
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

function lineAmount(item: InvoiceLineItem) {
  return Number(item.rate || 0) * Number(item.quantity || 0)
}

function money(value: number) {
  return value.toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCurrency(currency: InvoiceCurrency, value: number) {
  return `${currency}${money(value)}`
}

function buildInvoiceWord(
  invoice: InvoiceContent,
  copy: (typeof invoiceCopy)[InvoiceContent['language']],
  totals: { subtotal: number; discount: number; tax: number; total: number }
) {
  const itemRows = invoice.lineItems
    .map((item) => `<tr><td>${escapeHtml(item.phase)}</td><td>${escapeHtml(item.description === 'Custom' ? item.customDescription : item.description)}</td><td>${formatCurrency(invoice.currency, item.rate)}</td><td>${item.quantity}</td><td>${formatCurrency(invoice.currency, lineAmount(item))}</td></tr>`)
    .join('')

  return `<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:40px;color:#1a1a1a}h1{color:#7c3aed}table{border-collapse:collapse;width:100%;margin:20px 0}td,th{border:1px solid #e5e5e5;padding:8px 12px;font-size:13px;text-align:left}.right{text-align:right}</style></head><body><h1>${copy.invoice}</h1><p><strong>${escapeHtml(invoice.companyName)}</strong><br>${escapeHtml(invoice.email)}<br>${escapeHtml(invoice.phone)}<br>${escapeHtml(invoice.address)}</p><p><strong>${copy.invoiceNumber}:</strong> ${escapeHtml(invoice.invoiceNumber)}<br><strong>${copy.invoiceDate}:</strong> ${invoice.invoiceDate}<br><strong>${copy.dueDate}:</strong> ${invoice.dueDate}</p><h2>${copy.billedTo}</h2><p>${escapeHtml(invoice.billedToName)}<br>${escapeHtml(invoice.billedToAddress)}<br>${escapeHtml(invoice.billedToTaxId)}</p><table><tr><th>${copy.phase}</th><th>${copy.description}</th><th>${copy.rate}</th><th>${copy.qty}</th><th>${copy.amount}</th></tr>${itemRows}</table><p class="right">${copy.subtotal}: ${formatCurrency(invoice.currency, totals.subtotal)}<br>${copy.tax}: ${formatCurrency(invoice.currency, totals.tax)}<br><strong>${copy.total}: ${formatCurrency(invoice.currency, totals.total)}</strong></p><h2>${copy.payment}</h2><p>${copy.bankName}: ${escapeHtml(invoice.bankName)}<br>${copy.accountName}: ${escapeHtml(invoice.accountName)}<br>${copy.accountNumber}: ${escapeHtml(invoice.accountNumber)}</p><p>${escapeHtml(invoice.notes)}</p></body></html>`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char] ?? char)
}

function sanitizeFilename(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').toLowerCase() || 'invoice'
}
