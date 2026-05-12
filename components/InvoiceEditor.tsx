'use client'

import { type ChangeEvent, useEffect, useMemo, useState } from 'react'

import {
  createEmptyInvoice,
  createLineItem,
  defaultSettings,
  invoicePhases,
  parseInvoice,
  phaseColors,
  phaseDescriptions,
  type InvoiceContent,
  type InvoiceLineItem,
  type InvoicePhase,
  type InvoiceSettings,
} from '@/lib/invoice'
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
    invoice: '發票',
    billedTo: '開單予',
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
    notes: '備注',
    addItem: '+ 新增項目',
    addDiscount: '+ 新增折扣',
    save: 'Save',
    saved: '已儲存',
    pdf: '匯出 PDF',
    word: '匯出 Word',
  },
  en: {
    back: '← Docs Center',
    invoice: 'INVOICE',
    billedTo: 'Billed To',
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
    notes: 'Notes',
    addItem: '+ Add item',
    addDiscount: '+ Add discount',
    save: 'Save',
    saved: 'Saved',
    pdf: 'Export PDF',
    word: 'Export Word',
  },
} as const

export function InvoiceEditor({ doc, onBack, onSaved }: Props) {
  const [settings, setSettings] = useState<InvoiceSettings>(defaultSettings)
  const [invoice, setInvoice] = useState<InvoiceContent>(createEmptyInvoice())
  const [saved, setSaved] = useState(false)
  const copy = invoiceCopy[invoice.language]

  useEffect(() => {
    void loadSettings()
  }, [])

  async function loadSettings() {
    const { data } = await supabase.from('settings').select('*').eq('user_id', 'tommy').maybeSingle()
    const loaded: InvoiceSettings = data
      ? {
          company_name: data.company_name ?? '',
          email: data.email ?? '',
          phone: data.phone ?? '',
          address: data.address ?? '',
          bank_name: data.bank_name ?? '',
          account_name: data.account_name ?? '',
          account_number: data.account_number ?? '',
          tax_rate: Number(data.tax_rate ?? 0),
          default_rates: (data.default_rates ?? {}) as Record<string, number>,
        }
      : defaultSettings

    setSettings(loaded)
    setInvoice(parseInvoice(doc.content, loaded))
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
          next.rate = Number(settings.default_rates[next.description] ?? 0)
        }
        if (patch.description && patch.description !== 'Custom') {
          next.rate = Number(settings.default_rates[patch.description] ?? 0)
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

  return (
    <section className="brief-editor-page">
      <header className="brief-toolbar invoice-toolbar soon-no-print">
        <div className="brief-toolbar-left">
          <button type="button" onClick={onBack}>
            {copy.back}
          </button>
          <div className="brief-language-toggle">
            <button className={invoice.language === 'zh' ? 'active' : ''} type="button" onClick={() => update('language', 'zh')}>
              中文
            </button>
            <button className={invoice.language === 'en' ? 'active' : ''} type="button" onClick={() => update('language', 'en')}>
              English
            </button>
          </div>
        </div>
        <input value={invoice.invoiceNumber} onChange={(event) => update('invoiceNumber', event.target.value)} />
        <div className="brief-toolbar-actions">
          {saved && <span>{copy.saved}</span>}
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

      <article className="invoice-document soon-print-doc">
        <section className="invoice-header">
          <div className="invoice-company">
            <label className="invoice-logo">
              {invoice.logoDataUrl ? <img src={invoice.logoDataUrl} alt="" /> : <span>Logo</span>}
              <input type="file" accept="image/*" onChange={(event) => void uploadLogo(event)} />
            </label>
            <input className="invoice-company-name" value={invoice.companyName} onChange={(event) => update('companyName', event.target.value)} />
            <input value={invoice.email} onChange={(event) => update('email', event.target.value)} placeholder="Email" />
            <input value={invoice.phone} onChange={(event) => update('phone', event.target.value)} placeholder="Phone" />
            <textarea value={invoice.address} onChange={(event) => update('address', event.target.value)} placeholder="Address" rows={2} />
          </div>
          <div className="invoice-meta-box">
            <h1>{copy.invoice}</h1>
            <label>Invoice #<input value={invoice.invoiceNumber} onChange={(event) => update('invoiceNumber', event.target.value)} /></label>
            <label>Invoice Date<input type="date" value={invoice.invoiceDate} onChange={(event) => update('invoiceDate', event.target.value)} /></label>
            <label>Due Date<input type="date" value={invoice.dueDate} onChange={(event) => update('dueDate', event.target.value)} /></label>
          </div>
        </section>

        <section className="invoice-block">
          <h2>{copy.billedTo}</h2>
          <input value={invoice.billedToName} onChange={(event) => update('billedToName', event.target.value)} placeholder="Customer Name" />
          <input value={invoice.billedToAddress} onChange={(event) => update('billedToAddress', event.target.value)} placeholder="Address" />
          <input value={invoice.billedToTaxId} onChange={(event) => update('billedToTaxId', event.target.value)} placeholder="Tax ID" />
        </section>

        <table className="invoice-items-table">
          <thead>
            <tr>
              <th>{copy.phase}</th>
              <th>{copy.description}</th>
              <th>{copy.rate} (HK$)</th>
              <th>{copy.qty}</th>
              <th>{copy.amount} (HK$)</th>
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
                      <option key={phase} value={phase}>{phase}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select value={item.description} onChange={(event) => updateItem(item.id, { description: event.target.value })}>
                    {phaseDescriptions[item.phase].map((description) => (
                      <option key={description} value={description}>{description}</option>
                    ))}
                  </select>
                  {item.description === 'Custom' && (
                    <input value={item.customDescription} onChange={(event) => updateItem(item.id, { customDescription: event.target.value })} placeholder="Custom description" />
                  )}
                </td>
                <td><input type="number" value={item.rate} onChange={(event) => updateItem(item.id, { rate: Number(event.target.value || 0) })} /></td>
                <td><input type="number" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value || 0) })} /></td>
                <td>{money(lineAmount(item))}</td>
                <td className="soon-no-print"><button type="button" onClick={() => update('lineItems', invoice.lineItems.filter((current) => current.id !== item.id))}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="add-row-button soon-no-print" type="button" onClick={addItem}>{copy.addItem}</button>

        <div className="invoice-discount-row soon-no-print">
          {!invoice.discount ? (
            <button className="add-row-button" type="button" onClick={() => update('discount', { label: 'Discount', type: 'amount', value: 0 })}>{copy.addDiscount}</button>
          ) : (
            <>
              <input value={invoice.discount.label} onChange={(event) => update('discount', { ...invoice.discount!, label: event.target.value })} />
              <select value={invoice.discount.type} onChange={(event) => update('discount', { ...invoice.discount!, type: event.target.value as 'amount' | 'percentage' })}>
                <option value="amount">金額</option>
                <option value="percentage">百分比</option>
              </select>
              <input type="number" value={invoice.discount.value} onChange={(event) => update('discount', { ...invoice.discount!, value: Number(event.target.value || 0) })} />
              <strong>-HK$ {money(totals.discount)}</strong>
              <button type="button" onClick={() => update('discount', null)}>×</button>
            </>
          )}
        </div>

        <section className="invoice-totals">
          <div><span>{copy.subtotal}</span><strong>HK$ {money(totals.subtotal)}</strong></div>
          {invoice.discount && <div><span>{copy.discount}</span><strong>-HK$ {money(totals.discount)}</strong></div>}
          <div>
            <span>{copy.tax} (<input value={invoice.taxRate} type="number" onChange={(event) => update('taxRate', Number(event.target.value || 0))} />%)</span>
            <strong>HK$ {money(totals.tax)}</strong>
          </div>
          <div className="invoice-total"><span>{copy.total}</span><strong>HK$ {money(totals.total)}</strong></div>
        </section>

        <section className="invoice-payment">
          <h2>{copy.payment}</h2>
          <div><span>Payment Due Date</span><strong>{invoice.dueDate}</strong></div>
          <label>Bank Name<input value={invoice.bankName} onChange={(event) => update('bankName', event.target.value)} /></label>
          <label>Account Name<input value={invoice.accountName} onChange={(event) => update('accountName', event.target.value)} /></label>
          <label>Account Number<input value={invoice.accountNumber} onChange={(event) => update('accountNumber', event.target.value)} /></label>
          <textarea value={invoice.notes} onChange={(event) => update('notes', event.target.value)} placeholder="備注 / Additional notes" rows={3} />
        </section>
      </article>
    </section>
  )

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
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

