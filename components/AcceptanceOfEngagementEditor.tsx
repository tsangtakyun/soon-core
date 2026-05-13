'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { CoreDoc } from '@/lib/types'

type Lang = 'zh' | 'en'
type RateType = 'Monthly' | 'One-off' | 'Per project'

type AcceptanceContent = {
  language: Lang
  title: string
  post: string
  date: string
  rateType: RateType
  currency: string
  amount: number
  payeeEnglishName: string
  payeeChineseName: string
  payeeIdCard: string
  payeeAddress: string
  contactNumber: string
  email: string
  bankName: string
  accountName: string
  accountNumber: string
  legalClause: string
  paymentTerms: string
  authorizedName: string
  authorizedDate: string
  payeeSignatureName: string
  payeeSignatureDate: string
  createdAt: string
  updatedAt: string
}

type SettingsSnapshot = {
  companyName: string
  logoBase64: string
  signatureBase64: string
  authorizedName: string
  defaultCurrency: string
}

type Props = {
  doc: CoreDoc
  onBack: () => void
  onSaved: (doc: CoreDoc) => void
}

const langStorageKey = 'soon-acceptance-lang'
const currencies = ['HK$', 'USD $', 'GBP £', 'EUR €', 'SGD $', 'TWD NT$', 'CNY ¥']

const copy = {
  zh: {
    back: '← 文件中心',
    chinese: '中文',
    english: 'English',
    pdf: '匯出 PDF',
    word: '匯出 Word',
    save: 'Save',
    saved: '已儲存',
    title: '聘用確認書',
    post: '職位',
    postPlaceholder: '例：Creative / Director / Editor',
    date: '日期',
    rate: '薪酬',
    Monthly: '月薪',
    'One-off': '一次性',
    'Per project': '按項目',
    payeeEnglishName: '收款人英文姓名',
    payeeChineseName: '收款人中文姓名',
    payeeIdCard: '身份證號碼',
    payeeAddress: '收款人地址',
    contactNumber: '聯絡電話',
    email: 'Email',
    bankName: '銀行名稱',
    accountName: '戶口名稱',
    accountNumber: '戶口號碼',
    totalAmount: '總金額',
    authorizedSignature: '授權簽署',
    payeeSignature: '收款人簽署',
    name: '姓名',
  },
  en: {
    back: '← Docs Center',
    chinese: '中文',
    english: 'English',
    pdf: 'Export PDF',
    word: 'Export Word',
    save: 'Save',
    saved: 'Saved',
    title: 'Acceptance of Engagement',
    post: 'Post',
    postPlaceholder: 'e.g. Creative / Director / Editor',
    date: 'Date',
    rate: 'Rate',
    Monthly: 'Monthly',
    'One-off': 'One-off',
    'Per project': 'Per project',
    payeeEnglishName: 'Name of Payee in English',
    payeeChineseName: 'Name of Payee in Chinese',
    payeeIdCard: "Payee's ID card",
    payeeAddress: "Payee's address",
    contactNumber: 'Contact number',
    email: 'Email',
    bankName: 'Bank Name',
    accountName: 'Account Name',
    accountNumber: 'Account Number',
    totalAmount: 'Total Amount',
    authorizedSignature: 'Authorized Signature',
    payeeSignature: 'Payee Signature',
    name: 'Name',
  },
} as const

function today() {
  return new Date().toISOString().slice(0, 10)
}

function defaultLegalClause(companyName: string) {
  return `*This letter served as an agreement between ${companyName} (the payer) and the payee. The copyright of all recorded materials was belonged to ${companyName}. The payee signed this engagement form for proving that he/she accepted all of the above terms & conditions.`
}

