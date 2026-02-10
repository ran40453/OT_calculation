import React, { useState, useEffect, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, subDays, subMonths, getDaysInMonth, eachDayOfInterval, eachMonthOfInterval, isSameDay, isSameMonth, getYear } from 'date-fns'
import { TrendingUp, Globe, Wallet, Clock, Coffee, Moon, Gift, Eye, EyeOff, Briefcase, ChevronRight, Calendar, Battery, Palmtree } from 'lucide-react'
import BatteryIcon from './BatteryIcon'
import { motion } from 'framer-motion'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { loadSettings, fetchExchangeRate, standardizeCountry, calculateDailySalary, calculateCompLeaveUnits, calculateOTHours } from '../lib/storage'
import { cn } from '../lib/utils'

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend)

function Dashboard({ data, isPrivacy, setIsPrivacy }) {
    const [settings, setSettings] = useState(null)
    const [liveRate, setLiveRate] = useState(null)
    const today = new Date()

    useEffect(() => {
        const init = async () => {
            const s = loadSettings();
            setSettings(s);
            try {
                const rate = await fetchExchangeRate().catch(() => 32.5);
                if (rate) setLiveRate(rate);
            } catch (err) {
                console.error('Dashboard: Rate fetch error:', err);
            }
        };
        init();
    }, [])
    const parse = (d) => {
        if (!d) return new Date(0);
        if (d instanceof Date) return d;
        const parsed = parseISO(d);
        if (!isNaN(parsed.getTime())) return parsed;
        return new Date(d);
    }

    // Monthly OT trend (last 6 months) — must be before early return to satisfy Rules of Hooks
    const otChartMonths = useMemo(() => eachMonthOfInterval({ start: startOfMonth(subMonths(today, 5)), end: startOfMonth(today) }), []);
    const otByMonth = useMemo(() => otChartMonths.map(m => {
        return data.filter(r => {
            const d = parse(r.date);
            return d instanceof Date && !isNaN(d) && isSameMonth(d, m);
        }).reduce((sum, r) => sum + (parseFloat(r.otHours) || 0), 0);
    }), [data, otChartMonths]);

    if (!settings) return null

    const mask = (val) => isPrivacy ? '••••' : val;

    // Filter for Current Month Only
    const currentMonthInterval = { start: startOfMonth(today), end: endOfMonth(today) }
    const rollingYearInterval = { start: subDays(today, 365), end: today }

    const currentMonthRecords = data.filter(r => {
        const d = parse(r.date);
        return d instanceof Date && !isNaN(d) && isWithinInterval(d, currentMonthInterval);
    })

    const rollingYearRecords = data.filter(r => {
        const d = parse(r.date);
        return d instanceof Date && !isNaN(d) && isWithinInterval(d, rollingYearInterval);
    })

    // Calculate Monthly Metrics
    const calcMetrics = (records) => {
        const totalOT = records.reduce((sum, r) => {
            let hours = parseFloat(r.otHours) || 0;
            if (hours === 0 && r.endTime) {
                hours = calculateOTHours(r.endTime, settings?.rules?.standardEndTime || "17:30");
            }
            return sum + (isNaN(hours) ? 0 : hours);
        }, 0)

        // Dept Comp Earned (Internal OT)
        const deptCompEarned = records.reduce((sum, r) => {
            if (r.otType === 'internal') return sum + calculateCompLeaveUnits(r);
            return sum;
        }, 0);

        // Dept Comp Used (部門補休)
        const deptCompUsed = records.reduce((sum, r) => {
            if (r.isLeave && r.leaveType === '部門補休') {
                const duration = parseFloat(r.leaveDuration) || 0;
                return sum + (duration * 2); // 1 hour = 2 units
            }
            return sum;
        }, 0);

        const deptCompBalance = deptCompEarned - deptCompUsed;
        const totalLeave = records.filter(r => r.isLeave).length // In days

        // Financials
        let baseMonthly = settings?.salary?.baseMonthly !== undefined ? Number(settings.salary.baseMonthly) : 50000;

        // Try to get salary from history for the current month
        if (settings.salaryHistory && Array.isArray(settings.salaryHistory)) {
            const sortedHistory = [...settings.salaryHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
            const monthStart = startOfMonth(today);
            const applicable = sortedHistory.find(h => new Date(h.date) <= monthStart);
            if (applicable && applicable.amount) {
                baseMonthly = Number(applicable.amount);
            }
        }

        let otPay = 0;
        let travelAllowance = 0;
        let bonus = 0;
        let leaveDeduction = 0;

        records.forEach(r => {
            const metrics = calculateDailySalary(r, { ...settings, liveRate });
            otPay += metrics?.otPay || 0;
            travelAllowance += metrics?.travelAllowance || 0;
            bonus += (parseFloat(r.bonus) || 0);
            leaveDeduction += metrics?.leaveDeduction || 0;
        });

        const estimatedTotal = (baseMonthly + otPay + travelAllowance + bonus) - leaveDeduction;

        const daysInMonth = getDaysInMonth(today);
        const dayOfMonth = today.getDate();
        const monthPercent = Math.round((dayOfMonth / daysInMonth) * 100);

        return {
            baseMonthly,
            otPay,
            travelAllowance,
            bonus,
            estimatedTotal,
            totalOT,
            deptCompBalance,
            deptCompEarned,
            deptCompUsed,
            totalLeave,
            monthPercent,
            dayOfMonth,
            daysInMonth
        }
    }

    const monthMetrics = calcMetrics(currentMonthRecords);
    const yearMetrics = calcMetrics(rollingYearRecords);

    // Calculate Lifetime Cumulative Dept Comp Balance
    const allDeptCompEarned = data.reduce((sum, r) => {
        if (r.otType === 'internal') return sum + calculateCompLeaveUnits(r);
        return sum;
    }, 0);

    const allDeptCompUsed = data.reduce((sum, r) => {
        if (r.isLeave && r.leaveType === '部門補休') {
            const duration = parseFloat(r.leaveDuration) || 0;
            return sum + (duration * 2);
        }
        return sum;
    }, 0);

    const cumulativeDeptCompBalance = allDeptCompEarned - allDeptCompUsed;

    // Annual Leave Calculation
    const currentYear = getYear(today);
    const annualGiven = (settings?.annualLeave && settings.annualLeave[currentYear]) || 7; // Default 7
    const annualUsed = data.filter(r => {
        const d = parse(r.date);
        return d instanceof Date && !isNaN(d) && getYear(d) === currentYear && r.isLeave && r.leaveType === '特休';
    }).reduce((sum, r) => sum + (parseFloat(r.leaveDuration) || 8) / 8, 0);
    const remainingAnnual = Math.max(0, annualGiven - annualUsed);


    // Bar Chart Data (Horizontal Stacked)
    const barData = {
        labels: ['Stats'],
        datasets: [
            {
                label: '底薪',
                data: [monthMetrics.baseMonthly],
                backgroundColor: 'rgba(56, 189, 248, 0.8)', // Sky 400
                borderColor: 'rgba(56, 189, 248, 1)',
                borderWidth: 1,
                barThickness: 40,
            },
            {
                label: '加班',
                data: [monthMetrics.otPay],
                backgroundColor: 'rgba(255, 69, 0, 0.8)', // Orange Red
                borderColor: 'rgba(255, 69, 0, 1)',
                borderWidth: 1,
                barThickness: 40,
            },
            {
                label: '津貼',
                data: [monthMetrics.travelAllowance],
                backgroundColor: 'rgba(16, 185, 129, 0.8)', // Emerald 500
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 1,
                barThickness: 40,
            },
            {
                label: '獎金',
                data: [monthMetrics.bonus],
                backgroundColor: 'rgba(245, 158, 11, 0.8)', // Amber 500
                borderColor: 'rgba(245, 158, 11, 1)',
                borderWidth: 1,
                barThickness: 40,
            },
        ],
    };

    const barOptions = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        return `${context.dataset.label}: ${mask('$' + Math.round(context.raw).toLocaleString())}`;
                    }
                }
            },
        },
        scales: {
            x: { stacked: true, display: false },
            y: { stacked: true, display: false }
        },
        layout: { padding: 0 }
    };

    // Plugins to draw text inside the chart
    const textPlugin = {
        id: 'textPlugin',
        afterDatasetsDraw(chart) {
            const { ctx, data } = chart;
            ctx.save();
            ctx.font = 'bold 10px sans-serif';
            ctx.fillStyle = '#1f2937'; // gray-800
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Draw labels below the bars
            const meta0 = chart.getDatasetMeta(0);
            if (meta0.data.length > 0) {
                const bar0 = meta0.data[0];
                const value = data.datasets[0].data[0];
                if (value > 0) {
                    // Check if width is enough
                    const width = bar0.width;
                    if (width > 40) {
                        ctx.fillStyle = '#ffffff'; // White text on colored bar
                        ctx.fillText(mask('$' + Math.round(value).toLocaleString()), bar0.x - (width / 2), bar0.y);
                    }
                }
            }

            ctx.restore();
        }
    }

    // Attendance Grid Data
    const currentMonthDays = eachDayOfInterval(currentMonthInterval);
    const attendanceBoxes = currentMonthDays.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const record = data.find(r => format(parse(r.date), 'yyyy-MM-dd') === dayStr);
        let type = 'none';
        if (record) type = record.isLeave ? 'leave' : 'attendance';
        return { day, type };
    });
    const attendedCount = attendanceBoxes.filter(b => b.type === 'attendance').length;
    const totalDaysCount = attendanceBoxes.length;
    const attendedPercent = totalDaysCount > 0 ? Math.round((attendedCount / totalDaysCount) * 100) : 0;

    return (
        <div className="space-y-6 pb-32">
            <header className="flex justify-between items-start">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                        Dashboard <span className="text-sm font-bold bg-neumo-brand/10 text-neumo-brand px-2 py-1 rounded-lg">{format(today, 'MMMM')}</span>
                    </h1>
                    <p className="text-gray-500 text-xs font-bold tracking-widest uppercase italic">Real-time Monthly Overview</p>
                </div>
                <button
                    onClick={() => setIsPrivacy(!isPrivacy)}
                    className="neumo-button p-3 text-gray-400 hover:text-neumo-brand transition-colors"
                >
                    {isPrivacy ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
            </header>

            {/* Attendance Capsule Progress Bar */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="neumo-card p-4 flex flex-col justify-center" // Centered vertical
            >
                <div className="flex justify-between items-end mb-2">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">本月出勤概況</h3>
                    <div className="text-[10px] font-bold text-gray-400">
                        {mask(format(today, 'yyyy / MM'))}
                    </div>
                </div>
                <div className="h-8 w-full bg-gray-100 rounded-full relative overflow-hidden flex items-center shadow-inner">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${attendedPercent}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="absolute left-0 top-0 bottom-0 bg-neumo-brand opacity-80 rounded-full"
                    />
                    <div className="relative z-10 flex items-center justify-between w-full px-4">
                        <span className={cn("text-[10px] font-black uppercase tracking-widest z-10 mix-blend-overlay text-gray-600")}>
                            Passed: {mask(String(attendedCount))}/{mask(String(totalDaysCount))}
                        </span>
                        <span className="text-sm font-black z-10 text-neumo-brand mix-blend-screen drop-shadow-sm">
                            {mask(String(attendedPercent))}%
                        </span>
                    </div>
                </div>
            </motion.div>

            {/* Dashboard Main Content */}
            <div className="space-y-6">

                {/* 1. Monthly Salary Distribution (Moved to Top) */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="neumo-card p-6 flex flex-col justify-between"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2 text-gray-400">
                            <div className="p-2 rounded-xl neumo-pressed text-purple-500">
                                <TrendingUp size={20} />
                            </div>
                            <h2 className="text-xs font-black uppercase tracking-widest">本月薪資分布</h2>
                        </div>
                        {/* legends at top right */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                            <LegendItem color="bg-sky-400" label="底薪" />
                            <LegendItem color="bg-orange-500" label="加班" />
                            <LegendItem color="bg-emerald-500" label="津貼" />
                            <LegendItem color="bg-amber-500" label="獎金" />
                        </div>
                    </div>


                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                        {/* Big Number */}
                        <div className="flex flex-col">
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl lg:text-6xl font-black text-[#202731] tracking-tighter">
                                    {mask('$' + Math.round(monthMetrics.estimatedTotal).toLocaleString())}
                                </span>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-400 leading-none">TWD</span>
                                    <span className="text-[10px] font-black text-neumo-brand mt-1 whitespace-nowrap">
                                        {monthMetrics.dayOfMonth}/{monthMetrics.daysInMonth} = {monthMetrics.monthPercent}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Chart Section */}
                        <div className="flex-1 w-full h-[60px] relative">
                            <Bar data={barData} options={barOptions} plugins={[textPlugin]} />
                        </div>
                    </div>
                </motion.div>

                {/* 2. Secondary Grid: OT, Toolbox, Battery */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Row 1 Left: OT Stats */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="neumo-card p-4 flex flex-col items-center justify-center gap-4 aspect-square"
                    >
                        <div className="flex flex-col items-center gap-1">
                            <div className="p-2 rounded-lg neumo-pressed text-blue-500">
                                <Clock size={24} />
                            </div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mt-1">加班時數</span>
                        </div>

                        <div className="flex items-baseline gap-1 mt-2">
                            <span className="text-5xl font-black text-[#202731] tracking-tighter">
                                {mask(yearMetrics.totalOT.toFixed(1))}
                            </span>
                            <span className="text-xs font-bold text-gray-400">H</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 px-3 py-1 rounded-full bg-blue-50/50 border border-blue-100">
                            <span className="text-[9px] font-black text-blue-400 uppercase">This Month</span>
                            <span className="text-sm font-black text-blue-600">{mask(monthMetrics.totalOT.toFixed(1))}h</span>
                        </div>
                    </motion.div>

                    {/* Row 1 Right: Toolbox */}
                    <ToolboxCard data={currentMonthRecords} mask={mask} />

                    {/* Row 2: Combined Battery Stats (Full Width) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="md:col-span-2 neumo-card p-6 flex flex-col md:flex-row items-center justify-around gap-8 relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 to-transparent pointer-events-none" />

                        {/* Dept Comp Battery */}
                        <div className="flex flex-col items-center gap-4 relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                                <Battery size={20} className="text-purple-500" />
                                <span className="text-sm font-black text-gray-500 uppercase tracking-widest">部門補休</span>
                            </div>
                            <BatteryIcon
                                value={Math.round(cumulativeDeptCompBalance)}
                                total={40} // TODO: Should this be dynamic? "Earned"?
                                // User requested "Used / Total". 
                                // Let's use Balance / (Balance + Used) -> No, Total Earned.
                                // Actually, let's use a fixed reasonable scale or dynamic max?
                                // For now, use 40 as visual max, but display text properly.
                                // Wait, the BatteryIcon displays "Value / Total" if showDetails is true.
                                unit=""
                                size="large"
                                showDetails={true}
                                label=""
                                subLabel=""
                                color="bg-purple-500"
                            />
                            <div className="flex gap-4 text-[10px] font-bold text-gray-400">
                                <span>剩餘: {Math.round(cumulativeDeptCompBalance)}</span>
                                <span>已用: {Math.round(allDeptCompUsed)}</span>
                            </div>
                        </div>

                        {/* Divider (Desktop) */}
                        <div className="hidden md:block w-px h-32 bg-gray-200/50" />

                        {/* Annual Leave Battery */}
                        <div className="flex flex-col items-center gap-4 relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                                <Palmtree size={20} className="text-teal-500" />
                                <span className="text-sm font-black text-gray-500 uppercase tracking-widest">特休狀況</span>
                            </div>
                            <BatteryIcon
                                value={Number(remainingAnnual).toFixed(1)}
                                total={annualGiven}
                                unit=""
                                size="large"
                                showDetails={true}
                                label=""
                                subLabel=""
                                color="bg-teal-500"
                            />
                            <div className="flex gap-4 text-[10px] font-bold text-gray-400">
                                <span>剩餘: {Number(remainingAnnual).toFixed(1)}</span>
                                <span>總計: {annualGiven}</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}

function ToolboxCard({ data, mask }) {
    const handleCopy = () => {
        const text = data
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map(r => {
                const date = format(parseISO(r.date), 'MM/dd')
                if (r.isLeave) return `${date} 请假 (${r.leaveType}) ${r.leaveDuration}H ${r.remarks || ''}`
                if (parseFloat(r.otHours) > 0) return `${date} 加班 ${r.otHours}H ${r.endTime ? `(~${r.endTime})` : ''} ${r.remarks || ''}`
                if (r.travelCountry) return `${date} 出差 ${r.travelCountry} ${r.remarks || ''}`
                return null
            })
            .filter(Boolean)
            .join('\n')

        if (!text) {
            alert('本月尚無紀錄可複製');
            return;
        }
        navigator.clipboard.writeText(text);
        alert('已複製本月紀錄摘要！');
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="neumo-card p-4 flex flex-col items-center justify-center gap-4 aspect-square group cursor-pointer hover:bg-gray-50/50 transition-colors"
            onClick={handleCopy}
        >
            <div className="p-3 rounded-xl neumo-pressed text-gray-500 group-hover:text-neumo-brand group-hover:scale-110 transition-all">
                <Briefcase size={24} />
            </div>
            <div className="text-center space-y-1">
                <h4 className="text-sm font-black text-gray-600">快速複製</h4>
                <p className="text-[10px] font-bold text-gray-400">本月勤怠摘要</p>
            </div>
        </motion.div>
    )
}

function LegendItem({ color, label }) {
    return (
        <div className="flex items-center gap-1.5">
            <div className={cn("w-2 h-2 rounded-full", color)} />
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
        </div>
    )
}

export default Dashboard
