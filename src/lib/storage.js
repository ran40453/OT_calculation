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
    if (!endTimeStr || typeof endTimeStr !== 'string') return 0;
    if (!standardEndTimeStr || typeof standardEndTimeStr !== 'string') standardEndTimeStr = "18:00";

    try {
        const parts1 = standardEndTimeStr.split(':');
        const parts2 = endTimeStr.split(':');

        if (parts1.length < 2 || parts2.length < 2) return 0;

        const [h1, m1] = parts1.map(Number);
        const [h2, m2] = parts2.map(Number);

        if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;

        const startMinutes = h1 * 60 + m1;
        const endMinutes = h2 * 60 + m2;

        const diff = endMinutes - startMinutes;
        return Math.max(0, diff / 60);
    } catch (e) {
        return 0;
    }
};

/**
 * Calculates estimated daily salary
 */
export const calculateDailySalary = (record, settings) => {
    if (!settings || !settings.salary) return 0;
    if (record.isLeave) return 0;

    const baseMonthly = settings.salary.baseMonthly || 0;
    const hourlyRate = settings.salary.hourlyRate || (baseMonthly / 30 / 8);
    const daySalary = baseMonthly / 30;
    const otHours = parseFloat(record.otHours) || 0;

    // Simplified OT calculation: first 2 hours at ot1, rest at ot2
    let otPay = 0;
    const otType = record.otType || 'pay';

    if (otHours > 0 && otType === 'pay') {
        const rate1 = settings.rules?.ot1 || 1.34;
        const rate2 = settings.rules?.ot2 || 1.67;

        if (otHours <= 2) {
            otPay = otHours * hourlyRate * rate1;
        } else {
            otPay = (2 * hourlyRate * rate1) +
                ((otHours - 2) * hourlyRate * rate2);
        }
    }

    // Holiday bonus? Usually double pay for the base day if it's a holiday and worked
    const multiplier = record.isHoliday ? 2 : 1;

    // Travel allowance
    let travelAllowance = 0;
    if (record.travelCountry) {
        const rate = settings.liveRate || settings.allowance?.exchangeRate || 32.5;
        travelAllowance = (settings.allowance?.tripDaily || 50) * rate;
    }

    const total = (daySalary * multiplier) + otPay + travelAllowance;
    return isNaN(total) ? 0 : total;
};

/**
 * Calculates comp leave units (加班1小時增加0.5單位)
 */
export const calculateCompLeaveUnits = (record) => {
    if (record.otType === 'leave' && record.otHours) {
        return parseFloat(record.otHours) * 0.5;
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
            const records = JSON.parse(gist.files['records.json'].content);
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
export const testConnection = async () => {
    try {
        const response = await fetch(GET_GIST_URL(GIST_ID));
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