export function createEmptyAcceptance(language: Lang = 'en'): AcceptanceContent {
  const now = new Date().toISOString()
  return {
    language,
    title: language === 'zh' ? '聘用確認書' : 'Acceptance of Engagement',
    post: '',
    date: today(),
    rateType: 'Monthly',
    currency: 'HK$',
    amount: 0,
    payeeEnglishName: '',
    payeeChineseName: '',
    payeeIdCard: '',
    payeeAddress: '',
    contactNumber: '',
    email: '',
    bankName: '',
    accountName: '',
    accountNumber: '',
    legalClause: defaultLegalClause('SOON Studio'),
    paymentTerms: "Payment in cheque will be posted to the Payee's Address after 8-10 weeks of job completion.",
    authorizedName: 'Tommy',
    authorizedDate: today(),
    payeeSignatureName: '',
    payeeSignatureDate: '',
    createdAt: now,
    updatedAt: now,
  }
}

function parseAcceptance(content: string | null, fallbackLanguage: Lang) {
  if (!content) return createEmptyAcceptance(fallbackLanguage)
  try {
    const parsed = JSON.parse(content) as Partial<AcceptanceContent>
    const fallback = createEmptyAcceptance(fallbackLanguage)
    return {
      ...fallback,
      ...parsed,
      language: parsed.language === 'zh' || parsed.language === 'en' ? parsed.language : fallbackLanguage,
      rateType: parsed.rateType === 'Monthly' || parsed.rateType === 'One-off' || parsed.rateType === 'Per project' ? parsed.rateType : 'Monthly',
    }
  } catch {
    return createEmptyAcceptance(fallbackLanguage)
  }
}

function getStoredLanguage(): Lang {
  if (typeof window === 'undefined') return 'en'
  return window.localStorage.getItem(langStorageKey) === 'zh' ? 'zh' : 'en'
}

