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
    const [otHours, setOtHours] = useState(0)
    const [otType, setOtType] = useState('pay') // 'pay' or 'leave'

    if (!isOpen) return null

    const handleSubmit = () => {
        onAdd({
            date: new Date(date),
            travelCountry: country,
            isHoliday,
            isLeave,
            otHours: parseFloat(otHours) || 0,
            otType
        })
        onClose()
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
                            新增紀錄
                        </h3>
                        <button onClick={onClose} className="neumo-button p-2 text-gray-400">
                            <X size={18} />
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

                        {/* OT and Type */}
                        <div className="space-y-4 pt-2">
                            <div className="flex gap-3">
                                <div className="flex-1 space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Clock size={12} /> 加班時數
                                    </label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={otHours}
                                        onChange={(e) => setOtHours(e.target.value)}
                                        className="neumo-input w-full h-12 font-bold px-4"
                                    />
                                </div>
                                <div className="flex-1 space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <CreditCard size={12} /> 類型
                                    </label>
                                    <div className="flex gap-1 neumo-pressed p-1 rounded-2xl h-12">
                                        <button
                                            onClick={() => setOtType('pay')}
                                            className={cn(
                                                "flex-1 rounded-xl text-[10px] font-black transition-all",
                                                otType === 'pay' ? "bg-neumo-brand text-white shadow-lg" : "text-gray-400"
                                            )}
                                        >
                                            加班費
                                        </button>
                                        <button
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
                        </div>

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

                        <button
                            onClick={handleSubmit}
                            className="neumo-button w-full h-14 mt-4 text-neumo-brand font-black text-sm flex items-center justify-center gap-2"
                        >
                            <Plus size={20} strokeWidth={3} />
                            新增紀錄
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}

export default AddRecordModal
