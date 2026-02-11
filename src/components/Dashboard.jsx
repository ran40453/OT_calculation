import React, { useState, useEffect, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, subDays, subMonths, getDaysInMonth, eachDayOfInterval, eachMonthOfInterval, isSameDay, isSameMonth, getYear } from 'date-fns'
import { TrendingUp, Globe, Wallet, Clock, Coffee, Moon, Gift, Eye, EyeOff, Briefcase, ChevronRight, Calendar, Battery, Palmtree, Check } from 'lucide-react'
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
    const [showSalary, setShowSalary] = useState(false) // Default hidden
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
                                <span
                                    onClick={() => setShowSalary(!showSalary)}
                                    className="text-5xl lg:text-6xl font-black text-[#202731] tracking-tighter cursor-pointer hover:opacity-80 transition-opacity select-none"
                                >
                                    {(isPrivacy || !showSalary) ? '••••' : '$' + Math.round(monthMetrics.estimatedTotal).toLocaleString()}
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

                    {/* Row 1: Combined Battery Stats (Moved to Middle) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
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
                                total={40}
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

                    {/* Row 2 Left: OT Stats (Reduced Height) */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="neumo-card p-4 flex flex-row items-center justify-between gap-4 h-40"
                    >
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-blue-500 mb-1">
                                <div className="p-2 rounded-lg neumo-pressed">
                                    <Clock size={20} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest">OT Hours</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-5xl font-black text-[#202731] tracking-tighter">
                                    {mask(yearMetrics.totalOT.toFixed(1))}
                                </span>
                                <span className="text-xs font-bold text-gray-400">H (Year)</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 px-3 py-1 rounded-full bg-blue-50/50 border border-blue-100 w-fit">
                                <span className="text-[9px] font-black text-blue-400 uppercase">Month</span>
                                <span className="text-sm font-black text-blue-600">{mask(monthMetrics.totalOT.toFixed(1))}h</span>
                            </div>
                        </div>
                        {/* Visual Decoration or Mini Graph could go here */}
                        <div className="h-full w-1 bg-gradient-to-b from-transparent via-blue-100 to-transparent rounded-full opacity-50" />
                    </motion.div>

                    {/* Row 2 Right: Toolbox (Builder) */}
                    <ToolboxBuilder />
                </div>
            </div>
        </div>
    )
}

function ToolboxBuilder() {
    // State for builder
    const [m03, setM03] = useState(false);
    const [gtk, setGtk] = useState(false);
    const [content, setContent] = useState('');
    const [dateOffset, setDateOffset] = useState(-1); // Default yesterday
    const [units, setUnits] = useState(8);
    const [isCopied, setIsCopied] = useState(false);

    // Helper for formatted date
    const targetDate = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + dateOffset);
        return d;
    }, [dateOffset]);

    const dateStr = format(targetDate, 'M/d');

    // Generate full text
    const fullText = useMemo(() => {
        return `Nolan哥，${m03 ? 'M03 ' : ''}${content}${gtk ? ' （GTK刷臉）' : ''} ${dateStr} +${units}單位，謝謝！`;
    }, [m03, gtk, content, dateStr, units]);

    const handleCopy = () => {
        navigator.clipboard.writeText(fullText);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    // Drag handlers
    const handleDrag = (e, type) => {
        // Simple drag logic reusing concept from TimePicker
        // type: 'date' or 'unit'
        const startX = e.clientX || (e.touches && e.touches[0].clientX);
        const startValue = type === 'date' ? dateOffset : units;

        const handleMove = (moveEvent) => {
            const currentX = moveEvent.clientX || (moveEvent.touches && moveEvent.touches[0].clientY);
            const diff = currentX - startX;
            // Sensitivity Reduced significantly: 
            // Date: ~100px per day
            // Unit: ~100px per 2 units

            if (type === 'date') {
                const step = Math.round(diff / 100);
                setDateOffset(startValue + step);
            } else {
                const step = Math.round(diff / 80);
                // Clamp 0-16
                setUnits(Math.min(16, Math.max(0, startValue + (step * 2))));
            }
        };

        const handleEnd = () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleEnd);
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchmove', handleMove);
        window.addEventListener('touchend', handleEnd);
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="neumo-card p-4 flex flex-col justify-between h-40 relative group"
        >
            <div className="flex justify-between items-start mb-2">
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                    <Briefcase size={14} /> Quick Copy
                </h4>
                {isCopied && <span className="text-[10px] font-black text-green-500 bg-green-50 px-2 py-0.5 rounded-full animate-pulse">COPIED!</span>}
            </div>

            {/* Builder UI */}
            <div className="space-y-2 flex-1 flex flex-col justify-center">
                {/* Row 1: Toggles & Input */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">Nolan哥，</span>
                    <button
                        onClick={() => setM03(!m03)}
                        className={cn("px-2 py-1 rounded-lg text-[10px] font-black transition-all", m03 ? "neumo-pressed text-blue-600" : "neumo-raised text-gray-300")}
                    >
                        M03
                    </button>
                    <input
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="工作內容..."
                        className="neumo-inner-shadow flex-1 h-7 rounded-lg px-2 text-xs font-bold bg-transparent min-w-[60px]"
                    />
                    <button
                        onClick={() => setGtk(!gtk)}
                        className={cn("px-2 py-1 rounded-lg text-[10px] font-black transition-all", gtk ? "neumo-pressed text-purple-600" : "neumo-raised text-gray-300")}
                    >
                        GTK
                    </button>
                </div>

                {/* Row 2: Draggables */}
                <div className="flex items-center gap-2">
                    {/* Date Dragger */}
                    <div
                        className="flex-1 h-8 neumo-pressed rounded-lg flex items-center justify-center cursor-ew-resize select-none touch-none hover:bg-gray-100/50 transition-colors"
                        onMouseDown={(e) => handleDrag(e, 'date')}
                        onTouchStart={(e) => handleDrag(e, 'date')}
                    >
                        <Calendar size={12} className="text-gray-400 mr-1.5" />
                        <span className="text-xs font-black text-gray-600">{dateStr}</span>
                    </div>

                    <span className="text-xs font-bold text-gray-300">+</span>

                    {/* Unit Dragger */}
                    <div
                        className="flex-1 h-8 neumo-pressed rounded-lg flex items-center justify-center cursor-ew-resize select-none touch-none hover:bg-gray-100/50 transition-colors"
                        onMouseDown={(e) => handleDrag(e, 'unit')}
                        onTouchStart={(e) => handleDrag(e, 'unit')}
                    >
                        <span className="text-xs font-black text-neumo-brand mr-1">{units}</span>
                        <span className="text-[10px] font-bold text-gray-400">單位</span>
                    </div>

                    <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">，謝謝！</span>
                </div>
            </div>

            {/* Preview & Action */}
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
                <div className="flex-1 text-[10px] text-gray-400 font-bold truncate italic">
                    {fullText}
                </div>
                <button
                    onClick={handleCopy}
                    className="neumo-button w-8 h-8 flex items-center justify-center text-gray-500 hover:text-neumo-brand transition-colors"
                >
                    {isCopied ? <Check size={16} className="text-green-500" /> : <Briefcase size={16} />}
                </button>
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
