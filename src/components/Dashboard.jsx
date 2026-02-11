import React, { useState, useEffect, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, subDays, subMonths, getDaysInMonth, eachDayOfInterval, eachMonthOfInterval, isSameDay, isSameMonth, getYear } from 'date-fns'
import { TrendingUp, Globe, Wallet, Clock, Coffee, Moon, Gift, Eye, EyeOff, Briefcase, ChevronRight, Calendar, Battery, Palmtree, Check } from 'lucide-react'

import QuickCopyTool from './toolbox/QuickCopyTool'
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
    const [showSalary, setShowSalary] = useState(false) // Default hidden
    const [isQuickCopyOpen, setIsQuickCopyOpen] = useState(false)
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


    // Calculate chart segments manually for "stacking" with gaps
    // This allows us to use floating bars, which render as separate capsules with full rounded corners
    const GAP = 300; // Gap in currency value
    const baseStart = 0;
    const baseEnd = monthMetrics.baseMonthly;

    const otStart = baseEnd + GAP;
    const otEnd = otStart + monthMetrics.otPay;

    const allowStart = otEnd + GAP;
    const allowEnd = allowStart + monthMetrics.travelAllowance;

    const bonusStart = allowEnd + GAP;
    const bonusEnd = bonusStart + monthMetrics.bonus;

    // Bar Chart Data (Floating Bars)
    const barData = {
        labels: ['Stats'],
        datasets: [
            {
                label: '底薪',
                data: [[baseStart, baseEnd]],
                backgroundColor: 'rgba(56, 189, 248, 1)', // Sky 400
                barThickness: 40,
                borderRadius: 20, // Capsule style
                borderSkipped: false,
            },
            {
                label: '加班',
                data: [[otStart, otEnd]],
                backgroundColor: 'rgba(255, 69, 0, 1)', // Orange Red
                barThickness: 40,
                borderRadius: 20,
                borderSkipped: false,
            },
            {
                label: '津貼',
                data: [[allowStart, allowEnd]],
                backgroundColor: 'rgba(16, 185, 129, 1)', // Emerald 500
                barThickness: 40,
                borderRadius: 20,
                borderSkipped: false,
            },
            {
                label: '獎金',
                data: [[bonusStart, bonusEnd]],
                backgroundColor: 'rgba(245, 158, 11, 1)', // Amber 500
                barThickness: 40,
                borderRadius: 20,
                borderSkipped: false,
            },
        ],
    };

    const barOptions = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 1500,
            easing: 'easeOutQuart', // Smooth expansion matching motion
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        if (isPrivacy || !showSalary) return `${context.dataset.label}: ••••`;
                        // Handle floating bar data [start, end]
                        let val = context.raw;
                        if (Array.isArray(val)) val = val[1] - val[0];
                        return `${context.dataset.label}: ${mask('$' + Math.round(val).toLocaleString())}`;
                    }
                }
            },
        },
        scales: {
            x: { stacked: false, display: false }, // Floating bars manage their own position
            y: { stacked: true, display: false }
        },
        layout: { padding: 0 }
    };

    // Plugins to draw text inside the chart
    const textPlugin = {
        id: 'textPlugin',
        afterDatasetsDraw(chart) {
            // Privacy Check: If global privacy or local salary hidden, do not draw text
            if (isPrivacy || !showSalary) return;

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
                // Value from float range
                let value = data.datasets[0].data[0];
                if (Array.isArray(value)) value = value[1] - value[0];

                if (value > 0) {
                    // Check if width is enough
                    const width = bar0.width;
                    if (width > 40) {
                        ctx.fillStyle = '#ffffff'; // White text on colored bar
                        ctx.fillText('$' + Math.round(value).toLocaleString(), bar0.x - (width / 2), bar0.y);
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
            <QuickCopyTool isOpen={isQuickCopyOpen} onClose={() => setIsQuickCopyOpen(false)} />

            {/* Header */}
            <header className="flex justify-between items-start">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                        Dashboard <span className="text-sm font-bold bg-neumo-brand/10 text-neumo-brand px-2 py-1 rounded-lg">{format(today, 'MMMM')}</span>
                    </h1>
                    <p className="text-gray-500 text-xs font-bold tracking-widest uppercase italic">Powered by Cody</p>
                </div>
                <button
                    onClick={() => setIsPrivacy(!isPrivacy)}
                    className="neumo-button p-3 text-gray-400 hover:text-neumo-brand transition-colors"
                >
                    {isPrivacy ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
            </header>

            {/* Attendance Block (Redesigned: Grid of Squares) */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="neumo-card p-1 bg-purple-500 overflow-hidden relative group" // Group for hover
            >
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-purple-500 z-0 transition-all duration-500 group-hover:brightness-105" />

                <div className="relative z-10 w-full h-24 flex flex-col justify-between p-4">
                    {/* Header Text (White) */}
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-white/90 uppercase tracking-widest mb-0.5 mix-blend-screen shadow-black/10 text-shadow group-hover:scale-105 transition-transform duration-300 origin-left">本月出勤</span>
                            <span className="text-xs font-black text-white mix-blend-screen">
                                {mask(format(today, 'yyyy / MM'))}
                            </span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-3xl font-black text-white drop-shadow-md tracking-tighter group-hover:scale-110 transition-transform duration-300 origin-right">
                                {mask(String(attendedPercent))}<span className="text-base align-top">%</span>
                            </span>
                        </div>
                    </div>

                    {/* Bottom Grid of Squares (Light Gray Internal BG) */}
                    <div className="mt-2 flex-1 rounded-xl bg-gray-100/90 backdrop-blur-sm p-1.5 flex items-center justify-between gap-1 overflow-hidden shadow-inner group-hover:shadow-lg transition-all duration-300">
                        {attendanceBoxes.map((box, idx) => (
                            <div
                                key={idx}
                                className={cn(
                                    "flex-1 h-full rounded-[2px] transition-all duration-300",
                                    box.day <= today
                                        ? (box.type === 'attendance' ? "bg-purple-500 shadow-sm group-hover:bg-purple-400" : "bg-purple-200 group-hover:bg-purple-300")
                                        : "bg-gray-200 group-hover:bg-gray-100"
                                )}
                            />
                        ))}
                    </div>
                </div>
            </motion.div>

            {/* Dashboard Main Content */}
            <div className="space-y-6">

                {/* 1. Monthly Salary Distribution (Redesigned Block Chart) */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="neumo-card p-6 flex flex-col gap-6"
                >
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2 text-gray-400">
                            <div className="p-2 rounded-xl neumo-pressed text-purple-500">
                                <TrendingUp size={20} />
                            </div>
                            <h2 className="text-xs font-black uppercase tracking-widest">本月薪資分布</h2>
                        </div>
                        {/* Big Amount */}
                        <div className="text-right">
                            <div
                                onClick={() => setShowSalary(!showSalary)}
                                className="text-4xl lg:text-5xl font-black text-[#202731] tracking-tighter cursor-pointer hover:opacity-80 transition-opacity select-none leading-none"
                            >
                                {(isPrivacy || !showSalary) ? '••••' : '$' + Math.round(monthMetrics.estimatedTotal).toLocaleString()}
                            </div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1 block">Total Estimated</span>
                        </div>
                    </div>

                    {/* Custom Block Chart (CSS Grid) with Floated Guide Labels */}
                    {/* Added mt-8 to give space for floating labels above */}
                    <div className="mt-8 h-16 w-full flex gap-1 rounded-2xl overflow-visible neumo-pressed p-1.5 bg-gray-100/50 relative z-10">
                        {(!isPrivacy && showSalary) ? (
                            <>
                                <BlockBar label="底薪" value={monthMetrics.baseMonthly} total={monthMetrics.estimatedTotal} color="bg-sky-400" mask={mask} />
                                <BlockBar label="加班" value={monthMetrics.otPay} total={monthMetrics.estimatedTotal} color="bg-orange-500" mask={mask} />
                                <BlockBar label="津貼" value={monthMetrics.travelAllowance} total={monthMetrics.estimatedTotal} color="bg-emerald-500" mask={mask} />
                                <BlockBar label="獎金" value={monthMetrics.bonus} total={monthMetrics.estimatedTotal} color="bg-amber-500" mask={mask} />
                            </>
                        ) : (
                            <div className="w-full h-full bg-gray-200/50 rounded-xl flex items-center justify-center animate-pulse">
                                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Hidden</span>
                            </div>
                        )}
                    </div>

                    {/* Legend removed in favor of floating labels */}
                </motion.div>

                {/* 2. Secondary Grid: OT, Toolbox, Battery (Redesigned Blocks) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Row 1: Combined Battery Stats (Redesigned as Filled Blocks) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6"
                    >
                        {/* Dept Comp Block */}
                        <FilledStatsBlock
                            label="部門補休"
                            icon={Battery}
                            value={Math.round(cumulativeDeptCompBalance)}
                            total={Math.round(allDeptCompEarned)}
                            used={Math.round(allDeptCompUsed)}
                            unit="Unit"
                            color="bg-purple-500"
                            trackColor="bg-purple-100"
                            textColor="text-purple-600"
                            isPrivacy={isPrivacy}
                        />

                        {/* Annual Leave Block */}
                        <FilledStatsBlock
                            label="特休狀況"
                            icon={Palmtree}
                            value={Number(remainingAnnual).toFixed(1)}
                            total={annualGiven}
                            used={Number(annualUsed).toFixed(1)}
                            unit="Days"
                            color="bg-teal-500"
                            trackColor="bg-teal-100"
                            textColor="text-teal-600"
                            isPrivacy={isPrivacy}
                        />
                    </motion.div>

                    {/* Row 2 Left: OT Stats (New Filled Style) */}
                    <FilledStatsBlock
                        label="OT Hours"
                        icon={Clock}
                        value={Number(yearMetrics.totalOT).toFixed(1)}
                        total={0} // No limit for OT
                        used={mask(monthMetrics.totalOT.toFixed(1))} // Hack reuse: 'used' as Month value
                        unit="Hours (Year)"
                        color="bg-blue-500"
                        trackColor="bg-blue-100"
                        textColor="text-blue-600"
                        isPrivacy={isPrivacy}
                        isOT={true} // Special flag for OT layout (handled by display prop hijacking)
                    />

                    {/* Row 2 Right: Tools grid */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="neumo-card p-4 flex flex-col h-32" // Match height
                    >
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Tools</h3>
                        <div className="flex-1 grid grid-cols-4 gap-3 overflow-hidden">
                            {/* Quick Copy Button (New Style) */}
                            <button
                                onClick={() => setIsQuickCopyOpen(true)}
                                className="h-full rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all duration-200 group bg-orange-50 hover:bg-orange-100 border border-orange-100 hover:scale-105 active:scale-95"
                            >
                                <div className="p-1.5 bg-orange-200 rounded-lg text-orange-600 shadow-sm">
                                    <Briefcase size={18} strokeWidth={2.5} />
                                </div>
                                <span className="text-[8px] font-black uppercase tracking-wider text-orange-400 group-hover:text-orange-600">Copy</span>
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}

// Helper Components for Redesign
function BlockBar({ label, value, total, color, mask }) {
    const percent = total > 0 ? (value / total) * 100 : 0;
    if (percent === 0) return null;

    return (
        <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: `${percent}%`, opacity: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn("h-full rounded-xl relative group", color)}
        >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />

            {/* Guide Line & Label (Floating) */}
            <div className="absolute bottom-full right-0 mb-1 flex flex-col items-end z-20 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity duration-300 origin-bottom scale-y-90 group-hover:scale-y-100">
                {/* Label Container */}
                <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg shadow-sm border border-gray-100 mb-0.5 whitespace-nowrap">
                    <div className={cn("w-1.5 h-1.5 rounded-full", color)} />
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-wide">{label}</span>
                    <span className="text-[10px] font-black text-gray-800">{mask('$' + Math.round(value / 1000) + 'k')}</span>
                </div>
                {/* Line */}
                <div className={cn("w-0.5 h-3 rounded-full opacity-50", color)}></div>
            </div>
        </motion.div>
    )
}

function LegendBlock({ label, value, color, privacy, mask }) {
    return (
        <div className="neumo-pressed p-2 rounded-xl flex flex-col items-center justify-center gap-1">
            <div className="flex items-center gap-1.5 mb-1">
                <div className={cn("w-1.5 h-1.5 rounded-full", color)} />
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
            </div>
            <span className="text-xs font-black text-gray-700">
                {privacy ? '•••' : '$' + Math.round(value / 1000).toLocaleString() + 'k'}
            </span>
        </div>
    )
}

function FilledStatsBlock({ label, icon: Icon, value, total, used, unit, color, trackColor, textColor, isPrivacy, isOT }) {
    const safeValue = parseFloat(value) || 0;
    const safeTotal = parseFloat(total) || 1;
    // For OT, percent is full (100) or special? Let's use 100 to fill the block, or relative?
    // User asked OT to "match style". Filled block = Solid background.
    // If isOT, percent = 100.
    const percent = isOT ? 100 : Math.min(100, Math.max(0, (safeValue / safeTotal) * 100));

    // Masking logic
    const displayValue = isPrivacy ? '••••' : value; // Value passed as formatted string for OT? No, passed as number string
    const displayUsed = isPrivacy ? '••' : used;
    const displayTotal = isPrivacy ? '••' : total;

    return (
        <motion.div
            whileHover={{ scale: 1.02, filter: "brightness(1.05)" }}
            className="neumo-card p-1 relative h-32 overflow-hidden group cursor-default transition-all duration-300"
        >
            {/* Background Container (Pressed) */}
            <div className="w-full h-full rounded-2xl neumo-pressed relative overflow-hidden bg-gray-50/50">
                {/* Fill Animation */}
                <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${percent}%` }}
                    transition={{ duration: 1.2, type: "spring", bounce: 0.2 }}
                    className={cn("absolute bottom-0 left-0 right-0 w-full opacity-90 shadow-[0_0_20px_rgba(0,0,0,0.1)] transition-all duration-300 group-hover:brightness-110 group-hover:saturate-110", color)}
                />

                {/* Content Layer */}
                <div className="absolute inset-0 p-4 flex flex-col justify-between z-10 transition-colors duration-300">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-white/40 backdrop-blur-md shadow-sm text-gray-600 group-hover:scale-110 transition-transform duration-300">
                                <Icon size={16} />
                            </div>
                            <span className={cn("text-[10px] font-black uppercase tracking-widest transition-colors duration-300", percent > 60 ? "text-white/90" : "text-gray-400")}>
                                {label}
                            </span>
                        </div>
                        {!isOT && (
                            <div className={cn("text-[9px] font-black uppercase tracking-widest opacity-80", percent > 80 ? "text-white" : "text-gray-400")}>
                                {percent.toFixed(0)}%
                            </div>
                        )}
                        {isOT && (
                            <div className={cn("text-[9px] font-black uppercase tracking-widest opacity-80 text-white/90")}>
                                YEAR
                            </div>
                        )}
                    </div>

                    <div className="flex items-end justify-between">
                        <div className="flex flex-col">
                            <span className={cn("text-3xl font-black tracking-tighter leading-none transition-colors duration-300 group-hover:scale-105 origin-left",
                                percent > 40 ? "text-white drop-shadow-md" : textColor)}>
                                {displayValue}
                            </span>
                            <span className={cn("text-[9px] font-bold uppercase transition-colors duration-300", percent > 40 ? "text-white/80" : "text-gray-400")}>
                                {unit}
                            </span>
                        </div>
                        {isOT ? (
                            <div className={cn("text-[9px] font-black text-right transition-colors duration-300 text-white/70")}>
                                Month: {displayUsed}h
                            </div>
                        ) : (
                            <div className={cn("text-[9px] font-black text-right transition-colors duration-300", percent > 20 ? "text-white/70" : "text-gray-400")}>
                                Used: {displayUsed}<br />Total: {displayTotal}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

export default Dashboard
