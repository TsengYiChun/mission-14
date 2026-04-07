/* c:\Antigravity\mission-14\js\business.js */

class BusinessLogic {
    constructor() {
        // 在前端快取記憶體資料，用來加速計算
        this.cache = {
            plans: [],
            tasks: [],
            jobs: []
        };
    }

    // 重新從資料庫載入最新狀態
    async reloadData() {
        this.cache.plans = await api.readSheet('Plans');
        this.cache.tasks = await api.readSheet('Tasks');
        this.cache.jobs = await api.readSheet('Jobs');
    }

    // --- 計算屬性 ---

    // 取得計畫總預算 (初始 + 追加)
    getPlanTotalBudget(plan) {
        return (Number(plan.InitialBudget) || 0) + (Number(plan.AdditionalBudget) || 0);
    }

    // 取得某計畫下所有任務的預算加總
    getSumOfTasksBudgetInPlan(planId, excludeTaskId = null) {
        return this.cache.tasks
            .filter(t => t.PlanID === planId && t.ID !== excludeTaskId)
            .reduce((sum, t) => sum + (Number(t.Budget) || 0), 0);
    }

    // 判斷計畫是否超出任務總預算警示狀態 (True: 任務加總大於計畫總預算)
    isPlanOverBudgetAlert(planId) {
        const plan = this.cache.plans.find(p => p.ID === planId);
        if (!plan) return false;
        
        const planTotal = this.getPlanTotalBudget(plan);
        const tasksSum = this.getSumOfTasksBudgetInPlan(planId);
        
        return tasksSum > planTotal;
    }

    // --- 預算規則驗證 ---

    /*
     * 規則 1: 單一任務預算不能超過計畫總運算的 40%
     * 回傳: { valid: boolean, message: string }
     */
    validateTaskBudgetRule40(newTaskBudget, planId) {
        const plan = this.cache.plans.find(p => p.ID === planId);
        if (!plan) return { valid: false, message: '找不到對應計畫' };
        
        const planTotal = this.getPlanTotalBudget(plan);
        const maxLimit = planTotal * 0.4;
        
        if (newTaskBudget > maxLimit) {
            return { 
                valid: false, 
                message: `不得超過單一任務上限，最高為 $${maxLimit.toLocaleString()}` 
            };
        }
        return { valid: true };
    }

    /*
     * 規則 2: 當任務預算加總超過計畫總運算的 150% 時，不得再增加任務預算
     * 回傳: { valid: boolean, message: string }
     */
    validateTaskBudgetRule150(newTaskBudget, planId, taskIdToExclude = null) {
        const plan = this.cache.plans.find(p => p.ID === planId);
        if (!plan) return { valid: false, message: '找不到對應計畫' };
        
        const planTotal = this.getPlanTotalBudget(plan);
        const currentTasksSum = this.getSumOfTasksBudgetInPlan(planId, taskIdToExclude);
        const futureSum = currentTasksSum + newTaskBudget;
        
        const hardLimit = planTotal * 1.5;
        
        if (futureSum > hardLimit) {
            return { 
                valid: false, 
                message: `任務總預算加總 (${futureSum}) 將超過計畫總預算的 150% (${hardLimit}) 限制，無法寫入。` 
            };
        }
        return { valid: true };
    }

    // --- 工作項目預算規則 ---
    
    getSumOfJobsAllocatedInTask(taskId, excludeJobId = null) {
        return this.cache.jobs
            .filter(j => j.TaskID === taskId && j.ID !== excludeJobId)
            .reduce((sum, j) => sum + (Number(j.AllocatedAmount) || 0), 0);
    }

    validateJobAllocatedAmount(newAllocatedAmount, taskId, excludeJobId = null) {
        const task = this.cache.tasks.find(t => t.ID === taskId);
        if (!task) return { valid: false, message: '找不到對應任務' };
        
        const taskBudget = Number(task.Budget) || 0;
        const currentSum = this.getSumOfJobsAllocatedInTask(taskId, excludeJobId);
        const futureSum = currentSum + newAllocatedAmount;
        
        if (futureSum > taskBudget) {
            return { 
                valid: false, 
                message: `此工作配置金額 ($${newAllocatedAmount}) 加上其他工作的配置金額 ($${currentSum})，將超過專案預算總數 ($${taskBudget})，這是不允許的行為。` 
            };
        }
        return { valid: true };
    }

    // 計算任務轄下「已完成工作」的總配置金額
    getCompletedJobsCostInTask(taskId) {
        return this.cache.jobs
            .filter(j => j.TaskID === taskId && (String(j.IsCompleted).toUpperCase() === 'TRUE' || j.IsCompleted === true))
            .reduce((sum, j) => sum + (Number(j.AllocatedAmount) || 0), 0);
    }

    // 計算任務總實際花費 (任務自定義的實際花費 + 轄下已完成的工作配置金額)
    getTaskTotalActualCost(taskId) {
        const task = this.cache.tasks.find(t => t.ID === taskId);
        if (!task) return 0;
        
        const manualCost = Number(task.ActualCost) || 0;
        const jobsCost = this.getCompletedJobsCostInTask(taskId);
        
        return manualCost + jobsCost;
    }

    // --- 進度計算邏輯 ---

    // 計算任務進度 (轄下已完成工作數 / 總工作數)
    getTaskProgress(taskId) {
        const jobsInTask = this.cache.jobs.filter(j => j.TaskID === taskId);
        if (jobsInTask.length === 0) return 0;
        
        const completedJobs = jobsInTask.filter(j => 
            String(j.IsCompleted).toUpperCase() === 'TRUE' || j.IsCompleted === true
        ).length;
        
        return Math.round((completedJobs / jobsInTask.length) * 100);
    }

    // 計算計畫進度 (轄下所有任務的所有工作：已完成 / 總數)
    getPlanProgress(planId) {
        const tasksInPlan = this.cache.tasks.filter(t => t.PlanID === planId).map(t => t.ID);
        if (tasksInPlan.length === 0) return 0;
        
        const jobsInPlan = this.cache.jobs.filter(j => tasksInPlan.includes(j.TaskID));
        if (jobsInPlan.length === 0) return 0;
        
        const completedJobs = jobsInPlan.filter(j => 
            String(j.IsCompleted).toUpperCase() === 'TRUE' || j.IsCompleted === true
        ).length;
        
        return Math.round((completedJobs / jobsInPlan.length) * 100);
    }
}

const business = new BusinessLogic();
