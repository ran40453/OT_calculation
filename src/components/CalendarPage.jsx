import React, { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, isSameDay, startOfWeek, endOfWeek } from 'date-fns'
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
