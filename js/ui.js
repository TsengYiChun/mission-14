/* c:\Antigravity\mission-14\js\ui.js */

class UIManager {
    constructor() {
        this.currentLevel = 'plans'; // plans, tasks, jobs
        this.currentContextId = null; // Plan ID if looking at tasks, Task ID if looking at jobs
        this.charts = {};
    }

    // --- Utility UI ---

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-exclamation'}"></i> ${message}`;
        
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    showLoading() {
        document.getElementById('data-list').innerHTML = `
            <div class="loading-spinner">
                <i class="fa-solid fa-circle-notch fa-spin"></i> 載入資料中...
            </div>`;
    }

    // --- Navigation & Views ---

    navigateToLevel(level, contextId = null, contextName = null) {
        this.currentLevel = level;
        this.currentContextId = contextId;
        
        const listContainer = document.getElementById('data-list');
        const overviewContainer = document.getElementById('context-overview');
        const btnAdd = document.getElementById('btn-add-item');
        const breadcrumbs = document.getElementById('dynamic-breadcrumbs');

        // Update Breadcrumbs
        let bHtml = `<span class="crumb ${level === 'plans' ? 'active' : ''}" onclick="ui.navigateToLevel('plans')">計畫列表</span>`;
        
        if (level === 'tasks' || level === 'jobs') {
            const plan = business.cache.plans.find(p => p.ID === (level === 'tasks' ? contextId : business.cache.tasks.find(t=>t.ID === contextId)?.PlanID));
            if(plan) {
                bHtml += `<span class="crumb ${level === 'tasks' ? 'active' : ''}" onclick="ui.navigateToLevel('tasks', '${plan.ID}', '${plan.Name}')">${plan.Name} (任務)</span>`;
            }
        }
        
        if (level === 'jobs') {
            bHtml += `<span class="crumb active">${contextName} (工作)</span>`;
        }
        
        breadcrumbs.innerHTML = bHtml;

        // Setup UI base on level
        if (level === 'plans') {
            overviewContainer.classList.add('hidden');
            btnAdd.innerHTML = '<i class="fa-solid fa-plus"></i> 新增計畫';
            btnAdd.onclick = () => this.showModal('plan');
            this.renderPlansList();
        } else if (level === 'tasks') {
            overviewContainer.classList.remove('hidden');
            btnAdd.innerHTML = '<i class="fa-solid fa-plus"></i> 新增任務';
            btnAdd.onclick = () => this.showModal('task', { PlanID: contextId });
            this.renderContextOverview('plan', contextId);
            this.renderTasksList(contextId);
        } else if (level === 'jobs') {
            overviewContainer.classList.remove('hidden');
            btnAdd.innerHTML = '<i class="fa-solid fa-plus"></i> 新增工作';
            btnAdd.onclick = () => this.showModal('job', { TaskID: contextId });
            this.renderContextOverview('task', contextId);
            this.renderJobsList(contextId);
        }
    }

    renderContextOverview(type, id) {
        const container = document.getElementById('context-overview');
        let html = '';
        
        if(type === 'plan') {
            const plan = business.cache.plans.find(p => p.ID === id);
            if(!plan) return;
            const limit = business.getPlanTotalBudget(plan);
            const sum = business.getSumOfTasksBudgetInPlan(id);
            const isAlert = business.isPlanOverBudgetAlert(id);
            
            html = `
                <div class="context-title ${isAlert ? 'val-danger' : ''}">${plan.Name}</div>
                <div class="context-details">
                    <div>計畫總預算: $${limit.toLocaleString()}</div>
                    <div>目前任務分配總額: <span class="${isAlert ? 'val-danger' : ''}">$${sum.toLocaleString()}</span></div>
                    <div>整體進度: ${business.getPlanProgress(id)}%</div>
                </div>
            `;
        } else if (type === 'task') {
            const task = business.cache.tasks.find(t => t.ID === id);
            if(!task) return;
            
            const allocatedSum = business.getSumOfJobsAllocatedInTask(id);
            const remaining = Number(task.Budget) - allocatedSum;
            
            html = `
                <div class="context-title">${task.Name}</div>
                <div class="context-details">
                    <div>任務預算: $${Number(task.Budget).toLocaleString()}</div>
                    <div>任務剩餘可配置金額: <span style="font-weight:600; color:var(--primary);">$${(remaining > 0 ? remaining : 0).toLocaleString()}</span></div>
                    <div>任務總花費: $${business.getTaskTotalActualCost(id).toLocaleString()}</div>
                    <div>執行進度: ${business.getTaskProgress(id)}%</div>
                </div>
            `;
        }
        
        container.innerHTML = html;
    }

