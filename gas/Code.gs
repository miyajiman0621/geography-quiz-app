const SPREADSHEET_ID = '1-sPz0B_BZQnZJ6UetdbOhc85XUUbFM3LIStfD6KQ4As';
const LOG_SHEET_NAME = 'シート1';
const SUMMARY_SHEET_NAME = '集計';
const QUESTION_SUMMARY_SHEET_NAME = '問題別集計';

const LOG_HEADERS = ['日時', '種類', '画面', '単元', '問題ID', '判定', '難度', '端末ID'];

function doGet(e) {
  return handleLog_(e);
}

function doPost(e) {
  return handleLog_(e);
}

function handleLog_(e) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet_(ss, LOG_SHEET_NAME);
  ensureLogSheet_(sheet);

  const p = (e && e.parameter) || {};
  sheet.appendRow([
    new Date(),
    p.type || '',
    p.screen || '',
    p.unit || '',
    p.questionId || '',
    p.judge || '',
    p.level || '',
    p.deviceId || ''
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupSummarySheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = getOrCreateSheet_(ss, LOG_SHEET_NAME);
  ensureLogSheet_(logSheet);

  const summarySheet = getOrCreateSheet_(ss, SUMMARY_SHEET_NAME);
  const questionSheet = getOrCreateSheet_(ss, QUESTION_SUMMARY_SHEET_NAME);

  setupOverviewSheet_(summarySheet);
  setupQuestionSummarySheet_(questionSheet);
  ss.setActiveSheet(summarySheet);
}

function getOrCreateSheet_(ss, sheetName) {
  return ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
}

function ensureLogSheet_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), LOG_HEADERS.length);
  const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const hasAnyHeader = currentHeaders.some(Boolean);

  if (!hasAnyHeader) {
    sheet.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]);
    sheet.setFrozenRows(1);
    return;
  }

  // 旧形式: A-G が「日時, 種類, 画面, 単元, 問題ID, 判定, 端末ID」
  // 新形式: A-H が「日時, 種類, 画面, 単元, 問題ID, 判定, 難度, 端末ID」
  if (currentHeaders[6] === '端末ID') {
    sheet.insertColumnBefore(7);
  }

  sheet.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]);
  sheet.setFrozenRows(1);
}

