import React, { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, isSameDay } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, MapPin, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '../lib/utils'
import { loadData, addOrUpdateRecord } from '../lib/storage'
import DayCard from './DayCard'

function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [records, setRecords] = useState([])
    const [showAddForm, setShowAddForm] = useState(false)
    const [quickHoliday, setQuickHoliday] = useState(false)
    const [quickLeave, setQuickLeave] = useState(false)

    useEffect(() => {
        setRecords(loadData())
    }, [])

    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(monthStart)
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

    const getRecordForDay = (day) => {
        return records.find(r => isSameDay(new Date(r.date), day))
    }

    const handleUpdateRecord = (updatedRecord) => {
        const newData = addOrUpdateRecord(updatedRecord)
        setRecords(newData)
    }

    return (
        <div className="space-y-6">
            {/* Month Header */}
            <div className="flex justify-between items-center bg-[#E0E5EC] neumo-raised rounded-3xl p-4">
                <button
                    onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                    className="neumo-button p-2"
                >
                    <ChevronLeft size={20} />
                </button>
                <h2 className="text-xl font-extrabold uppercase tracking-widest text-[#202731]">
                    {format(currentDate, 'yyyy / MM')}
                </h2>
                <button
                    onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                    className="neumo-button p-2"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Quick Add Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="neumo-card p-4 md:p-6"
            >
                <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="flex items-center gap-2 min-w-max">
                        <Plus size={18} className="text-neumo-brand" />
                        <h3 className="text-sm font-black italic uppercase tracking-wider">快速新增</h3>
                    </div>

                    <div className="flex flex-1 flex-wrap items-center gap-3 w-full">
                        {/* Date */}
                        <div className="flex-1 min-w-[120px]">
                            <input
                                type="date"
                                className="neumo-input h-10 text-xs font-bold w-full"
                                defaultValue={format(new Date(), 'yyyy-MM-dd')}
                                id="quick-date"
                            />
                        </div>

                        {/* Country Dropdown */}
                        <div className="flex-1 min-w-[120px]">
                            <select
                                id="quick-country"
                                className="neumo-input h-10 text-xs font-bold w-full bg-transparent appearance-none"
                            >
                                <option value="">無出差</option>
                                <option value="印度">印度 (IN)</option>
                                <option value="越南">越南 (VN)</option>
                                <option value="大陸">大陸 (CN)</option>
                            </select>
                        </div>

                        {/* Toggles */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setQuickHoliday(!quickHoliday)}
                                className={cn(
                                    "p-2 rounded-xl transition-all",
                                    quickHoliday ? "neumo-pressed text-orange-500" : "neumo-raised text-gray-400"
                                )}
                                title="國定假日"
                            >
                                <Plus size={16} className={cn("transition-transform", quickHoliday && "rotate-45")} />
                            </button>
                            <button
                                onClick={() => setQuickLeave(!quickLeave)}
                                className={cn(
                                    "p-2 rounded-xl transition-all",
                                    quickLeave ? "neumo-pressed text-red-500" : "neumo-raised text-gray-400"
                                )}
                                title="請假"
                            >
                                <div className="w-4 h-4 flex items-center justify-center font-black text-[10px]">X</div>
                            </button>
                        </div>

                        {/* Add Button */}
                        <button
                            onClick={() => {
                                const date = document.getElementById('quick-date').value
                                const country = document.getElementById('quick-country').value
                                handleUpdateRecord({
                                    date: new Date(date),
                                    otHours: 0,
                                    country,
                                    isHoliday: quickHoliday,
                                    isLeave: quickLeave
                                })
                                setQuickHoliday(false)
                                setQuickLeave(false)
                            }}
                            className="neumo-button h-10 px-6 flex items-center justify-center gap-2 text-xs font-black text-neumo-brand ml-auto"
                        >
                            新增
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Calendar Grid */}
            <div className="space-y-4">
                {/* Weekday Labels (Desktop) */}
                <div className="grid grid-cols-7 gap-4 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Weeks */}
                {Array.from({ length: Math.ceil(days.length / 7) }, (_, i) => days.slice(i * 7, i * 7 + 7)).map((week, weekIdx) => (
                    <div key={weekIdx} className="flex gap-4 min-h-[100px]">
                        {week.map((day) => (
                            <DayCard
                                key={day.toString()}
                                day={day}
                                record={getRecordForDay(day)}
                                onUpdate={handleUpdateRecord}
                            />
                        ))}
                        {/* Fill empty slots in the last week if necessary */}
                        {week.length < 7 && Array.from({ length: 7 - week.length }).map((_, i) => (
                            <div key={`empty-${i}`} className="flex-1 min-w-[80px]" />
                        ))}
                    </div>
                ))}
            </div>

            {/* Quick Add Floating Button/Form would go here if needed, but we'll use DayCard expand */}
        </div>
    )
}

export default CalendarPage
