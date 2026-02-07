
import { calculateDailySalary, calculateOTHours } from './src/lib/storage.js';

const mockSettings = {
    allowance: { tripDaily: 50, exchangeRate: 32.5 },
    salary: { baseMonthly: 50000, hourlyRate: 208.33 },
    rules: { standardEndTime: "17:30" }
};

const record = {
    date: '2023-11-12', // A Saturday
    isWorkDay: true,
    endTime: '17:30',
    otHours: 0, // 17:30 - 17:30 = 0
    otType: 'pay',
    bonus: 0,
    travelCountry: ''
};

// Test 1: Explicit 0 OT Hours
console.log('--- Test 1: Explicit 0 OT ---');
const result1 = calculateDailySalary(record, mockSettings);
console.log('Input:', record);
console.log('Result:', result1);

// Test 2: Missing OT Hours (Fallback Calculation)
console.log('\n--- Test 2: Missing OT Hours (Fallback) ---');
const record2 = { ...record, otHours: 0 }; // 0 triggers fallback if endTime exists
const result2 = calculateDailySalary(record2, mockSettings);
console.log('Result (Fallback):', result2);

// Test 3: What if standardEndTime was 09:30?
console.log('\n--- Test 3: Wrong Settings (09:30 Standard) ---');
const settingsWrong = { ...mockSettings, rules: { standardEndTime: "09:30" } };
const result3 = calculateDailySalary(record2, settingsWrong);
console.log('Result (Wrong Settings):', result3);
console.log('OT Pay:', result3.otPay);
