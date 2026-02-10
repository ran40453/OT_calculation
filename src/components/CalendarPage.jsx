import React, { useState, useEffect, useMemo, useRef } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, isSameDay, startOfWeek, endOfWeek, setMonth, setYear, getDay, eachMonthOfInterval, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar, Grid3X3 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { loadData, addOrUpdateRecord, fetchRecordsFromGist } from '../lib/storage'
import { isTaiwanHoliday } from '../lib/holidays'
import DayCard from './DayCard'
import DayCardExpanded from './DayCardExpanded'

function CalendarPage({ data, onUpdate, isPrivacy }) {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [focusedDay, setFocusedDay] = useState(null)
    const [isYearView, setIsYearView] = useState(false)

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
        const record = data.find(r => {
            if (!r.date) return false
            const dStr = format(new Date(r.date), 'yyyy-MM-dd')
            return dStr === dayStr
        })

        // If no record exists, or it doesn't explicitly have isHoliday, check auto-detection
        if (record) {
            return {
                ...record,
                isHoliday: record.isHoliday !== undefined ? !!record.isHoliday : isTaiwanHoliday(day)
            }
        }

        // Return a virtual record for auto-detected holidays
        if (isTaiwanHoliday(day)) {
            return { date: dayStr, isHoliday: true, _isAutoHoliday: true }
        }

        return null;
    }

    // Debugging: Log data length updates
    useEffect(() => {
        console.log('CalendarPage Data Updated:', data.length, 'records');
    }, [data]);

    // Mobile Swipe Navigation
    const touchStartX = useRef(null);
    const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
    const handleTouchEnd = (e) => {
        if (!touchStartX.current) return;
        const diff = touchStartX.current - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) setCurrentDate(addMonths(currentDate, 1)); // Swipe Left -> Next Month
            else setCurrentDate(subMonths(currentDate, 1)); // Swipe Right -> Prev Month
        }
        touchStartX.current = null;
    };

    // Remove overflow: hidden logic to allow scrolling as requested
    useEffect(() => {
        document.body.style.overflow = '';
        return () => { document.body.style.overflow = ''; };
    }, []);

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

        // Responsive Grid Config
        const isMobile = window.innerWidth < 768; // Tailwind md breakpoint
        const cols = 7;
        const row = Math.floor(dayIndex / cols);
        const col = dayIndex % cols;

        // Overlay Dimensions
        const overlayWidth = isMobile ? 3 : 2; // Spans 3 cols on mobile, 2 on desktop
        const overlayHeight = isMobile ? 4 : 3; // Spans 4 rows on mobile, 3 on desktop

        // Vertical Logic: Cover the clicked cell if possible
        let targetStartRow = Math.max(0, Math.min(row, totalRows - overlayHeight));

        // Horizontal Logic: 
        // Default: Expand Right [Col, ... , Col + width - 1]
        // Boundary Check: If too close to right edge, shift left
        let targetStartCol = col;
        if (col + overlayWidth > cols) {
            targetStartCol = cols - overlayWidth;
        }

        // Is clicked cell inside the block?
        const isRowInside = row >= targetStartRow && row < targetStartRow + overlayHeight;
        const isColInside = col >= targetStartCol && col < targetStartCol + overlayWidth;
        const isInside = isRowInside && isColInside;

        return {
            row, col,
            targetStartRow,
            targetStartCol,
            overlayWidth,
            overlayHeight,
            isInside
        };
    }

    const overlayGeo = useMemo(() => getOverlayGeometry(focusedDay), [focusedDay, days]);

    return (
        <div
            className="space-y-4 relative"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
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
                    <button
                        onClick={() => { setCurrentDate(new Date()); setIsYearView(false); }}
                        className="neumo-button p-1.5 text-neumo-brand"
                        title="跳至本月"
                    >
                        <Calendar size={16} />
                    </button>
                    <button
                        onClick={() => setIsYearView(!isYearView)}
                        className={`neumo-button p-1.5 hidden md:flex ${isYearView ? 'text-neumo-brand' : 'text-gray-400'}`}
                        title="年曆模式"
                    >
                        <Grid3X3 size={16} />
                    </button>
                </div>
                <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="neumo-button p-2">
                    <ChevronRight size={20} />
                </button>
            </div>

            {isYearView ? (
                <YearView
                    year={currentDate.getFullYear()}
                    data={data}
                    onSelectMonth={(m) => { setCurrentDate(setMonth(setYear(new Date(), currentDate.getFullYear()), m)); setIsYearView(false); }}
                />
            ) : (
                <>

                    {/* Calendar Grid */}
                    <div className="relative pb-48">
                        {/* Weekday Labels */}
                        <div className="grid grid-cols-7 gap-1 md:gap-3 mb-1">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="text-center text-[7px] md:text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Main Grid */}
                        <div
                            className="grid grid-cols-7 gap-1 md:gap-3 lg:min-h-[600px] relative" // Min height for desktop feel
                            style={{
                                gridAutoRows: 'minmax(80px, 1fr)' // Consistent row heights
                            }}
                        >
                            {days.map((day) => {
                                return (
                                    <div
                                        key={format(day, 'yyyy-MM-dd')}
                                    // Removed 'invisible' class so original card stays visible underneath
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
                </>
            )}
        </div>
    )
}

function YearView({ year, data, onSelectMonth }) {
    const yearMonths = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));

    const getRecordForDate = (date) => {
        const dayStr = format(date, 'yyyy-MM-dd');
        return data.find(r => {
            if (!r.date) return false;
            try { return format(new Date(r.date), 'yyyy-MM-dd') === dayStr; } catch { return false; }
        });
    };

    return (
        <div className="grid grid-cols-4 gap-4 mt-4">
            {yearMonths.map((monthDate, mi) => {
                const mStart = startOfMonth(monthDate);
                const mEnd = endOfMonth(monthDate);
                const wStart = startOfWeek(mStart);
                const wEnd = endOfWeek(mEnd);
                const mDays = eachDayOfInterval({ start: wStart, end: wEnd });

                return (
                    <div
                        key={mi}
                        className="neumo-card p-3 cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => onSelectMonth(mi)}
                    >
                        <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center mb-2">
                            {format(monthDate, 'MMM')}
                        </div>
                        <div className="grid grid-cols-7 gap-[2px]">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                <div key={i} className="text-[6px] font-bold text-gray-300 text-center">{d}</div>
                            ))}
                            {mDays.map((day, di) => {
                                const inMonth = isSameMonth(day, mStart);
                                const record = inMonth ? getRecordForDate(day) : null;
                                const todayMatch = isToday(day);
                                let bg = 'bg-transparent';
                                if (record && record.isLeave) bg = 'bg-rose-400';
                                else if (record) bg = 'bg-green-400';
                                else if (isTaiwanHoliday(day) && inMonth) bg = 'bg-orange-200';

                                return (
                                    <div key={di} className={`text-[7px] text-center rounded-sm leading-4 ${inMonth ? 'text-gray-600' : 'text-gray-200'} ${bg} ${todayMatch && inMonth ? 'ring-1 ring-blue-500 font-black' : ''}`}>
                                        {format(day, 'd')}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function CalendarOverlay({ day, record, geometry, onUpdate, onClose, isPrivacy, monthStart }) {
    const { row, col, targetStartRow, targetStartCol, overlayWidth, overlayHeight, isInside } = geometry;

    // CSS Grid Positions (1-based)
    // Using absolute positioning to let it float over the grid without affecting flow
    const isMobile = window.innerWidth < 768;
    const blockStyle = {
        gridColumn: `${targetStartCol + 1} / span ${overlayWidth}`,
        gridRowStart: targetStartRow + 1, // Start at the correct row, but NO SPAN (allow auto height)
        position: 'absolute',
        width: '100%',
        minHeight: isMobile ? '320px' : '280px', // Fallback minimum height (approx 3-4 rows)
        height: 'auto',
        zIndex: 50
    };

    // ... cellStyle removed if not needed, but keeping for safety if logic falls back ...
    const cellStyle = {
        gridColumn: `${col + 1} / span 1`,
        gridRow: `${row + 1} / span 1`,
        position: 'absolute',
        width: '100%',
        height: '100%',
        zIndex: 51
    };

    // Stick Direction relative to Body
    let stickDir = null;
    if (row < targetStartRow) stickDir = 'top';
    else if (row >= targetStartRow + overlayHeight) stickDir = 'bottom';

    // Which column of the Body does the Tab attach to?
    // If col is reasonably within the start/end of the block
    const attachCol = (col === targetStartCol) ? 'left' : 'right';

    return (
        <>
            {/* Backdrop to close - Transparent as requested */}
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-40 bg-transparent" // Removed blur and darken
                onClick={onClose}
            />

            {/* The Main Expanded Block (Form) */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                style={blockStyle}
                className="relative pointer-events-auto"
            >
                <div className="h-full w-full bg-[#E0E5EC] neumo-raised rounded-2xl md:rounded-3xl shadow-2xl relative overflow-visible">
                    {/* If sticking out, we need to hide the border radius at the connection point */}
                    {/* The Body Itself */}
                    <DayCardExpanded
                        day={day}
                        record={record}
                        onUpdate={onUpdate}
                        onClose={onClose}
                        hideHeader={!isInside}
                        className="h-full w-full shadow-none bg-transparent" // Remove default card styles to merge
                        style={{
                            borderTopLeftRadius: stickDir === 'top' && attachCol === 'left' ? 0 : undefined,
                            borderTopRightRadius: stickDir === 'top' && attachCol === 'right' ? 0 : undefined,
                            borderBottomLeftRadius: stickDir === 'bottom' && attachCol === 'left' ? 0 : undefined,
                            borderBottomRightRadius: stickDir === 'bottom' && attachCol === 'right' ? 0 : undefined,
                        }}
                    />
                </div>
            </motion.div>

            {/* The "Tab" / Connector Cell */}
            {!isInside && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={cellStyle}
                    className="relative pointer-events-none"
                >
                    <div
                        className="h-full w-full bg-[#E0E5EC] neumo-raised p-2 flex flex-col items-center justify-start relative shadow-none"
                        style={{
                            // Border Radius Masking for Tab
                            borderBottomLeftRadius: stickDir === 'top' ? 0 : undefined,
                            borderBottomRightRadius: stickDir === 'top' ? 0 : undefined,
                            borderTopLeftRadius: stickDir === 'bottom' ? 0 : undefined,
                            borderTopRightRadius: stickDir === 'bottom' ? 0 : undefined,
                            zIndex: 52
                        }}
                    >
                        {/* Tab Content: Date Header */}
                        <span className="text-xl md:text-2xl font-black text-neumo-brand">{format(day, 'dd')}</span>

                        {/* Seamless Patch to cover the gap/shadow between Tab and Body */}
                        <div
                            className="absolute bg-[#E0E5EC] z-50"
                            style={{
                                width: '100%',
                                height: '20px',
                                left: 0,
                                bottom: stickDir === 'top' ? '-10px' : undefined,
                                top: stickDir === 'bottom' ? '-10px' : undefined,
                            }}
                        />
                    </div>
                </motion.div>
            )}
        </>
    )
}

export default CalendarPage
