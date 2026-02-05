import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '../lib/utils'

function Tabbar({ tabs, activeTab, onChange, onAddClick }) {
    const leftTabs = tabs.slice(0, 2)
    const rightTabs = tabs.slice(2)

    const TabButton = ({ tab }) => {
        const isActive = activeTab === tab.id
        const Icon = tab.icon

        return (
            <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                className={cn(
                    "relative flex flex-col items-center justify-center flex-1 py-1 px-1 transition-all duration-300 min-h-[56px]",
                    isActive ? "text-neumo-brand" : "text-gray-400"
                )}
            >
                {isActive && (
                    <motion.div
                        layoutId="activeTab"
                        className="absolute inset-x-1 inset-y-1 neumo-pressed rounded-xl"
                        transition={{ type: "spring", duration: 0.5 }}
                    />
                )}
                <div className="relative z-10 flex flex-col items-center space-y-0.5">
                    <Icon size={18} className={cn(isActive && "animate-pulse")} />
                    <span className="text-[9px] font-black uppercase tracking-tighter">{tab.label}</span>
                </div>
            </button>
        )
    }

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-sm z-50">
            <div className="bg-[#E0E5EC] neumo-raised rounded-[2.5rem] p-2 flex items-center">
                <div className="flex flex-1 items-center">
                    {leftTabs.map(tab => <TabButton key={tab.id} tab={tab} />)}
                </div>

                <div className="px-2">
                    <button
                        onClick={onAddClick}
                        className="w-14 h-14 bg-neumo-brand rounded-full flex items-center justify-center text-white shadow-[inset_0_-4px_8px_rgba(0,0,0,0.2),0_8px_16px_rgba(99,102,241,0.4)] active:scale-95 transition-transform"
                    >
                        <Plus size={28} strokeWidth={3} />
                    </button>
                </div>

                <div className="flex flex-1 items-center">
                    {rightTabs.map(tab => <TabButton key={tab.id} tab={tab} />)}
                </div>
            </div>
        </div>
    )
}

import { Plus } from 'lucide-react'

export default Tabbar