    // --- Render Lists ---

    renderPlansList() {
        const container = document.getElementById('data-list');
        container.innerHTML = '';
        
        if (business.cache.plans.length === 0) {
            container.innerHTML = '<div class="loading-spinner">暫無計畫，請點擊右上角新增。</div>';
            return;
        }

        business.cache.plans.forEach(plan => {
            const isAlert = business.isPlanOverBudgetAlert(plan.ID);
            const totalBudget = business.getPlanTotalBudget(plan);
            const progress = business.getPlanProgress(plan.ID);
            
            const card = document.createElement('div');
            card.className = `item-card ${isAlert ? 'alert-over-budget' : ''}`;
            card.innerHTML = `
                <div class="item-header">
                    <div>
                        <div class="item-title" style="cursor:pointer" onclick="ui.navigateToLevel('tasks', '${plan.ID}', '${plan.Name}')">${plan.Name}</div>
                        <div class="item-subtitle">建立於: ${new Date(Number(plan.CreatedAt || 0)).toLocaleDateString()}</div>
                    </div>
                    <div class="item-actions">
                        <button class="btn-icon edit" onclick="ui.showModal('plan', {id: '${plan.ID}'})" title="編輯"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon delete" onclick="ui.deleteItem('plan', '${plan.ID}')" title="刪除"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <div class="item-body">
                    <div class="data-row">
                        <span class="data-label">初始預算</span>
                        <span class="data-value">$${Number(plan.InitialBudget).toLocaleString()}</span>
                    </div>
                    <div class="data-row">
                        <span class="data-label">追加預算</span>
                        <span class="data-value">$${Number(plan.AdditionalBudget).toLocaleString()}</span>
                    </div>
                    <div class="data-row" style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
                        <span class="data-label">總計畫運算</span>
                        <span class="data-value">$${totalBudget.toLocaleString()}</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-text">
                            <span>執行進度</span>
                            <span>${progress}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%"></div>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    renderTasksList(planId) {
        const container = document.getElementById('data-list');
        container.innerHTML = '';
        
        const tasks = business.cache.tasks.filter(t => t.PlanID === planId);
        
        if (tasks.length === 0) {
            container.innerHTML = '<div class="loading-spinner">該計畫下暫無任務。</div>';
            return;
        }

        tasks.forEach(task => {
            const progress = business.getTaskProgress(task.ID);
            
            const card = document.createElement('div');
            card.className = `item-card`;
            card.innerHTML = `
                <div class="item-header">
                    <div>
                        <div class="item-title" style="cursor:pointer" onclick="ui.navigateToLevel('jobs', '${task.ID}', '${task.Name}')">${task.Name}</div>
                    </div>
                    <div class="item-actions">
                        <button class="btn-icon edit" onclick="ui.showModal('task', {id: '${task.ID}'})" title="編輯"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-icon delete" onclick="ui.deleteItem('task', '${task.ID}')" title="刪除"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <div class="item-body">
                    <div class="data-row">
                        <span class="data-label">任務預算</span>
                        <span class="data-value">$${Number(task.Budget).toLocaleString()}</span>
                    </div>
                    <div class="data-row">
                        <span class="data-label">任務總花費</span>
                        <span class="data-value">$${business.getTaskTotalActualCost(task.ID).toLocaleString()}</span>
                    </div>
                    
                    <div class="progress-container">
                        <div class="progress-text">
                            <span>執行進度</span>
                            <span>${progress}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%"></div>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    renderJobsList(taskId) {
        const container = document.getElementById('data-list');
        container.innerHTML = '';
        
        const jobs = business.cache.jobs.filter(j => j.TaskID === taskId);
        
        if (jobs.length === 0) {
            container.innerHTML = '<div class="loading-spinner">此任務暫無工作項目。</div>';
            return;
        }

        jobs.forEach(job => {
            const isCompleted = String(job.IsCompleted).toUpperCase() === 'TRUE';
            
            const card = document.createElement('div');
            card.className = `item-card`;
            card.style.padding = '1rem';
            card.style.flexDirection = 'row';
            card.style.justifyContent = 'space-between';
            card.style.alignItems = 'center';
            card.innerHTML = `
                <div class="job-info" style="flex:1; display:flex; flex-direction:column; gap: 0.5rem;">
                    <div style="display:flex; align-items:center; gap: 1rem;">
                        <label class="checkbox-container" style="margin-bottom:0">
                            <input type="checkbox" onchange="ui.toggleJobStatus('${job.ID}', this.checked)" ${isCompleted ? 'checked' : ''}>
                            <span class="checkmark"></span>
                        </label>
                        <span style="font-size: 1.1rem; ${isCompleted ? 'text-decoration: line-through; color: var(--text-secondary)' : ''}">${job.Name}</span>
                    </div>
                    <div style="padding-left: 2.2rem; font-size: 0.9rem; color: var(--text-secondary);">
                        配置金額: <strong style="color:var(--text-primary);">$${Number(job.AllocatedAmount || 0).toLocaleString()}</strong>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn-icon edit" onclick="ui.showModal('job', {id: '${job.ID}'})" title="編輯"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-icon delete" onclick="ui.deleteItem('job', '${job.ID}')" title="刪除"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    // --- Modals (AUDI Add/Update) ---
    
    closeModal(type) {
        document.getElementById(`modal-${type}`).classList.remove('active');
    }

    showModal(type, options = {}) {
        const modal = document.getElementById(`modal-${type}`);
        modal.classList.add('active');
        
        // Reset form
        document.getElementById(`form-${type}`).reset();
        document.getElementById(`${type}-id`).value = '';
        
        if (type === 'plan') {
             document.getElementById('modal-plan-title').innerText = options.id ? '編輯計畫' : '新增計畫';
             if (options.id) {
                 const plan = business.cache.plans.find(p => p.ID === options.id);
                 if (plan) {
                     document.getElementById('plan-id').value = plan.ID;
                     document.getElementById('plan-name').value = plan.Name;
                     document.getElementById('plan-initial-budget').value = plan.InitialBudget;
                     document.getElementById('plan-add-budget').value = plan.AdditionalBudget;
                 }
             }
        } else if (type === 'task') {
             document.getElementById('modal-task-title').innerText = options.id ? '編輯任務' : '新增任務';
             
             let planId = options.PlanID;
             
             if (options.id) {
                 const task = business.cache.tasks.find(t => t.ID === options.id);
                 if (task) {
                     document.getElementById('task-id').value = task.ID;
                     document.getElementById('task-name').value = task.Name;
                     document.getElementById('task-budget').value = task.Budget;
                     document.getElementById('task-actual-cost').value = task.ActualCost;
                     planId = task.PlanID;
                 }
             }
             document.getElementById('task-plan-id').value = planId;
             
             // Update limit hint dynamically
             const plan = business.cache.plans.find(p => p.ID === planId);
             if(plan) {
                 const maxLimit = business.getPlanTotalBudget(plan) * 0.4;
                 document.getElementById('task-budget-hint').innerText = `單一任務上限: $${maxLimit.toLocaleString()}`;
             }
             
        } else if (type === 'job') {
             document.getElementById('modal-job-title').innerText = options.id ? '編輯工作' : '新增工作';
             let taskId = options.TaskID;
             
             if (options.id) {
                 const job = business.cache.jobs.find(j => j.ID === options.id);
                 if (job) {
                     document.getElementById('job-id').value = job.ID;
                     document.getElementById('job-name').value = job.Name;
                     document.getElementById('job-allocated-amount').value = job.AllocatedAmount || 0;
                     document.getElementById('job-is-completed').checked = (String(job.IsCompleted).toUpperCase() === 'TRUE');
                     document.getElementById('job-task-id').value = job.TaskID;
                     taskId = job.TaskID;
                 }
             } else {
                 document.getElementById('job-allocated-amount').value = '';
                 document.getElementById('job-task-id').value = options.TaskID;
             }
             
             // Update limit hint dynamically
             const task = business.cache.tasks.find(t => t.ID === taskId);
             if (task) {
                 const allocatedSum = business.getSumOfJobsAllocatedInTask(taskId, options.id ? options.id : null);
                 const remaining = Number(task.Budget) - allocatedSum;
                 document.getElementById('job-allocated-hint').innerText = `剩餘可配置金額: $${(remaining > 0 ? remaining : 0).toLocaleString()}`;
             }
        }
    }

    // --- Save Actions ---

    async savePlan() {
        const id = document.getElementById('plan-id').value;
        const name = document.getElementById('plan-name').value;
        const initial = Number(document.getElementById('plan-initial-budget').value);
        const add = Number(document.getElementById('plan-add-budget').value);
        
        if(!name) return this.showToast('請填寫計畫名稱', 'error');

        document.getElementById('modal-plan').querySelector('.btn-primary').disabled = true;
        this.showToast('正在儲存，請稍候...', 'info');

        try {
            if (id) {
                // Update
                const rowIndex = business.cache.plans.find(p => p.ID === id)._rowIndex;
                const createdAt = business.cache.plans.find(p => p.ID === id).CreatedAt;
                await api.updateItem('Plans', rowIndex, [id, name, initial, add, createdAt]);
            } else {
                // Add
                const newId = api.generateId();
                await api.appendRow('Plans', [newId, name, initial, add, Date.now()]);
            }
            
            await syncAndRefresh();
            this.closeModal('plan');
            this.showToast('計畫已成功儲存');
        } catch(e) {
            this.showToast(e.message, 'error');
        } finally {
            document.getElementById('modal-plan').querySelector('.btn-primary').disabled = false;
        }
    }

    async saveTask() {
        const id = document.getElementById('task-id').value;
        const planId = document.getElementById('task-plan-id').value;
        const name = document.getElementById('task-name').value;
        const budget = Number(document.getElementById('task-budget').value);
        const actual = Number(document.getElementById('task-actual-cost').value);
        
        if(!name) return this.showToast('請填寫任務名稱', 'error');

        // ==== 預算驗證 (Budget Validation) ====
        
        // Rule 1: 40% 單一限制
        const limitCheck40 = business.validateTaskBudgetRule40(budget, planId);
        if (!limitCheck40.valid) {
            return this.showToast(limitCheck40.message, 'error');
        }
        
        // Rule 2: 150% 總和限制
        const limitCheck150 = business.validateTaskBudgetRule150(budget, planId, id ? id : null);
        if (!limitCheck150.valid) {
            return this.showToast(limitCheck150.message, 'error');
        }
        
        // ==== 預算驗證通過 ====

        document.getElementById('modal-task').querySelector('.btn-primary').disabled = true;
        this.showToast('正在儲存，請稍候...', 'info');

        try {
            if (id) {
                const rowIndex = business.cache.tasks.find(p => p.ID === id)._rowIndex;
                const createdAt = business.cache.tasks.find(p => p.ID === id).CreatedAt;
                await api.updateItem('Tasks', rowIndex, [id, planId, name, budget, actual, createdAt]);
            } else {
                const newId = api.generateId();
                await api.appendRow('Tasks', [newId, planId, name, budget, actual, Date.now()]);
            }
            
            await syncAndRefresh();
            this.closeModal('task');
            this.showToast('任務已成功儲存');
        } catch(e) {
            this.showToast(e.message, 'error');
        } finally {
            document.getElementById('modal-task').querySelector('.btn-primary').disabled = false;
        }
    }

    async saveJob() {
        const id = document.getElementById('job-id').value;
        const taskId = document.getElementById('job-task-id').value;
        const name = document.getElementById('job-name').value;
        const allocated = Number(document.getElementById('job-allocated-amount').value);
        const isCompleted = document.getElementById('job-is-completed').checked;
        
        if(!name) return this.showToast('請填寫工作名稱', 'error');

        // Validation
        const limitCheck = business.validateJobAllocatedAmount(allocated, taskId, id ? id : null);
        if (!limitCheck.valid) {
            return this.showToast(limitCheck.message, 'error');
        }

        document.getElementById('modal-job').querySelector('.btn-primary').disabled = true;
        this.showToast('正在儲存，請稍候...', 'info');

        try {
            if (id) {
                const rowIndex = business.cache.jobs.find(p => p.ID === id)._rowIndex;
                const createdAt = business.cache.jobs.find(p => p.ID === id).CreatedAt;
                await api.updateItem('Jobs', rowIndex, [id, taskId, name, isCompleted ? 'TRUE':'FALSE', allocated, createdAt]);
            } else {
                const newId = api.generateId();
                await api.appendRow('Jobs', [newId, taskId, name, isCompleted ? 'TRUE':'FALSE', allocated, Date.now()]);
            }
            
            await syncAndRefresh();
            this.closeModal('job');
            this.showToast('工作已成功儲存');
        } catch(e) {
            this.showToast(e.message, 'error');
        } finally {
            document.getElementById('modal-job').querySelector('.btn-primary').disabled = false;
        }
    }

    async deleteItem(type, id) {
        if(!confirm(`確定要刪除這筆資料嗎？`)) return;
        
        this.showToast('正在刪除，請稍候...', 'info');
        try {
            let cacheSource = [];
            let sheetName = '';
            if(type === 'plan') { cacheSource = business.cache.plans; sheetName = 'Plans'; }
            if(type === 'task') { cacheSource = business.cache.tasks; sheetName = 'Tasks'; }
            if(type === 'job') { cacheSource = business.cache.jobs; sheetName = 'Jobs'; }

            const target = cacheSource.find(item => item.ID === id);
            if(target) {
                await api.deleteRow(sheetName, target._rowIndex);
                await syncAndRefresh();
                this.showToast('刪除成功');
            }
        } catch(e) {
             this.showToast('刪除失敗: ' + e.message, 'error');
        }
    }

    async toggleJobStatus(id, isCompleted) {
        try {
            const job = business.cache.jobs.find(j => j.ID === id);
            if(job) {
                 await api.updateItem('Jobs', job._rowIndex, [job.ID, job.TaskID, job.Name, isCompleted ? 'TRUE' : 'FALSE', job.AllocatedAmount || 0, job.CreatedAt]);
                 await syncAndRefresh();
            }
        } catch (e) {
            this.showToast('狀態更新失敗: ' + e.message, 'error');
        }
    }

    // --- Dashboard & Charts ---
    
    renderDashboard() {
        // Update basic counts
        document.getElementById('stat-total-plans').innerText = business.cache.plans.length;
        document.getElementById('stat-total-tasks').innerText = business.cache.tasks.length;
        
        let totalSystemBudget = business.cache.plans.reduce((sum, p) => sum + business.getPlanTotalBudget(p), 0);
        document.getElementById('stat-total-budget').innerText = `$${totalSystemBudget.toLocaleString()}`;

        // Global Budget vs Actual pie chart calculation
        let projectTotalBudget = totalSystemBudget;
        let projectTotalActualCost = business.cache.tasks.reduce((sum, t) => sum + business.getTaskTotalActualCost(t.ID), 0);
        let projectRemainingBudget = projectTotalBudget - projectTotalActualCost;
        if (projectRemainingBudget < 0) projectRemainingBudget = 0; // Prevent negative slices

        // Global Jobs completion calculation
        let totalCompletedJobs = business.cache.jobs.filter(j => String(j.IsCompleted).toUpperCase() === 'TRUE').length;
        let totalIncompleteJobs = business.cache.jobs.length - totalCompletedJobs;

        // Chart 1: Plan Budget Pie
        const ctxBudget = document.getElementById('dashboardPlanBudgetChart');
        if(this.charts.budget) this.charts.budget.destroy();
        
        this.charts.budget = new Chart(ctxBudget, {
            type: 'doughnut',
            data: {
                labels: ['實際花費累積', '預算餘額'],
                datasets: [
                    {
                        data: [projectTotalActualCost, projectRemainingBudget],
                        backgroundColor: ['#ef4444', '#3b82f6'],
                        borderWidth: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                color: '#64748b',
                plugins: {
                    legend: { labels: { color: '#1e293b' } }
                }
            }
        });

        // Chart 2: Plan Progress
        const ctxProgress = document.getElementById('dashboardProgressChart');
        if(this.charts.progress) this.charts.progress.destroy();
        
        this.charts.progress = new Chart(ctxProgress, {
            type: 'doughnut',
            data: {
                labels: ['已執行工作數', '未執行工作數'],
                datasets: [{
                    data: [totalCompletedJobs, totalIncompleteJobs],
                    backgroundColor: ['#10b981', '#cbd5e1'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                color: '#64748b',
                plugins: {
                    legend: { position: 'right', labels: { color: '#1e293b' } }
                }
            }
        });
    }
}

const ui = new UIManager();
