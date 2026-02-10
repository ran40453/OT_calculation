import React from 'react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

function BatteryIcon({
    value,
    total,
    unit = '',
    label,
    subLabel,
    color = 'bg-green-500',
    className,
    size = 'normal', // 'normal', 'large'
    showDetails = false // If true, show 'Used: X / Total: Y' style
}) {
    const percentage = Math.min(100, Math.max(0, (value / (total || 1)) * 100));
    const isLow = percentage < 20;
    const displayColor = isLow ? 'bg-rose-500' : color;

    // Size classes
    const containerClass = size === 'large' ? "w-40 h-20 border-[6px] rounded-2xl" : "w-20 h-10 border-[3px] rounded-xl";
    const nippleClass = size === 'large' ? "w-3 h-8 -right-[10px]" : "w-2 h-4 -right-[7px]";
    const textClass = size === 'large' ? "text-2xl" : "text-sm";
    const subTextClass = size === 'large' ? "text-xs" : "text-[10px]";

    return (
        <div className={cn("flex flex-col items-center justify-center p-2 group", className)}>
            {/* Battery Body */}
            <div className="relative">
                <div className={cn("border-gray-400/80 p-1 relative flex items-center bg-gray-100/50 backdrop-blur-sm shadow-inner group-hover:scale-105 transition-transform duration-300", containerClass)}>
                    {/* Terminal (Nipple) */}
                    <div className={cn("absolute top-1/2 -translate-y-1/2 bg-gray-400/80 rounded-r-md", nippleClass)} />

                    {/* Fill */}
                    <div className="w-full h-full relative overflow-hidden rounded-lg">
                        <motion.div
                            className={cn("h-full rounded-md shadow-[0_0_10px_rgba(0,0,0,0.1)]", displayColor)}
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            whileHover={{ scale: 1.05, filter: "brightness(1.1)" }}
                            transition={{ type: "spring", stiffness: 120, damping: 15 }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none rounded-md" />
                    </div>

                    {/* Value Text Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                        <div className="flex flex-col items-center leading-none">
                            <span className={cn(
                                "font-black shadow-sm tracking-tight",
                                textClass,
                                percentage > 55 ? "text-white drop-shadow-md" : "text-gray-600"
                            )}>
                                {typeof value === 'number' ? Math.round(value * 10) / 10 : value}
                                <span className={cn("opacity-80 ml-0.5", subTextClass)}>{unit}</span>
                            </span>
                            {showDetails && (
                                <span className={cn("font-bold mt-0.5", percentage > 55 ? "text-white/90" : "text-gray-400", size === 'large' ? "text-[10px]" : "text-[8px]")}>
                                    {total ? `/${total}` : ''}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Labels */}
            {label && (
                <div className="mt-3 text-center">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none group-hover:text-gray-500 transition-colors">{label}</div>
                    {subLabel && <div className="text-[9px] font-bold text-gray-300 mt-0.5">{subLabel}</div>}
                </div>
            )}
        </div>
    );
}

export default BatteryIcon;
