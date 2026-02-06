import React, { useState, useRef, useEffect } from 'react'
import { format, isToday, getDay, isSameDay, isAfter, startOfDay } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Clock, ChevronDown, ChevronUp, Check, Palmtree, Moon, DollarSign, Coffee, CreditCard, X } from 'lucide-react'
import { cn } from '../lib/utils'
import { loadSettings, calculateOTHours, calculateDailySalary, calculateCompLeaveUnits, fetchExchangeRate, standardizeCountry } from '../lib/storage'

function DayCard({ day, record, onUpdate, isCurrentMonth = true, isFocused, onFocus, isPrivacy }) {
    const [endTime, setEndTime] = useState(record?.endTime || '17:30')
    const [travelCountry, setTravelCountry] = useState(record?.travelCountry || '')
    const [isHoliday, setIsHoliday] = useState(record?.isHoliday || false)
    const [isLeave, setIsLeave] = useState(record?.isLeave || false)
    const [otType, setOtType] = useState(record?.otType || 'pay')
    const [isDragging, setIsDragging] = useState(false)
    const [isSaved, setIsSaved] = useState(false)
    const [settings, setSettings] = useState(null)

    const dragStartY = useRef(0)
    const startMinutes = useRef(0)
    const currentEndTimeRef = useRef(endTime)

    useEffect(() => { currentEndTimeRef.current = endTime }, [endTime])

    const isSunday = getDay(day) === 0;

    useEffect(() => {
        const init = async () => {
            const s = loadSettings();
            const rate = await fetchExchangeRate();
            setSettings({ ...s, liveRate: rate });
        };
        init();
    }, []);

    useEffect(() => {
        if (record) {
            let rawTime = record.endTime || '17:30';
            if (rawTime.includes('T')) {
                try { rawTime = format(new Date(rawTime), 'HH:mm'); }
                catch (e) { rawTime = '17:30'; }
            }
            setEndTime(rawTime)
            const country = standardizeCountry(record.travelCountry);
            setTravelCountry(country)
            setIsHoliday(record.isHoliday || false)
            setIsLeave(record.isLeave || false)
            setOtType(record.otType || 'pay')
        } else {
            setEndTime('17:30')
            setTravelCountry('')
            setIsHoliday(false)
            setIsLeave(false)
            setOtType('pay')
        }
    }, [record])

    const handleDragStart = (e) => {
        setIsDragging(true)
        dragStartY.current = e.clientY || (e.touches && e.touches[0].clientY)
        const [h, m] = endTime.split(':').map(Number)
        startMinutes.current = h * 60 + m

        const handleMove = (moveEvent) => {
            const currentY = moveEvent.clientY || (moveEvent.touches && moveEvent.touches[0].clientY)
            const diff = dragStartY.current - currentY
            const minuteDiff = Math.round(diff / 5) * 15
            const totalMins = Math.max(0, Math.min(23 * 60 + 45, startMinutes.current + minuteDiff))
            const nh = Math.floor(totalMins / 60)
            const nm = totalMins % 60
            const nextTime = `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
            setEndTime(nextTime)
            currentEndTimeRef.current = nextTime
        }

        const handleEnd = () => {
            setIsDragging(false)
            window.removeEventListener('mousemove', handleMove)
            window.removeEventListener('mouseup', handleEnd)
            window.removeEventListener('touchmove', handleMove)
            window.removeEventListener('touchend', handleEnd)
            // No auto-sync here anymore, wait for Save button
        }

        window.addEventListener('mousemove', handleMove)
        window.addEventListener('mouseup', handleEnd)
        window.addEventListener('touchmove', handleMove)
        window.addEventListener('touchend', handleEnd)
    }

    const syncUpdate = (overrides = {}) => {
        const finalEndTime = overrides.endTime || endTime;
        let finalTravel = overrides.travelCountry !== undefined ? overrides.travelCountry : travelCountry;
        if (finalTravel === '越南' || finalTravel === 'VIETNAM') finalTravel = 'VN';

        const finalHoliday = overrides.isHoliday !== undefined ? overrides.isHoliday : isHoliday;
        const finalLeave = overrides.isLeave !== undefined ? overrides.isLeave : isLeave;
        const finalType = overrides.otType !== undefined ? overrides.otType : otType;

        const otHours = calculateOTHours(finalEndTime, settings?.rules?.standardEndTime);

        onUpdate({
            date: day,
            endTime: finalEndTime,
            otHours: otHours,
            travelCountry: finalTravel,
            isHoliday: finalHoliday,
            isLeave: finalLeave,
            otType: finalType
        })
    }

    const otHoursRaw = settings ? calculateOTHours(endTime, settings.rules.standardEndTime) : 0;
    const otHours = isNaN(otHoursRaw) ? 0 : otHoursRaw;
    const salaryMetrics = settings ? calculateDailySalary({ ...record, endTime, otHours, isHoliday, isLeave, otType }, settings) : { total: 0 };
    const dailySalary = salaryMetrics?.total || 0;
    const compUnits = calculateCompLeaveUnits({ otHours, otType });

    const mask = (val) => isPrivacy ? '••••' : val;

    const getCountryCode = (name) => {
        const mapping = { '印度': 'IN', '越南': 'VN', '越南': 'VN', 'VIETNAM': 'VN', '大陸': 'CN' };
        return mapping[name] || name;
    }

    const toggleOtType = (e) => {
        e.stopPropagation();
        setOtType(otType === 'pay' ? 'leave' : 'pay');
    }

    const handleSave = (e) => {
        if (e) e.stopPropagation();
        console.log(`DayCard: Saving ${format(day, 'yyyy-MM-dd')}`, { endTime, travelCountry, isHoliday, isLeave, otType });
        syncUpdate();
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    }

    const handleCancel = (e) => {
        if (e) e.stopPropagation();
        console.log(`DayCard: Canceling ${format(day, 'yyyy-MM-dd')}`);
        // Reset local state to original record values
        if (record) {
            let rawTime = record.endTime || '17:30';
            if (rawTime.includes('T')) {
                try { rawTime = format(new Date(rawTime), 'HH:mm'); }
                catch (e) { rawTime = '17:30'; }
            }
            setEndTime(rawTime)
            const country = standardizeCountry(record.travelCountry);
            setTravelCountry(country || '')
            setIsHoliday(record.isHoliday || false)
            setIsLeave(record.isLeave || false)
            setOtType(record.otType || 'pay')
        } else {
            setEndTime('17:30')
            setTravelCountry('')
            setIsHoliday(false)
            setIsLeave(false)
            setOtType('pay')
        }
        onFocus(); // Close the card on cancel
    }

    return (
        <motion.div
            layout
            transition={{
                layout: { type: 'tween', ease: 'easeOut', duration: 0.25 },
                opacity: { duration: 0.2 }
            }}
            onClick={onFocus}
            className={cn(
                "neumo-card transition-all flex flex-col p-3 md:p-4", // Slightly smaller padding on mobile
                isToday(day) && "ring-2 ring-neumo-brand/40",
                isHoliday && "bg-orange-50/30",
                isLeave && "opacity-50",
                isSunday && !isFocused && "bg-[#e0f2fe] shadow-inner text-sky-900", // New Light Sky Blue Sunday style
                !isSunday && isAfter(startOfDay(day), startOfDay(new Date())) && !isFocused && "bg-[#d1d5db] shadow-inner", // Future style
                "cursor-pointer overflow-hidden",
                !isCurrentMonth && "opacity-10 pointer-events-none scale-95",
                isFocused ? "md:flex-[2] z-10" : "flex-1"
            )}
        >
            {/* Header / Compact Layout */}
            <div className="flex justify-between items-start w-full">
                <div className="flex flex-col gap-0.5 md:gap-1">
                    <span className={cn(
                        "text-lg md:text-xl font-black leading-none",
                        isToday(day) ? "text-neumo-brand" : "text-[#202731]",
                        isSunday && "opacity-60"
                    )}>
                        {format(day, 'dd')}
                    </span>

                    {/* OT under date on mobile */}
                    {otHours > 0 && (
                        <div className="flex md:hidden items-center gap-0.5">
                            <span className="text-[10px] font-black text-neumo-brand">{otHours.toFixed(1)}h</span>
                            {otType === 'leave' ? (
                                <Coffee size={8} className="text-indigo-500" />
                            ) : (
                                <DollarSign size={8} className="text-green-500" />
                            )}
                        </div>
                    )}

                    {/* Salary under date on mobile/compact */}
                    {dailySalary > 0 && !isLeave && (
                        <span className={cn("text-[7px] md:hidden font-bold text-gray-400 tabular-nums")}>
                            {mask('$' + Math.round(dailySalary).toLocaleString())}
                        </span>
                    )}

                    {/* Icons below date - Now always flex and larger icons */}
                    <div className="flex items-center gap-1.2 md:gap-1.5 h-3 md:h-4">
                        {isHoliday && <Palmtree size={12} className="text-orange-500 md:w-3.5" strokeWidth={3} />}
                        {isLeave && <Moon size={12} className="text-indigo-400 md:w-3.5" strokeWidth={3} />}
                        {travelCountry && (
                            <span className="text-[7px] md:text-[8px] font-black text-green-600 uppercase border border-green-200 px-0.8 rounded">
                                {getCountryCode(travelCountry)}
                            </span>
                        )}
                    </div>
                </div>

                {/* Right of date: OT & Money - Money shown on right ONLY for Desktop */}
                <div className="flex flex-col items-end">
                    {otHours > 0 && (
                        <div className="hidden md:flex items-center gap-0.5 md:gap-1">
                            <span className="text-xs md:text-sm font-black text-neumo-brand">{otHours.toFixed(1)}h</span>
                            {otType === 'leave' ? (
                                <Coffee size={8} className="text-indigo-500 md:w-2.5" />
                            ) : (
                                <DollarSign size={8} className="text-green-500 md:w-2.5" />
                            )}
                        </div>
                    )}
                    {dailySalary > 0 && !isLeave && (
                        <span className="hidden md:block text-[9px] font-bold text-gray-400 tabular-nums">
                            {mask('$' + Math.round(dailySalary).toLocaleString())}
                        </span>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {isFocused && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{
                            opacity: 1,
                            height: 'auto',
                            transition: {
                                height: { type: 'tween', ease: 'easeOut', duration: 0.25 },
                                opacity: { duration: 0.2, delay: 0.05 }
                            }
                        }}
                        exit={{
                            opacity: 0,
                            height: 0,
                            transition: {
                                height: { type: 'tween', ease: 'easeIn', duration: 0.2 },
                                opacity: { duration: 0.15 }
                            }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-6 pt-6 border-t border-gray-100/50 space-y-6 overflow-hidden"
                    >
                        {/* Status Grid */}
                        <div className="flex gap-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsHoliday(!isHoliday); }}
                                className={cn("flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 text-[8px] font-bold uppercase transition-all", isHoliday ? "neumo-pressed text-orange-500" : "neumo-raised text-gray-400")}
                            >
                                <Palmtree size={14} /> 假日
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsLeave(!isLeave); }}
                                className={cn("flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 text-[8px] font-bold uppercase transition-all", isLeave ? "neumo-pressed text-indigo-500" : "neumo-raised text-gray-400")}
                            >
                                <Moon size={14} /> 請假
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); const seq = ['', 'VN', 'IN', 'CN']; setTravelCountry(seq[(seq.indexOf(travelCountry) + 1) % seq.length]); }}
                                className={cn("flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 text-[8px] font-bold uppercase transition-all", travelCountry ? "neumo-pressed text-green-600" : "neumo-raised text-gray-400")}
                            >
                                <MapPin size={14} /> {travelCountry || '出差'}
                            </button>
                        </div>

                        {/* Time Picker */}
                        {!isLeave && (
                            <div
                                className="h-24 neumo-pressed rounded-3xl flex flex-col items-center justify-center relative cursor-ns-resize overflow-hidden"
                                onMouseDown={(e) => { e.stopPropagation(); handleDragStart(e); }}
                                onTouchStart={(e) => { e.stopPropagation(); handleDragStart(e); }}
                            >
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-[#202731]">{endTime}</span>
                                    <Clock size={12} className="text-gray-300" />
                                </div>
                                <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest mt-1">拖曳調整下班</p>
                            </div>
                        )}

                        {/* OT Details - No boxes, just layout */}
                        {otHours >= 0.5 ? (
                            <div className="flex items-center justify-between px-2">
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">加班時數 / 類型</p>
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl font-black text-neumo-brand leading-none">{otHours.toFixed(1)}h</span>
                                        <button
                                            onClick={toggleOtType}
                                            className={cn(
                                                "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                                                otType === 'pay' ? "bg-green-500 text-white shadow-lg" : "bg-indigo-500 text-white shadow-lg"
                                            )}
                                        >
                                            {otType === 'pay' ? <DollarSign size={14} /> : <Coffee size={14} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="text-right space-y-1">
                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">
                                        預估 {otType === 'leave' ? '補休' : '薪資'}
                                    </p>
                                    <div className="flex items-baseline justify-end gap-1">
                                        <span className={cn(
                                            "text-2xl font-black tabular-nums",
                                            otType === 'leave' ? "text-indigo-600" : "text-green-600"
                                        )}>
                                            {otType === 'leave' ? compUnits.toFixed(0) : mask(`${Math.round(dailySalary).toLocaleString()}`)}
                                        </span>
                                        <span className="text-[9px] font-bold text-gray-400 uppercase">
                                            {otType === 'leave' ? '單' : 'TWD'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="neumo-pressed p-4 rounded-2xl flex justify-center items-center gap-2 opacity-40 grayscale h-[60px]">
                                <Clock size={14} className="text-gray-400" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">時數不足 0.5H 不計入加班</span>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={handleCancel}
                                className="flex-1 neumo-button h-12 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400"
                            >
                                <X size={16} strokeWidth={3} />
                                取消
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaved}
                                className={cn(
                                    "flex-[2] neumo-button h-12 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-500",
                                    isSaved ? "text-green-600 neumo-pressed scale-[0.98]" : "text-neumo-brand"
                                )}
                            >
                                {isSaved ? (
                                    <>
                                        <Check size={16} strokeWidth={4} className="animate-bounce" />
                                        已儲存變更
                                    </>
                                ) : (
                                    <>
                                        <Check size={16} strokeWidth={3} />
                                        儲存變更
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export default DayCard;
