function doGet(e) {
  try {
    // 1) ?ui=1 → 回 HtmlService 頁面（讓你用 /exec?ui=1 直接開整個 UI）
    if (e && e.parameter && e.parameter.ui === '1') {
      return HtmlService.createHtmlOutputFromFile('index')
        .setTitle('OT Calculation');
    }

    // 2) 準備資料（跟 getOvertimeData 一致）
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0]; // 或改 getSheetByName('工作表1')
    if (!sheet) throw new Error('找不到工作表');

    const values = sheet.getDataRange().getValues();
    const data = (values && values.length > 1)
      ? (function () {
          const headers = (values[0] || []).map(h => String(h).trim());
          return values.slice(1)
            .filter(row => row && row[0] !== '' && row[0] !== null && row[0] !== undefined)
            .map(row => {
              const obj = {};
              headers.forEach((h, idx) => {
                let v = row[idx];
                if (idx === 0) {
                  // 日期正規化：Date 物件 → YYYY-MM-DD；字串含 T → 取前 10 碼
                  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) {
                    const yyyy = v.getFullYear();
                    const mm = String(v.getMonth() + 1).padStart(2, '0');
                    const dd = String(v.getDate()).padStart(2, '0');
                    v = `${yyyy}-${mm}-${dd}`;
                  } else if (typeof v === 'string' && v.includes('T')) {
                    v = v.slice(0, 10);
                  }
                }
                obj[h] = v;
              });
              return obj;
            });
        })()
      : [];

    const payload = { data };

    // 3) ?callback=xxx → 回 JSONP：xxx({...})
    const cb = e && e.parameter && e.parameter.callback;
    if (cb) {
      const js = `${cb}(${JSON.stringify(payload)})`;
      return ContentService.createTextOutput(js)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    // 4) 否則回純 JSON
    return ContentService.createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    const cb = e && e.parameter && e.parameter.callback;
    const errPayload = { error: String(err && err.message ? err.message : err) };
    if (cb) {
      const js = `${cb}(${JSON.stringify(errPayload)})`;
      return ContentService.createTextOutput(js)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify(errPayload))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
