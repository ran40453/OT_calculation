import React, { useState, useRef, useEffect } from 'react'
import { format, isToday } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Clock, ChevronDown, ChevronUp, Check, Flag, UserX } from 'lucide-react'
import { cn } from '../lib/utils'
import { loadSettings, calculateOTHours, calculateDailySalary } from '../lib/storage'

function DayCard({ day, record, onUpdate }) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [endTime, setEndTime] = useState(record?.endTime || '18:00')
    const [country, setCountry] = useState(record?.country || '')
    const [isHoliday, setIsHoliday] = useState(record?.isHoliday || false)
    const [isLeave, setIsLeave] = useState(record?.isLeave || false)
    const [isDragging, setIsDragging] = useState(false)
    const [settings, setSettings] = useState(null)

    const dragStartY = useRef(0)
    const startMinutes = useRef(0)

    useEffect(() => {
        setSettings(loadSettings());
    }, []);

    // Initialize from record when it changes
    useEffect(() => {
        if (record) {
            setEndTime(record.endTime || '18:00')
            setCountry(record.country || '')
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
                country: country,
                isHoliday: isHoliday,
                isLeave: isLeave
            })
        }

        window.addEventListener('mousemove', handleMove)
        window.addEventListener('mouseup', handleEnd)
        window.addEventListener('touchmove', handleMove)
        window.addEventListener('touchend', handleEnd)
    }

    const otHours = settings ? calculateOTHours(endTime, settings.rules.standardEndTime) : 0;
    const dailySalary = settings ? calculateDailySalary({ ...record, endTime, otHours, isHoliday, isLeave }, settings) : 0;

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
            country,
            isHoliday,
            isLeave,
            ...update
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

    return (
        <motion.div
            layout
            className={cn(
                "neumo-card transition-all duration-300",
                isToday(day) && "border-2 border-neumo-brand/30",
                isHoliday && "bg-orange-50/50",
                isLeave && "opacity-60",
                "col-span-1" // Always col-span-1 to keep 7 columns
            )}
        >
            <div
                className="flex justify-between items-start cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 uppercase">{format(day, 'EEE')}</span>
                        {isHoliday && <Flag size={12} className="text-orange-500 fill-orange-500" />}
                        {isLeave && <UserX size={12} className="text-red-400" />}
                    </div>
                    <span className={cn("text-2xl font-black", isToday(day) ? "text-neumo-brand" : "text-[#202731]")}>
                        {format(day, 'dd')}
                    </span>
                    {!isExpanded && (
                        <span className="text-[10px] font-black text-gray-400 mt-1">
                            ${Math.round(dailySalary).toLocaleString()}
                        </span>
                    )}
                </div>

                <div className="flex flex-col items-end space-y-1">
                    {otHours > 0 && (
                        <div className="flex items-center gap-1 bg-neumo-brand/10 px-2 py-0.5 rounded-full">
                            <Clock size={12} className="text-neumo-brand" />
                            <span className="text-xs font-bold text-neumo-brand">{otHours}h</span>
                        </div>
                    )}
                    {country && (
                        <div className="flex items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded-full">
                            <MapPin size={12} className="text-green-600" />
                            <span className="text-xs font-bold text-green-600">{getCountryCode(country)}</span>
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
                        className="mt-6 space-y-6 overflow-hidden"
                    >
                        {/* Status Toggles */}
                        <div className="flex gap-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleStatus('holiday'); }}
                                className={cn(
                                    "flex-1 py-2 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all",
                                    isHoliday ? "neumo-pressed text-orange-600" : "neumo-raised text-gray-400"
                                )}
                            >
                                <Flag size={14} /> 國定假日
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleStatus('leave'); }}
                                className={cn(
                                    "flex-1 py-2 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all",
                                    isLeave ? "neumo-pressed text-red-500" : "neumo-raised text-gray-400"
                                )}
                            >
                                <UserX size={14} /> 請假中
                            </button>
                        </div>

                        {/* OT End Time Draggable */}
                        {!isLeave && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">下班時間 (拖曳調整)</label>
                                <div
                                    className={cn(
                                        "relative h-20 neumo-pressed rounded-2xl flex items-center justify-center cursor-ns-resize select-none",
                                        isDragging && "bg-neumo-brand/5"
                                    )}
                                    onMouseDown={handleDragStart}
                                    onTouchStart={handleDragStart}
                                >
                                    <div className="text-3xl font-black text-neumo-brand">
                                        {endTime}
                                    </div>
                                    <div className="absolute left-4 text-[10px] font-bold text-gray-400">
                                        加班: {otHours.toFixed(1)}h
                                    </div>
                                    <div className="absolute right-4 text-gray-300">
                                        <div className="flex flex-col items-center">
                                            <ChevronUp size={16} />
                                            <ChevronDown size={16} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Country Input */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">出差國家</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={country}
                                    onChange={(e) => {
                                        setCountry(e.target.value);
                                        onUpdate({ ...record, date: day, country: e.target.value, endTime, otHours, isHoliday, isLeave });
                                    }}
                                    placeholder="輸入國家名稱..."
                                    className="neumo-input pl-10 h-10 text-sm font-bold"
                                />
                                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            </div>
                        </div>

                        {/* Daily Salary Display */}
                        <div className="neumo-pressed rounded-2xl p-4 flex justify-between items-center bg-white/30">
                            <span className="text-[10px] font-black text-gray-500 uppercase">當日預計薪資</span>
                            <span className="text-lg font-black text-neumo-brand">${Math.round(dailySalary).toLocaleString()}</span>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="neumo-button py-2 px-6 flex items-center gap-2 text-sm font-black text-neumo-brand"
                            >
                                <Check size={16} />
                                完成
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

export default DayCard