function buildInvoiceWord(invoice: InvoiceContent, copy: (typeof invoiceCopy)[InvoiceContent['language']], totals: { subtotal: number; discount: number; tax: number; total: number }) {
  const itemRows = invoice.lineItems.map((item) => `<tr><td>${item.phase}</td><td>${item.description === 'Custom' ? item.customDescription : item.description}</td><td>${money(item.rate)}</td><td>${item.quantity}</td><td>${money(lineAmount(item))}</td></tr>`).join('')
  return `<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:40px;color:#1a1a1a}h1{color:#7c3aed}table{border-collapse:collapse;width:100%;margin:20px 0}td,th{border:1px solid #e5e5e5;padding:8px 12px;font-size:13px;text-align:left}.right{text-align:right}</style></head><body><h1>${copy.invoice}</h1><p><strong>${invoice.companyName}</strong><br>${invoice.email}<br>${invoice.phone}<br>${invoice.address}</p><p><strong>Invoice #:</strong> ${invoice.invoiceNumber}<br><strong>Invoice Date:</strong> ${invoice.invoiceDate}<br><strong>Due Date:</strong> ${invoice.dueDate}</p><h2>${copy.billedTo}</h2><p>${invoice.billedToName}<br>${invoice.billedToAddress}<br>${invoice.billedToTaxId}</p><table><tr><th>${copy.phase}</th><th>${copy.description}</th><th>${copy.rate}</th><th>${copy.qty}</th><th>${copy.amount}</th></tr>${itemRows}</table><p class="right">${copy.subtotal}: HK$ ${money(totals.subtotal)}<br>${copy.tax}: HK$ ${money(totals.tax)}<br><strong>${copy.total}: HK$ ${money(totals.total)}</strong></p><h2>${copy.payment}</h2><p>${invoice.bankName}<br>${invoice.accountName}<br>${invoice.accountNumber}</p><p>${invoice.notes}</p></body></html>`
}

function sanitizeFilename(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').toLowerCase() || 'invoice'
}
