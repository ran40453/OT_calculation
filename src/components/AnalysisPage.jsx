import React, { useState, useEffect } from 'react'
import { format, startOfYear, endOfYear, eachMonthOfInterval, subYears, isAfter, differenceInCalendarMonths, isSameMonth, subDays, isWithinInterval } from 'date-fns'
import { TrendingUp, Clock, CreditCard, Calendar, Globe, ArrowUpRight, Coffee, Trophy } from 'lucide-react'
import { motion } from 'framer-motion'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { cn } from '../lib/utils'
import { loadData, fetchRecordsFromGist, loadSettings, calculateDailySalary, fetchExchangeRate, calculateCompLeaveUnits } from '../lib/storage'

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
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
    const parse = (d) => new Date(d)

    // Filtering
    const rollingYearRecords = data.filter(r => isWithinInterval(parse(r.date), rollingYearInterval))
    const currentMonthRecords = data.filter(r => isWithinInterval(parse(r.date), currentMonthInterval))

    const calcStats = () => {
        if (!data.length) return null

        const getMetrics = (records) => {
            const totalSalary = records.reduce((sum, r) => sum + calculateDailySalary(r, { ...settings, liveRate }), 0)
            const totalOT = records.reduce((sum, r) => sum + (parseFloat(r.otHours) || 0), 0)
            const totalComp = records.reduce((sum, r) => sum + calculateCompLeaveUnits(r), 0)
            return { totalSalary, totalOT, totalComp }
        }

        const yearMetrics = getMetrics(rollingYearRecords)
        const monthMetrics = getMetrics(currentMonthRecords)

        // For "Rolling" Annual Salary calculation:
        // Base Salary * 12 + Daily OT/Travel from the last 365 days
        const rollingAnnualSalary = (settings.salary.baseMonthly * 12) + yearMetrics.totalSalary
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
        start: startOfYear(now),
        end: endOfYear(now)
    })

    const getMonthlyStat = (month, fn) => {
        const monthStr = format(month, 'yyyy-MM')
        const filtered = data.filter(r => format(parse(r.date), 'yyyy-MM') === monthStr)
        return filtered.reduce((sum, r) => sum + fn(r), 0)
    }

    const otByMonth = chartMonths.map(m => getMonthlyStat(m, r => parseFloat(r.otHours) || 0))
    const compByMonth = chartMonths.map(m => getMonthlyStat(m, r => calculateCompLeaveUnits(r)))

    const barData = {
        labels: chartMonths.map(m => format(m, 'MMM')),
        datasets: [{
            label: 'OT Hours',
            data: otByMonth,
            backgroundColor: 'rgba(99, 102, 241, 0.4)',
            borderColor: 'rgb(99, 102, 241)',
            borderWidth: 1,
            borderRadius: 4,
        }]
    }

    const compLineData = {
        labels: chartMonths.map(m => format(m, 'MMM')),
        datasets: [{
            label: 'Comp Leave Units',
            data: compByMonth,
            borderColor: 'rgb(79, 70, 229)',
            backgroundColor: 'rgba(79, 70, 229, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: 'rgb(79, 70, 229)',
        }]
    }

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
        },
        scales: {
            y: { beginAtZero: true, grid: { display: false }, ticks: { font: { size: 9 } } },
            x: { grid: { display: false }, ticks: { font: { size: 9 } } },
        },
    }

    const countryStats = () => {
        const counts = {}
        data.forEach(r => {
            if (r.travelCountry) {
                const code = r.travelCountry === '越南' || r.travelCountry === 'VIETNAM' ? 'VN' : r.travelCountry;
                counts[code] = (counts[code] || 0) + 1
            }
        })
        return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
    }

    const totalOTSum = data.reduce((sum, r) => sum + (parseFloat(r.otHours) || 0), 0)
    const totalCompSum = data.reduce((sum, r) => sum + calculateCompLeaveUnits(r), 0)

    return (
        <div className="space-y-8 pb-32 focus-none">
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
                    isDual
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="neumo-card h-[300px] flex flex-col p-6">
                    <h3 className="font-black italic flex items-center gap-2 mb-6 text-sm text-gray-400 uppercase tracking-widest">
                        加班時數統計 <ArrowUpRight size={14} />
                    </h3>
                    <div className="flex-1">
                        <Bar data={barData} options={chartOptions} />
                    </div>
                </div>

                <div className="neumo-card h-[300px] flex flex-col p-6">
                    <h3 className="font-black italic flex items-center gap-2 mb-6 text-sm text-indigo-400 uppercase tracking-widest">
                        補休累計趨勢 <Coffee size={14} />
                    </h3>
                    <div className="flex-1">
                        <Line data={compLineData} options={chartOptions} />
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-xl font-black italic flex items-center gap-2 px-2">
                    <Trophy className="text-amber-500" /> 歷史戰績總覽
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 出差總戰績 */}
                    <div className="neumo-card p-6">
                        <h3 className="font-black italic flex items-center gap-2 mb-6 text-sm text-gray-400 uppercase tracking-widest">出差總戰績</h3>
                        <div className="space-y-4">
                            {countryStats().slice(0, 3).map(c => (
                                <div key={c.name} className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                        <span className="text-gray-500">{c.name}</span>
                                        <span className="text-neumo-brand">{c.count} 天</span>
                                    </div>
                                    <div className="h-1.5 neumo-pressed rounded-full overflow-hidden">
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${(c.count / (countryStats()[0]?.count || 1)) * 100}%` }} className="h-full bg-neumo-brand" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 補休總戰績 */}
                    <div className="neumo-card p-6 flex flex-col justify-center items-center text-center gap-2">
                        <Coffee size={32} className="text-indigo-500 opacity-30 mb-2" />
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">補休總戰績</p>
                        <h4 className="text-4xl font-black text-indigo-600">{totalCompSum.toFixed(1)}</h4>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">累計獲得單位</p>
                    </div>

                    {/* 加班總戰績 */}
                    <div className="neumo-card p-6 flex flex-col justify-center items-center text-center gap-2">
                        <Clock size={32} className="text-blue-500 opacity-30 mb-2" />
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">加班總戰績</p>
                        <h4 className="text-4xl font-black text-blue-600">{totalOTSum.toFixed(0)}</h4>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">累計總時數 (H)</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

function StatCard({ label, value, sub, unit, icon: Icon, color }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="neumo-card p-5 space-y-3"
        >
            <div className={cn("p-2 rounded-xl neumo-pressed inline-flex", color)}>
                <Icon size={18} />
            </div>
            <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                <h4 className="text-lg font-black leading-none mb-1">{value}<span className="text-xs ml-0.5">{unit || ''}</span></h4>
                <p className="text-[10px] font-bold text-gray-500 italic">{sub}</p>
            </div>
        </motion.div>
    )
}

export default AnalysisPage
