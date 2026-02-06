import React, { useState, useEffect } from 'react'
import { format, startOfYear, endOfYear, eachMonthOfInterval, isSameMonth, subDays, isWithinInterval, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, subMonths } from 'date-fns'
import { TrendingUp, Clock, Calendar, Globe, ArrowUpRight, Coffee, Trophy, BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    BarController,
    LineController,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js'
import { Bar, Line, Chart } from 'react-chartjs-2'
import { cn } from '../lib/utils'
import { loadData, fetchRecordsFromGist, loadSettings, calculateDailySalary, fetchExchangeRate, calculateCompLeaveUnits } from '../lib/storage'

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    BarController,
    LineController,
    Title,
    Tooltip,
    Legend,
    Filler
)

function AnalysisPage() {
    const [data, setData] = useState([])
    const [settings, setSettings] = useState(null)
    const [liveRate, setLiveRate] = useState(32.5)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const init = async () => {
            try {
                const s = loadSettings()
                setSettings(s)
                setData(loadData())

                const [rate, remote] = await Promise.all([
                    fetchExchangeRate().catch(() => 32.5),
                    fetchRecordsFromGist().catch(() => null)
                ]);

                if (rate) setLiveRate(rate)
                if (remote) setData(remote)
            } catch (err) {
                console.error("Analysis init error:", err)
            } finally {
                setIsLoading(false)
            }
        }
        init()
    }, [])

    if (!settings || isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <div className="h-10 w-10 border-[6px] border-neumo-brand border-t-transparent rounded-full animate-spin opacity-40" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Loading Insights...</p>
        </div>
    )

    const now = new Date()
    const rollingYearInterval = { start: subDays(now, 365), end: now }
    const currentMonthInterval = { start: startOfMonth(now), end: endOfMonth(now) }

    // Safety parse
    const parse = (d) => {
        if (!d) return new Date(0);
        if (d instanceof Date) return d;
        const parsed = parseISO(d);
        if (!isNaN(parsed.getTime())) return parsed;
        return new Date(d);
    }
    const rollingYearRecords = data.filter(r => {
        const d = parse(r.date);
        return d instanceof Date && !isNaN(d) && isWithinInterval(d, rollingYearInterval);
    })
    const currentMonthRecords = data.filter(r => {
        const d = parse(r.date);
        return d instanceof Date && !isNaN(d) && isWithinInterval(d, currentMonthInterval);
    })

    const calcStats = () => {
        const getMetrics = (records) => {
            const totalSalary = records.reduce((sum, r) => sum + calculateDailySalary(r, { ...settings, liveRate }), 0)
            const totalOT = records.reduce((sum, r) => sum + (parseFloat(r.otHours) || 0), 0)
            const totalComp = records.reduce((sum, r) => sum + calculateCompLeaveUnits(r), 0)
            return { totalSalary, totalOT, totalComp }
        }

        const yearMetrics = getMetrics(rollingYearRecords)
        const monthMetrics = getMetrics(currentMonthRecords)

        const rollingAnnualSalary = (settings.salary?.baseMonthly || 50000) * 12 + yearMetrics.totalSalary
        const rollingMonthlySalary = rollingAnnualSalary / 12

        return {
            rollingAnnualSalary,
            rollingMonthlySalary,
            totalCompInYear: yearMetrics.totalComp,
            totalCompInMonth: monthMetrics.totalComp,
            yearOT: yearMetrics.totalOT,
            monthOT: monthMetrics.totalOT
        }
    }

    const stats = calcStats()
    const chartMonths = eachMonthOfInterval({
        start: startOfMonth(subMonths(now, 11)),
        end: endOfMonth(now)
    })

    const getMonthlyStat = (month, fn) => {
        const filtered = data.filter(r => {
            const d = parse(r.date);
            return d instanceof Date && !isNaN(d) && isSameMonth(d, month);
        })
        return filtered.reduce((sum, r) => sum + fn(r), 0)
    }

    const otByMonth = chartMonths.map(m => getMonthlyStat(m, r => parseFloat(r.otHours) || 0))
    const compByMonth = chartMonths.map(m => getMonthlyStat(m, r => calculateCompLeaveUnits(r)))

    // 1. Merged Chart: OT Hours & Comp Leave
    const mergedData = {
        labels: chartMonths.map(m => format(m, 'MMM')),
        datasets: [
            {
                type: 'bar',
                label: '加班時數 (H)',
                data: otByMonth,
                backgroundColor: 'rgba(99, 102, 241, 0.4)',
                borderColor: 'rgb(99, 102, 241)',
                borderWidth: 1,
                borderRadius: 4,
                yAxisID: 'y',
            },
            {
                type: 'line',
                label: '補休單位',
                data: compByMonth,
                borderColor: 'rgb(79, 70, 229)',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                yAxisID: 'y1',
            }
        ]
    }

    // 2. Attendance & Leave Grid Logic (GitHub style)
    const currentMonthDays = eachDayOfInterval({ start: startOfMonth(now), end: endOfMonth(now) })
    const attendanceBoxes = currentMonthDays.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd')
        const record = data.find(r => {
            const d = parse(r.date);
            return d instanceof Date && !isNaN(d) && format(d, 'yyyy-MM-dd') === dayStr;
        })

        let type = 'none'; // no record
        if (record) {
            type = record.isLeave ? 'leave' : 'attendance';
        }
        return { day, type };
    })

    // Options for OT/Comp Chart
    const mergedOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: { boxWidth: 10, font: { size: 9, weight: 'bold' } }
            }
        },
        scales: {
            y: { position: 'left', grid: { display: false }, ticks: { font: { size: 9 } }, title: { display: true, text: '加班時數', font: { size: 8, weight: 'bold' } } },
            y1: { position: 'right', grid: { display: false }, ticks: { font: { size: 9 } }, title: { display: true, text: '補休單位', font: { size: 8, weight: 'bold' } } },
            x: { grid: { display: false }, ticks: { font: { size: 9 } } },
        },
    }

    const countryStats = () => {
        const counts = {}
        data.forEach(r => {
            if (r.travelCountry) {
                const code = r.travelCountry.toUpperCase() === '越南' || r.travelCountry.toUpperCase() === 'VIETNAM' ? 'VN' : r.travelCountry.toUpperCase();
                counts[code] = (counts[code] || 0) + 1
            }
        })
        return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
    }

    const totalOTSum = data.reduce((sum, r) => sum + (parseFloat(r.otHours) || 0), 0)
    const totalCompSum = data.reduce((sum, r) => sum + calculateCompLeaveUnits(r), 0)

    return (
        <div className="space-y-8 pb-32">
            <header className="flex justify-between items-end">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tight">Analysis</h1>
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">Efficiency Dashboard (Rolling 365D)</p>
                </div>
                <div className="neumo-pressed px-4 py-2 rounded-2xl flex items-center gap-2 text-[10px] font-black text-green-600">
                    <Globe size={14} className="animate-pulse" />
                    USD Rate: {liveRate.toFixed(2)}
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard label="當年年薪 (Rolling 365)" value={`$${Math.round(stats?.rollingAnnualSalary || 0).toLocaleString()}`} sub="Estimated Cumulative" icon={TrendingUp} color="text-neumo-brand" />
                <StatCard label="月平均薪資 (Rolling 365)" value={`$${Math.round(stats?.rollingMonthlySalary || 0).toLocaleString()}`} sub="Monthly Projection" icon={Calendar} color="text-blue-500" />
                <StatCard
                    label="累計補休"
                    value={`${stats?.totalCompInYear.toFixed(1)}`}
                    unit="單"
                    sub={`本月增: ${stats?.totalCompInMonth.toFixed(1)}`}
                    icon={Coffee}
                    color="text-indigo-500"
                />
            </div>

            <div className="space-y-6">
                {/* Chart 1: Overtime & Comp Leave */}
                <div className="neumo-card h-[350px] flex flex-col p-6">
                    <h3 className="font-black italic flex items-center gap-2 mb-6 text-sm text-gray-400 uppercase tracking-widest">
                        加班與補休趨勢 <ArrowUpRight size={14} />
                    </h3>
                    <div className="flex-1">
                        <Chart type="bar" data={mergedData} options={mergedOptions} />
                    </div>
                </div>

                {/* Chart 2: Attendance Registry (GitHub Style) */}
                <div className="neumo-card flex flex-col p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black italic flex items-center gap-2 text-sm text-[#202731] uppercase tracking-widest">
                            本月出勤紀錄 (Contribution Grid) <BarChart3 size={14} className="text-neumo-brand" />
                        </h3>
                        <div className="flex items-center gap-4 text-[8px] font-black uppercase tracking-widest">
                            <span className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-sm" /> 出勤</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 bg-rose-500 rounded-sm" /> 休假</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 bg-gray-200 rounded-sm" /> 無資料</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-start md:justify-center p-2">
                        {attendanceBoxes.map((box, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-1">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: idx * 0.01 }}
                                    className={cn(
                                        "w-8 h-8 md:w-10 md:h-10 rounded-lg shadow-sm transition-colors duration-300",
                                        box.type === 'attendance' ? "bg-green-500 shadow-green-200" :
                                            box.type === 'leave' ? "bg-rose-500 shadow-rose-200" :
                                                "bg-gray-100"
                                    )}
                                    title={`${format(box.day, 'yyyy-MM-dd')}: ${box.type}`}
                                />
                                <span className="text-[7px] font-black text-gray-400">{format(box.day, 'd')}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-xl font-black italic flex items-center gap-2 px-2">
                    <Trophy className="text-amber-500" /> 歷史戰績總覽
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <HistoryCard label="出差總戰績" items={countryStats().slice(0, 3)} />
                    <HistoryCountCard label="補休總戰績" value={totalCompSum.toFixed(1)} sub="累計獲得單位" icon={Coffee} color="text-indigo-600" bgColor="text-indigo-500" />
                    <HistoryCountCard label="加班總戰績" value={totalOTSum.toFixed(0)} sub="累計總時數 (H)" icon={Clock} color="text-blue-600" bgColor="text-blue-500" />
                </div>
            </div>
        </div>
    )
}

function StatCard({ label, value, sub, unit, icon: Icon, color }) {
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="neumo-card p-5 space-y-3">
            <div className={cn("p-2 rounded-xl neumo-pressed inline-flex", color)}><Icon size={18} /></div>
            <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                <h4 className="text-lg font-black leading-none mb-1">{value}<span className="text-xs ml-0.5">{unit || ''}</span></h4>
                <p className="text-[10px] font-bold text-gray-500 italic">{sub}</p>
            </div>
        </motion.div>
    )
}

function HistoryCard({ label, items }) {
    return (
        <div className="neumo-card p-6">
            <h3 className="font-black italic text-sm text-gray-400 uppercase tracking-widest mb-6">{label}</h3>
            <div className="space-y-4">
                {items.map(c => (
                    <div key={c.name} className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                            <span className="text-gray-500">{c.name}</span>
                            <span className="text-neumo-brand">{c.count} 天</span>
                        </div>
                        <div className="h-1.5 neumo-pressed rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${(c.count / (items[0]?.count || 1)) * 100}%` }} className="h-full bg-neumo-brand" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function HistoryCountCard({ label, value, sub, icon: Icon, color, bgColor }) {
    return (
        <div className="neumo-card p-6 flex flex-col justify-center items-center text-center gap-2">
            <Icon size={32} className={cn("opacity-30 mb-2", bgColor)} />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
            <h4 className={cn("text-4xl font-black", color)}>{value}</h4>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{sub}</p>
        </div>
    )
}

export default AnalysisPage
