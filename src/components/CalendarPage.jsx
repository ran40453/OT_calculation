import React, { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, isSameDay, startOfWeek, endOfWeek, setMonth, setYear } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { loadData, addOrUpdateRecord, fetchRecordsFromGist } from '../lib/storage'
import DayCard from './DayCard'

function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [records, setRecords] = useState([])
    const [focusedDay, setFocusedDay] = useState(null)

    useEffect(() => {
        setRecords(loadData())
        fetchRecordsFromGist().then(remoteRecords => {
            if (remoteRecords) setRecords(remoteRecords)
        })
    }, [])

    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(monthStart)
    const calendarStart = startOfWeek(monthStart)
    const calendarEnd = endOfWeek(monthEnd)
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

    // Group days into weeks
    const weeks = []
    for (let i = 0; i < days.length; i += 7) {
        weeks.push(days.slice(i, i + 7))
    }

    const getRecordForDay = (day) => {
        return records.find(r => isSameDay(new Date(r.date), day))
    }

    const handleUpdateRecord = (updatedRecord) => {
        const newData = addOrUpdateRecord(updatedRecord)
        setRecords(newData)
    }

    // Generate options for selectors
    const currentYear = today.getFullYear()
    const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)
    const months = Array.from({ length: 12 }, (_, i) => i)

    const handleMonthChange = (e) => {
        const newMonth = parseInt(e.target.value)
        setCurrentDate(setMonth(currentDate, newMonth))
    }

    const handleYearChange = (e) => {
        const newYear = parseInt(e.target.value)
        setCurrentDate(setYear(currentDate, newYear))
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

                {/* Selectors */}
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <select
                            value={currentDate.getFullYear()}
                            onChange={handleYearChange}
                            className="appearance-none bg-transparent font-extrabold uppercase tracking-widest text-[#202731] py-1 px-4 neumo-pressed rounded-xl focus:outline-none cursor-pointer text-sm"
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <span className="text-gray-300 font-black">/</span>
                    <div className="relative">
                        <select
                            value={currentDate.getMonth()}
                            onChange={handleMonthChange}
                            className="appearance-none bg-transparent font-extrabold uppercase tracking-widest text-[#202731] py-1 px-4 neumo-pressed rounded-xl focus:outline-none cursor-pointer text-sm"
                        >
                            {months.map(m => <option key={m} value={m}>{format(new Date(2024, m), 'MM')}</option>)}
                        </select>
                    </div>
                </div>

                <button
                    onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                    className="neumo-button p-2"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Calendar Rows */}
            <div className="space-y-3 md:space-y-4 pb-12">
                {/* Weekday Labels (Desktop) */}
                <div className="hidden md:flex gap-4 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="flex-1 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            {day}
                        </div>
                    ))}
                </div>

                {weeks.map((week, weekIdx) => (
                    <div key={weekIdx} className="flex flex-col md:flex-row gap-3 md:gap-4 min-h-[100px]">
                        {week.map((day) => (
                            <DayCard
                                key={format(day, 'yyyy-MM-dd')}
                                day={day}
                                isCurrentMonth={isSameMonth(day, monthStart)}
                                record={getRecordForDay(day)}
                                onUpdate={handleUpdateRecord}
                                isFocused={focusedDay && isSameDay(day, focusedDay)}
                                onFocus={() => setFocusedDay(isSameDay(day, focusedDay) ? null : day)}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}

export default CalendarPage
