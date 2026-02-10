import React, { useState, useRef, useEffect } from 'react'
import { format, getDay, isAfter } from 'date-fns' // Added getDay, isAfter
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Clock, Check, Palmtree, Moon, DollarSign, Coffee, Trash2 } from 'lucide-react'
import { cn } from '../lib/utils'
import { loadSettings, calculateOTHours, calculateDuration, calculateDailySalary, calculateCompLeaveUnits, fetchExchangeRate, standardizeCountry } from '../lib/storage' // Added calculateDuration
import { isTaiwanHoliday, getHolidayName } from '../lib/holidays'

function DayCardExpanded({ day, record, onUpdate, onClose, style, className, hideHeader = false }) {
    const [settings, setSettings] = useState(null) // Moved to top
    const [endTime, setEndTime] = useState(record?.endTime || '17:30')
    const [travelCountry, setTravelCountry] = useState(record?.travelCountry || '')
    const [isHoliday, setIsHoliday] = useState(record?.isHoliday || false)
    const [isWorkDay, setIsWorkDay] = useState(record?.isWorkDay || false)
    const [isLeave, setIsLeave] = useState(record?.isLeave || false)
    const [otType, setOtType] = useState(record?.otType || 'pay')
    // Leave States
    const [leaveDuration, setLeaveDuration] = useState(record?.leaveDuration || 8);
    const [isFullDay, setIsFullDay] = useState(record?.leaveDuration === 8 || (record?.isLeave && !record?.leaveDuration) || false);
    const [leaveStartTime, setLeaveStartTime] = useState(record?.leaveStartTime || settings?.rules?.standardStartTime || "08:30");
    const [leaveEndTime, setLeaveEndTime] = useState(record?.leaveEndTime || settings?.rules?.standardEndTime || "17:30");
    const [leaveType, setLeaveType] = useState(record?.leaveType || '特休');
    const [isLeaveTypePickerOpen, setIsLeaveTypePickerOpen] = useState(false);

    // Auto-calculate duration (Partial Day)
    useEffect(() => {
        if (isLeave && !isFullDay && settings) {
            const dur = calculateDuration(leaveStartTime, leaveEndTime, settings.rules?.lunchBreak || 1.5);
            if (dur !== leaveDuration) setLeaveDuration(dur);
        } else if (isLeave && isFullDay) {
            if (leaveDuration !== 8) setLeaveDuration(8);
        }
    }, [leaveStartTime, leaveEndTime, isFullDay, isLeave, settings]);

    const [isDragging, setIsDragging] = useState(false)
    const [isSaved, setIsSaved] = useState(false)
    // const [settings, setSettings] = useState(null) // Moved up

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

    // Sync state if record changes externally
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
            setIsWorkDay(record.isWorkDay || false)
            setIsLeave(record.isLeave || false)
            setOtType(record.otType || 'pay')
        }
    }, [record?.date, record?.endTime, record?.travelCountry, record?.isHoliday, record?.isWorkDay, record?.isLeave, record?.otType])

    const handleDragStart = (e, type = 'endTime') => {
        if (e.cancelable) e.preventDefault();
        setIsDragging(true)
        const startY = e.clientY || (e.touches && e.touches[0].clientY)

        let initialTime = endTime;
        if (type === 'leaveStart') initialTime = leaveStartTime;
        if (type === 'leaveEnd') initialTime = leaveEndTime;

        const [h, m] = initialTime.split(':').map(Number)
        const startMins = h * 60 + m

        const handleMove = (moveEvent) => {
            const currentY = moveEvent.clientY || (moveEvent.touches && moveEvent.touches[0].clientY)
            const diff = startY - currentY
            const minuteDiff = Math.round(diff / 5) * 15
            const totalMins = Math.max(0, Math.min(23 * 60 + 45, startMins + minuteDiff))
            const nh = Math.floor(totalMins / 60)
            const nm = totalMins % 60
            const nextTime = `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`

            if (type === 'endTime') {
                setEndTime(nextTime)
                currentEndTimeRef.current = nextTime
            } else if (type === 'leaveStart') {
                setLeaveStartTime(nextTime)
            } else if (type === 'leaveEnd') {
                setLeaveEndTime(nextTime)
            }
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
        window.addEventListener('touchmove', handleMove, { passive: false })
        window.addEventListener('touchend', handleEnd)
    }

    const syncUpdate = (overrides = {}) => {
        const finalEndTime = overrides.endTime || endTime;
        let finalTravel = overrides.travelCountry !== undefined ? overrides.travelCountry : travelCountry;
        if (finalTravel === '越南' || finalTravel === 'VIETNAM') finalTravel = 'VN';

        const finalHoliday = overrides.isHoliday !== undefined ? overrides.isHoliday : isHoliday;
        const finalWorkDay = overrides.isWorkDay !== undefined ? overrides.isWorkDay : isWorkDay;
        const finalLeave = overrides.isLeave !== undefined ? overrides.isLeave : isLeave;
        const finalType = overrides.otType !== undefined ? overrides.otType : otType;

        // Leave values from state (or overrides)
        const finalLeaveType = overrides.leaveType !== undefined ? overrides.leaveType : leaveType;
        // If overriding isFullDay/Times, we might need to recalc duration, but simpler to rely on current state unless passed.
        // For simplicity, we grab current state if not passed.
        // We generally don't pass leave vars in overrides except maybe type.

        let otHours = 0;
        const d = getDay(day);
        const isRestDay = (d === 0 || d === 6 || finalHoliday) && !finalWorkDay;

        if (!finalLeave) {
            // Priority: isWorkDay overrides everything to be a 'Weekday'.
            // Then check isRestDay (Sat/Sun/Holiday).
            if (finalWorkDay) {
                // Treated as Normal Weekday
                // If endTime <= standardEndTime, OT is 0.
                const stdEnd = settings?.rules?.standardEndTime || "17:30";
                otHours = calculateOTHours(finalEndTime, stdEnd);
            } else if (isRestDay) {
                // Full day OT: (End - Start) - Break
                const start = settings?.rules?.standardStartTime || "08:00";
                const breakTime = settings?.rules?.lunchBreak || 1.5;
                otHours = calculateDuration(start, finalEndTime, breakTime);
            } else {
                // Normal Weekday (Mon-Fri non-holiday)
                const stdEnd = settings?.rules?.standardEndTime || "17:30";
                otHours = calculateOTHours(finalEndTime, stdEnd);
            }
        }

        onUpdate({
            date: day,
            endTime: finalEndTime,
            otHours: otHours,
            travelCountry: finalTravel,
            isHoliday: finalHoliday,
            isWorkDay: finalWorkDay,
            isLeave: finalLeave,
            otType: finalType,
            // Leave Persist
            leaveType: finalLeaveType,
            leaveDuration: finalLeave ? (isFullDay ? 8 : leaveDuration) : 0,
            leaveStartTime: finalLeave && !isFullDay ? leaveStartTime : null,
            leaveEndTime: finalLeave && !isFullDay ? leaveEndTime : null
        })
    }

    // Calculation for Render
    const storedOT = parseFloat(record?.otHours);

    let calculatedOT = 0;
    if (settings) {
        const d = getDay(day);
        const isRestDay = (d === 0 || d === 6 || isHoliday) && !isWorkDay;

        if (isRestDay) {
            const start = settings.rules?.standardStartTime || "08:30";
            const breakTime = settings.rules?.lunchBreak || 1.5;
            calculatedOT = calculateDuration(start, endTime, breakTime);
        } else {
            calculatedOT = calculateOTHours(endTime, settings.rules?.standardEndTime);
        }
    }

    // Prefer stored OT for initial display, but if user edits endTime, it will recalc via syncUpdate
    // However, for rendering the *current* state of the card (which might be historical), trust record.otHours if valid
    // Normalize record values for comparison
    const recordEndTime = (() => {
        let t = record?.endTime || '17:30';
        if (t.includes('T')) {
            try { t = format(new Date(t), 'HH:mm'); } catch (e) { t = '17:30'; }
        }
        return t;
    })();

    const isDirty =
        endTime !== recordEndTime ||
        isWorkDay !== (record?.isWorkDay || false) ||
        isHoliday !== (record?.isHoliday || false) ||
        isLeave !== (record?.isLeave || false) ||
        travelCountry !== (standardizeCountry(record?.travelCountry)) ||
        otType !== (record?.otType || 'pay');

    // If dirty (user edited), show live calc. If clean, show stored (history) unless stored is missing.
    const otHours = (isDirty || isNaN(storedOT) || storedOT === 0) ? (isNaN(calculatedOT) ? 0 : calculatedOT) : storedOT;

    const salaryMetrics = settings ? calculateDailySalary({
        ...record,
        endTime,
        otHours,
        isHoliday,
        isWorkDay,
        isLeave,
        otType,
        leaveType,
        leaveDuration: isLeave ? (isFullDay ? 8 : leaveDuration) : 0
    }, settings) : { total: 0 };
    const dailySalary = salaryMetrics?.total || 0;
    const compUnits = calculateCompLeaveUnits({ otHours, otType });

    const mask = (val) => val; // Privacy handled by parent or just ignored in edit mode for now? User usually wants to see val when editing.

    const toggleOtType = (e) => {
        e.stopPropagation();
        const types = ['pay', 'internal', 'leave'];
        const nextIndex = (types.indexOf(otType) + 1) % types.length;
        setOtType(types[nextIndex]);
    }

    const handleSave = (e) => {
        if (e) e.stopPropagation();

        // Future Date Check
        if (isAfter(day, new Date())) {
            // Toast or visual error?
            // Since we don't have a toast system ready in this file, we can set an error state or just alert.
            // User: "notify this day has not arrived".
            // I'll add a simple alert for now or a temporary error message in UI.
            // A temporary error state is better.
            const confirmed = window.confirm("此日期尚未發生。確定要儲存嗎？ (Date is in the future)");
            if (!confirmed) return;
        }

        syncUpdate();
        setIsSaved(true);
        setTimeout(() => {
            setIsSaved(false);
            if (onClose) onClose();
        }, 800);
    }

    return (
        <div style={style} className={cn("neumo-card p-4 flex flex-col gap-4 relative z-50 bg-[#E0E5EC] shadow-2xl", className)} onClick={e => e.stopPropagation()}>
            {/* Header Section with Date (if needed) or just Close button */}
            {/* The design implies this card merges with the cell. We might render the content directly. */}
            {!hideHeader && (
                <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                        <h3 className={cn("text-xl font-black", isHoliday ? "text-rose-500" : "text-neumo-brand")}>
                            {format(day, 'MMM dd')}
                        </h3>
                        {(isHoliday || isTaiwanHoliday(day)) && (
                            <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">{getHolidayName(day) || '國定假日'}</span>
                        )}
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const confirmed = window.confirm('確定要清除此日所有資料嗎？');
                            if (!confirmed) return;
                            onUpdate({
                                date: day,
                                endTime: '17:30',
                                otHours: 0,
                                travelCountry: '',
                                isHoliday: isTaiwanHoliday(day),
                                isWorkDay: false,
                                isLeave: false,
                                otType: 'pay',
                                leaveType: '特休',
                                leaveDuration: 0,
                                leaveStartTime: null,
                                leaveEndTime: null,
                                Remark: '',
                            });
                            if (onClose) onClose();
                        }}
                        className="neumo-button p-2 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            )}

            {/* If header is hidden, we might still want a close action or just rely on backdrop click? */}
            {/* The CalendarOverlay handles closing via backdrop. */}

            {/* Status Grid */}
            <div className="grid grid-cols-4 gap-2">
                <button
                    onClick={() => {
                        setIsWorkDay(!isWorkDay);
                        if (!isWorkDay) setIsHoliday(false);
                    }}
                    className={cn("py-3 rounded-2xl flex flex-col items-center justify-center gap-1 text-[8px] font-bold uppercase transition-all", isWorkDay ? "neumo-pressed text-blue-600" : "neumo-raised text-gray-400")}
                >
                    <Check size={16} />
                    <span>平日</span>
                </button>
                <button
                    onClick={() => {
                        setIsHoliday(!isHoliday);
                        if (!isHoliday) setIsWorkDay(false);
                    }}
                    className={cn("py-3 rounded-2xl flex flex-col items-center justify-center gap-1 text-[8px] font-bold uppercase transition-all", isHoliday ? "neumo-pressed text-orange-500" : "neumo-raised text-gray-400")}
                >
                    <Palmtree size={16} />
                    <span>假日</span>
                </button>
                <button
                    onClick={() => setIsLeave(!isLeave)}
                    className={cn("py-3 rounded-2xl flex flex-col items-center justify-center gap-1 text-[8px] font-bold uppercase transition-all", isLeave ? "neumo-pressed text-indigo-500" : "neumo-raised text-gray-400")}
                >
                    <Moon size={16} />
                    <span>請假</span>
                </button>
                <button
                    onClick={() => { const seq = ['', 'VN', 'IN', 'CN']; setTravelCountry(seq[(seq.indexOf(travelCountry) + 1) % seq.length]); }}
                    className={cn("py-3 rounded-2xl flex flex-col items-center justify-center gap-1 text-[8px] font-bold uppercase transition-all", travelCountry ? "neumo-pressed text-green-600" : "neumo-raised text-gray-400")}
                >
                    <MapPin size={16} />
                    <span>{travelCountry || '出差'}</span>
                </button>
            </div>

            {/* Content Area: Leave vs OT */}
            {isLeave ? (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="space-y-2 relative">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">假別</label>
                        <button
                            onClick={() => setIsLeaveTypePickerOpen(!isLeaveTypePickerOpen)}
                            className="w-full h-12 neumo-raised rounded-2xl flex items-center justify-between px-4 text-xs font-black text-gray-600 transition-all hover:scale-[0.99] active:scale-95"
                        >
                            <span>{leaveType}</span>
                            <div className={cn("transition-transform duration-200", isLeaveTypePickerOpen ? "rotate-180" : "rotate-0")}>
                                <Check size={14} className="text-neumo-brand" />
                            </div>
                        </button>

                        <AnimatePresence>
                            {isLeaveTypePickerOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                    className="absolute left-0 right-0 top-full mt-2 z-[60] bg-[#E0E5EC]/95 backdrop-blur-md neumo-card p-2 grid grid-cols-2 gap-2 shadow-2xl"
                                >
                                    {Object.keys(settings?.leaveRules || {}).filter(type => type !== '補休').map(type => (
                                        <button
                                            key={type}
                                            onClick={() => {
                                                setLeaveType(type);
                                                syncUpdate({ leaveType: type });
                                                setIsLeaveTypePickerOpen(false);
                                            }}
                                            className={cn(
                                                "py-3 px-1 text-[10px] font-black rounded-xl transition-all border border-transparent text-center",
                                                leaveType === type
                                                    ? "bg-rose-50 text-rose-600 border-rose-200 shadow-sm"
                                                    : "neumo-raised text-gray-400 hover:text-gray-600"
                                            )}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="flex items-center justify-between neumo-pressed p-3 rounded-2xl">
                        <span className="text-xs font-black text-gray-500">全天</span>
                        <button
                            onClick={() => setIsFullDay(!isFullDay)}
                            className={cn(
                                "w-10 h-6 rounded-full relative transition-colors duration-300",
                                isFullDay ? "bg-rose-500" : "bg-gray-200"
                            )}
                        >
                            <div className={cn(
                                "absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300",
                                isFullDay ? "translate-x-4" : "translate-x-0"
                            )} />
                        </button>
                    </div>

                    {!isFullDay && (
                        <div className="space-y-2">
                            <div className="flex justify-between items-end px-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">請假時間</label>
                                <span className="text-[10px] font-black text-rose-500">{leaveDuration}H</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div
                                    className="neumo-pressed flex-1 h-12 flex flex-col items-center justify-center cursor-ns-resize rounded-xl touch-action-none"
                                    onMouseDown={(e) => handleDragStart(e, 'leaveStart')}
                                    onTouchStart={(e) => handleDragStart(e, 'leaveStart')}
                                    style={{ touchAction: 'none' }}
                                >
                                    <span className="text-[10px] font-black text-gray-400 leading-none mb-1">開始</span>
                                    <span className="text-sm font-black text-gray-600">{leaveStartTime}</span>
                                </div>
                                <span className="text-gray-300 font-bold">-</span>
                                <div
                                    className="neumo-pressed flex-1 h-12 flex flex-col items-center justify-center cursor-ns-resize rounded-xl touch-action-none"
                                    onMouseDown={(e) => handleDragStart(e, 'leaveEnd')}
                                    onTouchStart={(e) => handleDragStart(e, 'leaveEnd')}
                                    style={{ touchAction: 'none' }}
                                >
                                    <span className="text-[10px] font-black text-gray-400 leading-none mb-1">結束</span>
                                    <span className="text-sm font-black text-gray-600">{leaveEndTime}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Leave Cost Estimate */}
                    <div className="flex items-center justify-between px-2 pt-2 border-t border-gray-200/50">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">扣薪預估</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-rose-500 tabular-nums">
                                -${Math.round(salaryMetrics?.leaveDeduction || 0).toLocaleString()}
                            </span>
                            <span className="text-[9px] font-bold text-gray-400 uppercase">TWD</span>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Time Picker */}
                    <div
                        className="h-24 neumo-pressed rounded-3xl flex flex-col items-center justify-center relative cursor-ns-resize overflow-hidden shrink-0 touch-action-none"
                        style={{ touchAction: 'none' }}
                        onMouseDown={handleDragStart}
                        onTouchStart={handleDragStart}
                    >
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-[#202731]">{endTime}</span>
                            <Clock size={14} className="text-gray-300" />
                        </div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">拖曳調整下班</p>
                    </div>

                    {/* OT Details */}
                    {otHours >= 0.5 ? (
                        <div className="space-y-3 px-2">
                            {/* Row 1: OT hours + type */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div>
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">加班時數 / 類型</p>
                                        <span className="text-3xl font-black text-neumo-brand leading-none">{otHours.toFixed(1)}h</span>
                                    </div>
                                    <button
                                        onClick={toggleOtType}
                                        className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                                            otType === 'pay' ? "bg-green-500 text-white shadow-lg" :
                                                otType === 'leave' ? "bg-indigo-500 text-white shadow-lg" :
                                                    "bg-purple-600 text-white shadow-lg"
                                        )}
                                    >
                                        {otType === 'pay' ? <DollarSign size={14} /> : <Coffee size={14} />}
                                    </button>
                                </div>
                            </div>
                            {/* Row 2: Estimated salary/comp */}
                            <div className="flex items-baseline justify-between px-1 pt-1 border-t border-gray-200/50">
                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">
                                    預估 {otType === 'pay' ? '薪資' : otType === 'leave' ? '公司補休' : '部門補休'}
                                </p>
                                <div className="flex items-baseline gap-1">
                                    <span className={cn(
                                        "text-2xl font-black tabular-nums",
                                        otType === 'pay' ? "text-green-600" :
                                            otType === 'leave' ? "text-indigo-600" :
                                                "text-purple-600"
                                    )}>
                                        {otType === 'pay' ? `\$${Math.round(dailySalary).toLocaleString()}` : compUnits.toFixed(0)}
                                    </span>
                                    <span className="text-[9px] font-bold text-gray-400 uppercase">
                                        {otType === 'pay' ? 'TWD' : '單'}
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
                </>
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
