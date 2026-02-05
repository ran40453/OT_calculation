import React, { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, isSameDay, startOfWeek, endOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { loadData, addOrUpdateRecord, fetchRecordsFromGist } from '../lib/storage'
import DayCard from './DayCard'

function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [records, setRecords] = useState([])

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

            {/* Calendar Grid */}
            <div className="space-y-4">
                {/* Weekday Labels (Desktop Only) */}
                <div className="hidden md:grid grid-cols-7 gap-4 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Grid Container */}
                <div className="grid grid-cols-1 md:grid-cols-7 gap-3 md:gap-4 pb-12">
                    {days.map((day) => (
                        <DayCard
                            key={day.toString()}
                            day={day}
                            isCurrentMonth={isSameMonth(day, monthStart)}
                            record={getRecordForDay(day)}
                            onUpdate={handleUpdateRecord}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

export default CalendarPage
