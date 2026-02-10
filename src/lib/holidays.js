import Holidays from 'date-holidays';

const hd = new Holidays('TW');

/**
 * Checks if a given date is a Taiwan public holiday.
 * @param {Date|string} date - Date object or ISO string.
 * @returns {boolean}
 */
export const isTaiwanHoliday = (date) => {
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return false;

        const holidays = hd.isHoliday(d);
        if (holidays && Array.isArray(holidays)) {
            // Include public holidays and common observances (like Constitution Day)
            return holidays.some(h => h.type === 'public' || h.type === 'observance' || h.name.includes('行憲紀念日'));
        }
        return !!holidays;
    } catch (e) {
        console.error('isTaiwanHoliday error:', e);
        return false;
    }
};

/**
 * Gets the holiday name if it exists.
 * @param {Date|string} date 
 * @returns {string|null}
 */
export const getHolidayName = (date) => {
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return null;

        const holidays = hd.isHoliday(d);
        if (holidays && Array.isArray(holidays)) {
            // Prefer public holidays, fallback to others
            const h = holidays.find(h => h.type === 'public') || holidays[0];
            return h ? h.name : null;
        }
        return null;
    } catch (e) {
        return null;
    }
};
