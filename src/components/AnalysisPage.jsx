import React, { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, isSameMonth, subDays, isWithinInterval, subMonths, eachDayOfInterval, parseISO, isSameDay, addDays, getDay } from 'date-fns'
import { TrendingUp, Clock, Calendar, Globe, ArrowUpRight, Coffee, Trophy, BarChart3, Gift, X, Edit2, Trash2, Check, Plane, Briefcase, MapPin } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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
import { loadSettings, calculateDailySalary, fetchExchangeRate, calculateCompLeaveUnits, calculateOTHours, standardizeCountry, saveData, syncRecordsToGist } from '../lib/storage'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, BarController, LineController, Title, Tooltip, Legend, Filler)

function AnalysisPage({ data, onUpdate, isPrivacy }) {
    const [settings, setSettings] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [liveRate, setLiveRate] = useState(32.5);
    const [activeTab, setActiveTab] = useState('financial'); // financial, travel
    const [isSalaryDetailOpen, setIsSalaryDetailOpen] = useState(false);
    const [isBonusDetailOpen, setIsBonusDetailOpen] = useState(false);
    const [isLeaveListOpen, setIsLeaveListOpen] = useState(false);
    const [isTravelListOpen, setIsTravelListOpen] = useState(false);
    const [isOTListOpen, setIsOTListOpen] = useState(false);

    const mask = (val) => isPrivacy ? '••••' : val;

    useEffect(() => {
        const init = async () => {
            const s = loadSettings();
            setSettings(s);
            try {
                const rate = await fetchExchangeRate().catch(() => 32.5);
                if (rate) setLiveRate(rate);
            } catch (err) {
                console.error('Analysis: Fetch error:', err);
            }
            setIsLoading(false);
        };
        init();
    }, []);

    if (!settings || isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <div className="h-10 w-10 border-[6px] border-neumo-brand border-t-transparent rounded-full animate-spin opacity-40" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Loading Insights...</p>
        </div>
    )

    const now = new Date()
    const rollingYearInterval = { start: subDays(now, 365), end: now }
    const currentMonthInterval = { start: startOfMonth(now), end: endOfMonth(now) }
    const chartMonths = eachMonthOfInterval({ start: startOfMonth(subMonths(now, 11)), end: endOfMonth(now) })

    // Data Parsing
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

    // Stats Calculation
    const calcStats = () => {
        const getMetrics = (records) => {
            const extraTotal = records.reduce((sum, r) => {
                const results = calculateDailySalary(r, { ...settings, liveRate });
                return sum + (results?.extra || 0);
            }, 0)
            const totalOT = records.reduce((sum, r) => sum + (parseFloat(r.otHours) || (r.endTime ? calculateOTHours(r.endTime, settings?.rules?.standardEndTime) : 0)), 0)
            const totalComp = records.reduce((sum, r) => sum + calculateCompLeaveUnits(r), 0)
            const totalBonus = records.reduce((sum, r) => sum + (parseFloat(r.bonus) || 0), 0)
            const totalTravel = records.reduce((sum, r) => {
                const results = calculateDailySalary(r, { ...settings, liveRate });
                return sum + (results?.travelAllowance || 0);
            }, 0)
            const totalOTPay = records.reduce((sum, r) => {
                const results = calculateDailySalary(r, { ...settings, liveRate });
                return sum + (results?.otPay || 0);
            }, 0)
            // Trip count (days with country)
            const tripCount = records.filter(r => r.travelCountry && r.travelCountry.trim() !== '').length

            return { extraTotal, totalOT, totalComp, totalBonus, totalTravel, totalOTPay, tripCount }
        }

        const yearMetrics = getMetrics(rollingYearRecords)

        // Calculate Base Salary
        let totalBaseInYear = 0;
        chartMonths.forEach(m => {
            let base = parseFloat(settings.salary?.baseMonthly) || 50000;
            if (settings.salaryHistory && Array.isArray(settings.salaryHistory)) {
                const sortedHistory = [...settings.salaryHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
                const monthEnd = endOfMonth(m);
                const applicable = sortedHistory.find(h => new Date(h.date) <= monthEnd);
                if (applicable) base = parseFloat(applicable.amount) || base;
            }
            totalBaseInYear += base;
        });

        const rollingAnnualSalary = totalBaseInYear + yearMetrics.extraTotal
        const rollingMonthlySalary = rollingAnnualSalary / 12

        return {
            rollingAnnualSalary,
            rollingMonthlySalary,
            yearMetrics,
            breakdown: {
                base: totalBaseInYear,
                ot: yearMetrics.totalOTPay,
                travel: yearMetrics.totalTravel,
                bonus: yearMetrics.totalBonus
            }
        }
    }

    const stats = calcStats();

    // Chart Data Preparation
    const getMonthlyStat = (month, fn) => {
        const filtered = data.filter(r => isSameMonth(parse(r.date), month));
        return filtered.reduce((sum, r) => sum + (fn(r) || 0), 0);
    }

    // Financial Chart Data
    const baseByMonth = chartMonths.map(m => {
        let base = parseFloat(settings.salary?.baseMonthly) || 50000;
        if (settings.salaryHistory && Array.isArray(settings.salaryHistory)) {
            const sortedHistory = [...settings.salaryHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
            const monthEnd = endOfMonth(m);
            const applicable = sortedHistory.find(h => new Date(h.date) <= monthEnd);
            if (applicable) base = parseFloat(applicable.amount) || base;
        }
        return base;
    });
    const bonusByMonth = chartMonths.map(m => getMonthlyStat(m, r => parseFloat(r.bonus)));
    const otPayByMonth = chartMonths.map(m => getMonthlyStat(m, r => calculateDailySalary(r, { ...settings, liveRate }).otPay));
    const travelByMonth = chartMonths.map(m => getMonthlyStat(m, r => calculateDailySalary(r, { ...settings, liveRate }).travelAllowance));
    const totalIncomeByMonth = chartMonths.map((m, i) => baseByMonth[i] + bonusByMonth[i] + otPayByMonth[i] + travelByMonth[i]);

    const incomeData = {
        labels: chartMonths.map(m => format(m, 'MMM')),
        datasets: [
            { label: '總收入', data: totalIncomeByMonth, borderColor: 'rgb(253, 224, 71)', backgroundColor: 'rgba(253, 224, 71, 0.4)', fill: true, tension: 0.4, borderWidth: 3, pointRadius: 0, order: 1 },
            { label: '底薪', data: baseByMonth, borderColor: 'rgb(56, 189, 248)', borderWidth: 1, pointRadius: 0, hidden: true },
            { label: '獎金', data: bonusByMonth, borderColor: 'rgb(245, 158, 11)', borderWidth: 1, pointRadius: 0, hidden: true },
            { label: '加班費', data: otPayByMonth, borderColor: 'rgb(255, 69, 0)', borderWidth: 1, pointRadius: 0, hidden: true },
        ]
    };

    // Travel Chart Data
    const otByMonth = chartMonths.map(m => getMonthlyStat(m, r => parseFloat(r.otHours) || (r.endTime ? calculateOTHours(r.endTime, settings?.rules?.standardEndTime) : 0)));
    const compByMonth = chartMonths.map(m => getMonthlyStat(m, r => r.otType === 'leave' ? calculateCompLeaveUnits(r) : 0)); // Wait, Comp By Month in Units or Hours?
    // Using calculateCompLeaveUnits returns units. The chart usually compares HOURS vs UNITS or Hours vs Hours.
    // Dashboard compares OT Hours vs Comp Units.
    // Let's use Units for Comp.

    const travelData = {
        labels: chartMonths.map(m => format(m, 'MMM')),
        datasets: [
            { type: 'bar', label: '加班時數', data: otByMonth, backgroundColor: 'rgba(99, 102, 241, 0.4)', borderColor: 'rgb(99, 102, 241)', borderWidth: 1, borderRadius: 4, yAxisID: 'y', order: 2 },
            { type: 'line', label: '補休單位', data: compByMonth, borderColor: 'rgb(79, 70, 229)', fill: false, tension: 0.4, yAxisID: 'y1', order: 1 }
        ]
    };

    // Attendance Grid
    const currentMonthDays = eachDayOfInterval(currentMonthInterval);
    const attendanceBoxes = currentMonthDays.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const record = data.find(r => format(parse(r.date), 'yyyy-MM-dd') === dayStr);
        let type = 'none';
        if (record) type = record.isLeave ? 'leave' : 'attendance';
        return { day, type };
    });

    const attendedCount = attendanceBoxes.filter(b => b.type === 'attendance').length;
    const totalDays = attendanceBoxes.length;
    const attendedPercent = totalDays > 0 ? Math.round((attendedCount / totalDays) * 100) : 0;

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false }, ticks: { font: { size: 9 } } }, y: { display: false } }
    };

    const travelOptions = {
        ...options,
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 9 } } },
            y: { display: false, position: 'left' },
            y1: { display: false, position: 'right' }
        },
        plugins: {
            legend: { display: false },
            tooltip: { enabled: true }
        }
    }

    // Custom Plugin to draw text values on Workload Chart
    const valuePlugin = {
        id: 'valuePlugin',
        afterDatasetsDraw(chart) {
            const { ctx, data } = chart;
            ctx.save();
            ctx.font = 'bold 9px sans-serif';
            ctx.fillStyle = '#6b7280'; // gray-500
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';

            chart.data.datasets.forEach((dataset, i) => {
                const meta = chart.getDatasetMeta(i);
                if (!meta.hidden) {
                    meta.data.forEach((element, index) => {
                        const value = dataset.data[index];
                        if (value > 0) {
                            const position = element.tooltipPosition();
                            ctx.fillStyle = dataset.type === 'line' ? '#4f46e5' : '#6366f1';
                            ctx.fillText(value.toFixed(0), position.x, position.y - 2);
                        }
                    });
                }
            });
            ctx.restore();
        }
    }


    const countryStats = () => {
        const counts = {}
        data.forEach(r => {
            const country = standardizeCountry(r.travelCountry);
            if (country) counts[country] = (counts[country] || 0) + 1
        })
        return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
    }

    const leaveTypeStats = () => {
        const counts = {}
        data.filter(r => r.isLeave).forEach(r => {
            const type = r.leaveType || '未分類';
            const days = (parseFloat(r.leaveDuration) || 8) / 8;
            counts[type] = (counts[type] || 0) + days;
        });
        return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    }

    return (
        <div className="space-y-6 pb-32">
            <header className="flex justify-between items-end">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tight">Analysis</h1>
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">Insights & Trends</p>
                </div>
                <div className="neumo-pressed px-3 py-1.5 rounded-xl flex items-center gap-2 text-[9px] font-black text-green-600">
                    <Globe size={12} className="animate-pulse" />
                    USD: {liveRate.toFixed(2)}
                </div>
            </header>

            {/* Tab Navigation */}
            <div className="flex gap-2 p-1 neumo-pressed rounded-2xl">
                <button
                    onClick={() => setActiveTab('financial')}
                    className={cn(
                        "flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        activeTab === 'financial' ? "bg-neumo-brand text-white shadow-lg" : "text-gray-400 hover:text-gray-600"
                    )}
                >
                    <span className="flex items-center justify-center gap-2"><Briefcase size={14} /> Financial</span>
                </button>
                <button
                    onClick={() => setActiveTab('travel')}
                    className={cn(
                        "flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        activeTab === 'travel' ? "bg-indigo-500 text-white shadow-lg" : "text-gray-400 hover:text-gray-600"
                    )}
                >
                    <span className="flex items-center justify-center gap-2"><Plane size={14} /> Travel</span>
                </button>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'financial' && (
                    <motion.div
                        key="financial"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-6"
                    >
                        {/* Financial Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div onClick={() => setIsSalaryDetailOpen(true)} className="cursor-pointer">
                                <StatCard
                                    label="當年年薪 (Rolling 365)"
                                    value={mask(`$${Math.round(stats.rollingAnnualSalary).toLocaleString()}`)}
                                    icon={Briefcase}
                                    color="text-neumo-brand"
                                    sub="點擊查看明細"
                                />
                            </div>
                            <StatCard
                                label="月平均薪資"
                                value={mask(`$${Math.round(stats.rollingMonthlySalary).toLocaleString()}`)}
                                icon={TrendingUp}
                                color="text-blue-500"
                            />
                        </div>
                        <div onClick={() => setIsBonusDetailOpen(true)} className="cursor-pointer">
                            <StatCard
                                label="累計獎金與津貼"
                                value={mask(`$${Math.round(stats.yearMetrics.totalBonus + stats.yearMetrics.totalTravel).toLocaleString()}`)}
                                icon={Gift}
                                color="text-amber-500"
                                sub={`獎金: ${mask('$' + Math.round(stats.yearMetrics.totalBonus).toLocaleString())} / 津貼: ${mask('$' + Math.round(stats.yearMetrics.totalTravel).toLocaleString())}`}
                            />
                        </div>

                        {/* Income Trend Chart */}
                        <div className="neumo-card h-[360px] p-4 flex flex-col">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">年度收入趨勢</h3>
                            <div className="flex-1 min-h-0 relative">
                                <Line data={incomeData} options={{ ...options, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                            </div>
                            {/* Series Thumbnails / Legend */}
                            <div className="flex gap-4 mt-4 overflow-x-auto pb-2 custom-scrollbar">
                                <LegendItem color="bg-yellow-400" label="總收入" value={mask('$' + Math.round(stats.rollingAnnualSalary).toLocaleString())} />
                                <LegendItem color="bg-sky-400" label="底薪" value={mask('$' + Math.round(stats.breakdown.base).toLocaleString())} />
                                <LegendItem color="bg-amber-500" label="獎金" value={mask('$' + Math.round(stats.breakdown.bonus).toLocaleString())} />
                                <LegendItem color="bg-orange-500" label="加班費" value={mask('$' + Math.round(stats.breakdown.ot).toLocaleString())} />
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'travel' && (
                    <motion.div
                        key="travel"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-6"
                    >
                        {/* Travel Stats & History */}
                        <div className="grid grid-cols-3 gap-3">
                            <div onClick={() => setIsLeaveListOpen(true)} className="cursor-pointer group relative">
                                <div className="absolute inset-0 bg-rose-400/0 group-hover:bg-rose-400/5 rounded-2xl transition-colors" />
                                <MiniStatCard label="請假" value={data.filter(r => r.isLeave).length} unit="Recs" color="text-rose-500" />
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-rose-300">
                                    <ArrowUpRight size={12} />
                                </div>
                            </div>
                            <div onClick={() => setIsTravelListOpen(true)} className="cursor-pointer group relative">
                                <div className="absolute inset-0 bg-emerald-400/0 group-hover:bg-emerald-400/5 rounded-2xl transition-colors" />
                                <MiniStatCard label="出差" value={stats.yearMetrics.tripCount} unit="Days" color="text-emerald-500" />
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-300">
                                    <ArrowUpRight size={12} />
                                </div>
                            </div>
                            <div onClick={() => setIsOTListOpen(true)} className="cursor-pointer group relative">
                                <div className="absolute inset-0 bg-indigo-400/0 group-hover:bg-indigo-400/5 rounded-2xl transition-colors" />
                                <MiniStatCard label="加班" value={stats.yearMetrics.totalOT.toFixed(0)} unit="H" color="text-indigo-500" />
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-300">
                                    <ArrowUpRight size={12} />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <HistoryCard label="出差國家分佈" items={countryStats().slice(0, 3)} />
                            <LeaveBreakdownCard label="假別統計 (Days)" items={leaveTypeStats()} />
                        </div>

                        {/* Attendance Grid */}
                        <div className="neumo-card p-4">
                            <div className="flex justify-between items-end mb-4">
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">本月出勤概況</h3>
                                <div className="text-[10px] font-bold text-gray-500">
                                    <span className="text-neumo-brand">{attendedCount}</span>
                                    <span className="text-gray-300 mx-1">/</span>
                                    <span>{totalDays}</span>
                                    <span className="ml-2 text-xs font-black text-gray-300">({attendedPercent}%)</span>
                                </div>
                            </div>
                            <div className="flex gap-1 overflow-x-auto pb-2 custom-scrollbar">
                                {attendanceBoxes.map((box, i) => (
                                    <div key={i} className="flex flex-col items-center gap-1 min-w-[20px]">
                                        <div className={cn(
                                            "w-6 h-6 rounded-md",
                                            box.type === 'attendance' ? "bg-green-500" : box.type === 'leave' ? "bg-rose-500" : "bg-gray-100"
                                        )} />
                                        <span className="text-[8px] font-bold text-gray-300">{format(box.day, 'd')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Work Load Chart */}
                        <div className="neumo-card h-[300px] p-4 flex flex-col">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">工作負荷趨勢 (OT vs Comp)</h3>
                            <div className="flex-1 min-h-0 relative">
                                <Chart type="bar" data={travelData} options={travelOptions} plugins={[valuePlugin]} />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modals */}
            <SalaryDetailModal
                isOpen={isSalaryDetailOpen}
                onClose={() => setIsSalaryDetailOpen(false)}
                data={stats.breakdown}
                total={stats.rollingAnnualSalary}
                mask={mask}
            />
            <BonusDetailModal
                isOpen={isBonusDetailOpen}
                onClose={() => setIsBonusDetailOpen(false)}
                data={data}
                onUpdate={(newData) => {
                    onUpdate(newData);
                    saveData(newData);
                    syncRecordsToGist(newData);
                }}
                isPrivacy={isPrivacy}
            />
            <LeaveListModal
                isOpen={isLeaveListOpen}
                onClose={() => setIsLeaveListOpen(false)}
                data={data.filter(r => r.isLeave)}
                mask={mask}
            />
            <TravelListModal
                isOpen={isTravelListOpen}
                onClose={() => setIsTravelListOpen(false)}
                data={data.filter(r => r.travelCountry)}
            />
            <OTListModal
                isOpen={isOTListOpen}
                onClose={() => setIsOTListOpen(false)}
                data={data.filter(r => parseFloat(r.otHours) > 0)}
                settings={settings}
                liveRate={liveRate}
            />
        </div>
    )
}

function StatCard({ label, value, sub, unit, icon: Icon, color }) {
    return (
        <div className="neumo-card p-5 space-y-3 h-full">
            <div className="flex justify-between items-start">
                <div className={cn("p-2 rounded-xl neumo-pressed inline-flex", color)}><Icon size={18} /></div>
            </div>
            <div>
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                <h4 className="text-xl font-black leading-none mb-1">{value}<span className="text-xs ml-0.5">{unit || ''}</span></h4>
                {sub && <p className="text-[10px] font-bold text-gray-500 italic mt-1">{sub}</p>}
            </div>
        </div>
    )
}

function MiniStatCard({ label, value, unit, color }) {
    return (
        <div className="neumo-card p-3 flex flex-col items-center justify-center space-y-1 h-full">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
            <h4 className={cn("text-xl font-black leading-none", color)}>{value}</h4>
            <span className="text-[8px] font-bold text-gray-300 lowercase">{unit}</span>
        </div>
    )
}

function LegendItem({ color, label, value }) {
    return (
        <div className="min-w-[80px] p-2 rounded-xl neumo-pressed flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", color.replace('bg-', 'bg-').replace('text-', 'bg-'))} />
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
            </div>
            <span className="text-xs font-black text-gray-600 pl-3.5">{value}</span>
        </div>
    )
}

function HistoryCard({ label, items }) {
    return (
        <div className="neumo-card p-6 h-full">
            <h3 className="font-black italic text-sm text-gray-400 uppercase tracking-widest mb-4">{label}</h3>
            <div className="space-y-3">
                {items.length === 0 && <p className="text-xs text-gray-400 font-bold">No travel history</p>}
                {items.map(c => (
                    <div key={c.name} className="space-y-1">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                            <span className="text-gray-500">{c.name}</span>
                            <span className="text-neumo-brand">{c.count} Days</span>
                        </div>
                        <div className="h-1.5 neumo-pressed rounded-full overflow-hidden bg-gray-100">
                            <div style={{ width: `${(c.count / (items[0]?.count || 1)) * 100}%` }} className="h-full bg-neumo-brand rounded-full" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function SalaryDetailModal({ isOpen, onClose, data, total, mask }) {
    if (!isOpen) return null;
    const items = [
        { label: '底薪收入 (Base)', value: data.base, color: 'text-blue-500' },
        { label: '加班費 (Overtime)', value: data.ot, color: 'text-orange-500' },
        { label: '出差費 (Travel)', value: data.travel, color: 'text-green-500' },
        { label: '獎金 (Bonus)', value: data.bonus, color: 'text-amber-500' },
    ];
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-gray-500/20 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-sm neumo-card p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black uppercase">年薪明細</h3>
                    <button onClick={onClose}><X size={18} /></button>
                </div>
                <div className="space-y-4">
                    {items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm font-bold border-b border-gray-100 pb-2">
                            <span className="text-gray-500">{item.label}</span>
                            <span className={cn(item.color)}>{mask('$' + Math.round(item.value || 0).toLocaleString())}</span>
                        </div>
                    ))}
                    <div className="flex justify-between pt-2">
                        <span className="text-xs font-black text-gray-400 uppercase">Total</span>
                        <span className="text-xl font-black text-neumo-brand">{mask('$' + Math.round(total || 0).toLocaleString())}</span>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}

function BonusDetailModal({ isOpen, onClose, data, onUpdate, isPrivacy }) {
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ amount: 0, category: '', name: '' });
    const mask = (val) => isPrivacy ? '••••' : val;
    if (!isOpen) return null;

    const bonusRecords = data.flatMap(r => {
        const dateStr = format(new Date(r.date), 'yyyy-MM-dd');
        if (Array.isArray(r.bonusEntries) && r.bonusEntries.length > 0) return r.bonusEntries.map(be => ({ ...be, parentDate: dateStr }));
        if (parseFloat(r.bonus) > 0) return [{ id: `legacy-${dateStr}`, date: r.date, amount: r.bonus, category: r.bonusCategory || '獎金', name: r.bonusName || '', parentDate: dateStr }];
        return [];
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-gray-500/20 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-lg neumo-card p-6 max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black uppercase text-amber-500 flex items-center gap-2"><Gift size={20} /> 獎金明細</h3>
                    <button onClick={onClose}><X size={18} /></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                    {bonusRecords.map((b, idx) => (
                        <div key={idx} className="neumo-pressed p-4 rounded-xl flex justify-between items-center">
                            <div>
                                <div className="flex gap-2 mb-1"><span className="text-[10px] bg-white/50 px-2 rounded font-black text-gray-500">{format(new Date(b.date), 'yyyy/MM/dd')}</span><span className="text-[10px] text-amber-600 border border-amber-200 px-2 rounded font-black">{b.category}</span></div>
                                <div className="text-xs font-bold text-gray-600">{b.name || '-'}</div>
                            </div>
                            <div className="font-black text-gray-800">{mask('$' + Math.round(b.amount).toLocaleString())}</div>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    )
}

function LeaveListModal({ isOpen, onClose, data }) {
    if (!isOpen) return null;
    const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-gray-500/20 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-sm neumo-card p-6 max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black uppercase text-rose-500 flex items-center gap-2"><Briefcase size={20} /> 請假紀錄</h3>
                    <button onClick={onClose}><X size={18} /></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {sorted.length === 0 && <p className="text-center text-gray-400 text-xs">尚無請假紀錄</p>}
                    {sorted.map((r, i) => (
                        <div key={i} className="neumo-pressed p-3 rounded-xl flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col items-center justify-center w-12 h-12 bg-white rounded-lg shadow-sm">
                                    <span className="text-[8px] font-black text-gray-400 uppercase leading-none">{format(new Date(r.date), 'yyyy')}</span>
                                    <span className="text-[8px] font-black text-gray-400 uppercase">{format(new Date(r.date), 'MMM')}</span>
                                    <span className="text-lg font-black text-[#202731] leading-none">{format(new Date(r.date), 'dd')}</span>
                                </div>
                                <div>
                                    <div className="text-xs font-black text-gray-700">{r.leaveType || '請假'}</div>
                                    <div className="text-[9px] font-bold text-gray-400">
                                        {(parseFloat(r.leaveDuration) || 8) === 8 ? '全天 (8H)' : `${(parseFloat(r.leaveDuration) || 0).toFixed(1)} Hours`}
                                    </div>
                                </div>
                            </div>
                            <div className="px-2 py-1 rounded bg-rose-50 text-[9px] font-black text-rose-600 border border-rose-100">
                                {r.leaveType || 'Leave'}
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    )
}

function TravelListModal({ isOpen, onClose, data }) {
    if (!isOpen) return null;

    // Sort asc to find ranges
    const sorted = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
    const ranges = [];
    if (sorted.length > 0) {
        let currentRange = { start: sorted[0], end: sorted[0], country: sorted[0].travelCountry };
        for (let i = 1; i < sorted.length; i++) {
            const current = sorted[i];
            const prev = currentRange.end;
            // Check consecutive days (difference is 1 day or sameday if duplicate)
            // Actually eachDayOfInterval includes start and end. 
            // We just check if current date is prev + 1 day.
            const currentDateObj = new Date(current.date);
            const prevDateObj = new Date(prev.date);
            const diffTime = Math.abs(currentDateObj - prevDateObj);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Allow same day definition? No, data is per day.
            // isSameDay check
            const isConsecutive = isSameDay(currentDateObj, addDays(prevDateObj, 1));
            const isSameCountry = current.travelCountry === currentRange.country;

            if (isConsecutive && isSameCountry) {
                currentRange.end = current;
            } else {
                ranges.push(currentRange);
                currentRange = { start: current, end: current, country: current.travelCountry };
            }
        }
        ranges.push(currentRange);
    }
    // Sort ranges DESC for display
    ranges.sort((a, b) => new Date(b.start.date) - new Date(a.start.date));

    const getCountryName = (code) => {
        const map = { 'VN': 'Vietnam', 'IN': 'India', 'CN': 'China' };
        return map[code] || code;
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-gray-500/20 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-sm neumo-card p-6 max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black uppercase text-emerald-500 flex items-center gap-2"><MapPin size={20} /> 出差紀錄</h3>
                    <button onClick={onClose}><X size={18} /></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {ranges.length === 0 && <p className="text-center text-gray-400 text-xs">尚無出差紀錄</p>}
                    {ranges.map((range, i) => (
                        <div key={i} className="neumo-pressed p-4 rounded-xl flex justify-between items-center">
                            <div>
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{getCountryName(range.country)}</div>
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                                    <span>{format(new Date(range.start.date), 'yyyy/MM/dd')}</span>
                                    <span className="text-gray-400">&rarr;</span>
                                    <span>{format(new Date(range.end.date), 'yyyy/MM/dd')}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                                    {Math.ceil((new Date(range.end.date) - new Date(range.start.date)) / (1000 * 60 * 60 * 24)) + 1} Days
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    )
}

function OTListModal({ isOpen, onClose, data, settings, liveRate }) {
    if (!isOpen) return null;
    const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Helper to estimate amount if needed, but we don't have settings here easily. 
    // We can just show hours and type.

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-gray-500/20 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-sm neumo-card p-6 max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black uppercase text-indigo-500 flex items-center gap-2"><Clock size={20} /> 加班紀錄</h3>
                    <button onClick={onClose}><X size={18} /></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {sorted.length === 0 && <p className="text-center text-gray-400 text-xs">尚無加班紀錄</p>}
                    {sorted.map((r, i) => {
                        const otPay = settings ? calculateDailySalary(r, { ...settings, liveRate }).otPay : 0;
                        return (
                            <div key={i} className="neumo-pressed p-3 rounded-xl flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col items-center justify-center w-12 h-12 bg-white rounded-lg shadow-sm">
                                        <span className="text-[8px] font-black text-gray-400 uppercase leading-none">{format(new Date(r.date), 'yyyy')}</span>
                                        <span className="text-[8px] font-black text-gray-400 uppercase">{format(new Date(r.date), 'MMM')}</span>
                                        <span className="text-lg font-black text-[#202731] leading-none">{format(new Date(r.date), 'dd')}</span>
                                    </div>
                                    <div>
                                        <div className="text-xs font-black text-gray-700">{r.otType === 'leave' ? '補休' : '加班費'}</div>
                                        <div className="text-[9px] font-bold text-gray-400">{parseFloat(r.otHours).toFixed(1)} Hours</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={cn("px-2 py-1 rounded text-[10px] font-black border", r.otType === 'leave' ? "bg-indigo-50 text-indigo-600 border-indigo-100" : "bg-green-50 text-green-600 border-green-100")}>
                                        {r.otType === 'leave' ? 'Comp' : `$${Math.round(otPay).toLocaleString()}`}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </motion.div>
        </div>
    )
}

function LeaveBreakdownCard({ label, items }) {
    return (
        <div className="neumo-card p-6 h-full">
            <h3 className="font-black italic text-sm text-gray-400 uppercase tracking-widest mb-4">{label}</h3>
            <div className="space-y-3">
                {items.length === 0 && <p className="text-xs text-gray-400 font-bold">No leave data</p>}
                {items.map(c => (
                    <div key={c.name} className="space-y-1">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                            <span className="text-gray-500">{c.name}</span>
                            <span className="text-rose-500">{c.count.toFixed(1)} Days</span>
                        </div>
                        <div className="h-1.5 neumo-pressed rounded-full overflow-hidden bg-gray-100">
                            <div style={{ width: `${(c.count / (items[0]?.count || 1)) * 100}%` }} className="h-full bg-rose-500 rounded-full" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default AnalysisPage
