'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import * as XLSX from 'xlsx'

import { DashboardShell } from '@/components/DashboardShell'
import { parseInvoice } from '@/lib/invoice'
import { supabase } from '@/lib/supabase'
import type { CoreDoc } from '@/lib/types'

type InvoiceStatus = 'draft' | 'issued' | 'sent_for_approval' | 'paid' | 'overdue'

type FinanceDoc = CoreDoc & {
  invoice_status: InvoiceStatus | null
  invoice_amount: number | null
  invoice_client: string | null
  invoice_date: string | null
  invoice_due_date: string | null
  invoice_currency: string | null
}

type Expense = {
  id: string
  workspace_id: string | null
  date: string
  merchant: string | null
  description: string | null
  amount: number
  original_amount: number | null
  original_currency: string | null
  converted_amount: number | null
  converted_currency: string | null
  exchange_rate: number | null
  category: string | null
  receipt_images: string[] | null
  ai_extracted: boolean | null
  notes: string | null
  created_at: string
}

type ExpenseDraft = {
  id: string
  receiptImages: string[]
  sourceNames: string[]
  merchant: string
  date: string
  description: string
  originalAmount: number | null
  originalCurrency: string
  convertedAmount: number
  convertedCurrency: string
  exchangeRate: number | null
  category: string
  notes: string
  aiMissingFields: string[]
  conversionError: boolean
}

type ReceiptOcrResult = {
  merchant?: string | null
  date?: string | null
  items?: string[] | null
  original_amount?: number | null
  original_currency?: string | null
  converted_amount?: number | null
  converted_currency?: string | null
  exchange_rate?: number | null
  category?: string | null
  notes?: string | null
}

const statusMeta: Record<InvoiceStatus, { label: string; color: string }> = {
  overdue: { label: '逾期', color: '#ef4444' },
  sent_for_approval: { label: '待審批', color: '#f59e0b' },
  issued: { label: '已發出', color: '#3b82f6' },
  draft: { label: '草稿', color: '#6b7280' },
  paid: { label: '已收款', color: '#22c55e' },
}

const receivableStatusOrder: InvoiceStatus[] = ['overdue', 'sent_for_approval', 'issued', 'draft', 'paid']

const categoryColors: Record<string, string> = {
  餐飲: '#f97316',
  交通: '#0ea5e9',
  器材租借: '#7c3aed',
  住宿: '#14b8a6',
  道具: '#ec4899',
  廣告費: '#ef4444',
  軟件訂閱: '#6366f1',
  製作費: '#f59e0b',
  人工: '#22c55e',
  雜項: '#6b7280',
}

const categories = Object.keys(categoryColors)
const timeFilters = ['全部', '最近7日', '最近14日', '最近30日', '本月', '自訂'] as const
const currencyOptions = [
  { code: 'HKD', label: 'HK$' },
  { code: 'USD', label: 'USD $' },
  { code: 'GBP', label: 'GBP £' },
  { code: 'EUR', label: 'EUR €' },
  { code: 'SGD', label: 'SGD $' },
  { code: 'TWD', label: 'TWD NT$' },
  { code: 'CNY', label: 'CNY ¥' },
  { code: 'JPY', label: 'JPY ¥' },
]

function today() {
  return new Date().toISOString().slice(0, 10)
}

function currencyPrefix(value: string) {
  const upper = value.toUpperCase()
  if (upper === 'HKD' || value === 'HK$') return 'HK$'
  if (upper === 'USD' || value === 'USD $') return '$'
  if (upper === 'GBP' || value === 'GBP £') return '£'
  if (upper === 'EUR' || value === 'EUR €') return '€'
  if (upper === 'SGD' || value === 'SGD $') return 'S$'
  if (upper === 'TWD' || value === 'TWD NT$') return 'NT$'
  if (upper === 'CNY' || value === 'CNY ¥') return '¥'
  if (upper === 'JPY' || value === 'JPY ¥') return '¥'
  return value
}

function money(currency: string, value: number) {
  return `${currencyPrefix(currency)}${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)}`
}

function toNumber(value: unknown) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

function currencyCodeFromSetting(value: string) {
  const upper = value.toUpperCase()
  const match = currencyOptions.find((currency) => upper.includes(currency.code))
  if (match) return match.code
  if (upper.includes('HK')) return 'HKD'
  if (upper.includes('US')) return 'USD'
  if (upper.includes('GB') || upper.includes('£')) return 'GBP'
  if (upper.includes('EU') || upper.includes('€')) return 'EUR'
  if (upper.includes('SG')) return 'SGD'
  if (upper.includes('TW') || upper.includes('NT')) return 'TWD'
  if (upper.includes('CN') || upper.includes('¥')) return 'CNY'
  return 'HKD'
}

