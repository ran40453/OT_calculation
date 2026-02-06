import React, { useState, useRef, useEffect } from 'react'
import { format, isToday, getDay, isSameDay } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Clock, ChevronDown, ChevronUp, Check, Palmtree, Moon, DollarSign, Coffee, CreditCard, X } from 'lucide-react'
import { cn } from '../lib/utils'
import { loadSettings, calculateOTHours, calculateDailySalary, calculateCompLeaveUnits, fetchExchangeRate } from '../lib/storage'

function DayCard({ day, record, onUpdate, isCurrentMonth = true, isFocused, onFocus }) {
    const [endTime, setEndTime] = useState(record?.endTime || '17:30')
    const [travelCountry, setTravelCountry] = useState(record?.travelCountry || '')
    const [isHoliday, setIsHoliday] = useState(record?.isHoliday || false)
    const [isLeave, setIsLeave] = useState(record?.isLeave || false)
    const [otType, setOtType] = useState(record?.otType || 'pay')
    const [isDragging, setIsDragging] = useState(false)
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
            // Standardize Vietnam to VN
            const country = record.travelCountry === '越南' || record.travelCountry === 'VIETNAM' ? 'VN' : record.travelCountry;
            setTravelCountry(country || '')
            setIsHoliday(record.isHoliday || false)
            setIsLeave(record.isLeave || false)
            setOtType(record.otType || 'pay')
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
    const dailySalary = settings ? calculateDailySalary({ ...record, endTime, otHours, isHoliday, isLeave, otType }, settings) : 0;
    const compUnits = calculateCompLeaveUnits({ otHours, otType });

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
        // Removed onFocus() to keep expanded as requested
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
            const country = record.travelCountry === '越南' || record.travelCountry === 'VIETNAM' ? 'VN' : record.travelCountry;
            setTravelCountry(country || '')
            setIsHoliday(record.isHoliday || false)
            setIsLeave(record.isLeave || false)
            setOtType(record.otType || 'pay')
        }
        // Removed onFocus() to keep expanded as requested
    }

    return (
        <motion.div
            layout
            onClick={onFocus}
            className={cn(
                "neumo-card transition-all duration-300 flex flex-col p-4",
                isToday(day) && "ring-2 ring-neumo-brand/40",
                isHoliday && "bg-orange-50/30",
                isLeave && "opacity-50",
                isSunday && !isFocused && "bg-[#d1d5db] shadow-inner",
                "cursor-pointer overflow-hidden",
                !isCurrentMonth && "opacity-10 pointer-events-none scale-95",
                isFocused ? "md:flex-[2] z-10" : "flex-1"
            )}
        >
            {/* Header / Compact Layout */}
            <div className="flex justify-between items-start w-full">
                <div className="flex flex-col gap-1">
                    <span className={cn(
                        "text-xl font-black leading-none",
                        isToday(day) ? "text-neumo-brand" : "text-[#202731]",
                        isSunday && "opacity-60"
                    )}>
                        {format(day, 'dd')}
                    </span>

                    {/* Icons below date - Hidden on mobile compact unless focused */}
                    <div className={cn("items-center gap-1.5 h-4", isFocused ? "flex" : "hidden md:flex")}>
                        {isHoliday && <Palmtree size={12} className="text-orange-500" strokeWidth={3} />}
                        {isLeave && <Moon size={12} className="text-indigo-400" strokeWidth={3} />}
                        {travelCountry && (
                            <span className="text-[7px] font-black text-green-600 uppercase border border-green-200 px-1 rounded">
                                {getCountryCode(travelCountry)}
                            </span>
                        )}
                    </div>
                </div>

                {/* Right of date: OT & Money - Money hidden on mobile compact */}
                <div className="flex flex-col items-end">
                    {otHours > 0 && (
                        <div className="flex items-center gap-1">
                            <span className="text-sm font-black text-neumo-brand">{otHours.toFixed(1)}h</span>
                            {otType === 'leave' ? (
                                <Coffee size={10} className="text-indigo-500" />
                            ) : (
                                <DollarSign size={10} className="text-green-500" />
                            )}
                        </div>
                    )}
                    {dailySalary > 0 && !isLeave && (
                        <span className={cn("text-[9px] font-bold text-gray-400 tabular-nums", isFocused ? "block" : "hidden md:block")}>
                            ${Math.round(dailySalary).toLocaleString()}
                        </span>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {isFocused && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-6 pt-6 border-t border-gray-100/50 space-y-6"
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

                        {/* OT Controls */}
                        {otHours >= 0.5 ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    {/* OT Info & Cycle Button */}
                                    <div className="flex-1 neumo-raised p-3 rounded-2xl flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <p className="text-[7px] font-black text-gray-400 uppercase">加班時數</p>
                                            <p className="text-xl font-black text-neumo-brand leading-none">{otHours.toFixed(1)}h</p>
                                        </div>
                                        <button
                                            onClick={toggleOtType}
                                            className={cn(
                                                "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                                otType === 'pay' ? "bg-green-500 text-white shadow-lg" : "bg-indigo-500 text-white shadow-lg"
                                            )}
                                        >
                                            {otType === 'pay' ? <DollarSign size={18} /> : <Coffee size={18} />}
                                        </button>
                                    </div>

                                    {/* Unified Sub-card Layout (Same size for both modes) */}
                                    <div className={cn(
                                        "flex-1 neumo-pressed p-3 rounded-2xl flex flex-col justify-center items-center h-[60px] transition-all duration-300",
                                        otType === 'leave' ? "bg-indigo-50/20" : "bg-green-50/20"
                                    )}>
                                        <p className={cn(
                                            "text-[7px] font-black uppercase tracking-widest mb-1",
                                            otType === 'leave' ? "text-indigo-400" : "text-green-600"
                                        )}>
                                            {otType === 'leave' ? '今日補休' : '今日加班費'}
                                        </p>
                                        <div className="flex items-baseline gap-1">
                                            <span className={cn(
                                                "text-xl font-black tabular-nums",
                                                otType === 'leave' ? "text-indigo-600" : "text-green-700"
                                            )}>
                                                {otType === 'leave' ? compUnits.toFixed(0) : `${Math.round(dailySalary).toLocaleString()}`}
                                            </span>
                                            <span className="text-[8px] font-bold text-gray-400 uppercase">
                                                {otType === 'leave' ? '單' : 'TWD'}
                                            </span>
                                        </div>
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
                                className="flex-[2] neumo-button h-12 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-neumo-brand"
                            >
                                <Check size={16} strokeWidth={3} />
                                儲存變更
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export default DayCard;
