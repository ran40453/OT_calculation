// TODO: 把下面這個 ID 換成你實際那個加班試算表的 Spreadsheet ID
// 例如：https://docs.google.com/spreadsheets/d/XXXXXXXXXXXXXXXXXXXXXXX/edit
// 裡面的 XXXXXXXXXXXXXXXXXXXXXXX 就是要填的 ID
var SPREADSHEET_ID = '1TG9aAty0ShJYhTQiB7yP_S4jcKRj57vOTFy0ZS9fHEk';

/**
 * 獲取最新匯率（使用 ExchangeRate-API）
 * @param {string} baseCurrency - 基準貨幣代碼（例如 'USD'）
 * @param {string} targetCurrency - 目標貨幣代碼（例如 'TWD'）
 * @return {number} 匯率數值
 */
function getExchangeRate(baseCurrency, targetCurrency, forceRefresh) {
  baseCurrency = baseCurrency || 'USD';
  targetCurrency = targetCurrency || 'TWD';

  // 使用 CacheService 快取匯率（6 小時有效）
  var cache = CacheService.getScriptCache();
  var cacheKey = 'rate_' + baseCurrency + '_' + targetCurrency;
  var cached = forceRefresh ? null : cache.get(cacheKey);

  if (cached) {
    Logger.log('[getExchangeRate] 使用快取匯率: %s', cached);
    return parseFloat(cached);
  }

  try {
    // 呼叫 ExchangeRate-API（免費版，無需 API Key）
    var url = 'https://api.exchangerate-api.com/v4/latest/' + baseCurrency;
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(response.getContentText());

    if (data && data.rates && data.rates[targetCurrency]) {
      var rate = data.rates[targetCurrency];
      Logger.log('[getExchangeRate] API 返回匯率: %s', rate);

      // 快取 6 小時（21600 秒）
      cache.put(cacheKey, String(rate), 21600);
      return rate;
    } else {
      Logger.log('[getExchangeRate] API 回應異常: %s', JSON.stringify(data));
    }
  } catch (err) {
    Logger.log('[getExchangeRate] API 呼叫失敗: %s', err);
  }

  // Fallback: 返回預設匯率
  Logger.log('[getExchangeRate] 使用預設匯率 30.9');
  return 30.9;
}

