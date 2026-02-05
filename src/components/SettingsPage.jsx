import React, { useState, useEffect } from 'react'
import { Save, RefreshCw, DollarSign, Calculator, Briefcase, Calendar as CalendarIcon } from 'lucide-react'
import { loadSettings, saveSettings, syncSettingsToSheets, testConnection } from '../lib/storage'
import { cn } from '../lib/utils'

function SettingsPage() {
    const [settings, setSettings] = useState(null)
    const [isSaving, setIsSaving] = useState(false)
    const [testResult, setTestResult] = useState(null)
    const [isTesting, setIsTesting] = useState(false)

    useEffect(() => {
        setSettings(loadSettings())
    }, [])

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestResult(null);
        const result = await testConnection();
        setTestResult(result);
        setIsTesting(false);
    };

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

                {/* System Connectivity Section */}
                <div className="neumo-card space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 neumo-pressed rounded-xl text-gray-500">
                            <RefreshCw size={20} className={cn(isTesting && "animate-spin")} />
                        </div>
                        <h3 className="text-lg font-black italic">系統連線診斷</h3>
                    </div>

                    <div className="space-y-4">
                        <button
                            onClick={handleTestConnection}
                            disabled={isTesting}
                            className="neumo-button w-full py-3 text-xs font-black uppercase text-gray-600"
                        >
                            {isTesting ? '正在測試中...' : '測試 Google Sheets 連線'}
                        </button>

                        {testResult && (
                            <div className={cn(
                                "neumo-pressed rounded-2xl p-4 text-xs font-bold break-all",
                                testResult.ok ? "text-green-600" : "text-red-500"
                            )}>
                                <p className="uppercase tracking-widest mb-1 underline">測試結果:</p>
                                <p>{testResult.ok ? '✅ 連線成功！' : `❌ 失敗: ${testResult.error}`}</p>
                                {testResult.status && <p className="mt-1">狀態碼: {testResult.status}</p>}
                                {testResult.raw && <p className="mt-1 opacity-50 italic">Raw: {testResult.raw}</p>}
                            </div>
                        )}

                        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                            <p className="text-[10px] text-blue-600 font-bold leading-relaxed">
                                ※ 如果測試失敗，請確認 `vercel.json` 中的網址是否與 Apps Script 的最新部署 ID 一致。
                            </p>
                        </div>
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
