import { format } from 'date-fns';

const DATA_KEY = 'ot-calculation-data';
const SETTINGS_KEY = 'ot-calculation-settings';

const defaultSettings = {
    allowance: {
        tripDaily: 50, // USD
        exchangeRate: 32.5, // USD to TWD
    },
    salary: {
        baseMonthly: 50000,
        hourlyRate: 50000 / 30 / 8,
    },
    rules: {
        ot1: 1.34,
        ot2: 1.67,
        ot3: 2.0,
        standardEndTime: "18:00", // Default off-work time
    }
};

/**
 * Calculates OT hours based on end time and standard end time
 */
export const calculateOTHours = (endTimeStr, standardEndTimeStr = "18:00") => {
    if (!endTimeStr) return 0;

    const [h1, m1] = standardEndTimeStr.split(':').map(Number);
    const [h2, m2] = endTimeStr.split(':').map(Number);

    const startMinutes = h1 * 60 + m1;
    const endMinutes = h2 * 60 + m2;

    const diff = endMinutes - startMinutes;
    return Math.max(0, diff / 60);
};

/**
 * Calculates estimated daily salary
 */
export const calculateDailySalary = (record, settings) => {
    if (!settings) return 0;
    if (record.isLeave) return 0;

    const daySalary = settings.salary.baseMonthly / 30;
    const otHours = record.otHours || 0;

    // Simplified OT calculation: first 2 hours at ot1, rest at ot2
    let otPay = 0;
    if (otHours > 0) {
        const rate1 = settings.rules.ot1 || 1.34;
        const rate2 = settings.rules.ot2 || 1.67;

        if (otHours <= 2) {
            otPay = otHours * settings.salary.hourlyRate * rate1;
        } else {
            otPay = (2 * settings.salary.hourlyRate * rate1) +
                ((otHours - 2) * settings.salary.hourlyRate * rate2);
        }
    }

    // Holiday bonus? Usually double pay for the base day if it's a holiday and worked
    // For now, let's keep it simple as requested or just add a placeholder for multiplier
    const multiplier = record.isHoliday ? 2 : 1;

    return (daySalary * multiplier) + otPay;
};

export const loadData = () => {
    const data = localStorage.getItem(DATA_KEY);
    return data ? JSON.parse(data) : [];
};

export const saveData = (data) => {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
};

export const loadSettings = () => {
    const settings = localStorage.getItem(SETTINGS_KEY);
    return settings ? JSON.parse(settings) : defaultSettings;
};

export const saveSettings = (settings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const addOrUpdateRecord = (record) => {
    const data = loadData();
    const dateStr = format(new Date(record.date), 'yyyy-MM-dd');
    const index = data.findIndex(r => format(new Date(r.date), 'yyyy-MM-dd') === dateStr);

    if (index >= 0) {
        data[index] = { ...data[index], ...record };
    } else {
        data.push(record);
    }

    saveData(data);
    return data;
};

export const deleteRecord = (date) => {
    const data = loadData();
    const dateStr = format(new Date(date), 'yyyy-MM-dd');
    const filtered = data.filter(r => format(new Date(r.date), 'yyyy-MM-dd') !== dateStr);
    saveData(filtered);
    return filtered;
};
