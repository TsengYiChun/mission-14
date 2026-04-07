/* c:\Antigravity\mission-14\js\main.js */

// 同步資料並更新畫面倒影
async function syncAndRefresh() {
    try {
        ui.showLoading();
        await business.reloadData();
        
        // 依據當前選單重繪 UI
        if(document.getElementById('plans-view').classList.contains('active')) {
             if (ui.currentLevel === 'plans') ui.renderPlansList();
             else if (ui.currentLevel === 'tasks') {
                 ui.renderContextOverview('plan', ui.currentContextId);
                 ui.renderTasksList(ui.currentContextId);
             }
             else if (ui.currentLevel === 'jobs') {
                 ui.renderContextOverview('task', ui.currentContextId);
                 ui.renderJobsList(ui.currentContextId);
             }
        } else {
             ui.renderDashboard();
        }
    } catch (e) {
        console.error("資料同步失敗", e);
        ui.showToast('無法讀取最新資料', 'error');
    }
}

// 切換左側主選單 View (Dashboard vs Plans)
function switchMainView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    document.getElementById(viewId).classList.add('active');
    document.querySelector(`[data-target="${viewId}"]`).classList.add('active');
    
    const titles = {
        'dashboard-view': '總覽儀表板',
        'plans-view': '計畫與任務管理'
    };
    document.getElementById('view-title').innerText = titles[viewId];
    
    if (viewId === 'dashboard-view') {
        ui.renderDashboard();
    } else {
        ui.navigateToLevel('plans');
    }
}

function initializeApp() {
    // 確保 Google Identity API 載入完成
    if (typeof google === 'undefined' || !google.accounts) {
        setTimeout(initializeApp, 100);
        return;
    }
    
    // 初始化 Auth
    auth.init();
    
    // 當 Auth 驗證碼獲取成功後 callback
    auth.onUserLogined = async () => {
        // 切換畫面
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('app-screen').classList.add('active');
        
        ui.showToast('連線中，初始化資料中心...', 'info');
        const isInitOk = await api.initSheets();
        
        if(isInitOk) {
            await syncAndRefresh();
            // Default select dashboard
            switchMainView('dashboard-view');
        }
    };

    // Binding Login / Logout clicks
    document.getElementById('authorize_button').onclick = () => auth.login();
    document.getElementById('signout_button').onclick = () => auth.logout();

    // Menu Clicks
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const targetView = e.currentTarget.getAttribute('data-target');
            switchMainView(targetView);
        });
    });
}

document.addEventListener('DOMContentLoaded', initializeApp);