export function AcceptanceOfEngagementEditor({ doc, onBack, onSaved }: Props) {
  const [content, setContent] = useState<AcceptanceContent>(() => parseAcceptance(doc.content, getStoredLanguage()))
  const [settings, setSettings] = useState<SettingsSnapshot>({
    companyName: 'SOON Studio',
    logoBase64: '',
    signatureBase64: '',
    authorizedName: 'Tommy',
    defaultCurrency: 'HK$',
  })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const t = copy[content.language]

  const ratePreview = useMemo(
    () => `${t[content.rateType]}(${content.currency}${money(content.amount)})`,
    [content.amount, content.currency, content.rateType, t],
  )

  useEffect(() => {
    void loadSettings()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => void save(false), 30000)
    return () => window.clearInterval(timer)
  })

  async function loadSettings() {
    const { data } = await supabase.from('settings').select('*').eq('user_id', 'tommy').maybeSingle()
    if (!data) return
    const companyName = String(data.company_name ?? 'SOON Studio')
    const defaultCurrency = String(data.default_currency ?? 'HK$')
    const authorizedName = String(data.authorized_name ?? 'Tommy')
    setSettings({
      companyName,
      logoBase64: String(data.logo_base64 ?? ''),
      signatureBase64: String(data.signature_base64 ?? ''),
      authorizedName,
      defaultCurrency,
    })
    setContent((current) => ({
      ...current,
      currency: current.currency || defaultCurrency,
      authorizedName: current.authorizedName || authorizedName,
      legalClause:
        !current.legalClause || current.legalClause.includes('SOON Studio')
          ? defaultLegalClause(companyName)
          : current.legalClause,
    }))
  }

  function update<K extends keyof AcceptanceContent>(key: K, value: AcceptanceContent[K]) {
    setSaved(false)
    setContent((current) => ({ ...current, [key]: value }))
  }

  function setLanguage(language: Lang) {
    window.localStorage.setItem(langStorageKey, language)
    setContent((current) => ({ ...current, language, title: current.title || copy[language].title }))
  }

  async function save(showIndicator = true) {
    setSaving(true)
    const next = { ...content, updatedAt: new Date().toISOString() }
    const { data, error } = await supabase
      .from('docs')
      .update({ title: next.title || t.title, content: JSON.stringify(next) })
      .eq('id', doc.id)
      .select()
      .single()
    setSaving(false)
    if (error) {
      if (showIndicator) window.alert(error.message)
      return
    }
    setContent(next)
    setSaved(true)
    onSaved(data as CoreDoc)
  }

  function exportWord() {
    const html = buildWordHtml(content, settings, t, ratePreview)
    const blob = new Blob([html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${content.payeeEnglishName || 'acceptance-of-engagement'}.doc`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="doc-editor-shell acceptance-editor">
      <div className="doc-toolbar soon-no-print acceptance-toolbar">
        <button type="button" onClick={onBack}>{t.back}</button>
        <div className="doc-language-toggle">
          {(['zh', 'en'] as Lang[]).map((language) => (
            <button key={language} className={content.language === language ? 'active' : ''} type="button" onClick={() => setLanguage(language)}>
              {language === 'zh' ? t.chinese : t.english}
            </button>
          ))}
        </div>
        <div className="toolbar-spacer" />
        <button className="doc-export-dark" type="button" onClick={() => window.print()}>{t.pdf}</button>
        <button className="doc-export-blue" type="button" onClick={exportWord}>{t.word}</button>
        <button className="doc-save-button" type="button" onClick={() => void save()}>{saving ? 'Saving...' : t.save}</button>
        {saved && <span className="doc-saved-indicator">{t.saved}</span>}
      </div>

      <article className="acceptance-doc soon-print-doc">
        {settings.logoBase64 ? <img className="acceptance-logo" src={settings.logoBase64} alt="Company logo" /> : <div className="acceptance-company">{settings.companyName}</div>}
        <input className="acceptance-title" value={content.title} onChange={(event) => update('title', event.target.value)} />

        <section className="acceptance-top-info">
          <label>{t.post}: <input value={content.post} placeholder={t.postPlaceholder} onChange={(event) => update('post', event.target.value)} /></label>
          <label>{t.date}: <input type="date" value={content.date} onChange={(event) => update('date', event.target.value)} /></label>
          <label>
            {t.rate}:
            <div className="acceptance-rate-row">
              <select value={content.rateType} onChange={(event) => update('rateType', event.target.value as RateType)}>
                {(['Monthly', 'One-off', 'Per project'] as RateType[]).map((option) => <option key={option} value={option}>{t[option]}</option>)}
              </select>
              <select value={content.currency} onChange={(event) => update('currency', event.target.value)}>
                {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                {!currencies.includes(settings.defaultCurrency) && <option value={settings.defaultCurrency}>{settings.defaultCurrency}</option>}
              </select>
              <input type="number" min="0" value={content.amount} onChange={(event) => update('amount', Number(event.target.value || 0))} />
              <strong>{ratePreview}</strong>
            </div>
          </label>
        </section>

        <table className="acceptance-info-table">
          <tbody>
            <InfoRow label={t.payeeEnglishName}><input value={content.payeeEnglishName} onChange={(event) => update('payeeEnglishName', event.target.value)} /></InfoRow>
            <InfoRow label={t.payeeChineseName}><input value={content.payeeChineseName} onChange={(event) => update('payeeChineseName', event.target.value)} /></InfoRow>
            <InfoRow label={t.payeeIdCard}><input value={content.payeeIdCard} onChange={(event) => update('payeeIdCard', event.target.value)} /></InfoRow>
            <InfoRow label={t.payeeAddress}><input value={content.payeeAddress} onChange={(event) => update('payeeAddress', event.target.value)} /></InfoRow>
            <InfoRow label={t.contactNumber}><input value={content.contactNumber} onChange={(event) => update('contactNumber', event.target.value)} /></InfoRow>
            <InfoRow label={t.email}><input value={content.email} onChange={(event) => update('email', event.target.value)} /></InfoRow>
            <InfoRow label={t.bankName}><input value={content.bankName} onChange={(event) => update('bankName', event.target.value)} /></InfoRow>
            <InfoRow label={t.accountName}><input value={content.accountName} onChange={(event) => update('accountName', event.target.value)} /></InfoRow>
            <InfoRow label={t.accountNumber}><input value={content.accountNumber} onChange={(event) => update('accountNumber', event.target.value)} /></InfoRow>
          </tbody>
        </table>

        <textarea className="acceptance-legal" value={content.legalClause} onChange={(event) => update('legalClause', event.target.value)} />
        <textarea className="acceptance-payment" value={content.paymentTerms} onChange={(event) => update('paymentTerms', event.target.value)} />

        <table className="acceptance-total-table">
          <tbody>
            <tr>
              <th>{t.totalAmount}</th>
              <td>{content.currency}{money(content.amount)}</td>
            </tr>
          </tbody>
        </table>

        <section className="quotation-signatures acceptance-signatures">
          <SignatureBlock
            title={t.authorizedSignature}
            signatureBase64={settings.signatureBase64}
            nameLabel={t.name}
            dateLabel={t.date}
            name={content.authorizedName}
            date={content.authorizedDate}
            onName={(value) => update('authorizedName', value)}
            onDate={(value) => update('authorizedDate', value)}
          />
          <SignatureBlock
            title={t.payeeSignature}
            nameLabel={t.name}
            dateLabel={t.date}
            name={content.payeeSignatureName}
            date={content.payeeSignatureDate}
            onName={(value) => update('payeeSignatureName', value)}
            onDate={(value) => update('payeeSignatureDate', value)}
          />
        </section>
      </article>
    </section>
  )
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr>
      <th>{label}</th>
      <td>{children}</td>
    </tr>
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
      <div className="sig-title">{title}</div>
      <div className="sig-image-area">
        {signatureBase64 && <img className="quotation-signature-image signature-img" src={signatureBase64} alt="" />}
      </div>
      <div className="sig-line" />
      <label className="sig-name">{nameLabel}: <input value={name} onChange={(event) => onName(event.target.value)} /></label>
      <label className="sig-date">{dateLabel}: <input type="date" value={date} onChange={(event) => onDate(event.target.value)} /></label>
    </div>
  )
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildWordHtml(content: AcceptanceContent, settings: SettingsSnapshot, t: (typeof copy)[Lang], ratePreview: string) {
  const rows = [
    [t.payeeEnglishName, content.payeeEnglishName],
    [t.payeeChineseName, content.payeeChineseName],
    [t.payeeIdCard, content.payeeIdCard],
    [t.payeeAddress, content.payeeAddress],
    [t.contactNumber, content.contactNumber],
    [t.email, content.email],
    [t.bankName, content.bankName],
    [t.accountName, content.accountName],
    [t.accountNumber, content.accountNumber],
  ].map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')
  const signature = settings.signatureBase64 ? `<img src="${settings.signatureBase64}" style="max-width:240px;max-height:100px">` : ''
  return `<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:40px;color:#1a1a1a}h1{text-align:center;text-decoration:underline;font-size:20px}table{border-collapse:collapse;width:100%;margin:20px 0}th,td{border:1px solid #1a1a1a;padding:8px 12px;font-size:13px;text-align:left}th{width:200px;background:#f9f9f9}.legal{font-size:12px;color:#555;font-style:italic;white-space:pre-wrap}.sig{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:48px}.line{border-top:1px solid #1a1a1a;margin:28px 0 10px}</style></head><body>
${settings.logoBase64 ? `<img src="${settings.logoBase64}" style="max-width:120px;max-height:60px">` : `<strong>${escapeHtml(settings.companyName)}</strong>`}
<h1>${escapeHtml(content.title)}</h1>
<p><strong>${t.post}:</strong> ${escapeHtml(content.post)}<br><strong>${t.date}:</strong> ${content.date}<br><strong>${t.rate}:</strong> ${escapeHtml(ratePreview)}</p>
<table>${rows}</table>
<p class="legal">${escapeHtml(content.legalClause)}</p>
<p>${escapeHtml(content.paymentTerms)}</p>
<table><tr><th>${t.totalAmount}</th><td style="font-size:20px;font-weight:bold">${content.currency}${money(content.amount)}</td></tr></table>
<div class="sig"><div><h3>${t.authorizedSignature}</h3>${signature}<div class="line"></div><p>${t.name}: ${escapeHtml(content.authorizedName)}<br>${t.date}: ${content.authorizedDate}</p></div><div><h3>${t.payeeSignature}</h3><div class="line"></div><p>${t.name}: ${escapeHtml(content.payeeSignatureName)}<br>${t.date}: ${content.payeeSignatureDate}</p></div></div>
</body></html>`
}
