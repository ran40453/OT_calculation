import React, { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, isSameDay } from 'date-fns'
import { TrendingUp, Globe, Wallet, Clock, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { loadData, loadSettings, fetchRecordsFromGist } from '../lib/storage'
import { cn } from '../lib/utils'

function Dashboard() {
    const [data, setData] = useState([])
    const [settings, setSettings] = useState(null)
    const today = new Date()

    useEffect(() => {
        const localData = loadData();
        setData(localData);
        setSettings(loadSettings());

        fetchRecordsFromGist().then(remoteRecords => {
            if (remoteRecords) setData(remoteRecords);
        });
    }, [])

    if (!settings) return null

    const currentMonthStart = startOfMonth(today)
    const currentMonthEnd = endOfMonth(today)

    const currentMonthRecords = data.filter(r => {
        const d = new Date(r.date)
        return d >= currentMonthStart && d <= currentMonthEnd
    })

    const totalOT = currentMonthRecords.reduce((sum, r) => sum + (parseFloat(r.otHours) || 0), 0)
    const tripCount = currentMonthRecords.filter(r => r.travelCountry).length
    const tripAllowance = tripCount * settings.allowance.tripDaily * settings.allowance.exchangeRate
    const otIncome = totalOT * settings.salary.hourlyRate * 1.67 // Simplified
    const estimatedTotal = settings.salary.baseMonthly + otIncome + tripAllowance

    const widgets = [
        { label: '本月累計加班', value: `${totalOT}h`, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50' },
        { label: '出差天數', value: `${tripCount}d`, icon: Globe, color: 'text-green-500', bg: 'bg-green-50' },
        { label: '津貼估計 (TWD)', value: `+${Math.round(tripAllowance).toLocaleString()}`, icon: Wallet, color: 'text-orange-500', bg: 'bg-orange-50' },
        { label: '預估總含薪', value: `${Math.round(estimatedTotal).toLocaleString()}`, icon: TrendingUp, color: 'text-purple-500', bg: 'bg-purple-50' },
    ]

    return (
        <div className="space-y-8">
            <header className="flex flex-col space-y-2">
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                    Dashboard <span className="text-sm font-bold bg-neumo-brand/10 text-neumo-brand px-2 py-1 rounded-lg">{format(today, 'MMMM')}</span>
                </h1>
                <p className="text-gray-500 text-sm font-bold tracking-widest uppercase">OT & Travel Statistics</p>
            </header>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {widgets.map((w, i) => (
                    <motion.div
                        key={w.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="neumo-card flex flex-col items-center justify-center p-6 space-y-3"
                    >
                        <div className={cn("p-3 rounded-2xl neumo-flat", w.color)}>
                            <w.icon size={24} />
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{w.label}</p>
                            <p className="text-xl font-black">{w.value}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Recent Activity */}
            <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                    <h3 className="text-lg font-black italic">Recent Activity</h3>
                    <button className="text-xs font-bold text-neumo-brand flex items-center gap-1">
                        View All <ArrowRight size={14} />
                    </button>
                </div>

                <div className="space-y-4">
                    {currentMonthRecords.slice(0, 3).length > 0 ? (
                        currentMonthRecords.slice(0, 3).reverse().map((r, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4 + (i * 0.1) }}
                                className="neumo-card p-4 flex justify-between items-center"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 neumo-pressed rounded-xl flex flex-col items-center justify-center">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">{format(new Date(r.date), 'EEE')}</span>
                                        <span className="text-sm font-black">{format(new Date(r.date), 'dd')}</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm">{r.travelCountry || '加班'}紀錄</h4>
                                        <p className="text-xs text-gray-500 font-bold">{r.otHours} hours overtime</p>
                                    </div>
                                </div>
                                {r.travelCountry && (
                                    <div className="bg-green-500/10 text-green-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                                        Travel
                                    </div>
                                )}
                            </motion.div>
                        ))
                    ) : (
                        <div className="neumo-card p-12 text-center">
                            <p className="text-gray-400 font-bold text-sm">No recent activity this month.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Dashboard
