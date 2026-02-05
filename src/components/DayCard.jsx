import React, { useState, useRef, useEffect } from 'react'
import { format, isToday, getDay } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Clock, ChevronDown, ChevronUp, Check, Flag, UserX, Palmtree, Moon } from 'lucide-react'
import { cn } from '../lib/utils'
import { loadSettings, calculateOTHours, calculateDailySalary } from '../lib/storage'

function DayCard({ day, record, onUpdate, isCurrentMonth = true }) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [endTime, setEndTime] = useState(record?.endTime || '18:00')
    const [travelCountry, setTravelCountry] = useState(record?.travelCountry || '')
    const [isHoliday, setIsHoliday] = useState(record?.isHoliday || false)
    const [isLeave, setIsLeave] = useState(record?.isLeave || false)
    const [isDragging, setIsDragging] = useState(false)
    const [settings, setSettings] = useState(null)

    const dragStartY = useRef(0)
    const startMinutes = useRef(0)

    const isSunday = getDay(day) === 0;

    useEffect(() => {
        setSettings(loadSettings());
    }, []);

    // Initialize from record when it changes
    useEffect(() => {
        if (record) {
            let rawTime = record.endTime || '18:00';
            // Solve 1899-12-30 issue: if it contains 'T' or looks like a ISO date, extract just HH:mm
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
            // 5 pixels = 15 mins
            const minuteDiff = Math.round(diff / 5) * 15
            const totalMins = Math.max(0, Math.min(23 * 60 + 45, startMinutes.current + minuteDiff))

            const nh = Math.floor(totalMins / 60)
            const nm = totalMins % 60
            const newTime = `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
            setEndTime(newTime)
        }

        const handleEnd = () => {
            setIsDragging(false)
            window.removeEventListener('mousemove', handleMove)
            window.removeEventListener('mouseup', handleEnd)
            window.removeEventListener('touchmove', handleMove)
            window.removeEventListener('touchend', handleEnd)

            const otHours = calculateOTHours(endTime, settings?.rules?.standardEndTime);
            onUpdate({
                date: day,
                endTime: endTime,
                otHours: otHours,
                travelCountry: travelCountry,
                isHoliday: isHoliday,
                isLeave: isLeave
            })
        }

        window.addEventListener('mousemove', handleMove)
        window.addEventListener('mouseup', handleEnd)
        window.addEventListener('touchmove', handleMove)
        window.addEventListener('touchend', handleEnd)
    }

    const otHoursRaw = settings ? calculateOTHours(endTime, settings.rules.standardEndTime) : 0;
    const otHours = isNaN(otHoursRaw) ? 0 : otHoursRaw;
    const dailySalaryRaw = settings ? calculateDailySalary({ ...record, endTime, otHours, isHoliday, isLeave }, settings) : 0;
    const dailySalary = isNaN(dailySalaryRaw) ? 0 : dailySalaryRaw;

    const toggleStatus = (type) => {
        let update = {};
        if (type === 'holiday') {
            const val = !isHoliday;
            setIsHoliday(val);
            update = { isHoliday: val };
        } else if (type === 'leave') {
            const val = !isLeave;
            setIsLeave(val);
            update = { isLeave: val };
        }

        onUpdate({
            date: day,
            endTime,
            otHours,
            travelCountry,
            isHoliday,
            isLeave,
            ...update
        });
    };

    const cycleCountry = (e) => {
        e.stopPropagation();
        const sequence = ['', '印度', '越南', '大陸'];
        const currentIndex = sequence.indexOf(travelCountry);
        const nextIndex = (currentIndex + 1) % sequence.length;
        const newVal = sequence[nextIndex];
        setTravelCountry(newVal);
        onUpdate({
            date: day,
            endTime,
            otHours,
            travelCountry: newVal,
            isHoliday,
            isLeave
        });
    };

    const getCountryCode = (name) => {
        const mapping = {
            '印度': 'IN',
            'India': 'IN',
            '越南': 'VN',
            'Vietnam': 'VN',
            '大陸': 'CN',
            '中國': 'CN',
            'China': 'CN'
        };
        return mapping[name] || name;
    };

    const countries = [
        { label: '無', value: '' },
        { label: '印度 (IN)', value: '印度' },
        { label: '越南 (VN)', value: '越南' },
        { label: '大陸 (CN)', value: '大陸' }
    ];

    return (
        <motion.div
            layout
            className={cn(
                "neumo-card transition-all duration-500 overflow-hidden flex flex-col p-4",
                isToday(day) && "ring-2 ring-neumo-brand/30 ring-inset",
                isHoliday && "bg-orange-50/50",
                isLeave && "opacity-60",
                isSunday && "bg-gray-400",
                "flex-1 min-w-[85px]",
                isExpanded && "flex-[3] min-w-[180px]",
                !isCurrentMonth && "opacity-25 grayscale-[0.5] scale-95 pointer-events-none"
            )}
        >
            <div
                className="flex justify-between items-start cursor-pointer w-full"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 mb-1">
                        <span className={cn("text-[10px] font-black uppercase tracking-tighter", isSunday ? "text-gray-900" : "text-gray-400")}>
                            {format(day, 'EEE')}
                        </span>
                        {isHoliday && <Palmtree size={12} className="text-orange-500" />}
                        {isLeave && <Moon size={12} className="text-indigo-400" />}
                    </div>
                    <span className={cn("text-2xl font-black leading-none", isToday(day) ? "text-neumo-brand" : "text-[#202731]")}>
                        {format(day, 'dd')}
                    </span>

                    {/* Collapsed Info - Move to absolute right or use space-between */}
                    {!isExpanded && (
                        <div className="mt-2 space-y-1">
                            {travelCountry && (
                                <div className="flex items-center gap-1 text-[8px] font-black text-green-600">
                                    <MapPin size={10} strokeWidth={3} />
                                    <span>{getCountryCode(travelCountry)}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-end gap-1">
                    <div className="text-gray-300">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                    {!isExpanded && (
                        <div className="flex flex-col items-end">
                            {otHours > 0 ? (
                                <div className="flex flex-col items-end">
                                    <span className="text-xl font-black text-neumo-brand leading-none">
                                        {otHours.toFixed(1)}<span className="text-[10px] ml-0.5">h</span>
                                    </span>
                                    <span className="text-[9px] font-black text-gray-400 mt-1">
                                        ${Math.round(dailySalary).toLocaleString()}
                                    </span>
                                </div>
                            ) : (
                                <span className="text-[11px] font-black text-gray-400">
                                    ${Math.round(dailySalary).toLocaleString()}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="mt-6 pt-6 border-t border-gray-100 space-y-6 overflow-hidden"
                    >
                        {/* Status Toggles */}
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleStatus('holiday'); }}
                                className={cn(
                                    "py-3 rounded-2xl text-[9px] font-black uppercase tracking-tighter transition-all flex flex-col items-center gap-1",
                                    isHoliday ? "neumo-pressed text-orange-500 bg-orange-50/50" : "neumo-raised text-gray-400"
                                )}
                            >
                                <Palmtree size={14} />
                                假日
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleStatus('leave'); }}
                                className={cn(
                                    "py-3 rounded-2xl text-[9px] font-black uppercase tracking-tighter transition-all flex flex-col items-center gap-1",
                                    isLeave ? "neumo-pressed text-indigo-500 bg-indigo-50/50" : "neumo-raised text-gray-400"
                                )}
                            >
                                <Moon size={14} />
                                請假
                            </button>
                            <button
                                onClick={cycleCountry}
                                className={cn(
                                    "py-3 rounded-2xl text-[9px] font-black uppercase tracking-tighter transition-all flex flex-col items-center gap-1",
                                    travelCountry ? "neumo-pressed text-green-600 bg-green-50/50" : "neumo-raised text-gray-400"
                                )}
                            >
                                <MapPin size={14} />
                                {travelCountry ? getCountryCode(travelCountry) : '出差'}
                            </button>
                        </div>

                        {!isLeave && (
                            <div
                                className="h-24 neumo-pressed rounded-3xl flex flex-col items-center justify-center relative cursor-ns-resize overflow-hidden touch-none"
                                onMouseDown={(e) => { e.stopPropagation(); handleDragStart(e); }}
                                onTouchStart={(e) => { e.stopPropagation(); handleDragStart(e); }}
                            >
                                <span className="text-3xl font-black text-neumo-brand tabular-nums mb-1">{endTime || '18:00'}</span>
                                <div className="flex flex-col items-center opacity-30 select-none pointer-events-none">
                                    <ChevronUp size={12} className="-mb-1" />
                                    <div className="text-[8px] font-black uppercase tracking-[0.2em]">拖曳調整時間</div>
                                    <ChevronDown size={12} className="-mt-1" />
                                </div>
                                {isDragging && (
                                    <motion.div
                                        layoutId="dragging-overlay"
                                        className="absolute inset-0 bg-neumo-brand/5 pointer-events-none"
                                    />
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="p-3 neumo-raised rounded-2xl">
                                <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">加班時數</p>
                                <p className="text-base font-black text-[#202731]">{otHours.toFixed(1)}h</p>
                            </div>
                            <div className="p-3 neumo-raised rounded-2xl">
                                <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">今日薪資</p>
                                <p className="text-base font-black text-green-600">${Math.round(dailySalary).toLocaleString()}</p>
                            </div>
                        </div>

                        <button
                            onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                            className="neumo-button w-full py-4 flex items-center justify-center gap-2 text-sm font-black text-neumo-brand"
                        >
                            <Check size={18} />
                            確認完成
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export default DayCard;
