let tableData = []; // 所有資料
let newRowTravelEnabled = true; // 新增列預設是否啟用 Travel 津貼

function getWeekdayChar(dateStr) {
    const date = new Date(dateStr);
    const weekdays = ['日','一','二','三','四','五','六'];
    return weekdays[date.getDay()];
}

// 根據輸入設定的國家，決定每日 Travel USD（China:33, Vietnam:40, India:80）
function getTravelUsdByCountry() {
    const select = document.getElementById('travelCountry');
    const country = select?.value || 'Vietnam';
    if (country === 'China') return 33;
    if (country === 'India') return 80;
    return 40; // Vietnam 預設
}

// 更新計算欄位
function updateAll(openIndex = null) {
    const salary = parseFloat(document.getElementById('salary')?.value) || 60000;
    const rate   = parseFloat(document.getElementById('usdRate')?.value) || 30.9;
    const travelUsdPerDay = getTravelUsdByCountry();

    let accum = 0;
    const monthTotals = {}; // key: 'YYYY-MM' -> 該月所有 Total 加總

    // 先跑一遍：算出每列的金額、順便累積每個月份的 Total
    tableData.forEach(entry => {
        const otSum = entry.v167 * 1.67
                    + entry.v134 * 1.34
                    + entry.v166 * 1.66
                    + entry.v267 * 2.67;

        // 若該列尚未有 travelEnabled 設定，預設為 true
        if (typeof entry.travelEnabled === 'undefined') {
            entry.travelEnabled = true;
        }

        const base     = salary / 30;
        const travel   = entry.travelEnabled ? (travelUsdPerDay * rate) : 0;
        const otSalary = (salary / 30 / 8) * otSum;
        const total    = base + travel + otSalary;

        accum += total;

        entry.weekday  = getWeekdayChar(entry.date);
        entry.otSum    = otSum.toFixed(2);
        entry.base     = base.toFixed(2);
        entry.travel   = travel.toFixed(2);
        entry.otSalary = otSalary.toFixed(2);
        entry.total    = total.toFixed(2);
        entry.accum    = accum.toFixed(2);

        // 依月份累積 Total（假設日期格式是 YYYY-MM-DD）
        const monthKey = entry.date ? entry.date.slice(0, 7) : '';
        if (monthKey) {
            monthTotals[monthKey] = (monthTotals[monthKey] || 0) + total;
        }
    });

    // 第二遍：依月份回寫「月薪」欄位
    tableData.forEach(entry => {
        const monthKey = entry.date ? entry.date.slice(0, 7) : '';
        const monthTotal = monthKey ? monthTotals[monthKey] : 0;

        // ✅ 這裡就是你要的邏輯：
        //    「當月所有 Total 加總」+「整月月薪」
        const monthSLR = salary + monthTotal;

        entry.monthSLR = monthSLR.toFixed(2);
    });

    renderTable(openIndex);
}

// 新增資料
function addNewEntry(entry) {
    tableData.push(entry);
    tableData.sort((a,b) => new Date(a.date) - new Date(b.date));
    updateAll();
}

// 調整單筆 OT 數值並重新計算
function adjustOTValue(entry, key, delta) {
    const current = parseFloat(entry[key]) || 0;
    let next = current + delta;
    if (next < 0) next = 0;
    entry[key] = next;
    updateAll();
}

// 數字翻牌動畫通用 helper（逐位數）
function setAnimatedNumber(element, newValue) {
    if (!element) return;
    const newText = String(newValue);
    const oldText = element.dataset.value ?? element.textContent;

    if (oldText === newText) {
        element.dataset.value = newText;
        return;
    }

    element.dataset.value = newText;
    element.innerHTML = '';

    for (let i = 0; i < newText.length; i++) {
        const ch = newText[i];
        const span = document.createElement('span');
        span.textContent = ch;
        span.classList.add('digit');
        if (oldText[i] !== ch) {
            span.classList.add('flip');
        }
        element.appendChild(span);
    }
}

// 同步 Travel Toggle UI（新增列上的 Travel 按鈕）
function syncTravelToggleUI() {
    const travelToggleBtn = document.getElementById('travelToggle');
    if (travelToggleBtn) {
        if (newRowTravelEnabled) {
            travelToggleBtn.classList.add('on');
        } else {
            travelToggleBtn.classList.remove('on');
        }
    }
}

