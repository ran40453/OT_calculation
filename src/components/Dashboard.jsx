import React, { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, isWithinInterval, subDays, isSameMonth } from 'date-fns'
import { TrendingUp, Globe, Wallet, Clock, Coffee, Moon, Gift, Eye, EyeOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { loadData, loadSettings, fetchRecordsFromGist, calculateCompLeaveUnits, calculateDailySalary, fetchExchangeRate } from '../lib/storage'
import { cn } from '../lib/utils'

function Dashboard() {
    const [data, setData] = useState([])
    const [settings, setSettings] = useState(null)
    const [isPrivacy, setIsPrivacy] = useState(false)
    const [liveRate, setLiveRate] = useState(null)
    const today = new Date()

    useEffect(() => {
        const init = async () => {
            const localData = loadData();
            setData(localData);
            const s = loadSettings();
            setSettings(s);

            const [rate, remote] = await Promise.all([
                fetchExchangeRate().catch(() => 32.5),
                fetchRecordsFromGist().catch(() => null)
            ]);

            if (rate) setLiveRate(rate);
            if (remote) setData(remote);
        };
        init();
    }, [])

    if (!settings) return null

    // Helper: Mask numbers if privacy mode is on
    const mask = (val) => isPrivacy ? '••••' : val;

    // Filtering Records (Fixed)
    const currentMonthInterval = { start: startOfMonth(today), end: endOfMonth(today) }
    const rollingYearInterval = { start: subDays(today, 365), end: today }

    const parse = (d) => new Date(d)
    const currentMonthRecords = data.filter(r => isWithinInterval(parse(r.date), currentMonthInterval))
    const rollingYearRecords = data.filter(r => isWithinInterval(parse(r.date), rollingYearInterval))

    const calcMetrics = (records) => {
        const tripCount = records.filter(r => r.travelCountry && (r.travelCountry.toUpperCase() === 'VN' || r.travelCountry === '越南' || r.travelCountry.toUpperCase() === 'IN' || r.travelCountry === '印度' || r.travelCountry.toUpperCase() === 'CN' || r.travelCountry === '大陸')).length

        const totalOT = records.reduce((sum, r) => sum + (parseFloat(r.otHours) || 0), 0)
        const totalComp = records.reduce((sum, r) => sum + calculateCompLeaveUnits(r), 0)
        const totalLeave = records.filter(r => r.isLeave).length
        const totalSalary = records.reduce((sum, r) => sum + calculateDailySalary(r, { ...settings, liveRate }), 0)

        // Rolling salary logic: Base * 12 + extra from records
        const baseMonthly = settings.salary.baseMonthly || 50000;
        const estTotal = (baseMonthly * 12) + totalSalary; // Overly simplistic but fits "estimated annual"

        // Allowance recalculation based on per-country rules
        const allowance = records.reduce((total, r) => {
            if (!r.travelCountry) return total;
            const country = r.travelCountry.toUpperCase();
            let usd = 50;
            if (country === 'VN' || country === '越南') usd = 40;
            else if (country === 'IN' || country === '印度') usd = 70;
            else if (country === 'CN' || country === '大陸') usd = 33;
            return total + (usd * (liveRate || settings.allowance.exchangeRate || 32.5));
        }, 0);

        return { tripCount, totalOT, totalComp, totalLeave, totalSalary: estTotal, allowance }
    }

    const monthStats = calcMetrics(currentMonthRecords)
    const yearStats = calcMetrics(rollingYearRecords)

    const StatPair = ({ yearVal, monthVal, unit, color }) => (
        <div className="flex items-center gap-1 w-full justify-center">
            <div className="flex-1 neumo-pressed py-1 rounded-lg text-center">
                <span className="text-[8px] block text-gray-400 font-bold uppercase mb-0.5">年</span>
                <span className={cn("text-xs font-black tracking-tight", color)}>{mask(yearVal)}{unit}</span>
            </div>
            <div className="flex-1 neumo-pressed py-1 rounded-lg text-center">
                <span className="text-[8px] block text-gray-400 font-bold uppercase mb-0.5">月</span>
                <span className={cn("text-xs font-black tracking-tight", color)}>{mask(monthVal)}{unit}</span>
            </div>
        </div>
    )

    const widgets = [
        { label: '獎金計算', main: mask(0), sub: 'Bonus Calculation', icon: Gift, color: 'text-amber-500', single: true },
        { label: '出差天數', year: yearStats.tripCount, month: monthStats.tripCount, unit: 'd', icon: Globe, color: 'text-green-500' },
        { label: '津貼估計', year: `$${Math.round(yearStats.allowance).toLocaleString()}`, month: `$${Math.round(monthStats.allowance).toLocaleString()}`, icon: Wallet, color: 'text-orange-500' },
        { label: '薪資估計', year: `$${Math.round(yearStats.totalSalary).toLocaleString()}`, month: `$${Math.round(monthStats.totalSalary / 12).toLocaleString()}`, icon: TrendingUp, color: 'text-purple-500' },
    ]

    return (
        <div className="space-y-8">
            <header className="flex justify-between items-start">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                        Dashboard <span className="text-sm font-bold bg-neumo-brand/10 text-neumo-brand px-2 py-1 rounded-lg">{format(today, 'MMMM')}</span>
                    </h1>
                    <p className="text-gray-500 text-xs font-bold tracking-widest uppercase italic">Efficiency & Trends (365D Rolling)</p>
                </div>
                <button
                    onClick={() => setIsPrivacy(!isPrivacy)}
                    className="neumo-button p-3 text-gray-400 hover:text-neumo-brand transition-colors"
                >
                    {isPrivacy ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
            </header>

            {/* Top Stat Widgtes */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {widgets.map((w, i) => (
                    <motion.div
                        key={w.label}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="neumo-card p-4 flex flex-col items-center gap-3"
                    >
                        <div className={cn("p-2 rounded-xl neumo-pressed", w.color)}>
                            <w.icon size={18} />
                        </div>
                        <div className="w-full text-center">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-100/50 pb-1">{w.label}</p>
                            {w.single ? (
                                <p className="text-xl font-black">{w.main}</p>
                            ) : (
                                <StatPair yearVal={w.year} monthVal={w.month} unit="" color={w.color} />
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Accumulation Grid */}
            <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                    <h3 className="text-lg font-black italic">累積統計庫</h3>
                    <div className="flex items-center gap-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-gray-300" /> 年累計</span>
                        <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-white border border-gray-200" /> 月累計</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <AccumulationCard
                        label="加班統計"
                        yearVal={yearStats.totalOT.toFixed(1)}
                        monthVal={monthStats.totalOT.toFixed(1)}
                        unit="h"
                        icon={Clock}
                        color="text-blue-500"
                        mask={mask}
                    />
                    <AccumulationCard
                        label="累計補休"
                        yearVal={yearStats.totalComp.toFixed(1)}
                        monthVal={monthStats.totalComp.toFixed(1)}
                        unit="單"
                        icon={Coffee}
                        color="text-indigo-500"
                        mask={mask}
                    />
                    <AccumulationCard
                        label="累計請假"
                        yearVal={yearStats.totalLeave}
                        monthVal={monthStats.totalLeave}
                        unit="天"
                        icon={Moon}
                        color="text-rose-500"
                        mask={mask}
                    />
                </div>
            </div>
        </div>
    )
}

function AccumulationCard({ label, yearVal, monthVal, unit, icon: Icon, color, mask }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="neumo-card p-5 flex items-center justify-between"
        >
            <div className="space-y-3 flex-1">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
                <div className="flex items-center gap-2">
                    <div className="flex-1 neumo-pressed px-3 py-2 rounded-xl text-center">
                        <span className={cn("text-xl font-black tabular-nums", color)}>{mask(yearVal)}</span>
                        <span className="text-[9px] font-bold text-gray-400 ml-1 uppercase">{unit}</span>
                        <div className="text-[7px] font-bold text-gray-400 uppercase mt-0.5">Year</div>
                    </div>
                    <div className="flex-1 bg-white/40 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.05)] px-3 py-2 rounded-xl text-center">
                        <span className={cn("text-xl font-black tabular-nums opacity-80", color)}>{mask(monthVal)}</span>
                        <span className="text-[9px] font-bold text-gray-400 ml-1 uppercase">{unit}</span>
                        <div className="text-[7px] font-bold text-gray-400 uppercase mt-0.5">Month</div>
                    </div>
                </div>
            </div>
            <div className={cn("ml-4 w-12 h-12 rounded-full neumo-pressed flex items-center justify-center opacity-20", color)}>
                <Icon size={20} />
            </div>
        </motion.div>
    )
}

export default Dashboard
