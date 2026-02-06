import { format, getDay } from 'date-fns';

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

// Helper to standardize country codes
const standardizeCountry = (c) => {
    if (!c) return '';
    const upper = c.toUpperCase();
    if (upper === 'VN' || upper === '越南' || upper === 'VIETNAM') return 'VN';
    if (upper === 'IN' || upper === '印度' || upper === 'INDIA') return 'IN';
    if (upper === 'CN' || upper === '大陸' || upper === 'CHINA') return 'CN';
    return upper;
};

/**
 * Calculates OT hours based on end time and standard end time
 */
export const calculateOTHours = (endTimeStr, standardEndTimeStr = "17:30") => {
    if (!endTimeStr || typeof endTimeStr !== 'string') return 0;
    if (!standardEndTimeStr || typeof standardEndTimeStr !== 'string') standardEndTimeStr = "17:30";

    try {
        const parts1 = standardEndTimeStr.split(':');
        const parts2 = endTimeStr.split(':');

        if (parts1.length < 2 || parts2.length < 2) return 0;

        const [h1, m1] = parts1.map(Number);
        const [h2, m2] = parts2.map(Number);

        const startMinutes = h1 * 60 + m1;
        const endMinutes = h2 * 60 + m2;

        const diff = endMinutes - startMinutes;
        return Math.max(0, diff / 60);
    } catch (e) {
        return 0;
    }
};

/**
 * Calculates estimated daily salary with complex tiered OT rules
 */
export const calculateDailySalary = (record, settings) => {
    if (!settings) return 0;
    if (record.isLeave) return 0;

    // 1. Get Base Salary for that date (History support)
    // If no history, fallback to current baseMonthly
    let baseMonthly = settings.salary?.baseMonthly || 0;
    if (settings.salaryHistory && settings.salaryHistory.length > 0) {
        const sortedHistory = [...settings.salaryHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
        const recordDate = new Date(record.date);
        const applicable = sortedHistory.find(h => new Date(h.date) <= recordDate);
        if (applicable) baseMonthly = applicable.amount;
    }

    const hourlyRate = baseMonthly / 30 / 8;
    const daySalary = baseMonthly / 30;
    const otHours = parseFloat(record.otHours) || 0;
    const otType = record.otType || 'pay';

    let otPay = 0;
    if (otHours > 0 && otType === 'pay') {
        if (record.isHoliday) {
            // 國定假日 (Holidays) 法定假日前 8 小時 2x, 之後比照平日
            if (otHours <= 8) {
                otPay = otHours * hourlyRate * 2.0;
            } else {
                const first8 = 8 * hourlyRate * 2.0;
                const extra = otHours - 8;
                // Extra follows weekday: 1.34 for first 2, 1.67 for rest
                let extraPay = 0;
                if (extra <= 2) {
                    extraPay = extra * hourlyRate * 1.34;
                } else {
                    extraPay = (2 * hourlyRate * 1.34) + ((extra - 2) * hourlyRate * 1.67);
                }
                otPay = first8 + extraPay;
            }
        } else if (getDay(new Date(record.date)) === 0 || getDay(new Date(record.date)) === 6 || record.isRestDay) {
            // 例假日 (Rest Days) 前 2 小時 1.34x，3-8 小時 1.67x，9+ 小時 2.67x
            if (otHours <= 2) {
                otPay = otHours * hourlyRate * 1.34;
            } else if (otHours <= 8) {
                otPay = (2 * hourlyRate * 1.34) + ((otHours - 2) * hourlyRate * 1.67);
            } else {
                otPay = (2 * hourlyRate * 1.34) + (6 * hourlyRate * 1.67) + ((otHours - 8) * hourlyRate * 2.67);
            }
        } else {
            // 平日 (Weekdays) 1.34x (前 2h), 1.67x (rest)
            if (otHours <= 2) {
                otPay = otHours * hourlyRate * 1.34;
            } else {
                otPay = (2 * hourlyRate * 1.34) + ((otHours - 2) * hourlyRate * 1.67);
            }
        }
    }

    // Holiday bonus: If it's a holiday and worked, the base day is usually 0 because OT is calculated from 0h
    // But if they worked full day on holiday, we typically just use the OT pay calculated above?
    // User requested: "平日... 例假日... 國定假日..."
    // If it's a normal day, we earn daySalary. 
    // If it's a Holiday/RestDay, do we earn daySalary + otPay? Usually, yes, because daySalary is fixed monthly.
    const baseDayPay = (record.isHoliday || getDay(new Date(record.date)) === 0 || getDay(new Date(record.date)) === 6) ? 0 : daySalary;

    // Travel allowance (Per-country)
    let travelAllowance = 0;
    if (record.travelCountry) {
        const country = standardizeCountry(record.travelCountry);
        let dailyUSD = settings.allowance?.tripDaily || 50;
        if (country === 'VN') dailyUSD = 40;
        else if (country === 'IN') dailyUSD = 70;
        else if (country === 'CN') dailyUSD = 33;

        const rate = settings.liveRate || settings.allowance?.exchangeRate || 32.5;
        travelAllowance = dailyUSD * rate;
    }

    const extra = otPay + travelAllowance;
    const total = baseDayPay + extra;

    return {
        total: isNaN(total) ? 0 : total,
        extra: isNaN(extra) ? 0 : extra,
        otPay: isNaN(otPay) ? 0 : otPay,
        travelAllowance: isNaN(travelAllowance) ? 0 : travelAllowance,
        baseDayPay: isNaN(baseDayPay) ? 0 : baseDayPay
    };
};

/**
 * Calculates comp leave units
 */
export const calculateCompLeaveUnits = (record) => {
    if (record.otType === 'leave' && record.otHours) {
        // User requested: 以 1 為單位，半小時不計入
        return Math.floor(parseFloat(record.otHours));
    }
    return 0;
};

const GIST_ID = '7ce68f2145a8c8aa4eabe5127f351f71';
const GET_GIST_URL = (id) => `https://api.github.com/gists/${id}`;

/**
 * Maps React record to Gist format (just JSON)
 */
const recordsToGistFormat = (records) => {
    return JSON.stringify(records, null, 2);
};

/**
 * Fetch data from GitHub Gist
 */
export const fetchRecordsFromGist = async () => {
    const settings = loadSettings();
    const token = settings?.githubToken;
    try {
        const headers = {};
        if (token) headers['Authorization'] = `token ${token}`;

        const response = await fetch(GET_GIST_URL(GIST_ID), { headers });
        const gist = await response.json();
        if (gist.files && gist.files['records.json']) {
            const recordsContent = gist.files['records.json'].content;
            if (!recordsContent) throw new Error('Gist content is empty');

            const records = JSON.parse(recordsContent);
            if (!Array.isArray(records)) throw new Error('Gist data is not an array');

            console.log(`Gist Sync: Successfully fetched ${records.length} records.`);
            saveData(records);
            return records;
        }
    } catch (error) {
        console.error('Failed to fetch from Gist:', error);
    }
    return loadData();
};

/**
 * Save data to GitHub Gist
 */
export const syncRecordsToGist = async (records) => {
    const settings = loadSettings();
    const token = settings.githubToken;
    if (!token) {
        console.warn('No GitHub token found in settings, cannot sync to Gist.');
        return { ok: false, error: 'Token missing' };
    }

    try {
        const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                files: {
                    'records.json': {
                        content: recordsToGistFormat(records)
                    }
                }
            })
        });
        return { ok: response.ok };
    } catch (error) {
        console.error('Failed to sync to Gist:', error);
        return { ok: false, error: 'Network error' };
    }
};

