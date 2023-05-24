import { postEvent, _postData } from "./interface/postEvent";
import { jsonMessage } from "./interface/lineMessage";

const LINE_TOKEN = PropertiesService.getScriptProperties().getProperty('LINEKEY');    // LINEのAPIキーを入れてください

const LINE_ENDPOINT = "https://api.line.me/v2/bot/message/reply";

const logsheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('LOGSHEET') as string); //ログシート
const spreadsheet1 = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEETKEY1') as string); //日直シート
const spreadsheet2 = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEETKEY2') as string); //部活動シート
const spreadsheet3 = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEETKEY3') as string); //試験監督シート
const folderId = PropertiesService.getScriptProperties().getProperty('FOLDERID') as string; // 画像フォルダのID

// LINEからPOSTリクエストが渡されてきたときに実行される処理
async function doPost(e: postEvent) {
    try {
        // LINEからPOSTされるJSON形式のデータをGASで扱える形式(JSオブジェクト)に変換
        const json = JSON.parse(e.postData.contents) as jsonMessage;
        // LINE側へ応答するためのトークンを作成(LINEからのリクエストに入っているので、それを取得する)
        const reply_token = json.events[0].replyToken;
        if (typeof reply_token === 'undefined') {
            return;
        }

        // LINEから送られてきたメッセージを取得
        const user_message = json.events[0].message.text;
        setLog(user_message)
        // setLog(`${json.events[0].source.userId}：メッセージが送信されました。`);
        let replyText: any;
        if (user_message.includes("日直")) {
            // let year = new Date().getFullYear();
            // let dateStr = user_message.split("_")[1];
            // let targetMonth = dateStr.split("月")[0];
            // let targetDate = dateStr.split("月")[1].split("日")[0];
            // let target = `${year}/${("0" + targetMonth).slice(-2)}/${("0" + targetDate).slice(-2)}`;
            let target = user_message.split("　")[0];
            // const pattern = /^\d{4}\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])$/;
            // const isValidFormat = pattern.test(target);
            // if (isValidFormat) {
            let name = getColumnDatas(spreadsheet1, "予定表", 1, 6);
            let rowIndex = await searchRow(name, target, false);
            replyText = getCellValue(spreadsheet1, "予定表", rowIndex[0] + 1, 2, false);
            if (replyText) {
                lineReply(json, `${new Date(replyText).getMonth() + 1}/${new Date(replyText).getDate()} （${new Date(replyText).toLocaleDateString('ja-JP', { weekday: 'long' }).slice(0, 1)}）`, false);
            } else {
                lineReply(json, "担当日がありません。", false);
            }
            // } else {
            // lineReply(json, "日付の指定方法を確認してください。");
            // }
        } else if (user_message.includes("部活動")) {
            // 記号のインデックス検索
            // let clubStr = user_message.split("　")[1];
            let clubNames = getRowDatas(spreadsheet2, "一覧", 3, 3)
            // let columnIndex = await searchColumn(clubNames, clubStr, false);
            let targetDate = user_message.split("　")[0];
            if (targetDate.includes("日")) {
                targetDate = targetDate.split("日")[0];
            }
            let dates = getColumnDatas(spreadsheet2, "一覧", 5, 1);
            let rowIndex = await searchRow(dates, targetDate, false);
            let clubDatas = getRowDatas(spreadsheet2, "一覧", rowIndex[0] + 5, 3)
            setLog(clubDatas)
            let replyArr: {
                kigou: String;
                name: String;
                date: String;
            }[] = [];
            for (let i = 0; i < clubDatas[0].length; i++) {
                let targetClub = {
                    kigou: "",
                    name: "",
                    date: ""
                };
                if (clubDatas[0][i] !== "") {
                    targetClub.kigou = clubDatas[0][i];
                    targetClub.name = clubNames[0][i];
                    // 活動時間のインデックス検索
                    let katudouDates = getColumnDatas(spreadsheet2, clubNames[0][i], 7, 1);
                    let katudouRowIndex = await searchRow(katudouDates, targetDate, false);
                    let kaishijikan = getCellValue(spreadsheet2, clubNames[0][i], katudouRowIndex[0] + 7, 7, true); // 活動時間の取得
                    let shuuryoujikan = getCellValue(spreadsheet2, clubNames[0][i], katudouRowIndex[0] + 7, 8, true); // 終了時間の取得    
                    targetClub.date = `${kaishijikan}-${shuuryoujikan}`;
                    replyArr.push(targetClub);
                }

                if (i == clubDatas[0].length - 1) {
                    if (replyArr.length > 0) {
                        replyText = `${targetDate}日 活動予定の部活は、\n`;
                        replyArr.forEach((reply, j) => {
                            replyText += `${reply.kigou} ${reply.name} ${reply.date}\n`;
                            if (j == replyArr.length - 1) {
                                lineReply(json, replyText, false);
                            }
                        })
                    } else {
                        lineReply(json, "該当の活動はありません。", false);
                    }
                }
            }
        } else if (user_message.includes("試験監督")) {
            let target = user_message.split("　")[0];
            let name = getColumnDatas(spreadsheet3, "", 3, 3);
            let rowIndex = await searchRow(name, target, false);
            replyText = getCellValue(spreadsheet3, "", rowIndex[0] + 3, 28, false);
            if (replyText) {
                lineReply(json, replyText, false);
            } else {
                lineReply(json, "担当日がありません。", false);
            }
        } else if (user_message.includes("欠席連絡")) {
            let folder = DriveApp.getFolderById(folderId);
            let files = folder.getFiles();
            let fileUrl;
            while (files.hasNext()) {
                let file = files.next();
                let fileId = file.getId();
                fileUrl = "https://drive.google.com/uc?export=view&id=" + fileId;
            }
            if (fileUrl) {
                lineReply(json, fileUrl, true);
            } else {
                lineReply(json, "画像がありません。", false);
            }
        } else {
            lineReply(json, "質問を正確に入力してください。", false);
        }
        // let messages = await chat(`${ json.events[0].source.userId }: user`, user_message);
    } catch (err) {
        setLog(err);
    }
}

