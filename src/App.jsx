import React, { useState } from 'react'
import { LayoutDashboard, Calendar, BarChart2, Settings } from 'lucide-react'
import Dashboard from './components/Dashboard'
import CalendarPage from './components/CalendarPage'
import AnalysisPage from './components/AnalysisPage'
import SettingsPage from './components/SettingsPage'
import Tabbar from './components/Tabbar'

import { fetchRecordsFromSheets, fetchSettingsFromSheets } from './lib/storage'

function App() {
    const [activeTab, setActiveTab] = useState('home')

    React.useEffect(() => {
        // Initial sync from Google Sheets
        fetchRecordsFromSheets();
        fetchSettingsFromSheets();
    }, []);

    const renderPage = () => {
        switch (activeTab) {
            case 'home':
                return <Dashboard />
            case 'calendar':
                return <CalendarPage />
            case 'analysis':
                return <AnalysisPage />
            case 'settings':
                return <SettingsPage />
            default:
                return <Dashboard />
        }
    }

    const tabs = [
        { id: 'home', label: '主頁', icon: LayoutDashboard },
        { id: 'calendar', label: '月曆', icon: Calendar },
        { id: 'analysis', label: '分析', icon: BarChart2 },
        { id: 'settings', label: '設定', icon: Settings },
    ]

    return (
        <div className="min-h-screen pb-24">
            <main className="container mx-auto px-4 pt-6">
                {renderPage()}
            </main>

            <Tabbar
                tabs={tabs}
                activeTab={activeTab}
                onChange={setActiveTab}
            />
        </div>
    )
}

export default App