async function convertExpenseAmount(originalCurrency: string, originalAmount: number | null, defaultCurrency: string, fallbackConverted?: number | null, fallbackRate?: number | null) {
  const fromCode = currencyCodeFromSetting(originalCurrency)
  const toCode = currencyCodeFromSetting(defaultCurrency)
  const amount = originalAmount ?? 0
  if (!amount || fromCode === toCode) {
    return { convertedAmount: amount, convertedCurrency: toCode, exchangeRate: 1, conversionError: false }
  }
  try {
    const response = await fetch(`https://api.frankfurter.app/latest?from=${fromCode}&to=${toCode}`)
    if (!response.ok) throw new Error('Exchange rate request failed')
    const data = await response.json() as { rates?: Record<string, number> }
    const rate = Number(data.rates?.[toCode])
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('Exchange rate missing')
    return { convertedAmount: amount * rate, convertedCurrency: toCode, exchangeRate: rate, conversionError: false }
  } catch {
    const fallbackAmount = Number(fallbackConverted)
    const fallbackExchangeRate = Number(fallbackRate)
    if (Number.isFinite(fallbackAmount) && fallbackAmount > 0 && Number.isFinite(fallbackExchangeRate) && fallbackExchangeRate > 0 && fallbackExchangeRate !== 1) {
      return { convertedAmount: fallbackAmount, convertedCurrency: toCode, exchangeRate: fallbackExchangeRate, conversionError: false }
    }
    return { convertedAmount: amount, convertedCurrency: toCode, exchangeRate: null, conversionError: true }
  }
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function readJsonResponse(response: Response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    const lower = text.toLowerCase()
    if (lower.includes('request entity too large') || response.status === 413) {
      throw new Error('PDF 檔案太大，Vercel 拒絕接收。請改用較細 PDF，或者截圖後用圖片上傳。')
    }
    throw new Error(text || `Request failed (${response.status})`)
  }
}

function daysOverdue(dueDate: string | null, status: InvoiceStatus) {
  if (!dueDate || status === 'paid') return 0
  const todayDate = new Date(today())
  const due = new Date(dueDate)
  const diff = Math.floor((todayDate.getTime() - due.getTime()) / 86400000)
  return Math.max(0, diff)
}

function effectiveInvoiceStatus(invoice: FinanceDoc): InvoiceStatus {
  const status = invoice.invoice_status ?? 'draft'
  if (status !== 'paid' && (status === 'overdue' || daysOverdue(invoice.invoice_due_date, status) > 0)) {
    return 'overdue'
  }
  return status
}

function invoiceContentTotal(invoice: ReturnType<typeof parseInvoice>) {
  const subtotal = invoice.lineItems.reduce((sum, item) => sum + toNumber(item.rate) * toNumber(item.quantity), 0)
  const discount = invoice.discount ? (invoice.discount.type === 'percentage' ? subtotal * (invoice.discount.value / 100) : invoice.discount.value) : 0
  const taxable = Math.max(0, subtotal - discount)
  return taxable + taxable * (toNumber(invoice.taxRate) / 100)
}

