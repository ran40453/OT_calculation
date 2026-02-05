import { loadData, loadSettings, fetchRecordsFromGist, calculateCompLeaveUnits } from '../lib/storage'
import { startOfYear, endOfYear, isWithinInterval } from 'date-fns'

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
    const currentYearStart = startOfYear(today)
    const currentYearEnd = endOfYear(today)

    const currentMonthRecords = data.filter(r => isWithinInterval(new Date(r.date), { start: currentMonthStart, end: currentMonthEnd }))
    const currentYearRecords = data.filter(r => isWithinInterval(new Date(r.date), { start: currentYearStart, end: currentYearEnd }))

    const calcCompUnits = (records) => records.reduce((sum, r) => sum + calculateCompLeaveUnits(r), 0)
    const calcLeaveDays = (records) => records.filter(r => r.isLeave).length

    const totalOTValue = currentMonthRecords.reduce((sum, r) => sum + (parseFloat(r.otHours) || 0), 0)
    const tripCount = currentMonthRecords.filter(r => r.travelCountry).length
    const tripAllowance = tripCount * settings.allowance.tripDaily * (settings.allowance.exchangeRate || 32.5)

    // Original Top Widgets
    const widgets = [
        { label: '本月累計加班', value: `${totalOTValue}h`, icon: Clock, color: 'text-blue-500' },
        { label: '出差天數', value: `${tripCount}d`, icon: Globe, color: 'text-green-500' },
        { label: '津貼估計', value: `$${Math.round(tripAllowance).toLocaleString()}`, icon: Wallet, color: 'text-orange-500' },
        { label: '月薪估計', value: `${Math.round(settings.salary.baseMonthly + tripAllowance).toLocaleString()}`, icon: TrendingUp, color: 'text-purple-500' },
    ]

    const statsGrid = [
        { label: '當月累計補休', value: calcCompUnits(currentMonthRecords).toFixed(1), unit: '單位', color: 'text-indigo-500' },
        { label: '當年累計補休', value: calcCompUnits(currentYearRecords).toFixed(1), unit: '單位', color: 'text-indigo-600' },
        { label: '當月累計請假', value: calcLeaveDays(currentMonthRecords), unit: '天', color: 'text-rose-500' },
        { label: '當年累計請假', value: calcLeaveDays(currentYearRecords), unit: '天', color: 'text-rose-600' },
    ]

    return (
        <div className="space-y-8">
            <header className="flex flex-col space-y-2">
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                    Dashboard <span className="text-sm font-bold bg-neumo-brand/10 text-neumo-brand px-2 py-1 rounded-lg">{format(today, 'MMMM')}</span>
                </h1>
                <p className="text-gray-500 text-xs font-bold tracking-widest uppercase italic">Efficiency & Trends</p>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {widgets.map((w, i) => (
                    <motion.div
                        key={w.label}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="neumo-card p-6 flex flex-col items-center gap-3"
                    >
                        <div className={cn("p-3 rounded-2xl neumo-pressed", w.color)}>
                            <w.icon size={22} />
                        </div>
                        <div className="text-center">
                            <p className="text-[9px] font-black text-gray-400 border-b border-gray-100 pb-1 mb-1 uppercase tracking-widest">{w.label}</p>
                            <p className="text-xl font-black tracking-tight">{w.value}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-black italic px-2">累積統計庫</h3>
                <div className="grid grid-cols-2 gap-4">
                    {statsGrid.map((s, i) => (
                        <motion.div
                            key={s.label}
                            initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="neumo-card p-5 flex justify-between items-center"
                        >
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{s.label}</p>
                                <div className="flex items-baseline gap-1">
                                    <span className={cn("text-2xl font-black tabular-nums", s.color)}>{s.value}</span>
                                    <span className="text-[10px] font-black text-gray-400 uppercase">{s.unit}</span>
                                </div>
                            </div>
                            <div className={cn("w-10 h-10 rounded-full neumo-pressed flex items-center justify-center opacity-30", s.color)}>
                                {s.label.includes('補休') ? <Coffee size={18} /> : <Moon size={18} />}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Dashboard
