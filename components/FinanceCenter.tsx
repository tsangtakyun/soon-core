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
  originalAmount: number
  originalCurrency: string
  convertedAmount: number
  convertedCurrency: string
  exchangeRate: number
  category: string
  notes: string
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

const statusOptions: Array<{ value: InvoiceStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'draft', label: 'Draft' },
  { value: 'issued', label: 'Issued' },
  { value: 'sent_for_approval', label: 'Sent for Approval' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
]

const statusMeta: Record<InvoiceStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#6b7280' },
  issued: { label: 'Issued', color: '#3b82f6' },
  sent_for_approval: { label: 'Sent for Approval', color: '#f59e0b' },
  paid: { label: 'Paid', color: '#22c55e' },
  overdue: { label: 'Overdue', color: '#ef4444' },
}

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

function today() {
  return new Date().toISOString().slice(0, 10)
}

function money(currency: string, value: number) {
  return `${currency}${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)}`
}

function toNumber(value: unknown) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
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

export function FinanceCenter() {
  const [invoices, setInvoices] = useState<FinanceDoc[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [defaultCurrency, setDefaultCurrency] = useState('HK$')
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all')
  const [importOpen, setImportOpen] = useState(false)
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
    setDefaultCurrency(String(settingsData?.default_currency ?? 'HK$'))
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

  const filteredInvoices = useMemo(() => {
    if (statusFilter === 'all') return invoices
    return invoices.filter((invoice) => (invoice.invoice_status ?? 'draft') === statusFilter)
  }, [invoices, statusFilter])

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
      return
    }
    setInvoices((current) => current.map((item) => (item.id === doc.id ? (data as FinanceDoc) : item)))
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
        return receipts.map((receipt, index) => ({
          ...draft,
          id: crypto.randomUUID(),
          merchant: String(receipt.merchant ?? draft.merchant),
          date: String(receipt.date ?? draft.date),
          description: Array.isArray(receipt.items) ? receipt.items.join(', ') : draft.description,
          originalAmount: toNumber(receipt.original_amount ?? draft.originalAmount),
          originalCurrency: String(receipt.original_currency ?? draft.originalCurrency),
          convertedAmount: toNumber(receipt.converted_amount ?? receipt.original_amount ?? draft.convertedAmount),
          convertedCurrency: String(receipt.converted_currency ?? defaultCurrency),
          exchangeRate: toNumber(receipt.exchange_rate ?? 1),
          category: String(receipt.category ?? draft.category),
          notes: String(receipt.notes ?? draft.notes),
          sourceNames: receipts.length > 1 ? draft.sourceNames.map((name) => `${name} #${index + 1}`) : draft.sourceNames,
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

  async function saveExpenseDraft(draft: ExpenseDraft) {
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        date: draft.date,
        merchant: draft.merchant,
        description: draft.description,
        amount: draft.convertedAmount,
        original_amount: draft.originalAmount,
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
          <div className="finance-section-head">
            <div>
              <h2>應收帳款</h2>
              <p>Accounts Receivable</p>
            </div>
            <button className="finance-primary-button" type="button" onClick={() => setImportOpen(true)}>匯入發票</button>
          </div>
          <div className="finance-tabs">
            {statusOptions.map((status) => {
              const count = status.value === 'all' ? invoices.length : invoices.filter((invoice) => (invoice.invoice_status ?? 'draft') === status.value).length
              return <button key={status.value} className={statusFilter === status.value ? 'active' : ''} type="button" onClick={() => setStatusFilter(status.value)}>{status.label}<span>{count}</span></button>
            })}
          </div>
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead><tr><th>發票號碼</th><th>客戶</th><th>金額</th><th>發票日期</th><th>到期日</th><th>狀態</th><th>逾期天數</th><th>操作</th></tr></thead>
              <tbody>
                {filteredInvoices.map((invoice) => {
                  const status = invoice.invoice_status ?? 'draft'
                  const overdueDays = daysOverdue(invoice.invoice_due_date, status)
                  return (
                    <tr key={invoice.id}>
                      <td>{invoice.title}</td>
                      <td>{invoice.invoice_client || '-'}</td>
                      <td>{money(invoice.invoice_currency || defaultCurrency, toNumber(invoice.invoice_amount))}</td>
                      <td>{invoice.invoice_date || '-'}</td>
                      <td>{invoice.invoice_due_date || '-'}</td>
                      <td><StatusBadge status={status} /></td>
                      <td className={overdueDays > 0 ? 'overdue-days' : ''}>{overdueDays || '-'}</td>
                      <td className="finance-actions">
                        <select value={status} onChange={(event) => void updateInvoiceStatus(invoice.id, event.target.value as InvoiceStatus)}>
                          {Object.entries(statusMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                        </select>
                        <a href={`/docs?open=${invoice.id}`}>開啟</a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
                {receiptDrafts.map((draft, index) => <ExpenseDraftCard key={draft.id} draft={draft} index={index} onChange={(next) => setReceiptDrafts((current) => current.map((item) => item.id === draft.id ? next : item))} onRemove={() => setReceiptDrafts((current) => current.filter((item) => item.id !== draft.id))} onSave={() => void saveExpenseDraft(draft)} />)}
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
                        const showConverted = Boolean(originalCurrency) && originalCurrency !== convertedCurrency
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
                              <span>{originalCurrency}{money('', originalAmount)}</span>
                              {showConverted && <strong>{money(convertedCurrency, convertedAmount)}</strong>}
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

        {importOpen && <InvoiceImportModal invoices={invoices} onClose={() => setImportOpen(false)} onImport={(invoice) => void importInvoice(invoice)} defaultCurrency={defaultCurrency} />}
      </section>
    </DashboardShell>
  )
}

function createExpenseDraft(files: string[], currency: string, sourceNames: string[] = []): ExpenseDraft {
  return { id: crypto.randomUUID(), receiptImages: files, sourceNames, merchant: '', date: today(), description: '', originalAmount: 0, originalCurrency: currency.replace('$', '').trim() || 'HKD', convertedAmount: 0, convertedCurrency: currency, exchangeRate: 1, category: '雜項', notes: '' }
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

function ExpenseDraftCard({ draft, index, onChange, onRemove, onSave }: { draft: ExpenseDraft; index: number; onChange: (draft: ExpenseDraft) => void; onRemove: () => void; onSave: () => void }) {
  return (
    <article className="expense-draft-card">
      <header className="expense-draft-head">
        <strong>收據 {index + 1}</strong>
        <CategoryBadge category={draft.category || '雜項'} />
        <button type="button" onClick={onRemove}>移除</button>
      </header>
      {draft.sourceNames.length > 0 && <small className="receipt-source-name">{draft.sourceNames.join(', ')}</small>}
      <div className="receipt-thumb-grid">
        {draft.receiptImages.map((file) => file.startsWith('data:application/pdf')
          ? <div className="receipt-pdf-thumb" key={file}>PDF</div>
          : <img key={file} src={file} alt="" />)}
      </div>
      <input value={draft.merchant} placeholder="商店" onChange={(event) => onChange({ ...draft, merchant: event.target.value })} />
      <input type="date" value={draft.date} onChange={(event) => onChange({ ...draft, date: event.target.value })} />
      <input value={draft.description} placeholder="描述" onChange={(event) => onChange({ ...draft, description: event.target.value })} />
      <input type="number" value={draft.originalAmount} onChange={(event) => onChange({ ...draft, originalAmount: Number(event.target.value || 0) })} />
      <select value={draft.category} onChange={(event) => onChange({ ...draft, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select>
      <strong>{money(draft.convertedCurrency, draft.convertedAmount)}</strong>
      <button className="finance-primary-button" type="button" onClick={onSave}>確認並儲存</button>
    </article>
  )
}

function InvoiceImportModal({ invoices, onClose, onImport, defaultCurrency }: { invoices: FinanceDoc[]; onClose: () => void; onImport: (invoice: FinanceDoc) => void; defaultCurrency: string }) {
  return (
    <div className="finance-modal-backdrop">
      <div className="finance-modal">
        <header><h2>匯入發票</h2><button type="button" onClick={onClose}>關閉</button></header>
        {invoices.map((invoice) => (
          <div key={invoice.id} className="finance-import-row">
            <span>{invoice.title}</span><span>{invoice.invoice_client || '-'}</span><span>{money(invoice.invoice_currency || defaultCurrency, toNumber(invoice.invoice_amount))}</span>
            <button type="button" onClick={() => onImport(invoice)}>Import</button>
          </div>
        ))}
      </div>
    </div>
  )
}
