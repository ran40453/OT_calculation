import React, { useState, useEffect, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, isSameDay, startOfWeek, endOfWeek, setMonth, setYear, getDay } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { loadData, addOrUpdateRecord, fetchRecordsFromGist } from '../lib/storage'
import DayCard from './DayCard'
import DayCardExpanded from './DayCardExpanded'

function CalendarPage({ data, onUpdate, isPrivacy }) {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [focusedDay, setFocusedDay] = useState(null)

    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(monthStart)
    const calendarStart = startOfWeek(monthStart)
    const calendarEnd = endOfWeek(monthEnd)

    // Flattened list of days for Grid
    const days = useMemo(() => eachDayOfInterval({ start: calendarStart, end: calendarEnd }), [calendarStart, calendarEnd])

    // Calculate Grid Rows
    const totalDays = days.length;
    const totalRows = Math.ceil(totalDays / 7);

    const getRecordForDay = (day) => {
        const dayStr = format(day, 'yyyy-MM-dd')
        return data.find(r => {
            if (!r.date) return false
            const dStr = typeof r.date === 'string' ? r.date.split('T')[0] : format(new Date(r.date), 'yyyy-MM-dd')
            return dStr === dayStr
        })
    }

    const handleUpdateRecord = (updatedRecord) => {
        onUpdate(updatedRecord)
    }

    // Selectors Data
    const today = new Date()
    const currentYear = today.getFullYear()
    const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)
    const months = Array.from({ length: 12 }, (_, i) => i)

    const handleMonthChange = (e) => {
        setCurrentDate(setMonth(currentDate, parseInt(e.target.value)))
    }

    // Overlay Logic Calculation
    const getOverlayGeometry = (day) => {
        if (!day) return null;

        const dayIndex = days.findIndex(d => isSameDay(d, day));
        if (dayIndex === -1) return null;

        const row = Math.floor(dayIndex / 7);
        const col = dayIndex % 7;

        // Vertical Logic (Top Half -> Down, Bottom Half -> Up)
        // Group 1 (Rows 0, 1) -> Target Start 1 (Ends 3) i.e. Block is Rows 1,2,3
        // Group 2 (Rows 2+) -> Target Start 0 (Ends 2) i.e. Block is Rows 0,1,2
        // Note: Using 1-based indexing for Grid Lines or 0-based for Calculation? 
        // CSS Grid lines are 1-based.

        // Let's determine logical row index first (0-based)
        let targetStartRow = 0;
        if (row <= 1) {
            targetStartRow = 1; // Block starts at Row Index 1 (2nd Row)
        } else {
            targetStartRow = 0; // Block starts at Row Index 0 (1st Row)
        }

        // Horizontal Logic
        let targetStartCol = col;
        if (col === 6) { // Last column
            targetStartCol = 5; // Use 5,6 instead of 6,7
        }

        // Is clicked cell inside the block?
        // Block Rows: [targetStartRow, targetStartRow + 2]
        // Block Cols: [targetStartCol, targetStartCol + 1]
        const isRowInside = row >= targetStartRow && row <= targetStartRow + 2;
        const isColInside = col >= targetStartCol && col <= targetStartCol + 1;
        const isInside = isRowInside && isColInside;

        return {
            row, col,
            targetStartRow,
            targetStartCol,
            isInside
        };
    }

    const overlayGeo = useMemo(() => getOverlayGeometry(focusedDay), [focusedDay, days]);

    return (
        <div className="space-y-6 relative">
            {/* Month Header */}
            <div className="flex justify-between items-center bg-[#E0E5EC] neumo-raised rounded-3xl p-4 z-20 relative">
                <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="neumo-button p-2">
                    <ChevronLeft size={20} />
                </button>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <select value={currentDate.getFullYear()} onChange={(e) => setCurrentDate(setYear(currentDate, parseInt(e.target.value)))}
                            className="appearance-none bg-transparent font-extrabold uppercase tracking-widest text-[#202731] py-1 px-4 neumo-pressed rounded-xl focus:outline-none cursor-pointer text-sm">
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <span className="text-gray-300 font-black">/</span>
                    <div className="relative">
                        <select value={currentDate.getMonth()} onChange={handleMonthChange}
                            className="appearance-none bg-transparent font-extrabold uppercase tracking-widest text-[#202731] py-1 px-4 neumo-pressed rounded-xl focus:outline-none cursor-pointer text-sm">
                            {months.map(m => <option key={m} value={m}>{format(new Date(2024, m), 'MM')}</option>)}
                        </select>
                    </div>
                </div>
                <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="neumo-button p-2">
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Calendar Grid */}
            <div className="relative pb-12">
                {/* Weekday Labels */}
                <div className="grid grid-cols-7 gap-2 md:gap-4 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="text-center text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Main Grid */}
                <div
                    className="grid grid-cols-7 gap-2 md:gap-4 lg:min-h-[600px]" // Min height for desktop feel
                    style={{
                        gridAutoRows: 'minmax(80px, 1fr)' // Consistent row heights
                    }}
                >
                    {days.map((day) => {
                        const isFocused = focusedDay && isSameDay(day, focusedDay);
                        return (
                            <div
                                key={format(day, 'yyyy-MM-dd')}
                                className={isFocused ? "invisible" : ""} // Hide the original if focused (Overlay takes over)
                            >
                                <DayCard
                                    day={day}
                                    isCurrentMonth={isSameMonth(day, monthStart)}
                                    record={getRecordForDay(day)}
                                    onClick={() => setFocusedDay(isSameDay(day, focusedDay) ? null : day)}
                                    isPrivacy={isPrivacy}
                                />
                            </div>
                        )
                    })}

                    {/* Overlay Layer */}
                    <AnimatePresence>
                        {focusedDay && overlayGeo && (
                            <CalendarOverlay
                                day={focusedDay}
                                record={getRecordForDay(focusedDay)}
                                geometry={overlayGeo}
                                onUpdate={handleUpdateRecord}
                                onClose={() => setFocusedDay(null)}
                                isPrivacy={isPrivacy}
                                monthStart={monthStart}
                            />
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}

function CalendarOverlay({ day, record, geometry, onUpdate, onClose, isPrivacy, monthStart }) {
    const { row, col, targetStartRow, targetStartCol, isInside } = geometry;

    // CSS Grid Positions (1-based)
    const blockStyle = {
        gridColumn: `${targetStartCol + 1} / span 2`,
        gridRow: `${targetStartRow + 1} / span 3`,
    };

    const cellStyle = {
        gridColumn: `${col + 1} / span 1`,
        gridRow: `${row + 1} / span 1`,
    };

    // Corner Logic: Where is the junction?
    // If not inside, we are "sticking out".
    // Vertical Stick Check
    const stickDir = row < targetStartRow ? 'top' : (row >= targetStartRow + 3 ? 'bottom' : null);

    // Render
    return (
        <>
            {/* Backdrop to close */}
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-40 bg-gray-500/10 backdrop-blur-[1px] rounded-3xl"
                onClick={onClose}
            />

            {/* The Main Expanded Block (Form) */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                style={blockStyle}
                className="z-50 relative pointer-events-auto"
            >
                <DayCardExpanded
                    day={day}
                    record={record}
                    onUpdate={onUpdate}
                    onClose={onClose}
                    className="h-full w-full shadow-2xl ring-4 ring-white/50" // Enhanced shadow/ring
                />
            </motion.div>

            {/* If sticking out, render the 'Connector' Cell */}
            {!isInside && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={cellStyle}
                    className="z-[51] relative pointer-events-none" // Higher than block, but pass events? 
                // Actually, if we click this, it should probably do nothing or close.
                // Visually it's the "Header" of the card.
                >
                    {/* We render a "Fake" DayCard that looks selected/merging */}
                    <div
                        className="h-full w-full bg-[#E0E5EC] neumo-raised p-2 flex flex-col items-center justify-center relative shadow-none"
                        style={{
                            // Magic Border Radius to Meld
                            borderBottomLeftRadius: stickDir === 'top' && col === targetStartCol + 1 ? '0' : undefined,
                            borderBottomRightRadius: stickDir === 'top' && col === targetStartCol ? '0' : undefined,
                            borderTopLeftRadius: stickDir === 'bottom' && col === targetStartCol + 1 ? '0' : undefined,
                            borderTopRightRadius: stickDir === 'bottom' && col === targetStartCol ? '0' : undefined,
                            // Mask the border where it meets the block
                            boxShadow: 'none', // Remove shadow to blend
                            zIndex: 52
                        }}
                    >
                        {/* Just minimal content to show 'It's this day' */}
                        <span className="text-2xl font-black text-neumo-brand">{format(day, 'dd')}</span>
                        {/* Optional connector patch to hide the seam perfectly */}
                        <div
                            className="absolute bg-[#E0E5EC] z-50"
                            style={{
                                width: '102%', height: '10px',
                                bottom: stickDir === 'top' ? '-5px' : undefined,
                                top: stickDir === 'bottom' ? '-5px' : undefined,
                                left: '-1%',
                            }}
                        />
                    </div>
                </motion.div>
            )}

            {/* Design Flourish: Smooth Corner if needed (Advanced) */}
            {/* For now, just the block + connector is a huge improvement */}
        </>
    )
}

export default CalendarPage
