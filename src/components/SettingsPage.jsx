import React, { useState, useEffect } from 'react'
import { Save, RefreshCw, DollarSign, Calculator, Briefcase, Calendar as CalendarIcon } from 'lucide-react'
import { loadSettings, saveSettings, syncSettingsToSheets } from '../lib/storage'
import { cn } from '../lib/utils'

function SettingsPage() {
    const [settings, setSettings] = useState(null)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        setSettings(loadSettings())
    }, [])

    if (!settings) return null

    const handleSave = async () => {
        setIsSaving(true)
        saveSettings(settings)
        await syncSettingsToSheets(settings) // Sync to cloud
        setTimeout(() => setIsSaving(false), 1000)
    }

    const updateSetting = (section, field, value) => {
        setSettings(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }))
    }

    const sections = [
        {
            id: 'allowance',
            title: '出差津貼 & 匯率',
            icon: DollarSign,
            fields: [
                { key: 'tripDaily', label: '日津貼 (USD)', type: 'number' },
                { key: 'exchangeRate', label: '美金匯率 (TWD)', type: 'number' },
            ]
        },
        {
            id: 'salary',
            title: '薪資管理',
            icon: Briefcase,
            fields: [
                { key: 'baseMonthly', label: '本薪 (TWD)', type: 'number' },
                { key: 'hourlyRate', label: '時薪 (自動計算)', type: 'number', disabled: true },
            ]
        },
        {
            id: 'rules',
            title: '加班計算規則',
            icon: Calculator,
            fields: [
                { key: 'ot1', label: '平日加班倍率 1 (前 2hr)', type: 'number', step: 0.01 },
                { key: 'ot2', label: '平日加班倍率 2 (後 2hr)', type: 'number', step: 0.01 },
                { key: 'standardEndTime', label: '預設下班時間 (如 18:00)', type: 'text' },
            ]
        }
    ]

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black tracking-tight">Settings</h1>
                    <p className="text-gray-500 text-sm font-bold tracking-widest uppercase">System Configurations</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={cn(
                        "neumo-button py-3 px-8 flex items-center gap-2 text-sm font-black transition-all",
                        isSaving ? "text-green-600 scale-95" : "text-neumo-brand"
                    )}
                >
                    {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {sections.map((section) => (
                    <div key={section.id} className="neumo-card space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 neumo-pressed rounded-xl text-gray-500">
                                <section.icon size={20} />
                            </div>
                            <h3 className="text-lg font-black italic">{section.title}</h3>
                        </div>

                        <div className="space-y-4">
                            {section.fields.map((field) => (
                                <div key={field.key} className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                                        {field.label}
                                    </label>
                                    <input
                                        type={field.type}
                                        disabled={field.disabled}
                                        step={field.step || 1}
                                        value={settings[section.id][field.key]}
                                        onChange={(e) => {
                                            const val = field.type === 'number' ? parseFloat(e.target.value) : e.target.value;
                                            updateSetting(section.id, field.key, val);
                                        }}
                                        className={cn(
                                            "neumo-input h-11 text-sm font-bold",
                                            field.disabled && "opacity-50 cursor-not-allowed"
                                        )}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {/* Leave Management Placeholder */}
                <div className="neumo-card space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 neumo-pressed rounded-xl text-gray-500">
                            <CalendarIcon size={20} />
                        </div>
                        <h3 className="text-lg font-black italic">特休管理</h3>
                    </div>
                    <div className="neumo-pressed rounded-2xl p-6 text-center">
                        <p className="text-xs text-gray-400 font-bold uppercase">Leave management coming soon</p>
                    </div>
                </div>
            </div>

            <div className="text-center py-8">
                <p className="text-[10px] text-gray-400 font-bold tracking-[0.2em] uppercase">OT Calculation App v2.0 • Neumorphic Design</p>
            </div>
        </div>
    )
}

export default SettingsPage
