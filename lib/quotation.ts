import {
  buildInvoiceNumber,
  createEmptyInvoice,
  defaultSettings,
  nextInvoiceSequence,
  normaliseCurrency,
  type InvoiceCurrency,
  type InvoiceDiscount,
  type InvoiceSettings,
} from '@/lib/invoice'

export type QuotationLanguage = 'zh' | 'en'

export type QuotationItem = {
  id: string
  deliverable: string
  details: string
  cost: number
}

export type QuotationContent = {
  language: QuotationLanguage
  currency: InvoiceCurrency
  logoDataUrl: string
  companyName: string
  email: string
  phone: string
  address: string
  quoteNumber: string
  quoteDate: string
  validUntil: string
  invoiceNumber: string
  clientCompany: string
  attention: string
  clientAddress: string
  clientPhone: string
  clientEmail: string
  projectName: string
  items: QuotationItem[]
  discount: InvoiceDiscount | null
  taxRate: number
  paymentTerms: string
  authorizedName: string
  authorizedDate: string
  clientSignatureName: string
  clientSignatureDate: string
  updatedAt?: string
}

export type QuotationSettings = InvoiceSettings & {
  quote_prefix: string
  quote_current_number: number
  cheque_payable_to: string
  cheque_address: string
  fps_id: string
  paypal_email: string
  payment_days: number
  interest_rate: number
  authorized_name: string
  bank_transfer_enabled: boolean
  cheque_enabled: boolean
  fps_enabled: boolean
  paypal_enabled: boolean
}

export const defaultQuotationSettings: QuotationSettings = {
  ...defaultSettings,
  quote_prefix: 'QUO',
  quote_current_number: 0,
  cheque_payable_to: '',
  cheque_address: '',
  fps_id: '',
  paypal_email: '',
  payment_days: 30,
  interest_rate: 5,
  authorized_name: 'Tommy',
  bank_transfer_enabled: true,
  cheque_enabled: false,
  fps_enabled: false,
  paypal_enabled: false,
}

export function mergeQuotationSettings(data: Record<string, unknown> | null | undefined): QuotationSettings {
  if (!data) return defaultQuotationSettings
  return {
    ...defaultQuotationSettings,
    display_name: String(data.display_name ?? defaultQuotationSettings.display_name),
    logo_base64: String(data.logo_base64 ?? ''),
    company_name: String(data.company_name ?? defaultQuotationSettings.company_name),
    email: String(data.email ?? ''),
    phone: String(data.phone ?? ''),
    address: String(data.address ?? ''),
    bank_name: String(data.bank_name ?? ''),
    account_name: String(data.account_name ?? ''),
    account_number: String(data.account_number ?? ''),
    default_currency: normaliseCurrency(data.default_currency),
    invoice_prefix: String(data.invoice_prefix ?? 'INV'),
    invoice_start_number: Number(data.invoice_start_number ?? 1),
    invoice_current_number: Number(data.invoice_current_number ?? 0),
    tax_rate: Number(data.tax_rate ?? 0),
    default_rates: (data.default_rates ?? {}) as Record<string, number>,
    quote_prefix: String(data.quote_prefix ?? 'QUO'),
    quote_current_number: Number(data.quote_current_number ?? 0),
    cheque_payable_to: String(data.cheque_payable_to ?? ''),
    cheque_address: String(data.cheque_address ?? ''),
    fps_id: String(data.fps_id ?? ''),
    paypal_email: String(data.paypal_email ?? ''),
    payment_days: Number(data.payment_days ?? 30),
    interest_rate: Number(data.interest_rate ?? 5),
    authorized_name: String(data.authorized_name ?? 'Tommy'),
    bank_transfer_enabled: Boolean(data.bank_transfer_enabled ?? true),
    cheque_enabled: Boolean(data.cheque_enabled ?? false),
    fps_enabled: Boolean(data.fps_enabled ?? false),
    paypal_enabled: Boolean(data.paypal_enabled ?? false),
  }
}

export function nextQuoteSequence(settings = defaultQuotationSettings) {
  return Number(settings.quote_current_number ?? 0) + 1 || 1
}

export function buildQuoteNumber(settings = defaultQuotationSettings, sequence = nextQuoteSequence(settings)) {
  return buildInvoiceNumber(settings.quote_prefix || 'QUO', new Date().getFullYear(), sequence)
}

export function createEmptyQuotation(settings = defaultQuotationSettings): QuotationContent {
  const invoiceSeed = createEmptyInvoice(settings)
  return {
    language: 'zh',
    currency: normaliseCurrency(settings.default_currency),
    logoDataUrl: settings.logo_base64,
    companyName: settings.company_name,
    email: settings.email,
    phone: settings.phone,
    address: settings.address,
    quoteNumber: buildQuoteNumber(settings),
    quoteDate: new Date().toISOString().slice(0, 10),
    validUntil: '',
    invoiceNumber: '',
    clientCompany: '',
    attention: '',
    clientAddress: '',
    clientPhone: '',
    clientEmail: '',
    projectName: '',
    items: [{ id: crypto.randomUUID(), deliverable: '', details: '', cost: 0 }],
    discount: null,
    taxRate: Number(settings.tax_rate ?? 0),
    paymentTerms: buildPaymentTerms(settings),
    authorizedName: settings.authorized_name,
    authorizedDate: new Date().toISOString().slice(0, 10),
    clientSignatureName: '',
    clientSignatureDate: '',
    ...(!settings.company_name ? { companyName: invoiceSeed.companyName } : {}),
  }
}

export function parseQuotation(content: string | null, settings = defaultQuotationSettings): QuotationContent {
  if (!content) return createEmptyQuotation(settings)
  try {
    const parsed = JSON.parse(content) as Partial<QuotationContent>
    return {
      ...createEmptyQuotation(settings),
      ...parsed,
      currency: normaliseCurrency(parsed.currency || settings.default_currency),
      logoDataUrl: parsed.logoDataUrl || settings.logo_base64 || '',
      companyName: parsed.companyName || settings.company_name || '',
      email: parsed.email || settings.email || '',
      phone: parsed.phone || settings.phone || '',
      address: parsed.address || settings.address || '',
      authorizedName: parsed.authorizedName || settings.authorized_name || 'Tommy',
      taxRate: parsed.taxRate ?? Number(settings.tax_rate ?? 0),
    }
  } catch {
    return createEmptyQuotation(settings)
  }
}

export function buildPaymentTerms(settings = defaultQuotationSettings) {
  const blocks: string[] = []
  if (settings.bank_transfer_enabled) {
    blocks.push(`Bank Transfer in payment should be made out payable to:
Bank Name: ${settings.bank_name}
Account Name: ${settings.account_name}
Account Number: ${settings.account_number}`)
  }
  if (settings.cheque_enabled) {
    blocks.push(`Cheques should be made payable to ${settings.cheque_payable_to}
and mailed to: ${settings.cheque_address}`)
  }
  if (settings.fps_enabled) blocks.push(`FPS / PayMe: ${settings.fps_id}`)
  if (settings.paypal_enabled) blocks.push(`PayPal: ${settings.paypal_email}`)
  blocks.push(`Total amount shall be settled in ${settings.payment_days} days after job completed.`)
  blocks.push(`An interest charge of ${settings.interest_rate}% per month will be imposed on overdue account.`)
  return blocks.filter(Boolean).join('\n\n')
}

export { nextInvoiceSequence }