// 渲染表格
function renderTable(openIndex = null) {
    const container = document.getElementById('tableContainer');
    container.innerHTML = '';

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // 標題（刪除欄放在最後一欄）
    const headerRow = document.createElement('tr');
    const headers = ['日期','1.67','1.34','1.66','2.67','費用 Total','月薪','備註',''];

    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // 若尚未載入任何資料，渲染簡單的占位假表
    if (tableData.length === 0) {
        const placeholderRows = 4;
        for (let i = 0; i < placeholderRows; i++) {
            const tr = document.createElement('tr');
            tr.classList.add('placeholder-row');
            headers.forEach(() => {
                const td = document.createElement('td');
                td.textContent = '';
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        }

        // 讓假表第一列第二欄「載入 CSV」區塊可以點擊觸發匯入
        const firstPlaceholderRow = tbody.querySelector('tr.placeholder-row');
        if (firstPlaceholderRow && firstPlaceholderRow.children[1]) {
            const loadCell = firstPlaceholderRow.children[1];
            loadCell.style.cursor = 'pointer';
            loadCell.classList.add('placeholder-load-cell');
            loadCell.addEventListener('click', () => {
                const importInput = document.getElementById('importCSVCard');
                if (importInput) {
                    importInput.click();
                }
            });
        }

        table.appendChild(thead);
        table.appendChild(tbody);
        container.appendChild(table);
        updateDashboard();
        return;
    }

    tableData.forEach((entry, index) => {
        // ===== 主列 =====
        const tr = document.createElement('tr');
        tr.classList.add('data-row');
        if (entry.weekday === '日') tr.classList.add('sunday-row');

        // 日期（點擊可修改）
        const dateTd = document.createElement('td');
        dateTd.textContent = `${entry.date} (${entry.weekday})`;
        tr.appendChild(dateTd);

        dateTd.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dateTd.querySelector('input')) return;

            const input = document.createElement('input');
            input.type = 'date';
            input.value = entry.date;
            input.classList.add('date-inline-input');

            dateTd.innerHTML = '';
            dateTd.appendChild(input);
            input.focus();

            const finish = (commit) => {
                if (!commit) {
                    // 取消修改，還原顯示
                    dateTd.innerHTML = `${entry.date} (${entry.weekday})`;
                    return;
                }
                const newVal = input.value;
                if (!newVal) {
                    dateTd.innerHTML = `${entry.date} (${entry.weekday})`;
                    return;
                }
                entry.date = newVal;
                entry.weekday = getWeekdayChar(newVal);
                tableData.sort((a, b) => new Date(a.date) - new Date(b.date));
                updateAll();
            };

            input.addEventListener('blur', () => finish(true));
            input.addEventListener('keydown', (evt) => {
                if (evt.key === 'Enter') finish(true);
                if (evt.key === 'Escape') finish(false);
            });
        });

        // OT 四個欄位
        ['v167','v134','v166','v267'].forEach(key => {
            const td = document.createElement('td');
            const cap = document.createElement('span');
            cap.classList.add('capsule', 'ot-value');
            cap.textContent = entry[key];

            if (entry[key] === 0) cap.classList.add('gray');
            else if (key === 'v167') cap.classList.add('green');
            else cap.classList.add('orange');

            // 下箭頭
            const downBtn = document.createElement('button');
            downBtn.type = 'button';
            downBtn.classList.add('ot-arrow', 'ot-arrow-down');
            downBtn.textContent = '▾';
            downBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 避免觸發列的展開/收合
                adjustOTValue(entry, key, -1);
            });

            // 上箭頭
            const upBtn = document.createElement('button');
            upBtn.type = 'button';
            upBtn.classList.add('ot-arrow', 'ot-arrow-up');
            upBtn.textContent = '▴';
            upBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                adjustOTValue(entry, key, +1);
            });

            // 組合：下箭頭 + 膠囊 + 上箭頭
            td.appendChild(downBtn);
            td.appendChild(cap);
            td.appendChild(upBtn);
            tr.appendChild(td);
        });

        // 費用 Total
        const totalTd = document.createElement('td');
        const totalSpan = document.createElement('span');
        totalSpan.classList.add('capsule','black','total-value');
        totalSpan.textContent = Math.round(entry.total);
        totalTd.appendChild(totalSpan);
        tr.appendChild(totalTd);

        // 月薪（每月第一筆黃底，其餘深灰）
        const monthTd = document.createElement('td');
        const monthSpan = document.createElement('span');
        monthSpan.classList.add('capsule', 'salary-value', 'total-value');

        const monthKey = entry.date ? entry.date.slice(0, 7) : '';
        const firstIndex = tableData.findIndex(e => e.date && e.date.slice(0, 7) === monthKey);
        const isFirstOfMonth = firstIndex === index;

        if (isFirstOfMonth) {
            monthSpan.classList.add('yellow');
        } else {
            monthSpan.classList.add('dark-gray');
        }

        monthSpan.textContent = Math.round(entry.monthSLR);
        monthTd.appendChild(monthSpan);
        tr.appendChild(monthTd);

        // Remark (正確抓 N 欄)
        const remarkTd = document.createElement('td');
        remarkTd.textContent = entry.remark;
        tr.appendChild(remarkTd);

        // 刪除列小圓點與確認氣泡（放在最右側欄位）
        const deleteTd = document.createElement('td');
        const deleteWrapper = document.createElement('div');
        deleteWrapper.classList.add('row-delete-wrapper');

        const dotBtn = document.createElement('button');
        dotBtn.type = 'button';
        dotBtn.classList.add('row-dot');
        dotBtn.textContent = '●';

        const bubble = document.createElement('div');
        bubble.classList.add('delete-bubble');
        bubble.innerHTML = `
            <div class="delete-bubble-content">
                <p>刪除這一列？</p>
                <div class="delete-bubble-actions">
                    <button type="button" class="delete-confirm">確認</button>
                    <button type="button" class="delete-cancel">取消</button>
                </div>
            </div>
        `;

        deleteWrapper.appendChild(dotBtn);
        deleteWrapper.appendChild(bubble);
        deleteTd.appendChild(deleteWrapper);
        tr.appendChild(deleteTd);

        dotBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // 關閉其他列的氣泡
            tbody.querySelectorAll('.delete-bubble.open').forEach(el => {
                el.classList.remove('open');
            });
            bubble.classList.add('open');
        });

        const confirmBtn = bubble.querySelector('.delete-confirm');
        const cancelBtn = bubble.querySelector('.delete-cancel');

        confirmBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = tableData.indexOf(entry);
            if (idx !== -1) {
                tableData.splice(idx, 1);
                updateAll();
            }
        });

        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            bubble.classList.remove('open');
        });

        tbody.appendChild(tr);

        // ===== 子列：Base / Travel / OT Salary =====
        const detailTr = document.createElement('tr');
        detailTr.classList.add('detail-row');
        const detailTd = document.createElement('td');
        detailTd.colSpan = headers.length;

        const detailWrapper = document.createElement('div');
        detailWrapper.classList.add('detail-wrapper');

        const detailItems = [
            { key: 'base', label: 'Base' },
            { key: 'travel', label: 'Travel' },
            { key: 'otSalary', label: 'OT Salary' }
        ];

        detailItems.forEach(item => {
            const block = document.createElement('div');
            block.classList.add('detail-chip');

            // 若為 Travel，加上可點擊的「此列專用」 toggle
            if (item.key === 'travel') {
                const travelToggleInline = document.createElement('button');
                travelToggleInline.type = 'button';
                travelToggleInline.classList.add('travel-toggle-inline');
                if (entry.travelEnabled) {
                    travelToggleInline.classList.add('on');
                }
                travelToggleInline.addEventListener('click', (e) => {
                    e.stopPropagation();
                    entry.travelEnabled = !entry.travelEnabled;
                    updateAll(index); // 更新後維持該列子清單展開
                });
                block.appendChild(travelToggleInline);
            }

            const labelSpan = document.createElement('span');
            labelSpan.classList.add('detail-label');
            labelSpan.textContent = item.label;

            const valueSpan = document.createElement('span');
            valueSpan.classList.add('capsule','dark-gray');
            valueSpan.textContent = Math.round(parseFloat(entry[item.key]) || 0);

            block.appendChild(labelSpan);
            block.appendChild(valueSpan);
            detailWrapper.appendChild(block);
        });

        detailTd.appendChild(detailWrapper);
        detailTr.appendChild(detailTd);
        if (openIndex === index) {
            detailTr.classList.add('open');
        }
        tbody.appendChild(detailTr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    container.appendChild(table);

    // 點擊主列展開/收合 Base / Travel / OT Salary 子清單
    const dataRows = tbody.querySelectorAll('tr.data-row');
    dataRows.forEach(row => {
        row.addEventListener('click', () => {
            const detail = row.nextElementSibling;
            if (!detail || !detail.classList.contains('detail-row')) return;

            const isOpen = detail.classList.contains('open');

            // 關閉其他已開啟的子列
            tbody.querySelectorAll('tr.detail-row.open').forEach(dr => {
                dr.classList.remove('open');
            });

            // 如果原本是關閉的，就打開；如果原本是開啟就維持關閉
            if (!isOpen) {
                detail.classList.add('open');
            }
        });
    });

    updateDashboard(); // 每次渲染表格後更新總計
    syncTravelToggleUI();
    console.log("每列欄數:", tbody.querySelector('tr.data-row')?.children.length);
}

