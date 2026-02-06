import React, { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, isWithinInterval, subDays, isSameMonth, parseISO } from 'date-fns'
import { TrendingUp, Globe, Wallet, Clock, Coffee, Moon, Gift, Eye, EyeOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { loadData, loadSettings, fetchRecordsFromGist, calculateCompLeaveUnits, calculateDailySalary, fetchExchangeRate, standardizeCountry, calculateOTHours } from '../lib/storage'
import { cn } from '../lib/utils'

function Dashboard({ isPrivacy, setIsPrivacy }) {
    const [data, setData] = useState([])
    const [settings, setSettings] = useState(null)
    const [liveRate, setLiveRate] = useState(null)
    const today = new Date()

    useEffect(() => {
        const init = async () => {
            console.log('Dashboard: Initializing...');
            const localData = loadData();
            console.log('Dashboard: Local records count:', localData.length);
            setData(localData);
            const s = loadSettings();
            setSettings(s);

            try {
                const [rate, remote] = await Promise.all([
                    fetchExchangeRate().catch(() => 32.5),
                    fetchRecordsFromGist().catch(() => null)
                ]);

                if (rate) setLiveRate(rate);
                if (remote) {
                    console.log('Dashboard: Gist remote records count:', remote.length);
                    setData(remote);
                } else {
                    console.warn('Dashboard: Failed to fetch from Gist or Gist is empty.');
                }
            } catch (err) {
                console.error('Dashboard: Init fetch error:', err);
            }
        };
        init();
    }, [])

    if (!settings) return null

    // Helper: Mask numbers if privacy mode is on
    const mask = (val) => isPrivacy ? '••••' : val;

    // Filtering Records (Fixed)
    const currentMonthInterval = { start: startOfMonth(today), end: endOfMonth(today) }
    const rollingYearInterval = { start: subDays(today, 365), end: today }

    const parse = (d) => {
        if (!d) return new Date(0);
        if (d instanceof Date) return d;
        const parsed = parseISO(d);
        if (!isNaN(parsed.getTime())) return parsed;
        return new Date(d);
    }
    const currentMonthRecords = data.filter(r => {
        const d = parse(r.date);
        return d instanceof Date && !isNaN(d) && isWithinInterval(d, currentMonthInterval);
    })
    const rollingYearRecords = data.filter(r => {
        const d = parse(r.date);
        return d instanceof Date && !isNaN(d) && isWithinInterval(d, rollingYearInterval);
    })

    const calcMetrics = (records, isMonth = false) => {
        // Robust trip count: Any day with a valid travel country string is a trip day
        const tripCount = records.filter(r => r.travelCountry && typeof r.travelCountry === 'string' && r.travelCountry.trim() !== '').length

        const totalOT = records.reduce((sum, r) => {
            let hours = parseFloat(r.otHours) || 0;
            if (hours === 0 && r.endTime) {
                hours = calculateOTHours(r.endTime, settings?.rules?.standardEndTime || "17:30");
            }
            return sum + (isNaN(hours) ? 0 : hours);
        }, 0)
        const totalComp = records.reduce((sum, r) => sum + calculateCompLeaveUnits(r), 0)
        const totalLeave = records.filter(r => r.isLeave).length

        // Sum of all daily calculated salaries (OT pay + Allowances)
        const extraPay = records.reduce((sum, r) => {
            const metrics = calculateDailySalary(r, { ...settings, liveRate });
            const val = metrics?.extra || 0;
            return sum + (isNaN(val) ? 0 : val);
        }, 0)

        const baseMonthly = settings?.salary?.baseMonthly || 50000;

        // Monthly Total = Base + Extra for this month
        // Annual Total = Base * 12 + Extra for the rolling 365 days
        const totalSalary = isMonth ? (baseMonthly + extraPay) : (baseMonthly * 12 + extraPay);

        // Allowance recalculation based on per-country rules
        const allowance = records.reduce((total, r) => {
            if (!r.travelCountry) return total;
            const country = standardizeCountry(r.travelCountry);
            let usd = 50;
            if (country === 'VN') usd = 40;
            else if (country === 'IN') usd = 70;
            else if (country === 'CN') usd = 33;
            const lineVal = usd * (liveRate || settings.allowance?.exchangeRate || 32.5);
            return total + (isNaN(lineVal) ? 0 : lineVal);
        }, 0);

        const bonus = records.reduce((sum, r) => sum + (parseFloat(r.bonus) || 0), 0)

        return { tripCount, totalOT, totalComp, totalLeave, totalSalary, allowance, bonus }
    }

    const monthStats = calcMetrics(currentMonthRecords, true)
    const yearStats = calcMetrics(rollingYearRecords, false)

    console.log('Dashboard Data Audit:', {
        allData: data.length,
        monthRecords: currentMonthRecords.length,
        yearRecords: rollingYearRecords.length,
        monthOT: monthStats.totalOT,
        monthSalary: monthStats.totalSalary,
        tripCount: monthStats.tripCount
    });

    const StatPair = ({ yearVal, monthVal, unit, color }) => (
        <div className="flex flex-col gap-2 w-full">
            <div className="flex justify-between items-baseline px-1">
                <span className="text-[9px] font-black text-gray-400 uppercase">Year</span>
                <span className={cn("text-sm font-black tracking-tight", color)}>{mask(yearVal)}{unit}</span>
            </div>
            <div className="flex justify-between items-baseline px-1 border-t border-gray-100/50 pt-1">
                <span className="text-[9px] font-black text-gray-400 uppercase">Month</span>
                <span className={cn("text-xs font-black tracking-tight opacity-80", color)}>{mask(monthVal)}{unit}</span>
            </div>
        </div>
    )

    const widgets = [
        { label: '獎金計算', year: `$${Math.round(yearStats.bonus).toLocaleString()}`, month: `$${Math.round(monthStats.bonus).toLocaleString()}`, icon: Gift, color: 'text-amber-500' },
        { label: '出差天數', year: yearStats.tripCount, month: monthStats.tripCount, unit: 'd', icon: Globe, color: 'text-green-500' },
        { label: '津貼估計', year: `$${Math.round(yearStats.allowance).toLocaleString()}`, month: `$${Math.round(monthStats.allowance).toLocaleString()}`, icon: Wallet, color: 'text-orange-500' },
        { label: '薪資估計', year: `$${Math.round(yearStats.totalSalary).toLocaleString()}`, month: `$${Math.round(monthStats.totalSalary).toLocaleString()}`, icon: TrendingUp, color: 'text-purple-500' },
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="neumo-card p-6 flex items-center gap-6"
        >
            <div className={cn("w-12 h-12 rounded-2xl neumo-pressed flex items-center justify-center flex-shrink-0", color)}>
                <Icon size={24} />
            </div>

            <div className="flex-1 space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-0.5">
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Rolling Year</p>
                        <div className="flex items-baseline gap-1">
                            <span className={cn("text-2xl font-black tabular-nums tracking-tighter", color)}>{mask(yearVal)}</span>
                            <span className="text-[9px] font-black text-gray-400 uppercase">{unit}</span>
                        </div>
                    </div>
                    <div className="space-y-0.5 border-l border-gray-100 pl-4">
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">This Month</p>
                        <div className="flex items-baseline gap-1">
                            <span className={cn("text-lg font-black tabular-nums tracking-tighter opacity-70", color)}>{mask(monthVal)}</span>
                            <span className="text-[9px] font-black text-gray-400 uppercase">{unit}</span>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

export default Dashboard
