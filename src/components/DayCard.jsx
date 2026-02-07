import React, { useState, useEffect } from 'react'
import { format, isToday, getDay, isAfter, startOfDay } from 'date-fns'
import { motion } from 'framer-motion'
import { Palmtree, Moon, DollarSign, Coffee } from 'lucide-react'
import { cn } from '../lib/utils'
import { loadSettings, calculateOTHours, calculateDuration, calculateDailySalary, fetchExchangeRate, standardizeCountry } from '../lib/storage'

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
    const endTime = record?.endTime || '17:30';
    const travelCountry = standardizeCountry(record?.travelCountry);
    const isHoliday = record?.isHoliday || false;
    const isLeave = record?.isLeave || false;
    const otType = record?.otType || 'pay';

    const storedOT = parseFloat(record?.otHours);

    let calculatedOT = 0;
    if (settings) {
        const isRestDay = isSunday || isSaturday || isHoliday;
        if (isRestDay) {
            const start = settings.rules?.standardStartTime || "08:30";
            const breakTime = settings.rules?.lunchBreak || 1.5;
            calculatedOT = calculateDuration(start, endTime, breakTime);
        } else {
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
            layout // Keep layout for subtle grid adjustments if any
            onClick={onClick}
            className={cn(
                "neumo-card transition-all flex flex-col p-2 md:p-3 relative",
                isToday(day) && "ring-2 ring-neumo-brand/40",
                isHoliday && "bg-orange-50/30",
                isLeave && "opacity-50",
                isSunday && "bg-[#e0f2fe] shadow-inner text-sky-900",
                !isSunday && isAfter(startOfDay(day), startOfDay(new Date())) && "bg-[#d1d5db] shadow-inner",
                "cursor-pointer overflow-hidden hover:scale-[0.98] active:scale-95 group",
                !isCurrentMonth && "opacity-10 pointer-events-none scale-95"
            )}
        >
            {/* Header / Compact Layout */}
            <div className="flex justify-between items-start w-full h-full min-h-[50px] md:min-h-[80px]">
                <div className="flex flex-col gap-0.5 md:gap-1">
                    <span className={cn(
                        "text-sm md:text-xl font-black leading-none",
                        isToday(day) ? "text-neumo-brand" : "text-[#202731]",
                        isSunday && "opacity-60"
                    )}>
                        {format(day, 'dd')}
                    </span>

                    {/* OT indicator */}
                    {otHours > 0 && (
                        <div className="flex items-center gap-0.5 mt-1">
                            <span className="text-[9px] md:text-xs font-black text-neumo-brand">{otHours.toFixed(1)}h</span>
                            {otType === 'leave' ? (
                                <Coffee size={10} className="text-indigo-500" />
                            ) : (
                                <DollarSign size={10} className="text-green-500" />
                            )}
                        </div>
                    )}

                    {/* Icons Row */}
                    <div className="flex items-center gap-1 mt-auto">
                        {isHoliday && <Palmtree size={10} className="text-orange-500" strokeWidth={3} />}
                        {isLeave && <Moon size={10} className="text-indigo-400" strokeWidth={3} />}
                        {travelCountry && (
                            <span className="text-[7px] font-black text-green-600 uppercase border border-green-200 px-0.5 rounded">
                                {getCountryCode(travelCountry)}
                            </span>
                        )}
                    </div>
                </div>

                {/* Right Side: Money (Desktop mainly) */}
                <div className="flex flex-col items-end">
                    {dailySalary > 0 && !isLeave && (
                        <span className="text-[8px] md:text-[10px] font-bold text-gray-400 tabular-nums">
                            {mask('$' + Math.round(dailySalary).toLocaleString())}
                        </span>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

export default DayCard;
