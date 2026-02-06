import React, { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { MapPin, Clock, Check, Palmtree, Moon, DollarSign, Coffee, X } from 'lucide-react'
import { cn } from '../lib/utils'
import { loadSettings, calculateOTHours, calculateDailySalary, calculateCompLeaveUnits, fetchExchangeRate, standardizeCountry } from '../lib/storage'

function DayCardExpanded({ day, record, onUpdate, onClose, style, className, hideHeader = false }) {
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

    useEffect(() => {
        const init = async () => {
            const s = loadSettings();
            const rate = await fetchExchangeRate();
            setSettings({ ...s, liveRate: rate });
        };
        init();
    }, []);

    // Sync state if record changes externally (though unlikely while focused)
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

    const mask = (val) => val; // Privacy handled by parent or just ignored in edit mode for now? User usually wants to see val when editing.

    const toggleOtType = (e) => {
        e.stopPropagation();
        setOtType(otType === 'pay' ? 'leave' : 'pay');
    }

    const handleSave = (e) => {
        if (e) e.stopPropagation();
        syncUpdate();
        setIsSaved(true);
        setTimeout(() => {
            setIsSaved(false);
            if (onClose) onClose();
        }, 800);
    }

    return (
        <div style={style} className={cn("neumo-card p-4 flex flex-col gap-4 overflow-hidden relative z-50 bg-[#E0E5EC] shadow-2xl", className)} onClick={e => e.stopPropagation()}>
            {/* Header Section with Date (if needed) or just Close button */}
            {/* The design implies this card merges with the cell. We might render the content directly. */}
            {!hideHeader && (
                <div className="flex justify-between items-start">
                    <h3 className="text-xl font-black text-neumo-brand">{format(day, 'MMM dd')}</h3>
                    <button onClick={onClose} className="neumo-button p-2 text-gray-400 hover:text-red-400">
                        <X size={18} />
                    </button>
                </div>
            )}

            {/* If header is hidden, we might still want a close action or just rely on backdrop click? */}
            {/* The CalendarOverlay handles closing via backdrop. */}

            {/* Status Grid */}
            <div className="flex gap-2">
                <button
                    onClick={() => setIsHoliday(!isHoliday)}
                    className={cn("flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 text-[8px] font-bold uppercase transition-all", isHoliday ? "neumo-pressed text-orange-500" : "neumo-raised text-gray-400")}
                >
                    <Palmtree size={14} /> 假日
                </button>
                <button
                    onClick={() => setIsLeave(!isLeave)}
                    className={cn("flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 text-[8px] font-bold uppercase transition-all", isLeave ? "neumo-pressed text-indigo-500" : "neumo-raised text-gray-400")}
                >
                    <Moon size={14} /> 請假
                </button>
                <button
                    onClick={() => { const seq = ['', 'VN', 'IN', 'CN']; setTravelCountry(seq[(seq.indexOf(travelCountry) + 1) % seq.length]); }}
                    className={cn("flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 text-[8px] font-bold uppercase transition-all", travelCountry ? "neumo-pressed text-green-600" : "neumo-raised text-gray-400")}
                >
                    <MapPin size={14} /> {travelCountry || '出差'}
                </button>
            </div>

            {/* Time Picker */}
            {!isLeave && (
                <div
                    className="h-24 neumo-pressed rounded-3xl flex flex-col items-center justify-center relative cursor-ns-resize overflow-hidden shrink-0"
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                >
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-[#202731]">{endTime}</span>
                        <Clock size={14} className="text-gray-300" />
                    </div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">拖曳調整下班</p>
                </div>
            )}

            {/* OT Details */}
            {otHours >= 0.5 ? (
                <div className="flex items-center justify-between px-2">
                    <div className="space-y-1">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">加班時數 / 類型</p>
                        <div className="flex items-center gap-3">
                            <span className="text-3xl font-black text-neumo-brand leading-none">{otHours.toFixed(1)}h</span>
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
                                {otType === 'leave' ? compUnits.toFixed(0) : `\$${Math.round(dailySalary).toLocaleString()}`}
                            </span>
                            <span className="text-[9px] font-bold text-gray-400 uppercase">
                                {otType === 'leave' ? '單' : 'TWD'}
                            </span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="neumo-pressed p-4 rounded-2xl flex justify-center items-center gap-2 opacity-40 grayscale h-[60px] shrink-0">
                    <Clock size={14} className="text-gray-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">時數不足 0.5H 不計入加班</span>
                </div>
            )}

            <button
                onClick={handleSave}
                disabled={isSaved}
                className={cn(
                    "w-full neumo-button h-12 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 mt-auto",
                    isSaved ? "text-green-600 neumo-pressed scale-[0.98]" : "text-neumo-brand"
                )}
            >
                {isSaved ? (
                    <>
                        <Check size={18} strokeWidth={4} className="animate-bounce" />
                        已儲存
                    </>
                ) : (
                    <>
                        <Check size={18} strokeWidth={3} />
                        確認變更
                    </>
                )}
            </button>
        </div>
    )
}

export default DayCardExpanded
