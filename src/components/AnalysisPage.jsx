import React, { useState, useEffect } from 'react'
import { format, startOfYear, endOfYear, eachMonthOfInterval, subYears, isAfter, differenceInCalendarMonths, isSameMonth } from 'date-fns'
import { TrendingUp, Clock, CreditCard, Calendar, Globe, ArrowUpRight, Coffee } from 'lucide-react'
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

                // Parallel fetch with catch
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
    const lastYearDate = subYears(now, 1)

    const calcStats = () => {
        if (!data.length) return null
        const lastYearRecords = data.filter(r => isAfter(new Date(r.date), lastYearDate))

        const getDailyTotal = (r) => calculateDailySalary(r, { ...settings, allowance: { ...settings.allowance, exchangeRate: liveRate } })

        const lastYearSalary = lastYearRecords.reduce((sum, r) => sum + getDailyTotal(r), 0)
        const lastYearCompUnits = lastYearRecords.reduce((sum, r) => sum + calculateCompLeaveUnits(r), 0)

        const totalSalary = data.reduce((sum, r) => sum + getDailyTotal(r), 0)
        const totalComp = data.reduce((sum, r) => sum + calculateCompLeaveUnits(r), 0)

        const timestamps = data.map(r => new Date(r.date).getTime())
        const firstDay = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : now
        const monthsSpan = Math.max(1, differenceInCalendarMonths(now, firstDay) + 1)
        const yearsSpan = Math.max(1, monthsSpan / 12)

        return {
            avgAnnualSalary: totalSalary / yearsSpan,
            avgMonthlySalary: totalSalary / monthsSpan,
            totalCompInYear: lastYearCompUnits,
            avgMonthlyComp: totalComp / monthsSpan,
            lastYearSalary
        }
    }

    const stats = calcStats()
    const currentYear = now.getFullYear()
    const chartMonths = eachMonthOfInterval({
        start: startOfYear(now),
        end: endOfYear(now)
    })

    const getMonthlyStat = (month, fn) => {
        const monthStr = format(month, 'yyyy-MM')
        return data
            .filter(r => format(new Date(r.date), 'yyyy-MM') === monthStr)
            .reduce((sum, r) => sum + fn(r), 0)
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
            tooltip: {
                backgroundColor: '#E0E5EC',
                titleColor: '#202731',
                bodyColor: '#202731',
                borderColor: '#c3c9d1',
                borderWidth: 1,
            }
        },
        scales: {
            y: { beginAtZero: true, grid: { display: false }, ticks: { font: { size: 9 } } },
            x: { grid: { display: false }, ticks: { font: { size: 9 } } },
        },
    }

    const countryStats = () => {
        const counts = {}
        data.forEach(r => { if (r.travelCountry) counts[r.travelCountry] = (counts[r.travelCountry] || 0) + 1 })
        return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
    }

    return (
        <div className="space-y-8 pb-32">
            <header className="flex justify-between items-end">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tight">Analysis</h1>
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">Efficiency Dashboard</p>
                </div>
                <div className="neumo-pressed px-4 py-2 rounded-2xl flex items-center gap-2 text-[10px] font-black text-green-600">
                    <Globe size={14} className="animate-pulse" />
                    USD Rate: {liveRate.toFixed(2)}
                </div>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="年平均薪資" value={`$${Math.round(stats?.avgAnnualSalary || 0).toLocaleString()}`} sub="Total Estimate" icon={TrendingUp} color="text-neumo-brand" />
                <StatCard label="月平均薪資" value={`$${Math.round(stats?.avgMonthlySalary || 0).toLocaleString()}`} sub="Base + OT + Travel" icon={Calendar} color="text-blue-500" />
                <StatCard label="年累計補休" value={`${stats?.totalCompInYear.toFixed(1)}`} sub="Units Earned" icon={Coffee} color="text-indigo-500" />
                <StatCard label="月平均補休" value={`${stats?.avgMonthlyComp.toFixed(1)}`} sub="Units / Month" icon={Clock} color="text-orange-500" />
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

            <div className="neumo-card p-6">
                <h3 className="font-black italic flex items-center gap-2 mb-6 text-sm text-gray-400 uppercase tracking-widest">熱門出差地點</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {countryStats().slice(0, 3).map(c => (
                        <div key={c.name} className="space-y-3">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                <span className="text-gray-500">{c.name}</span>
                                <span className="text-neumo-brand">{c.count} 天</span>
                            </div>
                            <div className="h-2 neumo-pressed rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(c.count / data.length) * 100}%` }}
                                    className="h-full bg-neumo-brand"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function StatCard({ label, value, sub, icon: Icon, color }) {
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
                <h4 className="text-lg font-black leading-none mb-1">{value}</h4>
                <p className="text-[10px] font-bold text-gray-500 italic">{sub}</p>
            </div>
        </motion.div>
    )
}

export default AnalysisPage