function setupOverviewSheet_(sheet) {
  sheet.clear();
  sheet.setFrozenRows(2);
  setWidths_(sheet, [130, 190, 40, 130, 130, 40, 150, 130, 40, 130, 130, 40, 130, 120, 120, 120, 120]);

  sheet.getRange('A1:Q1')
    .merge()
    .setValue('地理アプリ 利用状況 集計')
    .setFontSize(16)
    .setFontWeight('bold')
    .setBackground('#dbeafe')
    .setFontColor('#12325f');

  sheet.getRange('A2')
    .setValue('ログが増えると自動更新されます。人数は端末IDベースの概算です。難度列は 2026-07-09 以降のログから記録されます。')
    .setFontColor('#475569');

  sheet.getRange('A4:B4').setValues([['基本指標', '値']]);
  sheet.getRange('A5:B14').setValues([
    ['総ログ数', `=COUNTA('${LOG_SHEET_NAME}'!A2:A)`],
    ['利用端末数', `=IFERROR(COUNTA(UNIQUE(FILTER('${LOG_SHEET_NAME}'!H2:H,'${LOG_SHEET_NAME}'!H2:H<>""))),0)`],
    ['学習開始端末数', `=IFERROR(COUNTA(UNIQUE(FILTER('${LOG_SHEET_NAME}'!H2:H,'${LOG_SHEET_NAME}'!B2:B="start_quiz",'${LOG_SHEET_NAME}'!H2:H<>""))),0)`],
    ['解答した端末数', `=IFERROR(COUNTA(UNIQUE(FILTER('${LOG_SHEET_NAME}'!H2:H,'${LOG_SHEET_NAME}'!B2:B="answer",'${LOG_SHEET_NAME}'!H2:H<>""))),0)`],
    ['解答数', `=COUNTIF('${LOG_SHEET_NAME}'!B2:B,"answer")`],
    ['できた', `=COUNTIF('${LOG_SHEET_NAME}'!F2:F,"good")`],
    ['あやしい', `=COUNTIF('${LOG_SHEET_NAME}'!F2:F,"mid")`],
    ['できない', `=COUNTIF('${LOG_SHEET_NAME}'!F2:F,"bad")`],
    ['20問以上解いた端末数', `=IFERROR(COUNTIF(INDEX(QUERY('${LOG_SHEET_NAME}'!B2:H,"select H, count(E) where B='answer' and H is not null group by H label count(E) ''",0),,2),">=20"),0)`],
    ['最終更新', '=NOW()']
  ]);

  sheet.getRange('D4:E4').setValues([['イベント別', '']]);
  sheet.getRange('D5').setFormula(`=QUERY('${LOG_SHEET_NAME}'!B2:B,"select B, count(B) where B is not null group by B order by count(B) desc label B '種類', count(B) '件数'",0)`);

  sheet.getRange('G4:H4').setValues([['単元別 解答数', '']]);
  sheet.getRange('G5').setFormula(`=QUERY('${LOG_SHEET_NAME}'!B2:D,"select D, count(D) where B='answer' and D is not null group by D order by count(D) desc label D '単元', count(D) '解答数'",0)`);

  sheet.getRange('J4:K4').setValues([['難度別 解答数', '']]);
  sheet.getRange('J5').setFormula(`=QUERY('${LOG_SHEET_NAME}'!B2:G,"select G, count(G) where B='answer' and G is not null group by G order by count(G) desc label G '難度', count(G) '解答数'",0)`);

  sheet.getRange('M4:Q4').setValues([['難度別 正答状況', '', '', '', '']]);
  sheet.getRange('M5').setFormula(`=QUERY({'${LOG_SHEET_NAME}'!G2:G,'${LOG_SHEET_NAME}'!F2:F,ARRAYFORMULA(N('${LOG_SHEET_NAME}'!F2:F="good")),ARRAYFORMULA(N('${LOG_SHEET_NAME}'!F2:F="mid")),ARRAYFORMULA(N('${LOG_SHEET_NAME}'!F2:F="bad"))},"select Col1, count(Col2), sum(Col3), sum(Col4), sum(Col5) where Col1 is not null and Col2 is not null group by Col1 label Col1 '難度', count(Col2) '解答数', sum(Col3) 'できた', sum(Col4) 'あやしい', sum(Col5) 'できない'",0)`);

  sheet.getRange('A17:B17').setValues([['日別 利用状況', '']]);
  sheet.getRange('A18').setFormula(`=QUERY({ARRAYFORMULA(IF('${LOG_SHEET_NAME}'!A2:A="","",TO_DATE(INT('${LOG_SHEET_NAME}'!A2:A)))),'${LOG_SHEET_NAME}'!A2:A},"select Col1, count(Col2) where Col1 is not null group by Col1 order by Col1 label Col1 '日付', count(Col2) 'ログ数'",0)`);

  sheet.getRange('D17:E17').setValues([['開始モード別', '']]);
  sheet.getRange('D18').setFormula(`=QUERY('${LOG_SHEET_NAME}'!B2:F,"select F, count(F) where B='start_quiz' and F is not null group by F order by count(F) desc label F 'モード', count(F) '開始数'",0)`);

  sheet.getRange('G17:I17').setValues([['苦手問題候補', '', '']]);
  sheet.getRange('G18').setFormula(`=QUERY('${LOG_SHEET_NAME}'!B2:F,"select E, D, count(E) where B='answer' and (F='mid' or F='bad') and E is not null group by E, D order by count(E) desc label E '問題ID', D '単元', count(E) 'あやしい・できない数'",0)`);

  formatSummarySheet_(sheet);
}