export function FinanceCenter() {
  const [invoices, setInvoices] = useState<FinanceDoc[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [defaultCurrency, setDefaultCurrency] = useState('HK$')
  const [importOpen, setImportOpen] = useState(false)
  const [showEmptyInvoiceStatuses, setShowEmptyInvoiceStatuses] = useState(false)
  const [expandedInvoiceStatuses, setExpandedInvoiceStatuses] = useState<Set<InvoiceStatus>>(() => new Set(receivableStatusOrder))
  const [timeFilter, setTimeFilter] = useState<(typeof timeFilters)[number]>('全部')
  const [customStart, setCustomStart] = useState(today())
  const [customEnd, setCustomEnd] = useState(today())
  const [receiptDrafts, setReceiptDrafts] = useState<ExpenseDraft[]>([])
  const [analysingReceipts, setAnalysingReceipts] = useState(false)
  const [showEmptyExpenseCategories, setShowEmptyExpenseCategories] = useState(false)
  const [expandedExpenseCategories, setExpandedExpenseCategories] = useState<Set<string>>(() => new Set(categories))
  const [showAllExpenseCategories, setShowAllExpenseCategories] = useState<Set<string>>(() => new Set())
  const [expandedExpenseDescriptions, setExpandedExpenseDescriptions] = useState<Set<string>>(() => new Set())
  const [reportYear, setReportYear] = useState(new Date().getFullYear())
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1)

  useEffect(() => {
    void loadFinanceData()
  }, [])

  async function loadFinanceData() {
    const [{ data: docsData }, { data: expenseData }, { data: settingsData }] = await Promise.all([
      supabase.from('docs').select('*').eq('template_type', 'invoice').order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').order('date', { ascending: false }),
      supabase.from('settings').select('default_currency').eq('user_id', 'tommy').maybeSingle(),
    ])
    setInvoices((docsData ?? []) as FinanceDoc[])
    setExpenses((expenseData ?? []) as Expense[])
    setDefaultCurrency(currencyCodeFromSetting(String(settingsData?.default_currency ?? 'HK$')))
  }

  const dashboard = useMemo(() => {
    const paid = invoices.filter((invoice) => invoice.invoice_status === 'paid').reduce((sum, item) => sum + toNumber(item.invoice_amount), 0)
    const issued = invoices
      .filter((invoice) => invoice.invoice_status === 'issued' || invoice.invoice_status === 'sent_for_approval')
      .reduce((sum, item) => sum + toNumber(item.invoice_amount), 0)
    const draft = invoices.filter((invoice) => !invoice.invoice_status || invoice.invoice_status === 'draft').reduce((sum, item) => sum + toNumber(item.invoice_amount), 0)
    const overdueInvoices = invoices.filter((invoice) => invoice.invoice_status === 'overdue' || daysOverdue(invoice.invoice_due_date, invoice.invoice_status ?? 'draft') > 0)
    const overdueTotal = overdueInvoices.reduce((sum, item) => sum + toNumber(item.invoice_amount), 0)
    return { paid, issued, draft, overdueInvoices, overdueTotal }
  }, [invoices])

  const groupedInvoices = useMemo(() => {
    return receivableStatusOrder.map((status) => {
      const records = invoices
        .filter((invoice) => effectiveInvoiceStatus(invoice) === status)
        .sort((a, b) => String(b.invoice_date ?? b.created_at).localeCompare(String(a.invoice_date ?? a.created_at)))
      const total = records.reduce((sum, item) => sum + toNumber(item.invoice_amount || invoiceContentTotal(parseInvoice(item.content))), 0)
      return { status, records, total }
    }).filter((group) => showEmptyInvoiceStatuses || group.records.length > 0)
  }, [invoices, showEmptyInvoiceStatuses])

  const expenseRange = useMemo(() => {
    if (timeFilter === '全部') return null
    const end = new Date(today())
    const start = new Date(today())
    if (timeFilter === '最近7日') start.setDate(end.getDate() - 6)
    if (timeFilter === '最近14日') start.setDate(end.getDate() - 13)
    if (timeFilter === '最近30日') start.setDate(end.getDate() - 29)
    if (timeFilter === '本月') start.setDate(1)
    if (timeFilter === '自訂') return { start: customStart, end: customEnd }
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
  }, [customEnd, customStart, timeFilter])

  const filteredExpenses = useMemo(() => {
    if (!expenseRange) return expenses
    return expenses.filter((expense) => expense.date >= expenseRange.start && expense.date <= expenseRange.end)
  }, [expenses, expenseRange])

  const expenseSummary = useMemo(() => {
    const total = filteredExpenses.reduce((sum, item) => sum + toNumber(item.converted_amount ?? item.amount), 0)
    const byCategory = filteredExpenses.reduce<Record<string, number>>((acc, item) => {
      const category = item.category || '雜項'
      acc[category] = (acc[category] ?? 0) + toNumber(item.converted_amount ?? item.amount)
      return acc
    }, {})
    return { total, byCategory }
  }, [filteredExpenses])

  const groupedExpenses = useMemo(() => {
    return categories.map((category) => {
      const records = filteredExpenses
        .filter((expense) => (expense.category || '雜項') === category)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      const total = records.reduce((sum, item) => sum + toNumber(item.converted_amount ?? item.amount), 0)
      return { category, records, total }
    }).filter((group) => showEmptyExpenseCategories || group.records.length > 0)
  }, [filteredExpenses, showEmptyExpenseCategories])

  const monthlyData = useMemo(() => {
    const monthPrefix = `${reportYear}-${String(reportMonth).padStart(2, '0')}`
    const incomeInvoices = invoices.filter((invoice) => invoice.invoice_status === 'paid' && invoice.invoice_date?.startsWith(monthPrefix))
    const monthExpenses = expenses.filter((expense) => expense.date?.startsWith(monthPrefix))
    const income = incomeInvoices.reduce((sum, item) => sum + toNumber(item.invoice_amount), 0)
    const expenseTotal = monthExpenses.reduce((sum, item) => sum + toNumber(item.converted_amount ?? item.amount), 0)
    return { incomeInvoices, expenses: monthExpenses, income, expenseTotal, net: income - expenseTotal }
  }, [expenses, invoices, reportMonth, reportYear])

  async function updateInvoiceStatus(id: string, status: InvoiceStatus) {
    const { error } = await supabase.from('docs').update({ invoice_status: status }).eq('id', id)
    if (error) {
      window.alert(error.message)
      return
    }
    setInvoices((current) => current.map((invoice) => (invoice.id === id ? { ...invoice, invoice_status: status } : invoice)))
  }

  async function importInvoice(doc: FinanceDoc) {
    const invoice = parseInvoice(doc.content)
    const amount = invoice.lineItems.reduce((sum, item) => sum + toNumber(item.rate) * toNumber(item.quantity), 0)
    const discount = invoice.discount ? (invoice.discount.type === 'percentage' ? amount * (invoice.discount.value / 100) : invoice.discount.value) : 0
    const taxable = Math.max(0, amount - discount)
    const total = taxable + taxable * (toNumber(invoice.taxRate) / 100)
    const { data, error } = await supabase
      .from('docs')
      .update({
        invoice_amount: total,
        invoice_client: invoice.billedToName || null,
        invoice_date: invoice.invoiceDate || null,
        invoice_due_date: invoice.dueDate || null,
        invoice_currency: invoice.currency,
        invoice_status: doc.invoice_status ?? 'draft',
      })
      .eq('id', doc.id)
      .select()
      .single()
    if (error) {
      window.alert(error.message)
      return false
    }
    setInvoices((current) => current.map((item) => (item.id === doc.id ? (data as FinanceDoc) : item)))
    return true
  }

  async function handleReceiptUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    const maxBytes = 3 * 1024 * 1024
    const oversized = files.find((file) => file.type === 'application/pdf' && file.size > maxBytes)
    if (oversized) {
      window.alert(`${oversized.name} 太大，暫時支援 3MB 以下 PDF。請壓縮 PDF，或者截圖後用圖片上傳。`)
      event.target.value = ''
      return
    }
    const nextDrafts = await Promise.all(files.map(async (file) => {
      const dataUrl = await fileToDataUrl(file)
      return createExpenseDraft([dataUrl], defaultCurrency, [file.name])
    }))
    setReceiptDrafts((current) => [...current, ...nextDrafts])
    event.target.value = ''
  }

  async function analyseReceipts() {
    if (!receiptDrafts.length) return
    setAnalysingReceipts(true)
    try {
      const analysedGroups = await Promise.all(receiptDrafts.map(async (draft) => {
        const response = await fetch('/api/receipt-ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: draft.receiptImages[0], targetCurrency: defaultCurrency }),
        })
        const data = await readJsonResponse(response)
        if (!response.ok || data.error) throw new Error(data.error || 'Receipt analysis failed')
        const receipts = Array.isArray(data.receipts) ? data.receipts as ReceiptOcrResult[] : [data as ReceiptOcrResult]
        if (!receipts.length) return [draft]
        return Promise.all(receipts.map(async (receipt, index) => {
          const originalAmount = receipt.original_amount == null ? null : toNumber(receipt.original_amount)
          const originalCurrency = currencyCodeFromSetting(String(receipt.original_currency ?? draft.originalCurrency))
          const conversion = await convertExpenseAmount(
            originalCurrency,
            originalAmount,
            defaultCurrency,
            receipt.converted_amount == null ? null : toNumber(receipt.converted_amount),
            receipt.exchange_rate == null ? null : toNumber(receipt.exchange_rate),
          )
          return {
            ...draft,
            id: crypto.randomUUID(),
            merchant: receipt.merchant ? String(receipt.merchant) : draft.merchant,
            date: receipt.date ? String(receipt.date) : draft.date,
            description: Array.isArray(receipt.items) ? receipt.items.join(', ') : draft.description,
            originalAmount,
            originalCurrency,
            convertedAmount: conversion.convertedAmount,
            convertedCurrency: conversion.convertedCurrency,
            exchangeRate: conversion.exchangeRate,
            category: receipt.category ? String(receipt.category) : draft.category,
            notes: String(receipt.notes ?? draft.notes),
            aiMissingFields: [
              !receipt.merchant ? 'merchant' : '',
              !receipt.date ? 'date' : '',
              receipt.original_amount == null ? 'amount' : '',
              !receipt.category ? 'category' : '',
            ].filter(Boolean),
            conversionError: conversion.conversionError,
            sourceNames: receipts.length > 1 ? draft.sourceNames.map((name) => `${name} #${index + 1}`) : draft.sourceNames,
          }
        }))
      }))
      setReceiptDrafts(analysedGroups.flat())
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Receipt analysis failed')
    } finally {
      setAnalysingReceipts(false)
    }
  }

  async function saveAllExpenseDrafts() {
    for (const draft of receiptDrafts) {
      await saveExpenseDraft(draft)
    }
  }

  async function updateExpenseDraftAmount(id: string, originalCurrency: string, originalAmount: number | null) {
    const conversion = await convertExpenseAmount(originalCurrency, originalAmount, defaultCurrency)
    setReceiptDrafts((current) => current.map((draft) => draft.id === id
      ? {
        ...draft,
        originalCurrency: currencyCodeFromSetting(originalCurrency),
        originalAmount,
        convertedAmount: conversion.convertedAmount,
        convertedCurrency: conversion.convertedCurrency,
        exchangeRate: conversion.exchangeRate,
        conversionError: conversion.conversionError,
        aiMissingFields: originalAmount ? draft.aiMissingFields.filter((field) => field !== 'amount') : [...new Set([...draft.aiMissingFields, 'amount'])],
      }
      : draft))
  }

  async function saveExpenseDraft(draft: ExpenseDraft) {
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        date: draft.date,
        merchant: draft.merchant,
        description: draft.description,
        amount: draft.convertedAmount,
        original_amount: draft.originalAmount ?? 0,
        original_currency: draft.originalCurrency,
        converted_amount: draft.convertedAmount,
        converted_currency: draft.convertedCurrency,
        exchange_rate: draft.exchangeRate,
        category: draft.category,
        receipt_images: draft.receiptImages,
        ai_extracted: true,
        notes: draft.notes,
      })
      .select()
      .single()
    if (error) {
      window.alert(error.message)
      return
    }
    const savedExpense = data as Expense
    setExpenses((current) => [savedExpense, ...current])
    setTimeFilter('全部')
    setReceiptDrafts((current) => current.filter((item) => item.id !== draft.id))
  }

  async function deleteExpense(id: string) {
    if (!window.confirm('確定刪除此支出？')) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) {
      window.alert(error.message)
      return
    }
    setExpenses((current) => current.filter((item) => item.id !== id))
  }

  async function editExpense(expense: Expense) {
    const merchant = window.prompt('商店', expense.merchant ?? '') ?? expense.merchant ?? ''
    const description = window.prompt('描述', expense.description ?? '') ?? expense.description ?? ''
    const amountText = window.prompt('換算金額', String(expense.converted_amount ?? expense.amount ?? 0))
    const category = window.prompt('類別', expense.category ?? '雜項') ?? expense.category ?? '雜項'
    const amount = toNumber(amountText)
    const { data, error } = await supabase
      .from('expenses')
      .update({
        merchant,
        description,
        amount,
        converted_amount: amount,
        category,
      })
      .eq('id', expense.id)
      .select()
      .single()
    if (error) {
      window.alert(error.message)
      return
    }
    setExpenses((current) => current.map((item) => (item.id === expense.id ? data as Expense : item)))
  }

  function toggleExpenseCategory(category: string) {
    setExpandedExpenseCategories((current) => {
      const next = new Set(current)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  function toggleInvoiceStatusGroup(status: InvoiceStatus) {
    setExpandedInvoiceStatuses((current) => {
      const next = new Set(current)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  function toggleExpenseDescription(id: string) {
    setExpandedExpenseDescriptions((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function showAllInCategory(category: string) {
    setShowAllExpenseCategories((current) => new Set(current).add(category))
  }

  function expandAllExpenseCategories() {
    setExpandedExpenseCategories(new Set(categories))
  }

  function collapseAllExpenseCategories() {
    setExpandedExpenseCategories(new Set())
  }

  function expandAllInvoiceStatuses() {
    setExpandedInvoiceStatuses(new Set(receivableStatusOrder))
  }

  function collapseAllInvoiceStatuses() {
    setExpandedInvoiceStatuses(new Set())
  }

  function exportExcel() {
    const incomeSheet = monthlyData.incomeInvoices.map((invoice) => ({
      日期: invoice.invoice_date,
      描述: invoice.title,
      金額: invoice.invoice_amount,
      貨幣: invoice.invoice_currency,
      類別: '收入',
      狀態: invoice.invoice_status,
    }))
    const expenseSheet = monthlyData.expenses.map((expense) => ({
      日期: expense.date,
      描述: expense.description || expense.merchant,
      金額: expense.converted_amount ?? expense.amount,
      貨幣: expense.converted_currency || defaultCurrency,
      類別: expense.category,
      狀態: '支出',
    }))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(incomeSheet), '收入')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(expenseSheet), '支出')
    XLSX.writeFile(workbook, `financial-report-${reportYear}-${String(reportMonth).padStart(2, '0')}.xlsx`)
  }

  return (
    <DashboardShell activeSection="finance">
      <section className="finance-page">
        <header className="finance-header">
          <h1>財務概覽</h1>
          <p>Financial Overview</p>
        </header>

        <div className="finance-metric-grid">
          <FinanceMetric label="Paid / 已收款" amount={dashboard.paid} color="#22c55e" currency={defaultCurrency} />
          <FinanceMetric label="Issued / 已發出" amount={dashboard.issued} color="#7c3aed" currency={defaultCurrency} />
          <FinanceMetric label="Draft / 草稿" amount={dashboard.draft} color="#6b7280" currency={defaultCurrency} />
        </div>

        {dashboard.overdueInvoices.length > 0 && (
          <div className="finance-overdue-alert">
            ⚠️ {dashboard.overdueInvoices.length} 張發票已逾期，總金額 {money(defaultCurrency, dashboard.overdueTotal)}
          </div>
        )}

        <section className="finance-section">
          <div className="finance-section-head receivable-section-head">
            <div>
              <h2>應收帳款</h2>
              <p>Accounts Receivable</p>
            </div>
            <div className="receivable-controls">
              <button type="button" onClick={() => setShowEmptyInvoiceStatuses((current) => !current)}>
                {showEmptyInvoiceStatuses ? '隱藏空狀態' : '顯示空狀態'}
              </button>
              <button type="button" onClick={expandAllInvoiceStatuses}>全部展開</button>
              <button type="button" onClick={collapseAllInvoiceStatuses}>全部收合</button>
              <button className="finance-primary-button" type="button" onClick={() => setImportOpen(true)}>匯入發票</button>
            </div>
          </div>
          {dashboard.overdueInvoices.length > 0 && (
            <div className="receivable-overdue-alert">
              ⚠️ {dashboard.overdueInvoices.length} 張發票已逾期，總金額 {money(defaultCurrency, dashboard.overdueTotal)}
            </div>
          )}
          <div className="receivable-status-list">
            {groupedInvoices.map((group) => {
              const meta = statusMeta[group.status]
              const expanded = expandedInvoiceStatuses.has(group.status)
              return (
                <section className="receivable-status-section" key={group.status}>
                  <button className="receivable-status-header" type="button" onClick={() => toggleInvoiceStatusGroup(group.status)}>
                    <span className="receivable-status-title">
                      <StatusBadge status={group.status} />
                      <strong>{meta.label}</strong>
                      <small>({group.records.length})</small>
                    </span>
                    <span className="receivable-status-total">
                      {money(defaultCurrency, group.total)}
                      <i>{expanded ? '▼' : '▶'}</i>
                    </span>
                  </button>
                  {expanded && (
                    <div className="receivable-status-body">
                      {group.records.length === 0 && <div className="receivable-empty-row">未有記錄</div>}
                      {group.records.map((invoice) => {
                        const invoiceContent = parseInvoice(invoice.content)
                        const storedStatus = invoice.invoice_status ?? 'draft'
                        const effectiveStatus = effectiveInvoiceStatus(invoice)
                        const overdueDays = daysOverdue(invoice.invoice_due_date, storedStatus)
                        const invoiceNumber = invoiceContent.invoiceNumber || invoice.title || 'Invoice'
                        const invoiceDate = invoice.invoice_date || invoiceContent.invoiceDate || '-'
                        const dueDate = invoice.invoice_due_date || invoiceContent.dueDate || '-'
                        const client = invoice.invoice_client || invoiceContent.billedToName || '-'
                        const amount = toNumber(invoice.invoice_amount || invoiceContentTotal(invoiceContent))
                        const currency = invoice.invoice_currency || invoiceContent.currency || defaultCurrency
                        return (
                          <article className={`receivable-row-card ${effectiveStatus === 'overdue' ? 'receivable-row-overdue' : ''}`} key={invoice.id}>
                            <div className="receivable-row-number">
                              <a href={`/docs?open=${invoice.id}`}>{invoiceNumber}</a>
                              <span>{invoiceDate}</span>
                            </div>
                            <div className="receivable-row-client">
                              <strong>{client}</strong>
                              <span>到期日：{dueDate}</span>
                              {overdueDays > 0 && <em>逾期 {overdueDays} 天</em>}
                            </div>
                            <div className="receivable-row-amount">{money(currency, amount)}</div>
                            <div className="receivable-row-actions">
                              <select value={storedStatus} onChange={(event) => void updateInvoiceStatus(invoice.id, event.target.value as InvoiceStatus)}>
                                {Object.entries(statusMeta).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}
                              </select>
                              <a href={`/docs?open=${invoice.id}`}>開啟</a>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        </section>

        <section className="finance-section">
          <div className="finance-section-head">
            <div><h2>支出記錄</h2><p>Expenses</p></div>
          </div>
          <div className="finance-tabs">
            {timeFilters.map((filter) => <button key={filter} className={timeFilter === filter ? 'active' : ''} type="button" onClick={() => setTimeFilter(filter)}>{filter}</button>)}
          </div>
          {timeFilter === '自訂' && <div className="finance-date-range"><input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /><input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></div>}
          <div className="expense-summary">
            <strong>{money(defaultCurrency, expenseSummary.total)}</strong>
            <div className="expense-category-bars">
              {Object.entries(expenseSummary.byCategory).map(([category, amount]) => <CategoryBar key={category} category={category} amount={amount} total={expenseSummary.total} />)}
            </div>
          </div>
          <label className="receipt-upload-zone">
            <span>上傳收據（圖片或 PDF）</span>
            <input type="file" accept="image/*,application/pdf" multiple onChange={(event) => void handleReceiptUpload(event)} />
          </label>
          {receiptDrafts.length > 0 && (
            <div className="receipt-drafts">
              <div className="receipt-draft-actions">
                <button className="finance-primary-button" type="button" disabled={analysingReceipts} onClick={() => void analyseReceipts()}>{analysingReceipts ? '分析中...' : '✨ AI 分析收據'}</button>
                <button className="finance-secondary-button" type="button" onClick={() => void saveAllExpenseDrafts()}>全部儲存</button>
              </div>
              <div className="receipt-draft-grid">
                {receiptDrafts.map((draft, index) => <ExpenseDraftCard key={draft.id} draft={draft} index={index} defaultCurrency={defaultCurrency} onChange={(next) => setReceiptDrafts((current) => current.map((item) => item.id === draft.id ? next : item))} onAmountChange={(currency, amount) => void updateExpenseDraftAmount(draft.id, currency, amount)} onRemove={() => setReceiptDrafts((current) => current.filter((item) => item.id !== draft.id))} onSave={() => void saveExpenseDraft(draft)} />)}
              </div>
            </div>
          )}
          <div className="expense-list-tools">
            <button type="button" onClick={() => setShowEmptyExpenseCategories((current) => !current)}>{showEmptyExpenseCategories ? '隱藏空類別' : '顯示空類別'}</button>
            <button type="button" onClick={expandAllExpenseCategories}>全部展開</button>
            <button type="button" onClick={collapseAllExpenseCategories}>全部收合</button>
          </div>
          <div className="expense-category-list">
            {groupedExpenses.map((group) => {
              const expanded = expandedExpenseCategories.has(group.category)
              const showAll = showAllExpenseCategories.has(group.category)
              const visibleRecords = showAll ? group.records : group.records.slice(0, 3)
              const hiddenCount = Math.max(0, group.records.length - visibleRecords.length)
              return (
                <section className="expense-category-section" key={group.category}>
                  <button className="expense-category-header" type="button" onClick={() => toggleExpenseCategory(group.category)}>
                    <span className="expense-category-title">
                      <CategoryBadge category={group.category} />
                      <strong>{group.category}</strong>
                      <small>({group.records.length})</small>
                    </span>
                    <span className="expense-category-total">
                      {money(defaultCurrency, group.total)}
                      <i>{expanded ? '▼' : '▶'}</i>
                    </span>
                  </button>
                  {expanded && (
                    <div className="expense-category-body">
                      {visibleRecords.length === 0 && <div className="expense-empty-row">未有記錄</div>}
                      {visibleRecords.map((expense) => {
                        const description = expense.description || '-'
                        const isDescriptionExpanded = expandedExpenseDescriptions.has(expense.id)
                        const shouldTruncate = description.length > 60
                        const visibleDescription = !isDescriptionExpanded && shouldTruncate ? `${description.slice(0, 60)}...` : description
                        const convertedAmount = toNumber(expense.converted_amount ?? expense.amount)
                        const originalAmount = toNumber(expense.original_amount)
                        const originalCurrency = expense.original_currency || ''
                        const convertedCurrency = expense.converted_currency || defaultCurrency
                        const convertedCurrencyCode = currencyCodeFromSetting(convertedCurrency)
                        const originalCurrencyCode = originalCurrency || convertedCurrencyCode
                        const showConverted = Boolean(originalCurrencyCode) && originalCurrencyCode !== convertedCurrencyCode
                        return (
                          <article className="expense-row-card" key={expense.id}>
                            <div className="expense-row-meta">
                              <span>{expense.date}</span>
                              <strong>{expense.merchant || '-'}</strong>
                            </div>
                            <button className="expense-row-description" type="button" onClick={() => toggleExpenseDescription(expense.id)}>
                              {visibleDescription}
                            </button>
                            <div className="expense-row-amount">
                              {showConverted ? (
                                <span>{money(originalCurrencyCode, originalAmount)} → {money(convertedCurrency, convertedAmount)}</span>
                              ) : (
                                <strong>{money(convertedCurrency, convertedAmount)}</strong>
                              )}
                            </div>
                            <div className="expense-row-actions">
                              <button type="button" onClick={() => void editExpense(expense)}>編輯</button>
                              <button type="button" onClick={() => void deleteExpense(expense.id)}>刪除</button>
                            </div>
                          </article>
                        )
                      })}
                      {hiddenCount > 0 && <button className="expense-show-more" type="button" onClick={() => showAllInCategory(group.category)}>+ {hiddenCount} 條記錄</button>}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        </section>

        <section className="finance-section finance-report-section">
          <div className="finance-section-head">
            <div><h2>月結報告</h2><p>Monthly Report</p></div>
            <div className="finance-report-controls">
              <select value={reportYear} onChange={(event) => setReportYear(Number(event.target.value))}>{[2025, 2026, 2027].map((year) => <option key={year} value={year}>{year}</option>)}</select>
              <select value={reportMonth} onChange={(event) => setReportMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_, i) => i + 1).map((month) => <option key={month} value={month}>{month}</option>)}</select>
              <button className="finance-primary-button" type="button">生成報告</button>
              <button className="finance-secondary-button" type="button" onClick={() => window.print()}>匯出 PDF</button>
              <button className="finance-secondary-button" type="button" onClick={exportExcel}>匯出 Excel</button>
            </div>
          </div>
          <div className="monthly-report-card">
            <div><span>收入</span><strong>{money(defaultCurrency, monthlyData.income)}</strong></div>
            <div><span>支出</span><strong>{money(defaultCurrency, monthlyData.expenseTotal)}</strong></div>
            <div><span>淨額</span><strong>{money(defaultCurrency, monthlyData.net)}</strong></div>
          </div>
        </section>

        {importOpen && <InvoiceImportModal invoices={invoices} onClose={() => setImportOpen(false)} onImport={importInvoice} defaultCurrency={defaultCurrency} />}
      </section>
    </DashboardShell>
  )
}

function createExpenseDraft(files: string[], currency: string, sourceNames: string[] = []): ExpenseDraft {
  const code = currencyCodeFromSetting(currency)
  return { id: crypto.randomUUID(), receiptImages: files, sourceNames, merchant: '', date: today(), description: '', originalAmount: null, originalCurrency: code, convertedAmount: 0, convertedCurrency: code, exchangeRate: 1, category: '雜項', notes: '', aiMissingFields: ['merchant', 'amount', 'category'], conversionError: false }
}

function FinanceMetric({ label, amount, color, currency }: { label: string; amount: number; color: string; currency: string }) {
  return <div className="finance-metric-card"><strong style={{ color }}>{money(currency, amount)}</strong><span>{label}</span></div>
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const meta = statusMeta[status]
  return <span className="finance-status-badge" style={{ background: meta.color }}>{meta.label}</span>
}

function CategoryBadge({ category }: { category: string }) {
  return <span className="expense-category-badge" style={{ background: categoryColors[category] ?? '#6b7280' }}>{category}</span>
}

function CategoryBar({ category, amount, total }: { category: string; amount: number; total: number }) {
  return <div className="expense-category-bar"><span>{category}</span><div><i style={{ width: `${total ? (amount / total) * 100 : 0}%`, background: categoryColors[category] ?? '#6b7280' }} /></div><em>{money('', amount)}</em></div>
}

function ExpenseDraftCard({ draft, index, defaultCurrency, onChange, onAmountChange, onRemove, onSave }: { draft: ExpenseDraft; index: number; defaultCurrency: string; onChange: (draft: ExpenseDraft) => void; onAmountChange: (currency: string, amount: number | null) => void; onRemove: () => void; onSave: () => void }) {
  const missing = new Set(draft.aiMissingFields)
  const defaultCode = currencyCodeFromSetting(defaultCurrency)
  const hasConversion = Boolean(draft.originalAmount) && draft.originalCurrency !== defaultCode && !draft.conversionError && draft.exchangeRate
  return (
    <article className="expense-draft-card">
      <header className="expense-draft-head">
        <strong>收據 {index + 1}</strong>
        <CategoryBadge category={draft.category || '雜項'} />
        <button type="button" onClick={onRemove}>移除</button>
      </header>
      {draft.sourceNames.length > 0 && <small className="receipt-source-name">{draft.sourceNames.join(', ')}</small>}
      <div className={draft.receiptImages.length > 1 ? 'receipt-preview-row' : 'receipt-full-preview'}>
        {draft.receiptImages.map((file) => file.startsWith('data:application/pdf')
          ? <div className="receipt-pdf-thumb" key={file}>PDF</div>
          : <img key={file} src={file} alt="" />)}
      </div>
      <div>
        <input value={draft.merchant} placeholder="商店" onChange={(event) => onChange({ ...draft, merchant: event.target.value, aiMissingFields: event.target.value ? draft.aiMissingFields.filter((field) => field !== 'merchant') : [...new Set([...draft.aiMissingFields, 'merchant'])] })} />
        {missing.has('merchant') && <FieldWarning />}
      </div>
      <div>
        <input type="date" value={draft.date} onChange={(event) => onChange({ ...draft, date: event.target.value, aiMissingFields: event.target.value ? draft.aiMissingFields.filter((field) => field !== 'date') : [...new Set([...draft.aiMissingFields, 'date'])] })} />
        {missing.has('date') && <FieldWarning />}
      </div>
      <input value={draft.description} placeholder="描述" onChange={(event) => onChange({ ...draft, description: event.target.value })} />
      <div>
        <div className="expense-amount-row">
          <select value={draft.originalCurrency} onChange={(event) => onAmountChange(event.target.value, draft.originalAmount)}>
            {currencyOptions.map((currency) => <option key={currency.code} value={currency.code}>{currency.label}</option>)}
          </select>
          <input type="number" value={draft.originalAmount ?? ''} placeholder="0.00" onChange={(event) => onAmountChange(draft.originalCurrency, event.target.value ? Number(event.target.value) : null)} />
        </div>
        {missing.has('amount') && <div className="expense-field-warning">⚠️ AI 未能讀取金額，請手動輸入</div>}
        {hasConversion && (
          <div className="expense-conversion-note">
            ≈ {money(defaultCode, draft.convertedAmount)}（匯率: 1 {draft.originalCurrency} = {Number(draft.exchangeRate).toFixed(4)} {defaultCode}）
          </div>
        )}
        {draft.conversionError && (
          <div className="expense-field-warning">
            ⚠️ 匯率獲取失敗，請手動輸入換算金額
            <input type="number" value={draft.convertedAmount || ''} placeholder="換算金額" onChange={(event) => onChange({ ...draft, convertedAmount: Number(event.target.value || 0), convertedCurrency: defaultCode, exchangeRate: null })} />
          </div>
        )}
      </div>
      <div>
        <select value={draft.category} onChange={(event) => onChange({ ...draft, category: event.target.value, aiMissingFields: event.target.value ? draft.aiMissingFields.filter((field) => field !== 'category') : [...new Set([...draft.aiMissingFields, 'category'])] })}>{categories.map((category) => <option key={category}>{category}</option>)}</select>
        {missing.has('category') && <FieldWarning />}
      </div>
      <strong>
        {draft.originalAmount
          ? (draft.originalCurrency !== defaultCode ? `${money(draft.originalCurrency, draft.originalAmount)} → ${money(defaultCode, draft.convertedAmount)}` : money(defaultCode, draft.convertedAmount))
          : '未輸入金額'}
      </strong>
      <button className="finance-primary-button" type="button" disabled={!draft.originalAmount} onClick={onSave}>確認並儲存</button>
    </article>
  )
}

function FieldWarning() {
  return <div className="expense-field-warning">⚠️ AI 未能識別，請手動填寫</div>
}

function InvoiceImportModal({ invoices, onClose, onImport, defaultCurrency }: { invoices: FinanceDoc[]; onClose: () => void; onImport: (invoice: FinanceDoc) => Promise<boolean>; defaultCurrency: string }) {
  const [importingId, setImportingId] = useState<string | null>(null)

  async function handleImport(invoice: FinanceDoc) {
    setImportingId(invoice.id)
    const imported = await onImport(invoice)
    setImportingId(null)
    if (imported) onClose()
  }

  return (
    <div className="finance-modal-backdrop">
      <div className="finance-modal">
        <header><h2>匯入發票</h2><button type="button" onClick={onClose}>關閉</button></header>
        {invoices.map((invoice) => {
          const invoiceContent = parseInvoice(invoice.content)
          const invoiceNumber = invoiceContent.invoiceNumber || invoice.title
          const client = invoice.invoice_client || invoiceContent.billedToName || '-'
          const amount = invoice.invoice_amount || invoiceContent.lineItems.reduce((sum, item) => sum + toNumber(item.rate) * toNumber(item.quantity), 0)
          const currency = invoice.invoice_currency || invoiceContent.currency || defaultCurrency
          return (
            <div key={invoice.id} className="finance-import-row">
              <span>
                <strong>{invoiceNumber}</strong>
                <small>{invoice.title}</small>
              </span>
              <span>{client}</span>
              <span>{money(currency, toNumber(amount))}</span>
              <button type="button" disabled={importingId === invoice.id} onClick={() => void handleImport(invoice)}>
                {importingId === invoice.id ? 'Importing...' : 'Import'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
