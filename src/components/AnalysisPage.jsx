import React, { useState, useEffect } from 'react'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    PointElement,
    LineElement,
    ArcElement,
} from 'chart.js'
import { Bar, Line, Pie } from 'react-chartjs-2'
import { format, subMonths, eachMonthOfInterval, startOfYear, endOfYear } from 'date-fns'
import { loadData, fetchRecordsFromGist } from '../lib/storage'

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
)

function AnalysisPage() {
    const [data, setData] = useState([])

    useEffect(() => {
        setData(loadData());
        fetchRecordsFromGist().then(remoteRecords => {
            if (remoteRecords) setData(remoteRecords);
        });
    }, [])

    const currentYear = new Date().getFullYear()
    const months = eachMonthOfInterval({
        start: startOfYear(new Date(currentYear, 0, 1)),
        end: endOfYear(new Date(currentYear, 11, 31))
    })

    const otByMonth = months.map(m => {
        const monthStr = format(m, 'yyyy-MM')
        return data
            .filter(r => format(new Date(r.date), 'yyyy-MM') === monthStr)
            .reduce((sum, r) => sum + (r.otHours || 0), 0)
    })

    const barData = {
        labels: months.map(m => format(m, 'MMM')),
        datasets: [
            {
                label: 'Monthly OT Hours',
                data: otByMonth,
                backgroundColor: 'rgba(99, 102, 241, 0.5)',
                borderColor: 'rgb(99, 102, 241)',
                borderWidth: 1,
                borderRadius: 8,
            },
        ],
    }

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                display: false,
            },
            title: {
                display: false,
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    display: false,
                },
            },
            x: {
                grid: {
                    display: false,
                },
            },
        },
    }

    return (
        <div className="space-y-8">
            <header className="flex flex-col space-y-2">
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">Analysis</h1>
                <p className="text-gray-500 text-sm font-bold tracking-widest uppercase">Trends & Insights</p>
            </header>

            {/* OT Trend Card */}
            <div className="neumo-card space-y-4">
                <h3 className="font-black italic">OT Hours Trend (2025)</h3>
                <div className="h-64">
                    <Bar data={barData} options={chartOptions} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Distribution Card */}
                <div className="neumo-card space-y-4">
                    <h3 className="font-black italic">Work vs Travel</h3>
                    <div className="h-48 flex items-center justify-center">
                        {/* Placeholder for Pie chart if needed */}
                        <div className="text-center space-y-2">
                            <div className="w-32 h-32 rounded-full border-8 border-neumo-brand border-t-transparent neumo-raised animate-spin mx-auto opacity-20" />
                            <p className="text-xs text-gray-400 font-bold uppercase">Pie Chart Placeholder</p>
                        </div>
                    </div>
                </div>

                {/* Breakdown Card */}
                <div className="neumo-card space-y-4">
                    <h3 className="font-black italic">Top Countries</h3>
                    <div className="space-y-3">
                        {[
                            { name: 'USA', count: 12 },
                            { name: 'Japan', count: 8 },
                            { name: 'Germany', count: 5 }
                        ].map((c, i) => (
                            <div key={c.name} className="flex items-center justify-between">
                                <span className="text-sm font-bold">{c.name}</span>
                                <div className="flex-1 mx-4 h-2 neumo-pressed rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-neumo-brand"
                                        style={{ width: `${(c.count / 15) * 100}%` }}
                                    />
                                </div>
                                <span className="text-xs font-black text-gray-400">{c.count}d</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AnalysisPage