function getOvertimeData() {
  var ss;
  try {
    // 試圖開啟指定的 ID
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (e) {
    Logger.log('[getOvertimeData] 無法開啟 ID 為 %s 的試算表: %s', SPREADSHEET_ID, e);
    try {
      // 回退：試圖開啟連結到此腳本的試算表
      ss = SpreadsheetApp.getActiveSpreadsheet();
    } catch (e2) {
      Logger.log('[getOvertimeData] 回退開啟 ActiveSpreadsheet 也失敗: %s', e2);
    }
  }

  if (!ss) {
    Logger.log('[getOvertimeData] 找不到任何可用的試算表，返回空資料');
    return { data: [] };
  }

  var sheets = ss.getSheets();
  var sheet = sheets[0];

  // 嘗試尋找名稱包含「加班」或「加班表」的工作表
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (name.indexOf('加班') !== -1 || name.indexOf('Sheet1') !== -1) {
      sheet = sheets[i];
      break;
    }
  }

  Logger.log('[getOvertimeData] 使用工作表: %s', sheet.getName());
  var range = sheet.getDataRange();
  var values = range.getValues();

  if (!values || values.length < 2) {
    var errorMsg = '[getOvertimeData] 試算表工作表 (' + sheet.getName() + ') 為空或只有標題';
    Logger.log(errorMsg);
    return { data: [], error: errorMsg, sheetNames: sheets.map(function (s) { return s.getName(); }) };
  }

  var headers = values[0];              // 第一列標題
  var dataRows = values.slice(1);       // 之後才是資料列

  var rows = dataRows
    .filter(function (r) {
      // 只保留「有日期」的列（A 欄不為空）
      return r[0];
    })
    .map(function (r) {
      var obj = {};
      headers.forEach(function (h, i) {
        // 確保 key 一定是字串且無前後空格，例如 'date', '1.67', 'OT hr SUM'...
        var key = String(h || '').trim();
        if (key) {
          obj[key] = r[i];
        }
      });
      return obj;
    });

  Logger.log('[getOvertimeData] rows length = %s', rows.length);
  if (rows.length > 0) {
    Logger.log('[getOvertimeData] first row = %s', JSON.stringify(rows[0]));
  }

  // 💥 超重要：前端就是在等這個 { data: rows }
  var result = { data: rows };
  Logger.log('[getOvertimeData] returning = %s', JSON.stringify(result).slice(0, 300));
  return result;
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

  // 沒帶 api=1 的情況：用 Template 方式回整個 OT 畫面
  var t = HtmlService.createTemplateFromFile('index');

  // 一進頁面就先把加班資料塞進 Template，前端不用再另外呼叫 google.script.run 讀取
  var initPayload;
  try {
    initPayload = getOvertimeData();
  } catch (err) {
    Logger.log('[doGet] getOvertimeData 失敗: %s', err);
    initPayload = { data: [], error: String(err) };
  }

  // 💥 重要：確保轉為字串，若失敗則傳回空物件 JSON
  var initJson;
  try {
    initJson = JSON.stringify(initPayload);
  } catch (err) {
    initJson = '{"data":[], "error":"JSON stringify failure"}';
  }

  t.INIT_DATA_JSON = initJson;

  // 提供給前端的部署標籤，對應 index.html 裡的 "<?= DEPLOY_TAG ?>"
  // 這裡用日期時間當作 build tag，方便你在前端看到目前版本
  t.DEPLOY_TAG = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');

  return t
    .evaluate()
    .setTitle('OT calculation')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
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
    // Attempt to open by ID; fallback to Active Spreadsheet if ID fails or is placeholder
    var ss;
    try {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e) {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }

    if (!ss) throw new Error('無法開啟試算表，請確認 SPREADSHEET_ID 是否正確或指令碼是否有權限存取');

    var sheet = ss.getSheets()[0];
    if (!sheet) throw new Error('找不到工作表');

    var headers = payload.headers;
    var rows = payload.rows;

    sheet.clearContents();

    if (headers && headers.length) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    if (rows && rows.length) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }

    var ssName = ss.getName();
    Logger.log('[saveOvertimeData] wrote rows = %s to %s', rows ? rows.length : 0, ssName);
    return { ok: true, wrote: rows ? rows.length : 0, sheetName: ssName };

  } catch (err) {
    Logger.log('[saveOvertimeData] error: %s', err);
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

/**
 * 獲取設定資料（從 Settings 工作表）
 */
function getSettings() {
  try {
    var ss;
    try {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e) {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }
    if (!ss) return { ok: false, error: 'Cannot find spreadsheet' };

    var sheet = ss.getSheetByName('Settings');
    if (!sheet) return { ok: true, data: {} };

    var data = sheet.getRange(1, 1).getValue();
    if (!data) return { ok: true, data: {} };

    return { ok: true, data: JSON.parse(data) };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * 儲存設定資料（至 Settings 工作表）
 */
function saveSettings(settings) {
  try {
    var ss;
    try {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e) {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }
    if (!ss) return { ok: false, error: 'Cannot find spreadsheet' };

    var sheet = ss.getSheetByName('Settings');
    if (!sheet) {
      sheet = ss.insertSheet('Settings');
      sheet.setTabColor('#FF9500');
    }

    sheet.clear();
    sheet.getRange(1, 1).setValue(JSON.stringify(settings));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var payload = JSON.parse(raw);

    var result;
    if (payload.type === 'settings' || payload.mode === 'settings') {
      result = saveSettings(payload.data || payload);
    } else {
      result = saveOvertimeData(payload);
    }

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