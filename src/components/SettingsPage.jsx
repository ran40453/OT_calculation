import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Save, RefreshCw, DollarSign, Calculator, Briefcase, Calendar as CalendarIcon, Activity } from 'lucide-react'
import { loadSettings, saveSettings, syncSettingsToGist, testConnection } from '../lib/storage'
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
        // Use current temp token if available
        const result = await testConnection(settings.githubToken);
        setTestResult(result);
        setIsTesting(false);
    };

    if (!settings) return null

    const handleSave = async () => {
        setIsSaving(true)
        saveSettings(settings)
        await syncSettingsToGist(settings)
        setTimeout(() => setIsSaving(false), 1000)
    }

    const updateSetting = (section, field, value) => {
        if (section === 'root') {
            setSettings(prev => ({ ...prev, [field]: value }))
            return
        }
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

                {/* GitHub Gist Connectivity Section */}
                <div className="neumo-card space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 neumo-pressed rounded-xl text-gray-500">
                            <Activity size={20} />
                        </div>
                        <h3 className="text-lg font-black italic">Gist 資料同步與存取</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">GitHub Personal Access Token (PAT)</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={settings.githubToken || ''}
                                    onChange={(e) => updateSetting('root', 'githubToken', e.target.value)}
                                    placeholder="ghp_xxxxxxxxxxxx"
                                    className="neumo-input h-11 text-sm font-bold w-full"
                                />
                            </div>
                            <p className="text-[9px] text-gray-400 mt-1 ml-1 leading-relaxed">
                                用於存取 Gist。請確保 Token 具有 <code className="bg-gray-100 px-1 rounded">gist</code> 權限。
                                <br />目前的 Gist ID: <span className="font-mono text-neumo-brand">7ce68f2145a8c8aa4eabe5127f351f71</span>
                            </p>
                        </div>

                        <button
                            onClick={handleTestConnection}
                            disabled={isTesting}
                            className={cn(
                                "neumo-button w-full py-3 text-xs font-black uppercase transition-all",
                                isTesting ? "opacity-50 text-gray-600" : "text-neumo-brand"
                            )}
                        >
                            {isTesting ? '測試中...' : '測試 Gist 連線能力'}
                        </button>

                        {testResult && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={cn(
                                    "p-3 rounded-2xl text-[10px] font-bold leading-relaxed",
                                    testResult.ok ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"
                                )}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={cn("w-1.5 h-1.5 rounded-full", testResult.ok ? "bg-green-500" : "bg-red-500")} />
                                    {testResult.ok ? '連線成功！' : '連線失敗'}
                                </div>
                                {!testResult.ok && (
                                    <p className="opacity-80">{testResult.error}</p>
                                )}
                                {testResult.ok && (
                                    <p className="opacity-80">
                                        讀取到 {testResult.data?.files ? Object.keys(testResult.data.files).length : 0} 個檔案
                                    </p>
                                )}
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>

            <div className="text-center py-8">
                <p className="text-[10px] text-gray-400 font-bold tracking-[0.2em] uppercase">OT Calculation App v2.0 • GitHub Gist Driven</p>
            </div>
        </div>
    )
}

export default SettingsPage
