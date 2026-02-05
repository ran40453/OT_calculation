import React, { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, subDays, isSameMonth } from 'date-fns'
import { TrendingUp, Globe, Wallet, Clock, Coffee, Moon, Gift } from 'lucide-react'
import { motion } from 'framer-motion'
import { loadData, loadSettings, fetchRecordsFromGist, calculateCompLeaveUnits, calculateDailySalary } from '../lib/storage'
import { cn } from '../lib/utils'

function Dashboard() {
    const [data, setData] = useState([])
    const [settings, setSettings] = useState(null)
    const today = new Date()

    useEffect(() => {
        const localData = loadData();
        setData(localData);
        setSettings(loadSettings());

        fetchRecordsFromGist().then(remoteRecords => {
            if (remoteRecords) setData(remoteRecords);
        });
    }, [])

    if (!settings) return null

    // Date Ranges
    const currentMonthInterval = { start: startOfMonth(today), end: endOfMonth(today) }
    const rollingYearInterval = { start: subDays(today, 365), end: today }

    // Unified helper to parse dates safely
    const parse = (d) => new Date(d)

    // Filtering Records
    const currentMonthRecords = data.filter(r => isWithinInterval(parse(r.date), currentMonthInterval))
    const rollingYearRecords = data.filter(r => isWithinInterval(parse(r.date), rollingYearInterval))

    // Helper: Calculate Stats for a given record set
    const calcMetrics = (records) => {
        const tripCount = records.filter(r => r.travelCountry && (r.travelCountry === 'VN' || r.travelCountry === '越南')).length
        const totalOT = records.reduce((sum, r) => sum + (parseFloat(r.otHours) || 0), 0)
        const totalComp = records.reduce((sum, r) => sum + calculateCompLeaveUnits(r), 0)
        const totalLeave = records.filter(r => r.isLeave).length

        // Income calculation
        const totalSalary = records.reduce((sum, r) => sum + calculateDailySalary(r, settings), 0)
        const baseMonths = records.length > 0 ? (new Set(records.map(r => format(parse(r.date), 'yyyy-MM'))).size) : 0
        const estTotal = (settings.salary.baseMonthly * Math.max(1, baseMonths)) + totalSalary

        const allowance = tripCount * settings.allowance.tripDaily * (settings.allowance.exchangeRate || 32.5)

        return { tripCount, totalOT, totalComp, totalLeave, totalSalary: estTotal, allowance }
    }

    const monthStats = calcMetrics(currentMonthRecords)
    const yearStats = calcMetrics(rollingYearRecords)

    const widgets = [
        {
            label: '獎金計算',
            mainValue: '0',
            subValue: 'Bonus Pending',
            icon: Gift,
            color: 'text-amber-500',
            isSingle: true
        },
        {
            label: '出差天數',
            mainValue: yearStats.tripCount,
            subValue: monthStats.tripCount,
            unit: 'd',
            icon: Globe,
            color: 'text-green-500'
        },
        {
            label: '津貼估計',
            mainValue: `$${Math.round(yearStats.allowance).toLocaleString()}`,
            subValue: `$${Math.round(monthStats.allowance).toLocaleString()}`,
            icon: Wallet,
            color: 'text-orange-500'
        },
        {
            label: '薪資估計',
            mainValue: `$${Math.round(yearStats.totalSalary).toLocaleString()}`,
            subValue: `$${Math.round(monthStats.totalSalary).toLocaleString()}`,
            icon: TrendingUp,
            color: 'text-purple-500'
        },
    ]

    const statsGrid = [
        { label: '加班統計 (年/月)', value: `${yearStats.totalOT.toFixed(1)} / ${monthStats.totalOT.toFixed(1)}`, unit: 'h', color: 'text-blue-500', icon: Clock },
        { label: '累計補休 (年/月)', value: `${yearStats.totalComp.toFixed(1)} / ${monthStats.totalComp.toFixed(1)}`, unit: '單', color: 'text-indigo-500', icon: Coffee },
        { label: '累計請假 (年/月)', value: `${yearStats.totalLeave} / ${monthStats.totalLeave}`, unit: '天', color: 'text-rose-500', icon: Moon },
    ]

    return (
        <div className="space-y-8">
            <header className="flex flex-col space-y-2">
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                    Dashboard <span className="text-sm font-bold bg-neumo-brand/10 text-neumo-brand px-2 py-1 rounded-lg">{format(today, 'MMMM')}</span>
                </h1>
                <p className="text-gray-500 text-xs font-bold tracking-widest uppercase italic">Efficiency & Trends (365D Rolling)</p>
            </header>

            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {widgets.map((w, i) => (
                    <motion.div
                        key={w.label}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="neumo-card p-6 flex flex-col items-center gap-2"
                    >
                        <div className={cn("p-2 rounded-xl neumo-pressed", w.color)}>
                            <w.icon size={20} />
                        </div>
                        <div className="text-center w-full">
                            <p className="text-[9px] font-black text-gray-400 border-b border-gray-100 pb-1 mb-2 uppercase tracking-widest">{w.label}</p>
                            <div className="space-y-1">
                                <p className="text-lg font-black tracking-tight leading-none">{w.mainValue}{w.unit || ''}</p>
                                {!w.isSingle && (
                                    <p className="text-[10px] font-bold text-gray-400">
                                        月: <span className="text-gray-600">{w.subValue}{w.unit || ''}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Stats Accumulation Grid */}
            <div className="space-y-4">
                <h3 className="text-lg font-black italic px-2">累計統計庫</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {statsGrid.map((s, i) => (
                        <motion.div
                            key={s.label}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="neumo-card p-5 flex justify-between items-center"
                        >
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{s.label}</p>
                                <div className="flex items-baseline gap-1">
                                    <span className={cn("text-2xl font-black tabular-nums", s.color)}>{s.value}</span>
                                    <span className="text-[10px] font-black text-gray-400 uppercase">{s.unit}</span>
                                </div>
                            </div>
                            <div className={cn("w-10 h-10 rounded-full neumo-pressed flex items-center justify-center opacity-30", s.color)}>
                                <s.icon size={18} />
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Dashboard