// 新增按鈕事件
document.getElementById('addRowCard').addEventListener('click', () => {
    const newEntry = {
        date: document.getElementById('newDate').value,
        v167: parseFloat(document.getElementById('new167').value) || 0,
        v134: parseFloat(document.getElementById('new134').value) || 0,
        v166: parseFloat(document.getElementById('new166').value) || 0,
        v267: parseFloat(document.getElementById('new267').value) || 0,
        remark: document.getElementById('newRemark').value,
        travelEnabled: newRowTravelEnabled
    };
    if (!newEntry.date) {
        alert("請選擇日期");
        return;
    }
    addNewEntry(newEntry);

    // 清空輸入欄位
    document.getElementById('newDate').value = '';
    document.getElementById('new167').value = '';
    document.getElementById('new134').value = '';
    document.getElementById('new166').value = '';
    document.getElementById('new267').value = '';
    document.getElementById('newRemark').value = '';
});

// 匯出 CSV
document.getElementById('exportCSVCard').addEventListener('click', () => {
    let csv = 'date,weekday,1.67,1.34,1.66,2.67,OT hr SUM,Base,Travel,OT Salary,Total,Month SLR,Remark\n';
    tableData.forEach(entry => {
        csv += [
            entry.date,
            entry.weekday,
            entry.v167,
            entry.v134,
            entry.v166,
            entry.v267,
            entry.otSum,
            entry.base,
            entry.travel,
            entry.otSalary,
            entry.total,
            entry.monthSLR,
            entry.remark
        ].join(',') + '\n';
    });

    const blob = new Blob([csv], {type:'text/csv'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'overtime.csv';
    link.click();
});

// 匯入 CSV
document.getElementById('importCSVCard').addEventListener('change', function(e){
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = function(event){
        const text = event.target.result;
        parseCSV(text);
        updateAll();
    }
    reader.readAsText(file);
});

function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    tableData = lines.slice(1).map(line => {
        const cols = line.split(',');
        return {
            date: cols[0],
            v167: parseFloat(cols[2])||0,
            v134: parseFloat(cols[3])||0,
            v166: parseFloat(cols[4])||0,
            v267: parseFloat(cols[5])||0,
            remark: cols[13] || '',  // N 欄備註
            travelEnabled: true      // 匯入資料預設有 Travel，之後可用 toggle 關閉
        };
    });
}

// 更新 Dashboard 總計
function updateDashboard() {
    let totalOT = 0, totalBase = 0, totalTravel = 0, totalOTSalary = 0, totalCost = 0;
    const monthSalaryMap = {}; // key: 'YYYY-MM' -> 該月月薪，只取一次

    tableData.forEach(entry => {
        totalOT       += (parseFloat(entry.v167) || 0)
                       + (parseFloat(entry.v134) || 0)
                       + (parseFloat(entry.v166) || 0)
                       + (parseFloat(entry.v267) || 0);
        totalBase     += parseFloat(entry.base     || 0);
        totalTravel   += parseFloat(entry.travel   || 0);
        totalOTSalary += parseFloat(entry.otSalary || 0);
        totalCost     += parseFloat(entry.total    || 0);

        const monthKey = entry.date ? entry.date.slice(0, 7) : '';
        if (monthKey && entry.monthSLR) {
            // 只在第一次遇到這個月份時記錄
            if (!monthSalaryMap[monthKey]) {
                monthSalaryMap[monthKey] = parseFloat(entry.monthSLR) || 0;
            }
        }
    });

    // 所有月份的月薪加總
    const totalSalary = Object.values(monthSalaryMap).reduce((sum, val) => sum + val, 0);

    setAnimatedNumber(document.getElementById('totalOT'),        totalOT.toFixed(2));
    setAnimatedNumber(document.getElementById('totalBase'),      Math.round(totalBase));
    setAnimatedNumber(document.getElementById('totalTravel'),    Math.round(totalTravel));
    setAnimatedNumber(document.getElementById('totalOTSalary'),  Math.round(totalOTSalary));
    setAnimatedNumber(document.getElementById('totalCost'),      Math.round(totalCost));
    setAnimatedNumber(document.getElementById('totalSalary'),    Math.round(totalSalary));
}

// 當月薪或匯率輸入變更時，自動重新計算
document.getElementById('salary').addEventListener('input', () => {
    updateAll();
});

document.getElementById('usdRate').addEventListener('input', () => {
    updateAll();
});

// Travel 國家下拉選單改變時，重新計算（若尚未建立則略過）
const travelCountrySelect = document.getElementById('travelCountry');
if (travelCountrySelect) {
    travelCountrySelect.addEventListener('change', () => {
        updateAll();
    });
}

// 新增列上的 Travel toggle 按鈕：只控制「新資料預設是否有 Travel」
const travelToggleBtn = document.getElementById('travelToggle');
if (travelToggleBtn) {
    travelToggleBtn.addEventListener('click', () => {
        newRowTravelEnabled = !newRowTravelEnabled;
        syncTravelToggleUI();
    });
}

// 初始載入時渲染空表（顯示假表）
renderTable();
syncTravelToggleUI();
