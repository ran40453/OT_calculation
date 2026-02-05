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

const SHEET_API_URL = '/api';

/**
 * Maps React record to Google Sheets row format
 */
const recordsToSheetFormat = (records) => {
    const headers = ['日期', '下班時間', '加班時數', '出差國家', '國定假日', '請假'];
    const rows = records.map(r => [
        format(new Date(r.date), 'yyyy-MM-dd'),
        r.endTime || '',
        r.otHours || 0,
        r.country || '',
        r.isHoliday ? 'TRUE' : 'FALSE',
        r.isLeave ? 'TRUE' : 'FALSE'
    ]);
    return { headers, rows };
};

/**
 * Maps Google Sheets objects back to React record format
 */
const sheetToRecordsFormat = (sheetRows) => {
    return sheetRows.map(row => ({
        date: row['日期'] || row['date'],
        endTime: row['下班時間'] || row['endTime'] || '18:00',
        otHours: parseFloat(row['加班時數'] || row['otHours'] || 0),
        country: row['出差國家'] || row['country'] || '',
        isHoliday: String(row['國定假日'] || row['isHoliday']) === 'TRUE',
        isLeave: String(row['請假'] || row['isLeave']) === 'TRUE'
    }));
};

export const loadData = () => {
    const data = localStorage.getItem(DATA_KEY);
    return data ? JSON.parse(data) : [];
};

export const saveData = (data) => {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
};

/**
 * Fetch data from Google Sheets
 */
export const fetchRecordsFromSheets = async () => {
    try {
        const response = await fetch(`${SHEET_API_URL}?api=1`);
        const result = await response.json();
        if (result && result.data) {
            const records = sheetToRecordsFormat(result.data);
            saveData(records);
            return records;
        }
    } catch (error) {
        console.error('Failed to fetch from sheets:', error);
    }
    return loadData();
};

/**
 * Save data to Google Sheets
 */
export const syncRecordsToSheets = async (records) => {
    try {
        const payload = recordsToSheetFormat(records);
        const response = await fetch(SHEET_API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (error) {
        console.error('Failed to sync to sheets:', error);
        return { ok: false, error: 'Network error' };
    }
};

/**
 * Fetch settings from Google Sheets
 */
export const fetchSettingsFromSheets = async () => {
    try {
        const response = await fetch(`${SHEET_API_URL}?api=1&mode=settings`);
        const result = await response.json();
        // The legacy GAS code might need a mode=settings parameter or separate logic
        // For now, assume it returns { ok: true, data: { ... } }
        if (result && result.ok && result.data) {
            saveSettings(result.data);
            return result.data;
        }
    } catch (error) {
        console.error('Failed to fetch settings:', error);
    }
    return loadSettings();
};

/**
 * Save settings to Google Sheets
 */
export const syncSettingsToSheets = async (settings) => {
    try {
        const response = await fetch(SHEET_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'settings', data: settings })
        });
        return await response.json();
    } catch (error) {
        console.error('Failed to sync settings:', error);
        return { ok: false };
    }
};

/**
 * Test connectivity to Google Sheets API
 */
export const testConnection = async () => {
    try {
        console.log('Testing connection to:', SHEET_API_URL);
        const response = await fetch(`${SHEET_API_URL}?api=1`, { method: 'GET' });
        console.log('Response status:', response.status);

        if (!response.ok) {
            return { ok: false, status: response.status, error: `HTTP ${response.status}` };
        }

        const text = await response.text();
        console.log('Raw response:', text.slice(0, 100));

        try {
            const json = JSON.parse(text);
            return { ok: true, status: response.status, data: json };
        } catch (e) {
            return { ok: false, status: response.status, error: 'Invalid JSON response', raw: text.slice(0, 100) };
        }
    } catch (error) {
        console.error('Connection test failed:', error);
        return { ok: false, error: error.message || 'Network error' };
    }
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

    let newData;
    if (index >= 0) {
        newData = [...data];
        newData[index] = { ...newData[index], ...record };
    } else {
        newData = [...data, record];
    }

    saveData(newData);
    // Background sync
    syncRecordsToSheets(newData);
    return newData;
};

export const deleteRecord = (date) => {
    const data = loadData();
    const dateStr = format(new Date(date), 'yyyy-MM-dd');
    const filtered = data.filter(r => format(new Date(r.date), 'yyyy-MM-dd') !== dateStr);
    saveData(filtered);
    syncRecordsToSheets(filtered);
    return filtered;
};
