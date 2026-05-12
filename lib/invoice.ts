export type InvoiceLanguage = 'zh' | 'en'

export type InvoicePhase =
  | 'Pre-production'
  | 'Production'
  | 'Post-production'
  | 'Talent'
  | 'Ad Boosting'

export type InvoiceLineItem = {
  id: string
  phase: InvoicePhase
  description: string
  customDescription: string
  rate: number
  quantity: number
}

export type InvoiceDiscount = {
  label: string
  type: 'amount' | 'percentage'
  value: number
}

export type InvoiceContent = {
  language: InvoiceLanguage
  title: string
  logoDataUrl: string
  companyName: string
  email: string
  phone: string
  address: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  billedToName: string
  billedToAddress: string
  billedToTaxId: string
  lineItems: InvoiceLineItem[]
  discount: InvoiceDiscount | null
  taxRate: number
  bankName: string
  accountName: string
  accountNumber: string
  notes: string
  updatedAt?: string
}

export type InvoiceSettings = {
  company_name: string
  email: string
  phone: string
  address: string
  bank_name: string
  account_name: string
  account_number: string
  tax_rate: number
  default_rates: Record<string, number>
}

export const invoicePhases: InvoicePhase[] = [
  'Pre-production',
  'Production',
  'Post-production',
  'Talent',
  'Ad Boosting',
]

export const phaseColors: Record<InvoicePhase, string> = {
  'Pre-production': '#7c3aed',
  Production: '#0ea5e9',
  'Post-production': '#f97316',
  Talent: '#ec4899',
  'Ad Boosting': '#22c55e',
}

export const phaseDescriptions: Record<InvoicePhase, string[]> = {
  'Pre-production': [
    'Scriptwriting',
    'Storyboard',
    'Art direction',
    'Research',
    'Location scouting',
    'Casting arrangement',
    'Creative direction',
    'Custom',
  ],
  Production: [
    'Filming - Half day',
    'Filming - Full day',
    'Filming - Full day (2nd day)',
    'Filming - Full day (3+ days, per day)',
    'Equipment rental',
    'Props',
    'Travel & accommodation',
    'Custom',
  ],
  'Post-production': [
    'Video editing',
    'Colour grading',
    'Subtitles / Captions',
    'Thumbnail design',
    'Revision rounds',
    'Custom',
  ],
  Talent: [
    'Talent fee',
    'Make-up',
    'Hair styling',
    'Styling / Wardrobe',
    'Talent travel & accommodation',
    'Custom',
  ],
  'Ad Boosting': ['Ad management fee', 'Ad spend (pass-through)', 'Performance report', 'Custom'],
}

export const settingsRateGroups: Array<{ phase: InvoicePhase; items: string[] }> = [
  {
    phase: 'Pre-production',
    items: ['Scriptwriting', 'Storyboard', 'Art direction', 'Research', 'Location scouting', 'Casting arrangement', 'Creative direction'],
  },
  {
    phase: 'Production',
    items: [
      'Filming - Half day',
      'Filming - Full day',
      'Filming - Full day (2nd day)',
      'Filming - Full day (3+ days, per day)',
      'Equipment rental',
      'Props',
      'Travel & accommodation',
    ],
  },
  {
    phase: 'Post-production',
    items: ['Video editing', 'Colour grading', 'Subtitles / Captions', 'Thumbnail design', 'Revision rounds'],
  },
  {
    phase: 'Talent',
    items: ['Talent fee', 'Make-up', 'Hair styling', 'Styling / Wardrobe', 'Talent travel & accommodation'],
  },
  {
    phase: 'Ad Boosting',
    items: ['Ad management fee', 'Ad spend (pass-through)', 'Performance report'],
  },
]

export const defaultSettings: InvoiceSettings = {
  company_name: 'SOON Studio',
  email: '',
  phone: '',
  address: '',
  bank_name: '',
  account_name: '',
  account_number: '',
  tax_rate: 0,
  default_rates: {},
}

export function createEmptyInvoice(settings = defaultSettings): InvoiceContent {
  return {
    language: 'zh',
    title: 'Invoice',
    logoDataUrl: '',
    companyName: settings.company_name,
    email: settings.email,
    phone: settings.phone,
    address: settings.address,
    invoiceNumber: `INV-${new Date().getFullYear()}${String(Date.now()).slice(-5)}`,
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    billedToName: '',
    billedToAddress: '',
    billedToTaxId: '',
    lineItems: [createLineItem(settings, 'Pre-production', 'Scriptwriting')],
    discount: null,
    taxRate: Number(settings.tax_rate ?? 0),
    bankName: settings.bank_name,
    accountName: settings.account_name,
    accountNumber: settings.account_number,
    notes: '',
  }
}

export function createLineItem(
  settings = defaultSettings,
  phase: InvoicePhase = 'Pre-production',
  description = 'Scriptwriting'
): InvoiceLineItem {
  return {
    id: crypto.randomUUID(),
    phase,
    description,
    customDescription: '',
    rate: Number(settings.default_rates?.[description] ?? 0),
    quantity: 1,
  }
}

export function parseInvoice(content: string | null, settings = defaultSettings): InvoiceContent {
  if (!content) return createEmptyInvoice(settings)
  try {
    return { ...createEmptyInvoice(settings), ...(JSON.parse(content) as Partial<InvoiceContent>) }
  } catch {
    return createEmptyInvoice(settings)
  }
}
