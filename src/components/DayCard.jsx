import React, { useState, useEffect } from 'react'
import { format, isToday, getDay, isAfter, startOfDay } from 'date-fns'
import { motion } from 'framer-motion'
import { Palmtree, Moon, DollarSign, Coffee } from 'lucide-react'
import { cn } from '../lib/utils'
import { loadSettings, calculateOTHours, calculateDuration, calculateDailySalary, fetchExchangeRate, standardizeCountry } from '../lib/storage'
import { isTaiwanHoliday, getHolidayName } from '../lib/holidays'

function DayCard({ day, record, onClick, isCurrentMonth = true, isPrivacy }) {
    const [settings, setSettings] = useState(null)

    useEffect(() => {
        const init = async () => {
            const s = loadSettings();
            const rate = await fetchExchangeRate();
            setSettings({ ...s, liveRate: rate });
        };
        init();
    }, []);

    const dayOfWeek = getDay(day);
    const isSunday = dayOfWeek === 0;
    const isSaturday = dayOfWeek === 6;

    // Derived values for display
    // Do NOT default to '17:30' here; if record is missing or has no time, we should treat it as 0 OT.
    const endTime = record?.endTime;
    const travelCountry = standardizeCountry(record?.travelCountry);
    const isHoliday = record?.isHoliday || isTaiwanHoliday(day);
    const isLeave = record?.isLeave || false;
    const otType = record?.otType || 'pay';

    const storedOT = parseFloat(record?.otHours);

    const isWorkDay = record?.isWorkDay || false;

    let calculatedOT = 0;
    if (settings && !isLeave) {
        // Priority: isWorkDay overrides everything -> Treat as Weekday
        // Then: isRestDay (Sun, Sat, Holiday) checks
        const isRestDay = (isSunday || isSaturday || isHoliday) && !isWorkDay;

        if (isWorkDay) {
            // Weekday Logic (WorkDay checked on Sat/Sun/Holiday)
            calculatedOT = calculateOTHours(endTime, settings.rules?.standardEndTime);
        } else if (isRestDay) {
            const start = settings.rules?.standardStartTime || "08:30";
            const breakTime = settings.rules?.lunchBreak || 1.5;
            calculatedOT = calculateDuration(start, endTime, breakTime);
        } else {
            // Normal Weekday
            calculatedOT = calculateOTHours(endTime, settings.rules?.standardEndTime);
        }
    }

    const otHours = (!isNaN(storedOT) && storedOT > 0) ? storedOT : (isNaN(calculatedOT) ? 0 : calculatedOT);
    const salaryMetrics = settings ? calculateDailySalary({ ...record, endTime, otHours, isHoliday, isLeave, otType }, settings) : { total: 0 };
    const dailySalary = salaryMetrics?.total || 0;

    const mask = (val) => isPrivacy ? '••••' : val;

    const getCountryCode = (name) => {
        const mapping = { '印度': 'IN', '越南': 'VN', 'VIETNAM': 'VN', '大陸': 'CN' };
        return mapping[name] || name;
    }

    return (
        <motion.div
            layout
            onClick={onClick}
            className={cn(
                "neumo-card transition-all flex flex-col p-2 md:p-3 relative h-20 md:h-28", // Fixed height for predictability
                isToday(day) && "ring-2 ring-neumo-brand/40",
                isHoliday && "bg-rose-50/10",
                isLeave && "opacity-60",
                isSunday && "bg-[#e0f2fe]/40 text-sky-900",
                !isSunday && isAfter(startOfDay(day), startOfDay(new Date())) && "bg-gray-100/50 grayscale-[0.5]",
                "cursor-pointer overflow-hidden hover:scale-[0.98] active:scale-95 group",
                !isCurrentMonth && "opacity-10 pointer-events-none scale-95"
            )}
        >
            {/* Top Row: Date & Money/Country */}
            <div className="flex justify-between items-start w-full relative z-10">
                <div className="flex items-center gap-1.5">
                    <span className={cn(
                        "text-base md:text-2xl font-black leading-none",
                        isToday(day) ? "text-neumo-brand" : ((isHoliday || isTaiwanHoliday(day)) ? "text-rose-600" : "text-[#202731]"),
                        isSunday && !isHoliday && !isTaiwanHoliday(day) && "opacity-60"
                    )}>
                        {format(day, 'dd')}
                    </span>
                    {/* Mobile: Travel Country next to date */}
                    {travelCountry && (
                        <span className="md:hidden text-[8px] font-black text-green-600 uppercase border border-green-200 px-1 rounded bg-green-50/50">
                            {getCountryCode(travelCountry)}
                        </span>
                    )}
                </div>

                {/* Right Top: Desktop Price Pill */}
                <div className="hidden md:flex flex-col items-end gap-1">
                    {dailySalary > 0 && !isLeave && (
                        <div className="bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded-full border border-gray-100 shadow-sm">
                            <span className="text-[10px] font-black text-gray-500 tabular-nums">
                                {mask('$' + Math.round(dailySalary).toLocaleString())}
                            </span>
                        </div>
                    )}
                    {/* Desktop: Travel below price */}
                    {travelCountry && (
                        <span className="text-[8px] font-black text-green-600 uppercase border border-green-200 px-1 rounded bg-green-50/50">
                            {getCountryCode(travelCountry)}
                        </span>
                    )}
                </div>
            </div>

            {/* Center Area: OT Info */}
            <div className="flex-1 flex flex-col justify-center items-end md:items-center relative">
                {/* Desktop: Centered OT */}
                {otHours > 0 && (
                    <div className="absolute right-0 md:static flex items-center gap-1 bg-white/40 md:bg-transparent px-1.5 py-0.5 rounded-lg">
                        <span className={cn(
                            "text-xs md:text-lg font-black",
                            otType === 'internal' ? "text-purple-600" : (otType === 'pay' ? "text-neumo-brand" : "text-indigo-500")
                        )}>{otHours.toFixed(1)}</span>
                        {otType === 'leave' ? (
                            <Coffee size={16} className="text-indigo-500 md:w-5 md:h-5" />
                        ) : otType === 'internal' ? (
                            <Coffee size={16} className="text-purple-600 md:w-5 md:h-5" />
                        ) : (
                            <DollarSign size={16} className="text-green-500 md:w-5 md:h-5 border-2 border-green-500 rounded-full p-0.5" />
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Row: Status Icons (Left) & Holiday/Remark (Right) */}
            <div className="flex justify-between items-end w-full mt-auto relative z-10">
                {/* Left: Component-style Status Icons (Buffs) */}
                <div className="flex items-center gap-0.5 md:gap-1">
                    {isHoliday && (
                        <Palmtree size={14} className="text-rose-400 md:w-4 md:h-4" strokeWidth={1.5} />
                    )}
                    {isLeave && (
                        <Moon size={14} className="text-indigo-400 md:w-4 md:h-4" strokeWidth={1.5} />
                    )}
                    {record?.Remark?.includes('部門內部補休') && (
                        <span className="text-[8px] md:text-[10px] font-black text-purple-500">內</span>
                    )}
                </div>

                {/* Right: Desktop only Holiday Name / Remark */}
                <div className="hidden md:flex items-center gap-2">
                    {(isHoliday || isTaiwanHoliday(day)) && getHolidayName(day) && (
                        <span className="text-[9px] font-black text-rose-500/80 uppercase tracking-tighter bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                            {getHolidayName(day)}
                        </span>
                    )}
                    {record?.Remark && !record.Remark.includes('部門內部補休') && (
                        <span className="text-[9px] font-black text-gray-400 max-w-[60px] truncate bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                            {record.Remark}
                        </span>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

export default DayCard;
