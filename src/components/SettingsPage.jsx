import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Save, RefreshCw, DollarSign, Calculator, Briefcase, Calendar as CalendarIcon, Activity, Plus, Trash2, Globe } from 'lucide-react'
import { loadSettings, saveSettings, syncSettingsToGist, testConnection, fetchExchangeRate } from '../lib/storage'
import { cn } from '../lib/utils'
import { format } from 'date-fns'

function SettingsPage() {
    const [settings, setSettings] = useState(null)
    const [isSaving, setIsSaving] = useState(false)
    const [testResult, setTestResult] = useState(null)
    const [isTesting, setIsTesting] = useState(false)
    const [liveRate, setLiveRate] = useState(null)

    useEffect(() => {
        const init = async () => {
            const s = loadSettings()
            setSettings(s)
            const rate = await fetchExchangeRate().catch(() => 32.5)
            setLiveRate(rate)
            // Auto sync rate if not manually overridden or just to show the user
        }
        init()
    }, [])

    if (!settings) return null

    const handleSave = async () => {
        setIsSaving(true)
        // Sync live rate to settings before saving
        const updated = { ...settings, liveRate: liveRate || settings.allowance.exchangeRate }
        saveSettings(updated)
        await syncSettingsToGist(updated)
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

    const addSalaryHistory = () => {
        const history = settings.salaryHistory || []
        const newItem = { id: Date.now(), date: format(new Date(), 'yyyy-MM-dd'), amount: settings.salary.baseMonthly }
        setSettings(prev => ({ ...prev, salaryHistory: [newItem, ...history] }))
    }

    const removeSalaryHistory = (id) => {
        setSettings(prev => ({ ...prev, salaryHistory: prev.salaryHistory.filter(h => h.id !== id) }))
    }

    const updateSalaryHistory = (id, field, value) => {
        setSettings(prev => ({
            ...prev,
            salaryHistory: prev.salaryHistory.map(h => h.id === id ? { ...h, [field]: value } : h)
        }))
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-[#202731]">Settings</h1>
                    <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mt-1">System Configurations v2.0</p>
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
                {/* Salary Section with History */}
                <div className="neumo-card space-y-6">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 neumo-pressed rounded-xl text-purple-500"><Briefcase size={20} /></div>
                            <h3 className="text-lg font-black italic">薪資管理 (歷史紀錄)</h3>
                        </div>
                        <button onClick={addSalaryHistory} className="p-2 neumo-button text-neumo-brand"><Plus size={16} /></button>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2 px-1 mb-2">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">生效日期</span>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">本薪 (TWD)</span>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">操作</span>
                        </div>
                        <AnimatePresence>
                            {(settings.salaryHistory || []).map((h) => (
                                <motion.div key={h.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="grid grid-cols-3 gap-2 items-center neumo-pressed p-2 rounded-2xl">
                                    <input
                                        type="date"
                                        value={h.date}
                                        onChange={(e) => updateSalaryHistory(h.id, 'date', e.target.value)}
                                        className="bg-transparent text-xs font-bold focus:outline-none px-2"
                                    />
                                    <input
                                        type="number"
                                        value={h.amount}
                                        onChange={(e) => updateSalaryHistory(h.id, 'amount', parseFloat(e.target.value))}
                                        className="bg-transparent text-xs font-black text-purple-600 focus:outline-none"
                                    />
                                    <button onClick={() => removeSalaryHistory(h.id)} className="text-rose-400 hover:text-rose-600 transition-colors flex justify-center"><Trash2 size={14} /></button>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        {(!settings.salaryHistory || settings.salaryHistory.length === 0) && (
                            <div className="text-center py-4 border-2 border-dashed border-gray-100 rounded-2xl">
                                <p className="text-[10px] font-bold text-gray-400 uppercase">尚無歷史紀錄</p>
                            </div>
                        )}
                        <div className="pt-4 border-t border-gray-100/50">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">當前預設本薪 (Fallback)</label>
                            <input
                                type="number"
                                value={settings.salary.baseMonthly}
                                onChange={(e) => updateSetting('salary', 'baseMonthly', parseFloat(e.target.value))}
                                className="neumo-input h-11 text-sm font-black w-full mt-1"
                            />
                        </div>
                    </div>
                </div>

                {/* Allowance Section */}
                <div className="neumo-card space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 neumo-pressed rounded-xl text-orange-500"><DollarSign size={20} /></div>
                        <h3 className="text-lg font-black italic">出差津貼 & 即時匯率</h3>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-2">
                            <div className="neumo-pressed p-3 rounded-2xl text-center">
                                <p className="text-[8px] font-black text-gray-400 uppercase">VN (越南)</p>
                                <p className="text-sm font-black text-orange-600">$40</p>
                            </div>
                            <div className="neumo-pressed p-3 rounded-2xl text-center">
                                <p className="text-[8px] font-black text-gray-400 uppercase">IN (印度)</p>
                                <p className="text-sm font-black text-orange-600">$70</p>
                            </div>
                            <div className="neumo-pressed p-3 rounded-2xl text-center">
                                <p className="text-[8px] font-black text-gray-400 uppercase">CN (大路)</p>
                                <p className="text-sm font-black text-orange-600">$33</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">USD 即時匯率 (TWD)</label>
                            <div className="flex gap-2">
                                <div className="neumo-pressed flex-1 h-12 flex items-center px-4 rounded-2xl">
                                    <Globe size={16} className="text-green-500 mr-2" />
                                    <span className="text-sm font-black text-green-700">{liveRate?.toFixed(2) || '---'}</span>
                                </div>
                                <button
                                    onClick={async () => setLiveRate(await fetchExchangeRate())}
                                    className="neumo-button px-4 flex items-center gap-2 text-[10px] font-black uppercase text-gray-500"
                                >
                                    <RefreshCw size={14} /> 重新整理
                                </button>
                            </div>
                            <p className="text-[8px] text-gray-400 ml-1 italic">* 系統將自動抓取最新匯率並與分析頁同步</p>
                        </div>
                    </div>
                </div>

                {/* OT Rules Section */}
                <div className="neumo-card space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 neumo-pressed rounded-xl text-blue-500"><Calculator size={20} /></div>
                        <h3 className="text-lg font-black italic">加班倍率設定 (預設)</h3>
                    </div>
                    <div className="space-y-4">
                        <RuleRow label="平日前 2H" value="1.34x" />
                        <RuleRow label="平日之後" value="1.67x" />
                        <RuleRow label="例假日" value="1.34 / 1.67 / 2.67x" />
                        <RuleRow label="國定假日" value="2.0x (前 8H)" />
                        <div className="pt-2 border-t border-gray-100/50">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex justify-between">
                                預設起算時間 <span className="text-neumo-brand">固定 17:30</span>
                            </label>
                            <div className="neumo-input h-11 flex items-center px-4 text-sm font-bold opacity-50 bg-gray-50/50">17:30 (下班起算)</div>
                        </div>
                    </div>
                </div>

                {/* Connectivity Section */}
                <div className="neumo-card space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 neumo-pressed rounded-xl text-gray-500"><Activity size={20} /></div>
                        <h3 className="text-lg font-black italic">Gist 資料同步</h3>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">GitHub Token (PAT)</label>
                            <input
                                type="password"
                                value={settings.githubToken || ''}
                                onChange={(e) => updateSetting('root', 'githubToken', e.target.value)}
                                placeholder="ghp_xxxxxxxxxxxx"
                                className="neumo-input h-11 text-sm font-bold w-full"
                            />
                        </div>
                        <button
                            onClick={async () => {
                                setIsTesting(true);
                                const res = await testConnection(settings.githubToken);
                                setTestResult(res);
                                setIsTesting(false);
                            }}
                            disabled={isTesting}
                            className={cn("neumo-button w-full py-3 text-xs font-black uppercase", isTesting ? "opacity-50" : "text-neumo-brand")}
                        >
                            {isTesting ? '測試中...' : '測試 Gist 連線能力'}
                        </button>
                        {testResult && (
                            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className={cn("p-3 rounded-2xl text-[9px] font-bold", testResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={cn("w-1.5 h-1.5 rounded-full", testResult.ok ? "bg-green-500" : "bg-red-500")} />
                                    {testResult.ok ? '連線成功！' : `連線失敗: ${testResult.error}`}
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function RuleRow({ label, value }) {
    return (
        <div className="flex justify-between items-center px-2 py-1">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
            <span className="text-sm font-black text-[#202731] neumo-pressed px-3 py-1 rounded-lg">{value}</span>
        </div>
    )
}

export default SettingsPage
