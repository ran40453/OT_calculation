import React, { useState, useMemo, useEffect } from 'react'
import { format } from 'date-fns'
import { Briefcase, Calendar, Check, Copy, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../lib/utils'

function QuickCopyTool({ isOpen, onClose }) {
    // State for builder
    const [m03, setM03] = useState(false);
    const [gtk, setGtk] = useState(false);
    const [content, setContent] = useState('');
    const [dateOffset, setDateOffset] = useState(-1); // Default yesterday
    const [units, setUnits] = useState(8);
    const [isCopied, setIsCopied] = useState(false);

    // Helper for formatted date
    const targetDate = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + dateOffset);
        return d;
    }, [dateOffset]);

    const dateStr = format(targetDate, 'M/d');

    // Generate full text
    const fullText = useMemo(() => {
        return `Nolan哥，${m03 ? 'M03 ' : ''}${content}${gtk ? ' （GTK刷臉）' : ''} ${dateStr} +${units}單位，謝謝！`;
    }, [m03, gtk, content, dateStr, units]);

    const handleCopy = () => {
        navigator.clipboard.writeText(fullText);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    // Drag handlers
    const handleDrag = (e, type) => {
        // Simple drag logic reusing concept from TimePicker
        // type: 'date' or 'unit'
        const startX = e.clientX || (e.touches && e.touches[0].clientX);
        const startValue = type === 'date' ? dateOffset : units;

        const handleMove = (moveEvent) => {
            const currentX = moveEvent.clientX || (moveEvent.touches && moveEvent.touches[0].clientX);
            const diff = currentX - startX;
            // Sensitivity Reduced significantly: 
            // Date: ~100px per day
            // Unit: ~100px per 2 units

            if (type === 'date') {
                const step = Math.round(diff / 100);
                setDateOffset(startValue + step);
            } else {
                const step = Math.round(diff / 80);
                // Clamp 0-16
                setUnits(Math.min(16, Math.max(0, startValue + (step * 2))));
            }
        };

        const handleEnd = () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleEnd);
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchmove', handleMove);
        window.addEventListener('touchend', handleEnd);
    };

    if (!isOpen) return null;

    return (
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
                className="relative w-full max-w-sm neumo-card p-6"
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black uppercase text-gray-600 flex items-center gap-2">
                        <Briefcase size={20} /> Quick Copy
                    </h3>
                    <button onClick={onClose} className="neumo-button p-2 text-gray-400">
                        <X size={18} />
                    </button>
                </div>

                {/* Builder UI */}
                <div className="space-y-6">
                    {/* Row 1: Toggles & Input */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <input
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="工作內容..."
                                className="neumo-input w-full h-12 px-4 text-sm font-bold"
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setM03(!m03)}
                                className={cn("flex-1 h-10 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2", m03 ? "neumo-pressed text-blue-600" : "neumo-raised text-gray-400")}
                            >
                                {m03 && <Check size={14} />} M03
                            </button>
                            <button
                                onClick={() => setGtk(!gtk)}
                                className={cn("flex-1 h-10 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2", gtk ? "neumo-pressed text-purple-600" : "neumo-raised text-gray-400")}
                            >
                                {gtk && <Check size={14} />} GTK刷臉
                            </button>
                        </div>
                    </div>

                    {/* Row 2: Draggables */}
                    <div className="flex flex-col gap-3">
                        <div className="flex justify-between px-1">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">其他參數 (Drag to adjust)</span>
                        </div>
                        <div className="flex gap-4">
                            {/* Date Dragger */}
                            <div
                                className="flex-1 h-14 neumo-pressed rounded-2xl flex flex-col items-center justify-center cursor-ew-resize select-none touch-none hover:bg-gray-100/50 transition-colors"
                                onMouseDown={(e) => handleDrag(e, 'date')}
                                onTouchStart={(e) => handleDrag(e, 'date')}
                            >
                                <span className="text-[9px] font-black text-gray-400 uppercase mb-1">Date</span>
                                <div className="flex items-center gap-1.5">
                                    <Calendar size={14} className="text-blue-400" />
                                    <span className="text-lg font-black text-gray-700">{dateStr}</span>
                                </div>
                            </div>

                            {/* Unit Dragger */}
                            <div
                                className="flex-1 h-14 neumo-pressed rounded-2xl flex flex-col items-center justify-center cursor-ew-resize select-none touch-none hover:bg-gray-100/50 transition-colors"
                                onMouseDown={(e) => handleDrag(e, 'unit')}
                                onTouchStart={(e) => handleDrag(e, 'unit')}
                            >
                                <span className="text-[9px] font-black text-gray-400 uppercase mb-1">Units</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-lg font-black text-neumo-brand">{units}</span>
                                    <span className="text-[10px] font-bold text-gray-400">單位</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Preview & Action */}
                    <div className="pt-4 border-t border-gray-100">
                        <div className="bg-gray-50 rounded-xl p-4 mb-4 text-xs font-bold text-gray-600 break-words italic border border-gray-100">
                            {fullText}
                        </div>
                        <button
                            onClick={handleCopy}
                            className={cn(
                                "w-full h-14 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all",
                                isCopied ? "bg-green-500 text-white shadow-lg" : "neumo-button text-gray-600"
                            )}
                        >
                            {isCopied ? <><Check size={20} strokeWidth={3} /> 已複製</> : <><Copy size={20} strokeWidth={3} /> 複製文字</>}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}

export default QuickCopyTool
