/* c:\Antigravity\mission-14\js\auth.js */

class AuthManager {
    constructor() {
        this.tokenClient = null;
        this.accessToken = null;
        this.isAuthenticated = false;
        this.onUserLogined = null;
    }

    init() {
        // Init Google Identity Service Token Client
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CONFIG.CLIENT_ID,
            scope: CONFIG.SCOPES,
            callback: (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                    this.accessToken = tokenResponse.access_token;
                    this.isAuthenticated = true;
                    // 保存至 sessionStorage 避免刷新重登
                    sessionStorage.setItem('gs_access_token', this.accessToken);
                    console.log("登入成功，取得授權碼");
                    if (typeof this.onUserLogined === 'function') {
                        this.onUserLogined();
                    }
                } else {
                    console.error("登入授權失敗", tokenResponse);
                    ui.showToast('認證失敗，請重試', 'error');
                }
            },
        });

        // 檢查是否已有暫存 token
        const storedToken = sessionStorage.getItem('gs_access_token');
        if (storedToken) {
            // Verify if still valid by making a simple request later. Currently just assume it is.
            this.accessToken = storedToken;
            this.isAuthenticated = true;
        }
    }

    login() {
        if (!this.tokenClient) {
            console.error("Token client not initialized yet");
            return;
        }
        // Ask for token
        this.tokenClient.requestAccessToken({prompt: 'consent'});
    }

    logout() {
        this.accessToken = null;
        this.isAuthenticated = false;
        sessionStorage.removeItem('gs_access_token');
        ui.showToast('您已成功登出', 'success');
        
        // 切換至登入畫面
        document.getElementById('app-screen').classList.remove('active');
        document.getElementById('login-screen').classList.add('active');
    }

    getToken() {
        return this.accessToken;
    }
}

const auth = new AuthManager();