// LINEへの応答
function lineReply(json: jsonMessage, replyText: string | number, isImage: boolean) {

    // 応答用のメッセージを作成
    const message = {
        "replyToken": json.events[0].replyToken,
        "messages": [{
            "type": isImage ? "image" : "text",         // メッセージのタイプ(画像、テキストなど)
            "text": isImage ? "" : replyText,
            "originalContentUrl": isImage ? replyText : "",
            "previewImageUrl": isImage ? replyText : ""
        }] // メッセージの内容
    };
    // LINE側へデータを返す際に必要となる情報
    const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
        "method": "post",
        "headers": {
            "Content-Type": "application/json; charset=UTF-8",  // JSON形式を指定、LINEの文字コードはUTF-8
            "Authorization": "Bearer " + LINE_TOKEN           // 認証タイプはBearer(トークン利用)、アクセストークン
        },
        "payload": JSON.stringify(message)                    // 応答文のメッセージをJSON形式に変換する
    };
    // LINEへ応答メッセージを返す
    UrlFetchApp.fetch(LINE_ENDPOINT, options);
}

// シートの検索
function checkSheetExists(sheetName: string) {
    let sheets = spreadsheet1.getSheets();

    for (let i = 0; i < sheets.length; i++) {
        if (sheets[i].getName() == sheetName) {
            return true;
        }
    }

    return false;
}

