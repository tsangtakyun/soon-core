'use client'

import { useEffect, useState } from 'react'

import { DashboardShell } from '@/components/DashboardShell'
import { defaultSettings, settingsRateGroups, type InvoiceSettings } from '@/lib/invoice'
import { supabase } from '@/lib/supabase'

export function SettingsPage() {
  const [settings, setSettings] = useState<InvoiceSettings>(defaultSettings)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    const { data } = await supabase.from('settings').select('*').eq('user_id', 'tommy').maybeSingle()
    if (data) {
      setSettings({
        company_name: data.company_name ?? '',
        email: data.email ?? '',
        phone: data.phone ?? '',
        address: data.address ?? '',
        bank_name: data.bank_name ?? '',
        account_name: data.account_name ?? '',
        account_number: data.account_number ?? '',
        tax_rate: Number(data.tax_rate ?? 0),
        default_rates: (data.default_rates ?? {}) as Record<string, number>,
      })
    }
  }

  function update<K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) {
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
  }

  return (
    <DashboardShell activeSection="settings">
      <section className="settings-page">
        <header className="docs-header">
          <div>
            <h1>設定</h1>
            <p>公司資料、付款資料同 Invoice 預設費率</p>
          </div>
          <div className="settings-save-row">
            {saved && <span>已儲存</span>}
            <button className="primary-button" type="button" onClick={() => void save()}>
              儲存設定
            </button>
          </div>
        </header>

        <section className="settings-card">
          <h2>公司資料</h2>
          <label>
            公司名稱
            <input value={settings.company_name} onChange={(event) => update('company_name', event.target.value)} />
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
        </section>

        <section className="settings-card">
          <h2>Invoice 預設費率 (HK$)</h2>
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
