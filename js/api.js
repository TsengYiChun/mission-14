/* c:\Antigravity\mission-14\js\api.js */

class ApiManager {
    constructor() {
        this.baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
        this.sheetMetadata = {}; // Maps Sheet Name to Sheet ID (gid)
    }

    async fetchWithAuth(url, options = {}) {
        const token = auth.getToken();
        if (!token) throw new Error('Not authenticated');

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        const response = await fetch(url, { ...options, headers });
        const result = await response.json();
        
        if (!response.ok) {
            console.error('API Error:', result);
            throw new Error(result.error?.message || 'API request failed');
        }
        return result;
    }

    // 1. 初始化與確保 Sheet 存在
    async initSheets() {
        try {
            // Get spreadsheet metadata
            const url = `${this.baseUrl}/${CONFIG.SPREADSHEET_ID}`;
            const meta = await this.fetchWithAuth(url);
            
            const existingSheets = meta.sheets.map(s => s.properties.title);
            meta.sheets.forEach(s => {
                this.sheetMetadata[s.properties.title] = s.properties.sheetId;
            });

            const requiredSheets = [
                { title: 'Plans', headers: ['ID', 'Name', 'InitialBudget', 'AdditionalBudget', 'CreatedAt'] },
                { title: 'Tasks', headers: ['ID', 'PlanID', 'Name', 'Budget', 'ActualCost', 'CreatedAt'] },
                { title: 'Jobs', headers: ['ID', 'TaskID', 'Name', 'IsCompleted', 'AllocatedAmount', 'CreatedAt'] }
            ];

            const batchRequests = [];

            for (const required of requiredSheets) {
                if (!existingSheets.includes(required.title)) {
                    batchRequests.push({
                        addSheet: { properties: { title: required.title } }
                    });
                }
            }

            if (batchRequests.length > 0) {
                const addReqResult = await this.fetchWithAuth(`${url}:batchUpdate`, {
                    method: 'POST',
                    body: JSON.stringify({ requests: batchRequests })
                });

                // Update metadata
                addReqResult.replies.forEach(reply => {
                    if (reply.addSheet && reply.addSheet.properties) {
                        this.sheetMetadata[reply.addSheet.properties.title] = reply.addSheet.properties.sheetId;
                    }
                });

                // Write headers for newly created sheets
                for (const required of requiredSheets) {
                    if (!existingSheets.includes(required.title)) {
                        await this.updateRange(`${required.title}!A1:Z1`, [required.headers]);
                    }
                }
            }
            return true;
        } catch (error) {
            console.error("初始化 Google Sheets 失敗", error);
            ui.showToast("無法連接至 Google 試算表，請確認權限或 ID。", "error");
            return false;
        }
    }

    // --- Core Operations ---
    
    // 讀取特定 Sheet 的所有資料
    async readSheet(sheetName) {
        const url = `${this.baseUrl}/${CONFIG.SPREADSHEET_ID}/values/${sheetName}?valueRenderOption=UNFORMATTED_VALUE`;
        const result = await this.fetchWithAuth(url);
        
        const rows = result.values || [];
        if (rows.length === 0) return [];

        const headers = rows[0];
        const dataRows = rows.slice(1);
        
        return dataRows.map((row, rowIndex) => {
            const obj = { _rowIndex: rowIndex + 2 }; // +2 because 1-based and header
            headers.forEach((header, index) => {
                obj[header] = row[index];
            });
            return obj;
        }).filter(item => item.ID); //過濾空行
    }

    // 寫入一筆新資料到指定 Sheet
    async appendRow(sheetName, values) {
        const url = `${this.baseUrl}/${CONFIG.SPREADSHEET_ID}/values/${sheetName}:append?valueInputOption=USER_ENTERED`;
        await this.fetchWithAuth(url, {
            method: 'POST',
            body: JSON.stringify({ values: [values] })
        });
    }

    // 修改特定範圍 (Update Row)
    async updateRange(range, values) {
        const url = `${this.baseUrl}/${CONFIG.SPREADSHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`;
        await this.fetchWithAuth(url, {
            method: 'PUT',
            body: JSON.stringify({ values })
        });
    }

    // 更新一筆資料 (知道 rowIndex 的情況)
    async updateItem(sheetName, rowIndex, valuesArray) {
        const range = `${sheetName}!A${rowIndex}`;
        await this.updateRange(range, [valuesArray]);
    }

    // 刪除一筆資料 (使用 batchUpdate 的 DeleteDimensionRequest)
    async deleteRow(sheetName, rowIndex) {
        const sheetId = this.sheetMetadata[sheetName];
        if (sheetId === undefined) throw new Error("Unknown Sheet Name for deletion");
        
        const url = `${this.baseUrl}/${CONFIG.SPREADSHEET_ID}:batchUpdate`;
        await this.fetchWithAuth(url, {
            method: 'POST',
            body: JSON.stringify({
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: "ROWS",
                                startIndex: rowIndex - 1, // 0-based, inclusive
                                endIndex: rowIndex        // 0-based, exclusive
                            }
                        }
                    }
                ]
            })
        });
    }

    // 生成 UUID
    generateId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
}

const api = new ApiManager();