/**
 * Fetch settings from Gist
 */
export const fetchSettingsFromGist = async () => {
    try {
        const response = await fetch(GET_GIST_URL(GIST_ID));
        const gist = await response.json();
        if (gist.files && gist.files['settings.json']) {
            const remoteSettings = JSON.parse(gist.files['settings.json'].content);
            const localSettings = loadSettings();
            // Merge remote settings with local token (token should probably stay local or be carefully synced)
            const merged = { ...remoteSettings, githubToken: localSettings.githubToken };
            saveSettings(merged);
            return merged;
        }
    } catch (error) {
        console.error('Failed to fetch settings from Gist:', error);
    }
    return loadSettings();
};

/**
 * Save settings to Gist
 */
export const syncSettingsToGist = async (settings) => {
    const token = settings.githubToken;
    if (!token) return { ok: false };

    try {
        // Strip token before saving to Gist for security
        const { githubToken, ...safeSettings } = settings;
        const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                files: {
                    'settings.json': {
                        content: JSON.stringify(safeSettings, null, 2)
                    }
                }
            })
        });
        return { ok: response.ok };
    } catch (error) {
        console.error('Failed to sync settings to Gist:', error);
        return { ok: false };
    }
};

/**
 * Alias functions for compatibility or future proofing
 */
export const fetchRecordsFromSheets = fetchRecordsFromGist;
export const syncRecordsToSheets = syncRecordsToGist;
export const fetchSettingsFromSheets = fetchSettingsFromGist;
export const syncSettingsToSheets = syncSettingsToGist;

/**
 * Test connectivity to Gist
 */
export const testConnection = async (token) => {
    try {
        const headers = {};
        if (token) headers['Authorization'] = `token ${token}`;

        const response = await fetch(GET_GIST_URL(GIST_ID), { headers });
        if (response.ok) {
            const gist = await response.json();
            return { ok: true, status: 200, data: gist };
        }
        return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    } catch (error) {
        return { ok: false, error: error.message };
    }
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

let exchangeRateCache = {
    rate: 32.5,
    timestamp: 0
};

export const fetchExchangeRate = async () => {
    const NOW = Date.now();
    // Cache for 1 hour
    if (NOW - exchangeRateCache.timestamp < 3600000) {
        return exchangeRateCache.rate;
    }

    try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await response.json();
        if (data && data.rates && data.rates.TWD) {
            exchangeRateCache = {
                rate: data.rates.TWD,
                timestamp: NOW
            };
            return data.rates.TWD;
        }
    } catch (error) {
        console.error('Failed to fetch exchange rate:', error);
    }
    return exchangeRateCache.rate;
};