// シート列データの取得
function getColumnDatas(spreadsheet: any, sheetName: string, rowNum: number, columnNum: number): string[][] {
    //シートを取得する
    let sheet;
    if (sheetName !== "") {
        sheet = spreadsheet.getSheetByName(sheetName) as GoogleAppsScript.Spreadsheet.Sheet;
    } else {
        sheet = spreadsheet.getSheets()[0];
    }
    //シート最終行の値を取得する
    // const lastRow = sheet.getLastRow();
    const lastRow = sheet.getRange(sheet.getMaxRows(), columnNum).getNextDataCell(SpreadsheetApp.Direction.UP).getRow();
    //指定したセル範囲を取得する
    const range = sheet.getRange(rowNum, columnNum, lastRow - 1);
    //セル範囲の値を取得する
    const values = range.getValues();
    return values;
}

// シート行データの取得
function getRowDatas(spreadsheet: any, sheetName: string, rowNum: number, columnNum: number): string[][] {
    //シートを取得する
    const sheet = spreadsheet.getSheetByName(sheetName) as GoogleAppsScript.Spreadsheet.Sheet;
    //シート最終列の値を取得する
    const lastCol = sheet.getRange(rowNum, sheet.getMaxColumns()).getNextDataCell(SpreadsheetApp.Direction.PREVIOUS).getColumn();
    //指定したセル範囲を取得する
    const range = sheet.getRange(rowNum, columnNum, 1, lastCol);
    //セル範囲の値を取得する
    const values = range.getValues();
    return values;
}

// 列の検索
function searchColumn(Arr: string[][], searchWord: string, isDate: boolean): Promise<number[]> {
    return new Promise((resolve, reject) => {
        const indexes: number[] = [];
        for (let i = 0; i < Arr[0].length; i++) {
            const isSameDate = Arr[0][i] == searchWord;
            if (isSameDate) {
                setLog(i)
                indexes.push(i);
            }
            if (i == Arr[0].length - 1) {
                resolve(indexes);
            }
        }
    })
}

// 行の検索
function searchRow(Arr: string[][], searchWord: string, isDate: boolean): Promise<number[]> {
    return new Promise((resolve, reject) => {
        const indexes: number[] = [];
        if (isDate) {
            for (let i = 0; i < Arr.length; i++) {
                const isSameDate = new Date(Arr[i][0]).getFullYear() === new Date(searchWord).getFullYear() && new Date(Arr[i][0]).getMonth() === new Date(searchWord).getMonth() && new Date(Arr[i][0]).getDate() === new Date(searchWord).getDate();
                if (isSameDate) {
                    setLog(i)
                    indexes.push(i);
                }
                if (i == Arr.length - 1) {
                    resolve(indexes);
                }
            }
        } else {
            for (let i = 0; i < Arr.length; i++) {
                const isSameDate = Arr[i][0] == searchWord;
                if (isSameDate) {
                    setLog(i)
                    indexes.push(i);
                }
                if (i == Arr.length - 1) {
                    resolve(indexes);
                }
            }
        }
    })
}

// セルの値取得
function getCellValue(spreadsheet: any, sheetName: string, rowNum: number, columnNum: number, isDisplay: boolean): string {
    //シートを取得する
    let sheet;
    if (sheetName !== "") {
        sheet = spreadsheet.getSheetByName(sheetName) as GoogleAppsScript.Spreadsheet.Sheet;
    } else {
        sheet = spreadsheet.getSheets()[0];
    }
    //シート最終行の値を取得する
    const lastRow = sheet.getLastRow();
    //指定したセル範囲を取得する
    const range = sheet.getRange(rowNum, columnNum);
    //セル範囲の値を取得する
    let values;
    if (isDisplay) {
        values = range.getDisplayValue();
    } else {
        values = range.getValue();
    }
    return values;
}

// ログの出力
function setLog(val: string | unknown) {
    const logSheet = logsheet.getSheetByName('log') as GoogleAppsScript.Spreadsheet.Sheet;
    const logLastRow = logSheet.getLastRow();
    let now = new Date();
    let jpTime = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
    logSheet.getRange(logLastRow + 1, 1).setValue(jpTime); // ログ時間出力
    logSheet.getRange(logLastRow + 1, 2).setValue(val); // ログの出力
}