function setupQuestionSummarySheet_(sheet) {
  sheet.clear();
  sheet.setFrozenRows(4);
  setWidths_(sheet, [155, 120, 130, 95, 80, 80, 80, 95, 95, 30, 155, 120, 95, 95]);

  sheet.getRange('A1:I1')
    .merge()
    .setValue('問題別集計')
    .setFontSize(16)
    .setFontWeight('bold')
    .setBackground('#dbeafe')
    .setFontColor('#12325f');
  sheet.getRange('A2')
    .setValue('各問題の総解答数、できた、あやしい、できない、弱点率を自動集計します。弱点率は「あやしい＋できない」÷「総解答数」です。');

  sheet.getRange('A4:I4').setValues([['問題ID', '単元', '難度', '総解答数', 'できた', 'あやしい', 'できない', '弱点率', '判定']]);
  sheet.getRange('A5').setFormula(`=QUERY({'${LOG_SHEET_NAME}'!E2:E,'${LOG_SHEET_NAME}'!D2:D,'${LOG_SHEET_NAME}'!G2:G,'${LOG_SHEET_NAME}'!F2:F,ARRAYFORMULA(N('${LOG_SHEET_NAME}'!F2:F="good")),ARRAYFORMULA(N('${LOG_SHEET_NAME}'!F2:F="mid")),ARRAYFORMULA(N('${LOG_SHEET_NAME}'!F2:F="bad"))},"select Col1, Col2, Col3, count(Col4), sum(Col5), sum(Col6), sum(Col7), (sum(Col6)+sum(Col7))/count(Col4) where Col1 is not null and Col4 is not null group by Col1, Col2, Col3 label Col1 '問題ID', Col2 '単元', Col3 '難度', count(Col4) '総解答数', sum(Col5) 'できた', sum(Col6) 'あやしい', sum(Col7) 'できない', (sum(Col6)+sum(Col7))/count(Col4) '弱点率'",0)`);

  sheet.getRange('I5:I500').setFormulaR1C1('=IF(RC[-5]="","",IF(RC[-1]>=0.5,"要確認",IF(RC[-1]>=0.3,"注意","安定")))');
  sheet.getRange('H5:H500').setNumberFormat('0.0%');

  sheet.getRange('K1:N1')
    .merge()
    .setValue('弱点率上位（5解答以上）')
    .setFontSize(16)
    .setFontWeight('bold')
    .setBackground('#fee2e2')
    .setFontColor('#7f1d1d');
  sheet.getRange('K2')
    .setValue('総解答数が5問以上ある問題だけを、弱点率の高い順に表示します。');
  sheet.getRange('K4:N4').setValues([['問題ID', '単元', '難度', '総解答数']]);
  sheet.getRange('K5').setFormula('=IFERROR(QUERY(A5:I,"select A, B, C, D where D >= 5 order by H desc label A \'問題ID\', B \'単元\', C \'難度\', D \'総解答数\'",0),"")');

  formatQuestionSummarySheet_(sheet);
}

function setWidths_(sheet, widths) {
  widths.forEach((width, index) => sheet.setColumnWidth(index + 1, width));
}

function formatSummarySheet_(sheet) {
  sheet.getRange('A4:B4').setFontWeight('bold').setBackground('#dbeafe');
  sheet.getRange('D4:E4').setFontWeight('bold').setBackground('#dbeafe');
  sheet.getRange('G4:H4').setFontWeight('bold').setBackground('#dbeafe');
  sheet.getRange('J4:K4').setFontWeight('bold').setBackground('#dbeafe');
  sheet.getRange('M4:Q4').setFontWeight('bold').setBackground('#dbeafe');
  sheet.getRange('A17:B17').setFontWeight('bold').setBackground('#dcfce7');
  sheet.getRange('D17:E17').setFontWeight('bold').setBackground('#dcfce7');
  sheet.getRange('G17:I17').setFontWeight('bold').setBackground('#dcfce7');
  sheet.getRange('A4:Q40').setBorder(true, true, true, true, true, true);
  sheet.getRange('B14').setNumberFormat('yyyy/mm/dd hh:mm');
}

function formatQuestionSummarySheet_(sheet) {
  sheet.getRange('A4:I4').setFontWeight('bold').setBackground('#dbeafe');
  sheet.getRange('K4:N4').setFontWeight('bold').setBackground('#fee2e2');
  sheet.getRange('A4:I500').setBorder(true, true, true, true, true, true);
  sheet.getRange('K4:N200').setBorder(true, true, true, true, true, true);
}
