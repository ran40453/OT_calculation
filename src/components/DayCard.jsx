import React, { useState, useRef, useEffect } from 'react'
import { format, isToday, getDay } from 'date-fns'
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

    const isSunday = getDay(day) === 0;

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
                "neumo-card transition-all duration-500 overflow-hidden",
                isToday(day) && "border-2 border-neumo-brand/30",
                isHoliday && "bg-orange-50/50",
                isLeave && "opacity-60",
                isSunday && "bg-gray-300",
                "flex-1 min-w-[80px]",
                isExpanded && "flex-[2.5] min-w-[160px]"
            )}
            style={{
                color: isSunday ? '#4a5568' : '#202731'
            }}
        >
            <div
                className="flex justify-between items-start cursor-pointer h-full"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className={cn("text-xs font-bold uppercase", isSunday ? "text-gray-600" : "text-gray-500")}>{format(day, 'EEE')}</span>
                        {isHoliday && <Flag size={12} className="text-orange-500 fill-orange-500" />}
                        {isLeave && <UserX size={12} className="text-red-400" />}
                    </div>
                    <span className={cn("text-2xl font-black", isToday(day) ? "text-neumo-brand" : "")}>
                        {format(day, 'dd')}
                    </span>
                    {!isExpanded && (
                        <span className="text-[10px] font-black text-gray-500 opacity-60 mt-1">
                            ${Math.round(dailySalary).toLocaleString()}
                        </span>
                    )}
                </div>

                <div className="flex flex-col items-end space-y-1">
                    {otHours > 0 && (
                        <div className="flex items-center gap-1 bg-neumo-brand/10 px-2 py-0.5 rounded-full">
                            <Clock size={12} className="text-neumo-brand" />
                            <span className="text-xs font-bold text-neumo-brand">{otHours.toFixed(1)}h</span>
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
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="pt-6 border-t border-gray-100 mt-6 space-y-6"
                    >
                        <div className="flex gap-3">
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleStatus('holiday'); }}
                                className={cn(
                                    "flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    isHoliday ? "neumo-pressed text-orange-500 bg-orange-50/50" : "neumo-raised text-gray-400"
                                )}
                            >
                                國定假日
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleStatus('leave'); }}
                                className={cn(
                                    "flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    isLeave ? "neumo-pressed text-red-500 bg-red-50/50" : "neumo-raised text-gray-400"
                                )}
                            >
                                請假
                            </button>
                        </div>

                        {!isLeave && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-end">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">下班時間</label>
                                    <span className="text-2xl font-black text-neumo-brand tabular-nums">{endTime}</span>
                                </div>
                                <div
                                    className="h-16 neumo-pressed rounded-2xl flex items-center justify-center relative cursor-ns-resize overflow-hidden touch-none"
                                    onMouseDown={(e) => { e.stopPropagation(); handleDragStart(e); }}
                                    onTouchStart={(e) => { e.stopPropagation(); handleDragStart(e); }}
                                >
                                    <div className="flex flex-col items-center opacity-30 select-none">
                                        <ChevronUp size={16} />
                                        <div className="text-[10px] font-bold uppercase tracking-widest">滑動調整</div>
                                        <ChevronDown size={16} />
                                    </div>
                                    {isDragging && (
                                        <motion.div
                                            layoutId="dragging-overlay"
                                            className="absolute inset-0 bg-neumo-brand/5 pointer-events-none"
                                        />
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">出差地區</label>
                            <select
                                value={country}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setCountry(val);
                                    onUpdate({ date: day, endTime, otHours, country: val, isHoliday, isLeave });
                                }}
                                className="neumo-input w-full h-11 px-4 text-xs font-bold bg-transparent appearance-none"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <option value="">無出差</option>
                                <option value="印度">印度 (IN)</option>
                                <option value="越南">越南 (VN)</option>
                                <option value="大陸">大陸 (CN)</option>
                            </select>
                        </div>

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
    );
}

export default DayCard;
