import React, { useState } from 'react'
import { LayoutDashboard, Calendar, BarChart2, Settings } from 'lucide-react'
import Dashboard from './components/Dashboard'
import CalendarPage from './components/CalendarPage'
import AnalysisPage from './components/AnalysisPage'
import SettingsPage from './components/SettingsPage'
import Tabbar from './components/Tabbar'
import AddRecordModal from './components/AddRecordModal'

import { fetchRecordsFromSheets, fetchSettingsFromSheets, addOrUpdateRecord, loadSettings } from './lib/storage'

function App() {
    const [activeTab, setActiveTab] = useState('home')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [settings, setSettings] = useState(null)

    React.useEffect(() => {
        // Initial sync from Google Sheets
        fetchRecordsFromSheets();
        fetchSettingsFromSheets().then(s => setSettings(s));
        setSettings(loadSettings())
    }, []);

    const handleAddRecord = (record) => {
        addOrUpdateRecord(record)
        // Optionally reload data or trigger sync
        window.location.reload() // Simple way to refresh all views for now, or use a context/global state
    }

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
                onAddClick={() => setIsModalOpen(true)}
            />

            <AddRecordModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onAdd={handleAddRecord}
                settings={settings}
            />
        </div>
    )
}

export default App
