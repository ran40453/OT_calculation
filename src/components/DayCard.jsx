import React, { useState, useRef, useEffect } from 'react'
import { format, isToday, getDay } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Clock, ChevronDown, ChevronUp, Check, Palmtree, Moon, DollarSign, Coffee } from 'lucide-react'
import { cn } from '../lib/utils'
import { loadSettings, calculateOTHours, calculateDailySalary, calculateCompLeaveUnits } from '../lib/storage'

function DayCard({ day, record, onUpdate, isCurrentMonth = true }) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [endTime, setEndTime] = useState(record?.endTime || '18:00')
    const [travelCountry, setTravelCountry] = useState(record?.travelCountry || '')
    const [isHoliday, setIsHoliday] = useState(record?.isHoliday || false)
    const [isLeave, setIsLeave] = useState(record?.isLeave || false)
    const [otType, setOtType] = useState(record?.otType || 'pay') // 'pay' or 'leave'
    const [isDragging, setIsDragging] = useState(false)
    const [settings, setSettings] = useState(null)

    const dragStartY = useRef(0)
    const startMinutes = useRef(0)

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
            let rawTime = record.endTime || '18:00';
            if (rawTime.includes('T')) {
                try {
                    rawTime = format(new Date(rawTime), 'HH:mm');
                } catch (e) {
                    rawTime = '18:00';
                }
            }
            setEndTime(rawTime)
            setTravelCountry(record.travelCountry || '')
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
            setEndTime(`${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`)
        }

        const handleEnd = () => {
            setIsDragging(false)
            window.removeEventListener('mousemove', handleMove)
            window.removeEventListener('mouseup', handleEnd)
            window.removeEventListener('touchmove', handleMove)
            window.removeEventListener('touchend', handleEnd)
            syncUpdate({ endTime: endTime })
        }

        window.addEventListener('mousemove', handleMove)
        window.addEventListener('mouseup', handleEnd)
        window.addEventListener('touchmove', handleMove)
        window.addEventListener('touchend', handleEnd)
    }

    const syncUpdate = (overrides = {}) => {
        const finalEndTime = overrides.endTime || endTime;
        const finalTravel = overrides.travelCountry !== undefined ? overrides.travelCountry : travelCountry;
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
        const mapping = { '印度': 'IN', '越南': 'VN', '大陸': 'CN' };
        return mapping[name] || name;
    }

    const toggleStatus = (type) => {
        if (type === 'holiday') {
            setIsHoliday(!isHoliday);
            syncUpdate({ isHoliday: !isHoliday });
        } else if (type === 'leave') {
            setIsLeave(!isLeave);
            syncUpdate({ isLeave: !isLeave });
        }
    };

    const cycleCountry = (e) => {
        e.stopPropagation();
        const sequence = ['', '印度', '越南', '大陸'];
        const newVal = sequence[(sequence.indexOf(travelCountry) + 1) % sequence.length];
        setTravelCountry(newVal);
        syncUpdate({ travelCountry: newVal });
    };

    return (
        <motion.div
            layout
            className={cn(
                "neumo-card transition-all duration-500 flex flex-col p-4",
                isToday(day) && "ring-2 ring-neumo-brand/30 ring-inset",
                isHoliday && "bg-orange-50/50",
                isLeave && "opacity-60",
                isSunday && "bg-[#d1d5db] shadow-[6px_6px_12px_#b8bcbe,-6px_-6px_12px_#eaeeef]",
                "w-full",
                !isCurrentMonth && "opacity-25 grayscale-[0.5] scale-95 pointer-events-none"
            )}
        >
            {/* Header Area */}
            <div
                className="flex justify-between items-center cursor-pointer w-full"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <span className={cn(
                        "text-2xl font-black leading-none",
                        isToday(day) ? "text-neumo-brand" : "text-[#202731]",
                        isSunday && "text-gray-600"
                    )}>
                        {format(day, 'dd')}
                    </span>

                    {/* Compact View Labels (Mobile Icons) */}
                    {!isExpanded && (
                        <div className="flex items-center gap-2">
                            {isHoliday && <Palmtree size={14} className="text-orange-500" />}
                            {isLeave && <Moon size={14} className="text-indigo-400" />}
                            {travelCountry && (
                                <div className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">
                                    {getCountryCode(travelCountry)}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Side Info */}
                <div className="flex items-center gap-3">
                    {!isExpanded && (
                        <div className="flex flex-col items-end">
                            {otHours > 0 ? (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-lg font-black text-neumo-brand leading-none">
                                        {otHours.toFixed(1)}<span className="text-[10px] ml-0.5 uppercase tracking-tighter">h</span>
                                    </span>
                                    {otType === 'leave' ? (
                                        <div className="bg-indigo-100 text-indigo-600 px-1.5 rounded text-[9px] font-black">補</div>
                                    ) : (
                                        <DollarSign size={14} className="text-green-500" />
                                    )}
                                </div>
                            ) : null}
                        </div>
                    )}
                    <div className="text-gray-300">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-6 pt-6 border-t border-gray-100/50 space-y-6">
                            {/* Action Buttons to the Right of Date Logic - Implemented as a clean row */}
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleStatus('holiday'); }}
                                    className={cn(
                                        "flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all",
                                        isHoliday ? "neumo-pressed text-orange-500 bg-orange-50" : "neumo-raised text-gray-400"
                                    )}
                                >
                                    <Palmtree size={14} /> 假日
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleStatus('leave'); }}
                                    className={cn(
                                        "flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all",
                                        isLeave ? "neumo-pressed text-indigo-500 bg-indigo-50" : "neumo-raised text-gray-400"
                                    )}
                                >
                                    <Moon size={14} /> 請假
                                </button>
                                <button
                                    onClick={cycleCountry}
                                    className={cn(
                                        "flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all",
                                        travelCountry ? "neumo-pressed text-green-600 bg-green-50" : "neumo-raised text-gray-400"
                                    )}
                                >
                                    <MapPin size={14} /> {travelCountry ? getCountryCode(travelCountry) : '出差'}
                                </button>
                            </div>

                            {/* Time Adjuster */}
                            {!isLeave && (
                                <div
                                    className="h-28 neumo-pressed rounded-[2rem] flex flex-col items-center justify-center relative cursor-ns-resize overflow-hidden touch-none"
                                    onMouseDown={(e) => { e.stopPropagation(); handleDragStart(e); }}
                                    onTouchStart={(e) => { e.stopPropagation(); handleDragStart(e); }}
                                >
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-black text-[#202731] tabular-nums">{endTime}</span>
                                        <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">下班時間</span>
                                    </div>
                                    <div className="flex flex-col items-center opacity-20 mt-2">
                                        <ChevronUp size={12} className="-mb-1" />
                                        <span className="text-[7px] font-black uppercase tracking-[0.3em]">拖曳調整</span>
                                        <ChevronDown size={12} className="-mt-1" />
                                    </div>
                                    {isDragging && <div className="absolute inset-0 bg-neumo-brand/5 pointer-events-none" />}
                                </div>
                            )}

                            {/* OT Type & Stats */}
                            <div className="space-y-4">
                                <div className="flex gap-3">
                                    {/* OT Type Toggle */}
                                    <div className="flex-1 neumo-pressed p-1.5 rounded-2xl flex h-14">
                                        <button
                                            onClick={() => { setOtType('pay'); syncUpdate({ otType: 'pay' }); }}
                                            className={cn(
                                                "flex-1 rounded-xl flex flex-col items-center justify-center transition-all",
                                                otType === 'pay' ? "bg-white shadow-md text-neumo-brand" : "text-gray-400"
                                            )}
                                        >
                                            <DollarSign size={14} strokeWidth={3} />
                                            <span className="text-[8px] font-black uppercase">加班費</span>
                                        </button>
                                        <button
                                            onClick={() => { setOtType('leave'); syncUpdate({ otType: 'leave' }); }}
                                            className={cn(
                                                "flex-1 rounded-xl flex flex-col items-center justify-center transition-all",
                                                otType === 'leave' ? "bg-indigo-500 shadow-md text-white" : "text-gray-400"
                                            )}
                                        >
                                            <Coffee size={14} strokeWidth={3} />
                                            <span className="text-[8px] font-black uppercase">補休</span>
                                        </button>
                                    </div>

                                    {/* Stats Display */}
                                    <div className="flex-1 neumo-raised p-3 rounded-2xl flex flex-col justify-center">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest">加班時數</p>
                                                <p className="text-lg font-black text-[#202731] leading-none">{otHours.toFixed(1)}h</p>
                                            </div>
                                            {otType === 'leave' ? (
                                                <div className="text-right">
                                                    <p className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">補休單位</p>
                                                    <p className="text-lg font-black text-indigo-500 leading-none">{compUnits.toFixed(1)}</p>
                                                </div>
                                            ) : (
                                                <div className="text-right">
                                                    <p className="text-[7px] font-black text-green-400 uppercase tracking-widest">今日所得</p>
                                                    <p className="text-lg font-black text-green-600 leading-none">${Math.round(dailySalary).toLocaleString()}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                                className="neumo-button w-full h-14 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-neumo-brand"
                            >
                                <Check size={18} strokeWidth={3} />
                                確認完成
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export default DayCard;
