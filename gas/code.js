function getOvertimeData() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var range = sheet.getDataRange();
  var values = range.getValues();  // 第一列 = 標題列

  var headers = values[0];
  var dataRows = values.slice(1);

  var rows = dataRows
    .filter(function(r) { return r[0]; })  // 沒日期的列就跳過
    .map(function(r) {
      var obj = {};
      headers.forEach(function(h, i) {
        obj[String(h)] = r[i];
      });
      return obj;
    });

  return { data: rows };
}

function doGet(e) {
  e = e || {};
  var params = e.parameter || {};
  var wantsApi = params.api === '1' || params.mode === 'api';

  // API 給 GitHub / OT_calculation 用
  if (wantsApi) {
    var payload = getOvertimeData();  // 你原本的讀取邏輯
    var json = JSON.stringify(payload);
    return ContentService
      .createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*');
  }

  // 沒帶 api=1 的情況：回 HtmlService（整個 OT 畫面）
  return HtmlService
    .createHtmlOutputFromFile('index') // 要跟你的 index.html 檔名一樣
    .setTitle('OT calculation')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}
/**
 * 將前端 payload 寫回試算表
 * payload 結構：
 * {
 *   headers: [..],   // 第一列欄名
 *   rows: [ [..], ... ]  // 資料列
 * }
 * 回傳：{ ok:true, wrote:<筆數> } 或 { ok:false, error:"..." }
 */
function saveOvertimeData(payload) {
  try {
    if (!payload || !payload.headers || !payload.rows) {
      return { ok: false, error: 'bad payload' };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheets()[0];  // 如需指定工作表請改這裡
    if (!sheet) throw new Error('找不到工作表');

    var headers = payload.headers;
    var rows    = payload.rows;

    sheet.clearContents();

    if (headers && headers.length) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    if (rows && rows.length) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }

    Logger.log('[saveOvertimeData] wrote rows = %s', rows ? rows.length : 0);
    return { ok: true, wrote: rows ? rows.length : 0 };

  } catch (err) {
    Logger.log('[saveOvertimeData] error: %s', err);
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

/**
 * 讓（未來如果有需要）外部可以用 POST 寫回加班資料。
 */
function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var payload = JSON.parse(raw);
    var result = saveOvertimeData(payload);

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*');
  } catch (err) {
    var res = {
      ok: false,
      error: String(err && err.message ? err.message : err)
    };
    return ContentService
      .createTextOutput(JSON.stringify(res))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*');
  }
}