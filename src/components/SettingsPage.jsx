import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Save, RefreshCw, DollarSign, Calculator, Briefcase, Calendar as CalendarIcon, Activity, Plus, Trash2, Globe } from 'lucide-react'
import { loadSettings, saveSettings, syncSettingsToGist, testConnection, fetchExchangeRate, createGist } from '../lib/storage'
import { cn } from '../lib/utils'
import { format } from 'date-fns'

function SettingsPage({ isPrivacy }) {
    const [settings, setSettings] = useState(null)
    const [isSaving, setIsSaving] = useState(false)
    const [testResult, setTestResult] = useState(null)
    const [isTesting, setIsTesting] = useState(false)
    const [liveRate, setLiveRate] = useState(null)
    const [expandedSection, setExpandedSection] = useState('sync') // 'sync', 'salary', 'ot', 'allowance'

    const maskValue = (val) => isPrivacy ? '••••' : val;

    useEffect(() => {
        const init = async () => {
            const s = loadSettings()
            setSettings(s)
            const rate = await fetchExchangeRate().catch(() => 32.5)
            setLiveRate(rate)
        }
        init()
    }, [])

    // Auto-save settings to localStorage whenever they change
    // This ensures other components (and sync logic) can access the token immediately
    useEffect(() => {
        if (settings) {
            saveSettings(settings)
        }
    }, [settings])

    if (!settings) return null

    const handleSave = async () => {
        setIsSaving(true)
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

    const handleCreateGist = async () => {
        if (!settings.githubToken) {
            alert('請先輸入 GitHub Token');
            return;
        }
        setIsSaving(true);
        const res = await createGist(settings.githubToken);
        if (res.ok) {
            setSettings(prev => ({ ...prev, gistId: res.gistId }));
            alert('Gist 建立成功！資料已同步。');
        } else {
            alert(`建立失敗: ${res.error}`);
        }
        setIsSaving(false);
    }

    const toggleSection = (id) => {
        setExpandedSection(expandedSection === id ? null : id);
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-32">
            <header className="flex justify-between items-center px-1">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-[#202731]">Settings</h1>
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">System Configurations v2.1</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={cn(
                        "neumo-button py-3 px-6 flex items-center gap-2 text-xs font-black transition-all",
                        isSaving ? "text-green-600 scale-95 neumo-pressed" : "text-neumo-brand"
                    )}
                >
                    {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                    {isSaving ? 'SYNCING...' : 'SAVE & SYNC'}
                </button>
            </header>

            <div className="space-y-4">
                {/* 1. Account & Sync */}
                <SettingsCard
                    id="sync"
                    title="帳號與雲端同步"
                    icon={Activity}
                    color="text-gray-500"
                    isExpanded={expandedSection === 'sync'}
                    onToggle={() => toggleSection('sync')}
                >
                    <div className="space-y-4 p-1">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">GitHub Token (PAT)</label>
                            <input
                                type="password"
                                value={settings.githubToken || ''}
                                onChange={(e) => updateSetting('root', 'githubToken', e.target.value)}
                                placeholder="ghp_xxxxxxxxxxxx"
                                className="neumo-input h-11 text-xs font-bold w-full"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Gist ID (雲端儲存庫 ID)</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={settings.gistId || ''}
                                    onChange={(e) => updateSetting('root', 'gistId', e.target.value)}
                                    placeholder="輸入現有 Gist ID 或點選右側自動建立"
                                    className="neumo-input h-11 text-xs font-bold flex-1"
                                />
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleCreateGist(); }}
                                    className="neumo-button px-4 text-[10px] font-black uppercase text-neumo-brand whitespace-nowrap"
                                >
                                    自動建立
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                setIsTesting(true);
                                const res = await testConnection(settings.githubToken);
                                setTestResult(res);
                                setIsTesting(false);
                            }}
                            disabled={isTesting}
                            className={cn("neumo-button w-full py-3 text-[10px] font-black uppercase tracking-widest", isTesting ? "opacity-50" : "text-neumo-brand")}
                        >
                            {isTesting ? 'TESTING...' : '測試 Gist 連線能力'}
                        </button>
                        {testResult && (
                            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className={cn("p-3 rounded-2xl text-[9px] font-bold", testResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={cn("w-1.5 h-1.5 rounded-full", testResult.ok ? "bg-green-500" : "bg-red-500")} />
                                    {testResult.ok ? `連線成功！(Gist: ${testResult.data?.id})` : `連線失敗: ${testResult.error}`}
                                </div>
                            </motion.div>
                        )}
                    </div>
                </SettingsCard>

                {/* 2. Salary Management */}
                <SettingsCard
                    id="salary"
                    title="薪資管理"
                    icon={Briefcase}
                    color="text-purple-500"
                    isExpanded={expandedSection === 'salary'}
                    onToggle={() => toggleSection('salary')}
                    action={<button onClick={(e) => { e.stopPropagation(); addSalaryHistory(); }} className="p-1 neumo-button text-purple-600 rounded-lg"><Plus size={14} /></button>}
                >
                    <div className="space-y-4 p-1">
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-2 px-1">
                                <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">生效日期</span>
                                <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">本薪 (TWD)</span>
                                <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest text-right pr-2">操作</span>
                            </div>
                            <AnimatePresence>
                                {(settings.salaryHistory || []).map((h) => (
                                    <motion.div key={h.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="grid grid-cols-3 gap-2 items-center neumo-pressed p-2 rounded-xl">
                                        <input
                                            type="date"
                                            value={h.date}
                                            onChange={(e) => updateSalaryHistory(h.id, 'date', e.target.value)}
                                            className="bg-transparent text-[11px] font-black text-gray-600 focus:outline-none px-1"
                                        />
                                        <div className="relative">
                                            <input
                                                type={isPrivacy ? "text" : "number"}
                                                value={isPrivacy ? maskValue('') : h.amount}
                                                onChange={(e) => !isPrivacy && updateSalaryHistory(h.id, 'amount', parseFloat(e.target.value))}
                                                readOnly={isPrivacy}
                                                className={cn("bg-transparent text-xs font-black text-purple-600 focus:outline-none w-full", isPrivacy && "text-gray-300")}
                                            />
                                        </div>
                                        <div className="flex justify-end">
                                            <button onClick={(e) => { e.stopPropagation(); removeSalaryHistory(h.id); }} className="p-1.5 text-rose-400 hover:text-rose-600 transition-colors"><Trash2 size={13} /></button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {(!settings.salaryHistory || settings.salaryHistory.length === 0) && (
                                <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-2xl opacity-50">
                                    <p className="text-[10px] font-bold text-gray-300 uppercase">尚無歷史薪資紀錄</p>
                                </div>
                            )}
                        </div>
                        <div className="pt-4 border-t border-gray-100/50">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">當前預設本薪 (Fallback)</label>
                            <input
                                type={isPrivacy ? "text" : "number"}
                                value={isPrivacy ? maskValue('') : settings.salary.baseMonthly}
                                onChange={(e) => !isPrivacy && updateSetting('salary', 'baseMonthly', parseFloat(e.target.value))}
                                readOnly={isPrivacy}
                                className={cn("neumo-input h-11 text-sm font-black w-full mt-1 px-4", isPrivacy && "text-gray-300")}
                                placeholder={isPrivacy ? "••••" : "輸入本薪"}
                            />
                        </div>
                    </div>
                </SettingsCard>

                {/* 3. OT Rules */}
                <SettingsCard
                    id="ot"
                    title="加班與補休規則"
                    icon={Calculator}
                    color="text-blue-500"
                    isExpanded={expandedSection === 'ot'}
                    onToggle={() => toggleSection('ot')}
                >
                    <div className="space-y-6 p-1">
                        {/* OT Pay Section */}
                        <div className="space-y-2">
                            <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest pl-1 mb-2 border-b border-blue-100 pb-1">加班費倍率 (Overtime Pay)</h4>
                            <div className="grid grid-cols-1 gap-2">
                                <RuleRow label="平日前 2H" value="1.34x" />
                                <RuleRow label="平日之後" value="1.67x" />
                                <RuleRow label="例假日" value="1.34 / 1.67 / 2.67x" />
                                <RuleRow label="國定假日" value="2.0x (前 8H)" />
                            </div>
                        </div>

                        {/* Comp Leave Section */}
                        <div className="space-y-2">
                            <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest pl-1 mb-2 border-b border-indigo-100 pb-1">補休換算 (Comp Leave)</h4>
                            <div className="neumo-pressed p-3 rounded-2xl space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">換算單位</span>
                                    <span className="text-xs font-black text-[#202731]">0.5H = 1 單位</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-gray-100/50 pt-2">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">計算公式</span>
                                    <span className="text-[10px] font-bold text-gray-500 italic">floor(時數 * 2)</span>
                                </div>
                                <p className="text-[8px] text-gray-400 font-bold italic text-right pt-1">* 不滿 0.5H 不計入</p>
                            </div>
                        </div>

                        {/* Standard Time Section */}
                        <div className="pt-2 space-y-4">
                            {/* Start Time & Lunch Break Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">上班時間 (Start)</label>
                                    <input
                                        type="time"
                                        value={settings.rules?.standardStartTime || "08:30"}
                                        onChange={(e) => updateSetting('rules', 'standardStartTime', e.target.value)}
                                        className="neumo-pressed h-10 px-4 text-xs font-black text-[#202731] rounded-xl bg-gray-50/50 focus:outline-none w-full"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">午休時數 (Break)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={settings.rules?.lunchBreak || 1.5}
                                        onChange={(e) => updateSetting('rules', 'lunchBreak', parseFloat(e.target.value))}
                                        className="neumo-pressed h-10 px-4 text-xs font-black text-[#202731] rounded-xl bg-gray-50/50 focus:outline-none w-full"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1.5 px-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">加班起算時間 (Standard End Time)</label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="time"
                                        value={settings.rules?.standardEndTime || "17:30"}
                                        onChange={(e) => updateSetting('rules', 'standardEndTime', e.target.value)}
                                        className="neumo-pressed h-10 px-4 text-xs font-black text-[#202731] rounded-xl bg-gray-50/50 focus:outline-none flex-1"
                                    />
                                    <span className="text-[9px] font-bold text-gray-400 italic whitespace-nowrap">* 下班後 0.5H 起算</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </SettingsCard>

                {/* 4. Allowance */}
                <SettingsCard
                    id="allowance"
                    title="出差津貼與匯率"
                    icon={DollarSign}
                    color="text-orange-500"
                    isExpanded={expandedSection === 'allowance'}
                    onToggle={() => toggleSection('allowance')}
                >
                    <div className="space-y-6 p-1">
                        <div className="grid grid-cols-1 gap-3">
                            <div className="flex justify-between items-center neumo-pressed p-3 rounded-2xl">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">越南 (VN)</p>
                                <p className="text-sm font-black text-orange-600 tracking-widest">$40 USD/day</p>
                            </div>
                            <div className="flex justify-between items-center neumo-pressed p-3 rounded-2xl">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">印度 (IN)</p>
                                <p className="text-sm font-black text-orange-600 tracking-widest">$70 USD/day</p>
                            </div>
                            <div className="flex justify-between items-center neumo-pressed p-3 rounded-2xl">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">其他/大陸 (CN)</p>
                                <p className="text-sm font-black text-orange-600 tracking-widest">$33 USD/day</p>
                            </div>
                        </div>

                        <div className="pt-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">即時 USD 匯率 (TWD)</label>
                            <div className="flex gap-2 mt-1.5">
                                <div className="neumo-pressed flex-1 h-12 flex items-center px-4 rounded-2xl">
                                    <Globe size={16} className="text-green-500 mr-2" />
                                    <span className="text-sm font-black text-green-700">{liveRate?.toFixed(2) || '---'}</span>
                                </div>
                                <button
                                    onClick={async (e) => { e.stopPropagation(); setLiveRate(await fetchExchangeRate()); }}
                                    className="neumo-button px-4 flex items-center gap-2 text-[10px] font-black uppercase text-gray-500"
                                >
                                    <RefreshCw size={14} /> REFRESH
                                </button>
                            </div>
                            <p className="text-[8px] text-gray-400 mt-2 ml-1 italic font-bold uppercase tracking-tighter">* 會自動根據幣別轉換台幣收入，每日同步更新一次。</p>
                        </div>
                    </div>
                </SettingsCard>
            </div>
        </div>
    )
}

function SettingsCard({ id, title, icon: Icon, color, isExpanded, onToggle, children, action }) {
    return (
        <div className="neumo-card overflow-hidden transition-all duration-300">
            <div
                onClick={onToggle}
                className="p-5 flex justify-between items-center cursor-pointer group"
            >
                <div className="flex items-center gap-4">
                    <div className={cn("p-2.5 rounded-xl neumo-pressed transition-transform group-hover:scale-105", color)}>
                        <Icon size={20} strokeWidth={2.5} />
                    </div>
                    <h3 className="text-sm font-black italic text-[#202731] uppercase tracking-wider">{title}</h3>
                </div>
                <div className="flex items-center gap-3">
                    {action}
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} className="text-gray-300">
                        <Plus size={18} />
                    </motion.div>
                </div>
            </div>
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                        <div className="px-5 pb-6 border-t border-gray-50/50 pt-5">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

function RuleRow({ label, value }) {
    return (
        <div className="flex justify-between items-center px-3 py-2 neumo-pressed rounded-xl">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
            <span className="text-xs font-black text-[#202731] tracking-widest">{value}</span>
        </div>
    )
}


export default SettingsPage
