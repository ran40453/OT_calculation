import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Calendar, Globe, Palmtree, Moon, Clock, CreditCard, Coffee } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '../lib/utils'

function AddRecordModal({ isOpen, onClose, onAdd, settings }) {
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [country, setCountry] = useState('')
    const [isHoliday, setIsHoliday] = useState(false)
    const [isLeave, setIsLeave] = useState(false)
    const [endTime, setEndTime] = useState('17:30')
    const [otType, setOtType] = setOtType = useState('pay')
    const [isDragging, setIsDragging] = useState(false)
    const [mode, setMode] = useState('attendance') // 'attendance' or 'bonus'
    const [bonus, setBonus] = useState('')

    if (!isOpen) return null

    const otHours = (() => {
        const [h1, m1] = "17:30".split(':').map(Number);
        const [h2, m2] = endTime.split(':').map(Number);
        return Math.max(0, (h2 * 60 + m2 - (h1 * 60 + m1)) / 60);
    })();

    const handleSubmit = () => {
        onAdd({
            date: new Date(date),
            travelCountry: mode === 'attendance' ? country : '',
            isHoliday: mode === 'attendance' ? isHoliday : false,
            isLeave: mode === 'attendance' ? isLeave : false,
            otHours: mode === 'attendance' ? otHours : 0,
            otType: mode === 'attendance' ? (otHours >= 0.5 ? otType : 'pay') : 'pay',
            endTime: mode === 'attendance' ? endTime : '',
            bonus: mode === 'bonus' ? parseFloat(bonus) || 0 : 0,
            recordType: mode // helpful for distinguishing records
        })
        onClose()
    }

    const handleDragStart = (e) => {
        setIsDragging(true)
        const startY = e.clientY || (e.touches && e.touches[0].clientY)
        const [h, m] = endTime.split(':').map(Number)
        const startMins = h * 60 + m

        const handleMove = (moveEvent) => {
            const currentY = moveEvent.clientY || (moveEvent.touches && moveEvent.touches[0].clientY)
            const diff = startY - currentY
            const minuteDiff = Math.round(diff / 5) * 15
            const totalMins = Math.max(0, Math.min(23 * 60 + 45, startMins + minuteDiff))
            const nh = Math.floor(totalMins / 60)
            const nm = totalMins % 60
            setEndTime(`${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`)
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
        window.addEventListener('touchmove', handleMove)
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
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-black italic uppercase text-neumo-brand flex items-center gap-2">
                            <Plus size={20} strokeWidth={3} />
                            {mode === 'attendance' ? '新增紀錄' : '新增獎金'}
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
                                <Calendar size={12} /> 日期
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="neumo-input w-full h-12 font-bold px-4"
                            />
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
                                                        otType === 'leave' ? "bg-indigo-500 text-white shadow-lg" : "text-gray-400"
                                                    )}
                                                >
                                                    補休
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Status Toggles */}
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setIsHoliday(!isHoliday)}
                                        className={cn(
                                            "h-12 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all",
                                            isHoliday ? "neumo-pressed text-orange-500" : "neumo-raised text-gray-400"
                                        )}
                                    >
                                        <Palmtree size={14} /> 假日
                                    </button>
                                    <button
                                        onClick={() => setIsLeave(!isLeave)}
                                        className={cn(
                                            "h-12 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all",
                                            isLeave ? "neumo-pressed text-indigo-500" : "neumo-raised text-gray-400"
                                        )}
                                    >
                                        <Moon size={14} /> 請假
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Bonus Mode Fields */}
                        {mode === 'bonus' && (
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
                        )}

                        <button
                            onClick={handleSubmit}
                            className={cn(
                                "neumo-button w-full h-14 mt-4 font-black text-sm flex items-center justify-center gap-2",
                                mode === 'bonus' ? "text-amber-500" : "text-neumo-brand"
                            )}
                        >
                            <Plus size={20} strokeWidth={3} />
                            {mode === 'attendance' ? '新增紀錄' : '新增獎金'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}

export default AddRecordModal
