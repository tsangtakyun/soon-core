'use client'

import { type ChangeEvent, useEffect, useState } from 'react'

import { DashboardShell } from '@/components/DashboardShell'
import { buildInvoiceNumber, currencyOptions, normaliseCurrency, settingsRateGroups } from '@/lib/invoice'
import { buildQuoteNumber, defaultQuotationSettings, mergeQuotationSettings, type QuotationSettings } from '@/lib/quotation'
import { supabase } from '@/lib/supabase'

export function SettingsPage() {
  const [settings, setSettings] = useState<QuotationSettings>(defaultQuotationSettings)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    const { data } = await supabase.from('settings').select('*').eq('user_id', 'tommy').maybeSingle()
    if (!data) return

    setSettings(mergeQuotationSettings(data))
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

  async function save() {
    const { error } = await supabase.from('settings').upsert(
      {
        user_id: 'tommy',
        ...settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (error) {
      window.alert(error.message)
      return
    }
    setSaved(true)
    window.dispatchEvent(new Event('soon-data-updated'))
  }

  return (
    <DashboardShell activeSection="settings">
      <section className="settings-page">
        <header className="docs-header settings-header">
          <div>
            <h1>設定</h1>
            <p>管理用戶資料、公司資料、付款資料同 Invoice 預設費率</p>
          </div>
          <div className="settings-save-row">
            {saved && <span>已儲存</span>}
            <button className="primary-button" type="button" onClick={() => void save()}>
              儲存設定
            </button>
          </div>
        </header>

        <section className="settings-card">
          <h2>用戶資料</h2>
          <label>
            Display name
            <input value={settings.display_name} onChange={(event) => update('display_name', event.target.value)} />
          </label>
          <label>
            公司名稱
            <input value={settings.company_name} onChange={(event) => update('company_name', event.target.value)} />
          </label>
          <label>
            Logo upload
            <div className="settings-logo-row">
              {settings.logo_base64 ? (
                <img src={settings.logo_base64} alt="" />
              ) : (
                <span className="settings-logo-placeholder">Logo</span>
              )}
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
        </section>

        <section className="settings-card">
          <h2>付款資料</h2>
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
            <select
              value={settings.default_currency}
              onChange={(event) => update('default_currency', normaliseCurrency(event.target.value))}
            >
              {currencyOptions.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="settings-card">
          <h2>發票設定</h2>
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
            <input
              type="number"
              min="1"
              value={settings.invoice_start_number}
              onChange={(event) => update('invoice_start_number', Number(event.target.value || 1))}
            />
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
        </section>

        <section className="settings-card">
          <h2>付款條款設定</h2>
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
        </section>

        <section className="settings-card">
          <h2>簽署設定</h2>
          <label>
            授權人姓名
            <input value={settings.authorized_name} onChange={(event) => update('authorized_name', event.target.value)} />
          </label>
        </section>

        <section className="settings-card">
          <h2>Invoice 預設費率</h2>
          <div className="settings-rate-groups">
            {settingsRateGroups.map((group) => (
              <div key={group.phase} className="settings-rate-group">
                <h3>{group.phase}</h3>
                {group.items.map((item) => (
                  <label key={item}>
                    {item}
                    <input
                      type="number"
                      min="0"
                      value={settings.default_rates[item] ?? 0}
                      onChange={(event) => updateRate(item, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="settings-card">
          <h2>稅率</h2>
          <label>
            Tax rate %
            <input
              type="number"
              min="0"
              value={settings.tax_rate}
              onChange={(event) => update('tax_rate', Number(event.target.value || 0))}
            />
          </label>
        </section>
      </section>
    </DashboardShell>
  )
}
