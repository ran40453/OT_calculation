import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Calendar, Globe, Palmtree, Moon, Clock, CreditCard, Coffee, Gift, Check } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '../lib/utils'

function AddRecordModal({ isOpen, onClose, onAdd, settings, records }) {
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [mode, setMode] = useState('attendance') // attendance, bonus
    const [country, setCountry] = useState('')
    const [endTime, setEndTime] = useState('17:30')
    const [otType, setOtType] = useState('pay')
    const [isLeave, setIsLeave] = useState(false)
    const [isHoliday, setIsHoliday] = useState(false)
    const [isWorkDay, setIsWorkDay] = useState(false)
    const [isBatchMode, setIsBatchMode] = useState(false)
    const [bonus, setBonus] = useState('')
    const [bonusCategory, setBonusCategory] = useState('')
    const [bonusName, setBonusName] = useState('')
    const [showCustomCategory, setShowCustomCategory] = useState(false)
    const [customCategory, setCustomCategory] = useState('')
    const [showConfirm, setShowConfirm] = useState(false)
    const [conflictingDates, setConflictingDates] = useState([])
    const [pendingPayloads, setPendingPayloads] = useState(null)
    const [leaveType, setLeaveType] = useState('特休')
    const [isFullDay, setIsFullDay] = useState(true)
    const [leaveStartTime, setLeaveStartTime] = useState(settings?.rules?.standardStartTime || '08:00')
    const [leaveEndTime, setLeaveEndTime] = useState(settings?.rules?.standardEndTime || '17:30')
    const [isLeaveTypePickerOpen, setIsLeaveTypePickerOpen] = useState(false);

    const bonusCategories = settings?.bonusCategories || ['季獎金', '年終獎金', '其他獎金', '補助金', '退費', '分紅']

    if (!isOpen) return null

    // Helper to calculate duration for leave
    const calcDuration = (start, end) => {
        const [h1, m1] = (start || "08:00").split(':').map(Number);
        const [h2, m2] = (end || "17:30").split(':').map(Number);
        const diff = (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
        const lunch = settings?.rules?.lunchBreak || 1.5;
        // Simple logic: if duration spans lunch, subtract it. 
        // For simplicity matching DayCardExpanded:
        return Math.max(0, diff - lunch);
    };

    const otHours = (() => {
        const stdEnd = settings?.rules?.standardEndTime || "17:30";
        const [h1, m1] = stdEnd.split(':').map(Number);
        const [h2, m2] = endTime.split(':').map(Number);
        return Math.max(0, (h2 * 60 + m2 - (h1 * 60 + m1)) / 60);
    })();

    const generatePayload = (targetDate) => {
        const payload = {
            date: new Date(targetDate),
            travelCountry: mode === 'attendance' ? country : '',
            isHoliday: mode === 'attendance' ? isHoliday : false,
            isWorkDay: mode === 'attendance' ? isWorkDay : false,
            isLeave: mode === 'attendance' ? isLeave : false,
            otHours: mode === 'attendance' ? otHours : 0,
            otType: mode === 'attendance' ? (otHours >= 0.5 ? otType : 'pay') : 'pay',
            endTime: mode === 'attendance' ? endTime : '',
            bonus: mode === 'bonus' ? parseFloat(bonus) || 0 : 0,
            bonusCategory: mode === 'bonus' ? (showCustomCategory ? customCategory : bonusCategory) : '',
            bonusName: mode === 'bonus' ? bonusName : '',
            recordType: mode
        };

        if (mode === 'attendance' && isLeave) {
            payload.leaveType = leaveType;
            payload.leaveDuration = isFullDay ? 8 : calcDuration(leaveStartTime, leaveEndTime);
            payload.leaveStartTime = isFullDay ? null : leaveStartTime;
            payload.leaveEndTime = isFullDay ? null : leaveEndTime;
        }

        return payload;
    };

    const getDatesInRange = (start, end) => {
        const dates = [];
        let current = new Date(start);
        const last = new Date(end);
        while (current <= last) {
            dates.push(format(current, 'yyyy-MM-dd'));
            current.setDate(current.getDate() + 1);
        }
        return dates;
    }

    const handlePreSubmit = () => {
        if (!isBatchMode) {
            const payload = generatePayload(date);
            handleFinalSubmit([payload]);
        } else {
            // Batch Mode Logic
            const dates = getDatesInRange(date, endDate);
            if (dates.length === 0) return;

            // Generate all payloads
            const payloads = dates.map(d => generatePayload(d));

            // Check conflicts
            // records must be passed from App.jsx
            const existingDates = (records || []).map(r => format(new Date(r.date), 'yyyy-MM-dd'));
            const conflicts = dates.filter(d => existingDates.includes(d));

            if (conflicts.length > 0) {
                setConflictingDates(conflicts);
                setPendingPayloads(payloads);
                setShowConfirm(true);
            } else {
                handleFinalSubmit(payloads);
            }
        }
    }

    const handleFinalSubmit = (payloads) => {
        // Handle bonus entries structure for each payload
        const finalPayloads = payloads.map(p => {
            if (mode === 'bonus' && p.bonus > 0) {
                return {
                    ...p,
                    bonusEntries: [{
                        id: `be-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        amount: p.bonus,
                        category: p.bonusCategory,
                        name: p.bonusName,
                        date: p.date
                    }]
                };
            }
            return p;
        });

        // Loop add (App.jsx handles one by one or we updated storage to handle array?)
        // Storage addOrUpdateRecord handles array now.
        // App handleUpdateRecord calls addOrUpdateRecord.
        // So passing array is fine IF App.jsx passes it through.
        // App.jsx: handleUpdateRecord(updatedRecord) -> addOrUpdateRecord(updatedRecord)
        // Yes, checking App.jsx code:
        // const handleUpdateRecord = async (updatedRecord) => { const result = await addOrUpdateRecord(updatedRecord) ... }
        // So it passes whatever we send.

        onAdd(finalPayloads);

        // Reset and Close
        setBonus('');
        setBonusName('');
        setPendingPayloads(null);
        setShowConfirm(false);
        onClose();
    }

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

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-gray-500/20 backdrop-blur-sm"
                />
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative w-full max-w-sm neumo-card p-6 overflow-hidden"
                >
                    {/* Confirm Overlay */}
                    {showConfirm && (
                        <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4">
                            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-orange-500 mb-2">
                                <Clock size={32} />
                            </div>
                            <h4 className="text-lg font-black text-[#202731]">確認覆蓋資料？</h4>
                            <p className="text-xs text-gray-500 font-bold">
                                發現 {conflictingDates.length} 筆重複資料（{conflictingDates[0]}...）。<br />
                                是否確定要覆蓋這些日期的紀錄？
                            </p>
                            <div className="flex gap-3 w-full pt-4">
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    className="flex-1 h-12 rounded-xl neumo-raised text-gray-500 font-black text-xs"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={() => handleFinalSubmit(pendingPayloads)}
                                    className="flex-1 h-12 rounded-xl neumo-button text-red-500 font-black text-xs"
                                >
                                    確認覆蓋
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-black italic uppercase text-neumo-brand flex items-center gap-2">
                            <Plus size={20} strokeWidth={3} />
                            {mode === 'attendance' ? (isBatchMode ? '批量新增' : '新增紀錄') : '新增獎金'}
                        </h3>
                        <button onClick={onClose} className="neumo-button p-2 text-gray-400">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Mode Switcher */}
                    <div className="flex gap-1 neumo-pressed p-1 rounded-2xl h-12 mb-6">
                        <button
                            onClick={() => setMode('attendance')}
                            className={cn(
                                "flex-1 rounded-xl text-[10px] font-black transition-all",
                                mode === 'attendance' ? "bg-neumo-brand text-white shadow-lg" : "text-gray-400"
                            )}
                        >
                            出勤紀錄
                        </button>
                        <button
                            onClick={() => setMode('bonus')}
                            className={cn(
                                "flex-1 rounded-xl text-[10px] font-black transition-all",
                                mode === 'bonus' ? "bg-amber-500 text-white shadow-lg" : "text-gray-400"
                            )}
                        >
                            獎金輸入
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* Date Input */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Calendar size={12} /> {isBatchMode ? '日期範圍' : '日期'}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="neumo-input w-full h-12 font-bold px-4 flex-1"
                                />
                                {isBatchMode && (
                                    <>
                                        <span className="flex items-center text-gray-400 font-black">to</span>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="neumo-input w-full h-12 font-bold px-4 flex-1"
                                        />
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Attendance Mode Fields */}
                        {mode === 'attendance' && (
                            <>
                                {/* Country Select */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Globe size={12} /> 出差國家
                                    </label>
                                    <select
                                        value={country}
                                        onChange={(e) => setCountry(e.target.value)}
                                        className="neumo-input w-full h-12 font-bold px-4 bg-transparent appearance-none"
                                    >
                                        <option value="">無出差</option>
                                        <option value="印度">印度 (IN)</option>
                                        <option value="越南">越南 (VN)</option>
                                        <option value="大陸">大陸 (CN)</option>
                                    </select>
                                </div>

                                {/* Time Picker and Type */}
                                {!isLeave && (
                                    <div className="space-y-4 pt-2">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <Clock size={12} /> 下班時間 (17:30 起算)
                                            </label>
                                            <div
                                                className="h-24 neumo-pressed rounded-3xl flex flex-col items-center justify-center relative cursor-ns-resize overflow-hidden"
                                                onMouseDown={handleDragStart}
                                                onTouchStart={handleDragStart}
                                            >
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-3xl font-black text-[#202731]">{endTime}</span>
                                                    <span className="text-sm font-black text-neumo-brand">{otHours.toFixed(1)}h</span>
                                                </div>
                                                <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest mt-1">
                                                    {otHours < 0.5 ? '時數不足 0.5H' : '拖曳調整時間'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className={cn("space-y-2 transition-opacity", otHours < 0.5 && "opacity-40 pointer-events-none grayscale")}>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <CreditCard size={12} /> 加班類型
                                            </label>
                                            <div className="flex gap-1 neumo-pressed p-1 rounded-2xl h-12">
                                                <button
                                                    disabled={otHours < 0.5}
                                                    onClick={() => setOtType('pay')}
                                                    className={cn(
                                                        "flex-1 rounded-xl text-[10px] font-black transition-all",
                                                        otType === 'pay' ? "bg-neumo-brand text-white shadow-lg" : "text-gray-400"
                                                    )}
                                                >
                                                    加班費
                                                </button>
                                                <button
                                                    disabled={otHours < 0.5}
                                                    onClick={() => setOtType('leave')}
                                                    className={cn(
                                                        "flex-1 rounded-xl text-[10px] font-black transition-all",
                                                        otType === 'leave' ? "bg-indigo-600 text-white shadow-lg" : "text-gray-400"
                                                    )}
                                                >
                                                    公司補休
                                                </button>
                                                <button
                                                    disabled={otHours < 0.5}
                                                    onClick={() => setOtType('internal')}
                                                    className={cn(
                                                        "flex-1 rounded-xl text-[10px] font-black transition-all",
                                                        otType === 'internal' ? "bg-purple-600 text-white shadow-lg" : "text-gray-400"
                                                    )}
                                                >
                                                    部門補休
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Status Toggles */}
                                <div className="grid grid-cols-3 gap-3">
                                    <button
                                        onClick={() => {
                                            setIsWorkDay(!isWorkDay);
                                            if (!isWorkDay) setIsHoliday(false);
                                        }}
                                        className={cn(
                                            "h-12 rounded-2xl flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                                            isWorkDay ? "neumo-pressed text-blue-600" : "neumo-raised text-gray-400"
                                        )}
                                    >
                                        <Check size={14} /> 平日
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsHoliday(!isHoliday);
                                            if (!isHoliday) setIsWorkDay(false);
                                        }}
                                        className={cn(
                                            "h-12 rounded-2xl flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                                            isHoliday ? "neumo-pressed text-orange-500" : "neumo-raised text-gray-400"
                                        )}
                                    >
                                        <Palmtree size={14} /> 假日
                                    </button>
                                    <button
                                        onClick={() => setIsLeave(!isLeave)}
                                        className={cn(
                                            "h-12 rounded-2xl flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                                            isLeave ? "neumo-pressed text-indigo-500" : "neumo-raised text-gray-400"
                                        )}
                                    >
                                        <Moon size={14} /> 請假
                                    </button>
                                </div>

                                {/* Leave Details (Only if isLeave is active) */}
                                {isLeave && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        className="space-y-4 pt-2 overflow-hidden"
                                    >
                                        <div className="space-y-2 relative">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">假別 (Type)</label>
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
                                                        className="absolute left-0 right-0 top-full mt-2 z-[60] bg-[#E0E5EC]/95 backdrop-blur-md neumo-card p-2 grid grid-cols-2 gap-2 shadow-2xl max-h-[240px] overflow-y-auto"
                                                    >
                                                        {Object.keys(settings?.leaveRules || {}).filter(type => type !== '補休').map(type => (
                                                            <button
                                                                key={type}
                                                                onClick={() => {
                                                                    setLeaveType(type);
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
                                            <span className="text-xs font-black text-gray-500">全天請假 (Full Day)</span>
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
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">請假時間 (Time)</label>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="neumo-pressed flex-1 h-12 flex flex-col items-center justify-center cursor-ns-resize rounded-xl touch-action-none"
                                                        onMouseDown={(e) => handleDragStart(e, 'leaveStart')}
                                                        onTouchStart={(e) => handleDragStart(e, 'leaveStart')}
                                                        style={{ touchAction: 'none' }}
                                                    >
                                                        <span className="text-[9px] font-black text-gray-400 leading-none mb-1 uppercase tracking-tight">開始 (Start)</span>
                                                        <span className="text-sm font-black text-gray-600">{leaveStartTime}</span>
                                                    </div>
                                                    <span className="text-gray-300 font-bold">-</span>
                                                    <div
                                                        className="neumo-pressed flex-1 h-12 flex flex-col items-center justify-center cursor-ns-resize rounded-xl touch-action-none"
                                                        onMouseDown={(e) => handleDragStart(e, 'leaveEnd')}
                                                        onTouchStart={(e) => handleDragStart(e, 'leaveEnd')}
                                                        style={{ touchAction: 'none' }}
                                                    >
                                                        <span className="text-[9px] font-black text-gray-400 leading-none mb-1 uppercase tracking-tight">結束 (End)</span>
                                                        <span className="text-sm font-black text-gray-600">{leaveEndTime}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </>
                        )}

                        {/* Bonus Mode Fields */}
                        {mode === 'bonus' && (
                            <div className="space-y-4">
                                {/* Bonus Amount */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Gift size={12} /> 獎金金額 (TWD)
                                    </label>
                                    <input
                                        type="number"
                                        value={bonus}
                                        onChange={(e) => setBonus(e.target.value)}
                                        placeholder="輸入獎金金額..."
                                        className="neumo-input w-full h-12 font-bold px-4"
                                    />
                                </div>

                                {/* Bonus Category */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Plus size={12} /> 獎金類別
                                    </label>
                                    <div className="flex gap-2">
                                        {!showCustomCategory ? (
                                            <>
                                                <select
                                                    value={bonusCategory}
                                                    onChange={(e) => setBonusCategory(e.target.value)}
                                                    className="neumo-input flex-1 h-12 font-bold px-4 bg-transparent appearance-none"
                                                >
                                                    {bonusCategories.map(cat => (
                                                        <option key={cat} value={cat}>{cat}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => setShowCustomCategory(true)}
                                                    className="neumo-button w-12 h-12 flex items-center justify-center text-neumo-brand"
                                                >
                                                    <Plus size={18} strokeWidth={3} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <input
                                                    placeholder="輸入自定義類別..."
                                                    value={customCategory}
                                                    onChange={(e) => setCustomCategory(e.target.value)}
                                                    className="neumo-input flex-1 h-12 font-bold px-4"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => setShowCustomCategory(false)}
                                                    className="neumo-button w-12 h-12 flex items-center justify-center text-gray-400"
                                                >
                                                    <X size={18} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Bonus Name/Reason */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Calendar size={12} /> 獎金名目 / 備註
                                    </label>
                                    <input
                                        value={bonusName}
                                        onChange={(e) => setBonusName(e.target.value)}
                                        placeholder="例如：2023 績效獎金..."
                                        className="neumo-input w-full h-12 font-bold px-4"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={handlePreSubmit}
                                className={cn(
                                    "neumo-button flex-1 h-14 font-black text-sm flex items-center justify-center gap-2",
                                    mode === 'bonus' ? "text-amber-500" : "text-neumo-brand"
                                )}
                            >
                                <Plus size={20} strokeWidth={3} />
                                {isBatchMode ? '確認批量新增' : (mode === 'attendance' ? '新增紀錄' : '新增獎金')}
                            </button>

                            {mode === 'attendance' && (
                                <button
                                    onClick={() => setIsBatchMode(!isBatchMode)}
                                    className={cn(
                                        "neumo-button w-14 h-14 flex items-center justify-center transition-all",
                                        isBatchMode ? "text-white bg-neumo-brand shadow-inner rounded-xl" : "text-gray-400"
                                    )}
                                    title="批量新增模式"
                                >
                                    {isBatchMode ? <Calendar size={20} strokeWidth={3} /> : <div className="flex flex-col items-center leading-none text-[8px] font-black gap-0.5"><Plus size={14} /><span className="scale-75">BATCH</span></div>}
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}

export default AddRecordModal
