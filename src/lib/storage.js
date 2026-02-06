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

/**
 * Standardizes record format from historical or different schemas
 */
export const standardizeRecords = (records) => {
    if (!Array.isArray(records)) return [];
    return records.map(r => {
        const nr = { ...r };

        // 1. Handle tiered OT hours (Historical format: { "1.34": 2, "1.67": 2 })
        const h134 = parseFloat(nr['1.34']) || 0;
        const h167 = parseFloat(nr['1.67']) || 0;
        const h267 = parseFloat(nr['2.67']) || 0;
        const h2 = parseFloat(nr['2']) || 0;
        const tieredSum = h134 + h167 + h267 + h2;

        // Use either existing otHours or calculate from tiers
        let otHours = parseFloat(nr.otHours);
        if (isNaN(otHours) || otHours === 0) {
            otHours = tieredSum;
        }

        // 2. Map property names (Historical or snake_case variants)
        const travelCountry = nr.travelCountry || nr.travel_country || '';
        const isHoliday = !!(nr.isHoliday || nr.is_holiday);
        const isLeave = !!(nr.isLeave || nr.is_leave);
        const isRestDay = !!(nr.isRestDay || nr.is_rest_day);
        const endTime = nr.endTime || nr.end_time || '';
        const otType = nr.otType || nr.ot_type || 'pay';

        return {
            ...nr,
            otHours,
            travelCountry,
            isHoliday,
            isLeave,
            isRestDay,
            endTime,
            otType
        };
    });
};

// Helper to standardize country codes (exported for component use)
export const standardizeCountry = (c) => {
    if (!c || typeof c !== 'string') return '';
    const upper = c.trim().toUpperCase();
    if (upper === 'VN' || upper === '越南' || upper === 'VIETNAM') return 'VN';
    if (upper === 'IN' || upper === '印度' || upper === 'INDIA') return 'IN';
    if (upper === 'CN' || upper === '大陸' || upper === 'CHINA') return 'CN';
    return upper;
};

/**
 * Calculates OT hours based on end time and standard end time
 */
export const calculateOTHours = (endTimeStr, standardEndTimeStr = "17:30") => {
    if (!endTimeStr) return 0;
    const finalStandardTime = standardEndTimeStr || "17:30";

    const extractTime = (str) => {
        if (typeof str !== 'string') return null;
        // Search for HH:mm or HH:mm:ss format
        const timeMatch = str.match(/(\d{1,2}:\d{2})/);
        if (timeMatch) return timeMatch[1];

        // Fallback for strings starting with HH:mm
        if (/^\d{1,2}:\d{2}/.test(str)) return str.substring(0, 5);

        return null;
    };

    const t1 = extractTime(finalStandardTime);
    const t2 = extractTime(endTimeStr);

    if (!t1 || !t2) return 0;

    try {
        const parts1 = t1.split(':');
        const parts2 = t2.split(':');

        if (parts1.length < 2 || parts2.length < 2) return 0;

        const h1 = parseInt(parts1[0]);
        const m1 = parseInt(parts1[1]);
        const h2 = parseInt(parts2[0]);
        const m2 = parseInt(parts2[1]);

        if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;

        const startMinutes = h1 * 60 + m1;
        const endMinutes = h2 * 60 + m2;

        const diff = endMinutes - startMinutes;
        const result = diff / 60;
        return isNaN(result) || result < 0 ? 0 : result;
    } catch (e) {
        return 0;
    }
};

/**
 * Calculates estimated daily salary with complex tiered OT rules
 */
export const calculateDailySalary = (record, settings) => {
    const emptyMetrics = { total: 0, extra: 0, otPay: 0, travelAllowance: 0, baseDayPay: 0, bonus: 0 };
    if (!settings || !record) return emptyMetrics;
    if (record.isLeave && record.recordType !== 'bonus') return emptyMetrics; // Allow bonus on leave days if it was manually entered

    // 1. Get Base Salary for that date (History support)
    let baseMonthly = parseFloat(settings.salary?.baseMonthly) || 0;
    if (settings.salaryHistory && Array.isArray(settings.salaryHistory)) {
        try {
            const sortedHistory = [...settings.salaryHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
            const recordDate = new Date(record.date);
            if (!isNaN(recordDate.getTime())) {
                const applicable = sortedHistory.find(h => new Date(h.date) <= recordDate);
                if (applicable && !isNaN(parseFloat(applicable.amount))) {
                    baseMonthly = parseFloat(applicable.amount);
                }
            }
        } catch (e) {
            console.warn('Salary history parse error', e);
        }
    }

    const hourlyRate = baseMonthly / 30 / 8 || 0;
    const daySalary = baseMonthly / 30 || 0;
    const otType = record.otType || 'pay';
    let otHours = parseFloat(record.otHours);
    if (isNaN(otHours)) otHours = 0;

    // Fallback: Recalculate if endTime exists but otHours is 0/missing
    if (otHours === 0 && record.endTime) {
        otHours = calculateOTHours(record.endTime, settings?.rules?.standardEndTime || "17:30");
    }

    let otPay = 0;
    if (otHours > 0 && otType === 'pay' && !isNaN(hourlyRate)) {
        const recordDate = new Date(record.date);
        const dayOfWeek = isNaN(recordDate.getTime()) ? -1 : getDay(recordDate);

        if (record.isHoliday) {
            if (otHours <= 8) {
                otPay = otHours * hourlyRate * 2.0;
            } else {
                const first8 = 8 * hourlyRate * 2.0;
                const extra = otHours - 8;
                let extraPay = 0;
                if (extra <= 2) {
                    extraPay = extra * hourlyRate * 1.34;
                } else {
                    extraPay = (2 * hourlyRate * 1.34) + ((extra - 2) * hourlyRate * 1.67);
                }
                otPay = first8 + extraPay;
            }
        } else if (dayOfWeek === 0 || dayOfWeek === 6 || record.isRestDay) {
            if (otHours <= 2) {
                otPay = otHours * hourlyRate * 1.34;
            } else if (otHours <= 8) {
                otPay = (2 * hourlyRate * 1.34) + ((otHours - 2) * hourlyRate * 1.67);
            } else {
                otPay = (2 * hourlyRate * 1.34) + (6 * hourlyRate * 1.67) + ((otHours - 8) * hourlyRate * 2.67);
            }
        } else {
            if (otHours <= 2) {
                otPay = otHours * hourlyRate * 1.34;
            } else {
                otPay = (2 * hourlyRate * 1.34) + ((otHours - 2) * hourlyRate * 1.67);
            }
        }
    }

    const recordDate = new Date(record.date);
    const dayOfWeek = isNaN(recordDate.getTime()) ? -1 : getDay(recordDate);
    const isSpecialDay = record.isHoliday || dayOfWeek === 0 || dayOfWeek === 6;
    const baseDayPay = isSpecialDay ? 0 : daySalary;

    let travelAllowance = 0;
    if (record.travelCountry) {
        const country = standardizeCountry(record.travelCountry);
        let dailyUSD = parseFloat(settings.allowance?.tripDaily) || 50;
        if (country === 'VN') dailyUSD = 40;
        else if (country === 'IN') dailyUSD = 70;
        else if (country === 'CN') dailyUSD = 33;

        const rate = parseFloat(settings.liveRate) || parseFloat(settings.allowance?.exchangeRate) || 32.5;
        travelAllowance = dailyUSD * rate;
    }

    const bonus = parseFloat(record.bonus) || 0;
    const extra = (isNaN(otPay) ? 0 : otPay) + (isNaN(travelAllowance) ? 0 : travelAllowance) + bonus;
    const total = (isNaN(baseDayPay) ? 0 : baseDayPay) + extra;

    return {
        total: isNaN(total) ? 0 : total,
        extra: isNaN(extra) ? 0 : extra,
        otPay: isNaN(otPay) ? 0 : otPay,
        travelAllowance: isNaN(travelAllowance) ? 0 : travelAllowance,
        baseDayPay: isNaN(baseDayPay) ? 0 : baseDayPay,
        bonus: isNaN(bonus) ? 0 : bonus
    };
};

/**
 * Calculates comp leave units
 */
export const calculateCompLeaveUnits = (record) => {
    if (record.otType === 'leave' && record.otHours) {
        // User requested: 以 1 為單位，半小時不計入
        const h = parseFloat(record.otHours);
        return isNaN(h) ? 0 : Math.floor(h);
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

            const standardized = standardizeRecords(records);
            console.log(`Gist Sync: Successfully fetched and standardized ${standardized.length} records.`);
            saveData(standardized);
            return standardized;
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
    try {
        const data = localStorage.getItem(DATA_KEY);
        if (!data) return [];
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed)) return [];
        return standardizeRecords(parsed);
    } catch (e) {
        console.error('Storage: Failed to load records', e);
        return [];
    }
};

export const saveData = (data) => {
    try {
        localStorage.setItem(DATA_KEY, JSON.stringify(Array.isArray(data) ? data : []));
    } catch (e) {
        console.error('Storage: Failed to save records', e);
    }
};

export const loadSettings = () => {
    try {
        const settings = localStorage.getItem(SETTINGS_KEY);
        if (!settings) return defaultSettings;
        const parsed = JSON.parse(settings);
        return { ...defaultSettings, ...parsed };
    } catch (e) {
        console.error('Storage: Failed to load settings', e);
        return defaultSettings;
    }
};

export const saveSettings = (settings) => {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
        console.error('Storage: Failed to save settings', e);
    }
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
