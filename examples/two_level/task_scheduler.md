### diff
```diff
## file: 'services/TaskScheduler.js'
@@ -22,28 +22,52 @@
   scheduleTask(taskId, cronExpression, handler, options = {}) {
-    if (this.tasks.has(taskId)) {
-      throw new Error('Task already scheduled');
+    const taskKey = this.generateTaskKey(taskId, options.namespace);
+    
+    if (this.tasks.has(taskKey)) {
+      this.cancelTask(taskKey);
     }
     
-    const job = cron.schedule(cronExpression, async () => {
-      await this.executeTask(taskId, handler);
-    }, {
-      scheduled: false
-    });
+    const taskConfig = {
+      id: taskId,
+      expression: cronExpression,
+      handler,
+      retries: 0,
+      maxRetries: options.maxRetries || 3,
+      lastRun: null,
+      nextRun: this.getNextRunTime(cronExpression),
+      status: 'scheduled',
+      metadata: options.metadata || {},
+      priority: options.priority || 'normal'
+    };
     
-    this.tasks.set(taskId, job);
-    job.start();
+    const job = this.createJob(taskConfig);
+    this.tasks.set(taskKey, { job, config: taskConfig });
+    
+    if (options.immediate) {
+      this.executeTask(taskKey);
+    }
+    
+    return taskKey;
   }
 
-  async executeTask(taskId, handler) {
-    const startTime = Date.now();
+  createJob(config) {
+    return cron.schedule(config.expression, async () => {
+      await this.processTaskExecution(config);
+    }, {
+      scheduled: true,
+      timezone: config.metadata.timezone || 'UTC'
+    });
+  }
+
+  async processTaskExecution(config) {
+    const taskKey = this.generateTaskKey(config.id, config.metadata.namespace);
+    const task = this.tasks.get(taskKey);
+    
+    if (!task || task.config.status === 'running') {
+      return;
+    }
     
+    task.config.status = 'running';
+    task.config.lastRun = new Date();
+
     try {
-      await handler();
-      this.emit('task:completed', { taskId, duration: Date.now() - startTime });
+      const context = this.buildContext(task.config);
+      await task.config.handler(context);
+      
+      task.config.status = 'scheduled';
+      task.config.retries = 0;
+      this.emit('task:completed', { taskId: config.id });
+      
     } catch (error) {
-      this.emit('task:failed', { taskId, error });
-      throw error;
+      task.config.retries++;
+      
+      if (task.config.retries >= task.config.maxRetries) {
+        task.config.status = 'failed';
+        this.emit('task:failed', { taskId: config.id, error });
+      } else {
+        task.config.status = 'scheduled';
+        setTimeout(() => this.processTaskExecution(config), 
+          Math.pow(2, task.config.retries) * 1000);
+      }
     }
   }
 
+  buildContext(config) {
+    return {
+      taskId: config.id,
+      metadata: config.metadata,
+      lastRun: config.lastRun,
+      retryCount: config.retries,
+      isRetry: config.retries > 0
+    };
+  }
+
   cancelTask(taskId) {
-    const job = this.tasks.get(taskId);
-    if (job) {
-      job.stop();
-      this.tasks.delete(taskId);
+    const task = this.tasks.get(taskId);
+    if (task && task.job) {
+      task.job.stop();
+      task.config.status = 'cancelled';
+      this.tasks.delete(taskId);
     }
   }
 
-  updateSchedule(taskId, newExpression) {
-    const job = this.tasks.get(taskId);
-    if (!job) {
-      throw new Error('Task not found');
-    }
+  async updateSchedule(taskId, newExpression, options = {}) {
+    const taskKey = this.generateTaskKey(taskId, options.namespace);
+    const task = this.tasks.get(taskKey);
     
-    job.stop();
-    job.cronExpression = newExpression;
-    job.start();
+    if (!task) {
+      throw new Error('Task not found');
+    }
+    
+    // Recreate job with new expression
+    task.job.stop();
+    task.config.expression = newExpression;
+    task.config.nextRun = this.getNextRunTime(newExpression);
+    
+    const newJob = this.createJob(task.config);
+    task.job = newJob;
+    
+    return taskKey;
   }
 
+  generateTaskKey(taskId, namespace) {
+    return namespace ? `${namespace}:${taskId}` : taskId;
+  }
```

### files
```
<!-- services/TaskScheduler.js -->
<- CUT CONTENT ->
22:   scheduleTask(taskId, cronExpression, handler, options = {}) {
23:     const taskKey = this.generateTaskKey(taskId, options.namespace);
24:     
25:     if (this.tasks.has(taskKey)) {
26:       this.cancelTask(taskKey);
27:     }
28:     
29:     const taskConfig = {
30:       id: taskId,
31:       expression: cronExpression,
32:       handler,
33:       retries: 0,
34:       maxRetries: options.maxRetries || 3,
35:       lastRun: null,
36:       nextRun: this.getNextRunTime(cronExpression),
37:       status: 'scheduled',
38:       metadata: options.metadata || {},
39:       priority: options.priority || 'normal'
40:     };
41:     
42:     const job = this.createJob(taskConfig);
43:     this.tasks.set(taskKey, { job, config: taskConfig });
44:     
45:     if (options.immediate) {
46:       this.executeTask(taskKey);
47:     }
48:     
49:     return taskKey;
50:   }
51: 
52:   createJob(config) {
53:     return cron.schedule(config.expression, async () => {
54:       await this.processTaskExecution(config);
55:     }, {
56:       scheduled: true,
57:       timezone: config.metadata.timezone || 'UTC'
58:     });
59:   }
60: 
61:   async processTaskExecution(config) {
62:     const taskKey = this.generateTaskKey(config.id, config.metadata.namespace);
63:     const task = this.tasks.get(taskKey);
64:     
65:     if (!task || task.config.status === 'running') {
66:       return;
67:     }
68:     
69:     task.config.status = 'running';
70:     task.config.lastRun = new Date();
71: 
72:     try {
73:       const context = this.buildContext(task.config);
74:       await task.config.handler(context);
75:       
76:       task.config.status = 'scheduled';
77:       task.config.retries = 0;
78:       this.emit('task:completed', { taskId: config.id });
79:       
80:     } catch (error) {
81:       task.config.retries++;
82:       
83:       if (task.config.retries >= task.config.maxRetries) {
84:         task.config.status = 'failed';
85:         this.emit('task:failed', { taskId: config.id, error });
86:       } else {
87:         task.config.status = 'scheduled';
88:         setTimeout(() => this.processTaskExecution(config), 
89:           Math.pow(2, task.config.retries) * 1000);
90:       }
91:     }
92:   }
<- CUT CONTENT ->
94:   buildContext(config) {
95:     return {
96:       taskId: config.id,
97:       metadata: config.metadata,
98:       lastRun: config.lastRun,
99:       retryCount: config.retries,
100:      isRetry: config.retries > 0
101:    };
102:  }
<- CUT CONTENT ->
108:  cancelTask(taskId) {
109:    const task = this.tasks.get(taskId);
110:    if (task && task.job) {
111:      task.job.stop();
112:      task.config.status = 'cancelled';
113:      this.tasks.delete(taskId);
114:    }
115:  }
116:
117:  async updateSchedule(taskId, newExpression, options = {}) {
118:    const taskKey = this.generateTaskKey(taskId, options.namespace);
119:    const task = this.tasks.get(taskKey);
120:    
121:    if (!task) {
122:      throw new Error('Task not found');
123:    }
124:    
125:    // Recreate job with new expression
126:    task.job.stop();
127:    task.config.expression = newExpression;
128:    task.config.nextRun = this.getNextRunTime(newExpression);
129:    
130:    const newJob = this.createJob(task.config);
131:    task.job = newJob;
132:    
133:    return taskKey;
134:  }
135:
136:  generateTaskKey(taskId, namespace) {
137:    return namespace ? `${namespace}:${taskId}` : taskId;
138:  }
<- CUT CONTENT ->

<!-- services/BackupService.js -->
<- CUT CONTENT ->
45: class BackupService {
46:   constructor(scheduler) {
47:     this.scheduler = scheduler;
48:   }
49:   
50:   async setupDailyBackup() {
51:     // Schedule daily backup at 2 AM
52:     this.scheduler.scheduleTask('daily-backup', '0 2 * * *', 
53:       async () => {
54:         await this.performBackup();
55:       }, {
56:         maxRetries: 5,
57:         metadata: { type: 'database' }
58:       }
59:     );
60:   }
61:   
62:   async performBackup() {
63:     const startTime = Date.now();
64:     
65:     // Heavy operation that might take long
66:     await this.backupDatabase();
67:     await this.backupFiles();
68:     
69:     // If this takes > 24h, next scheduled run happens during execution!
70:     console.log(`Backup completed in ${Date.now() - startTime}ms`);
71:   }
72:   
73:   async updateBackupSchedule(newTime) {
74:     // updateSchedule now requires namespace in options!
75:     await this.scheduler.updateSchedule('daily-backup', newTime);
76:   }
<- CUT CONTENT ->

<!-- services/ReportGenerator.js -->
<- CUT CONTENT ->
89: class ReportGenerator {
90:   constructor(scheduler) {
91:     this.scheduler = scheduler;
92:     this.reportTasks = new Map();
93:   }
94:   
95:   scheduleReport(reportId, schedule, reportConfig) {
96:     const handler = async (context) => {
97:       // Context now has different structure
98:       if (context.lastRun) {
99:         const data = await this.fetchDataSince(context.lastRun);
100:        await this.generateReport(reportId, data);
101:      }
102:    };
103:    
104:    // Uses namespace to organize reports
105:    const taskKey = this.scheduler.scheduleTask(reportId, schedule, handler, {
106:      namespace: 'reports',
107:      metadata: reportConfig
108:    });
109:    
110:    // Stores taskId but gets back taskKey!
111:    this.reportTasks.set(reportId, reportId);
112:  }
113:  
114:  cancelReport(reportId) {
115:    const taskId = this.reportTasks.get(reportId);
116:    // This won't work - needs 'reports:reportId'
117:    this.scheduler.cancelTask(taskId);
118:  }
<- CUT CONTENT ->

<!-- workers/MaintenanceWorker.js -->
<- CUT CONTENT ->
123: class MaintenanceWorker {
124:   constructor(scheduler) {
125:     this.scheduler = scheduler;
126:   }
127:   
128:   async initialize() {
129:     // Schedule cleanup every hour
130:     this.scheduler.scheduleTask('cleanup', '0 * * * *', 
131:       async (context) => {
132:         // Cleanup modifies scheduler tasks!
133:         await this.cleanupOldTasks();
134:       }, {
135:         immediate: true  // Runs immediately AND on schedule
136:       }
137:     );
138:   }
139:   
140:   async cleanupOldTasks() {
141:     // Iterates and modifies tasks collection
142:     for (const [taskId, task] of this.scheduler.tasks) {
143:       if (task.config.status === 'failed') {
144:         this.scheduler.cancelTask(taskId);
145:       }
146:     }
147:   }
<- CUT CONTENT ->

<!-- services/NotificationScheduler.js -->
<- CUT CONTENT ->
156: class NotificationScheduler {
157:   constructor(scheduler) {
158:     this.scheduler = scheduler;
159:   }
160:   
161:   scheduleRecurringNotification(userId, schedule, message) {
162:     let executionCount = 0;
163:     
164:     this.scheduler.scheduleTask(`notify-${userId}`, schedule,
165:       async (context) => {
166:         executionCount++;
167:         
168:         // Config object is shared - this creates closure!
169:         if (executionCount > 10) {
170:           // Tries to cancel itself while running
171:           this.scheduler.cancelTask(`notify-${userId}`);
172:         }
173:         
174:         await this.sendNotification(userId, message);
175:       }, {
176:         metadata: { userId, originalMessage: message }
177:       }
178:     );
179:   }
<- CUT CONTENT ->
```

### suggestions.json
```
{
    "overallSummary": "Este PR refatora o TaskScheduler adicionando namespaces, contexto de execução e melhor handling de retries. Foram identificados quatro problemas críticos: processTaskExecution usa config por referência causando estado compartilhado entre execuções, updateSchedule não preserva o job em execução, status 'running' previne retry automático, e iteração sobre tasks durante modificação causa erro.",
    "codeSuggestions": [
        {
            "relevantFile": "services/TaskScheduler.js",
            "language": "javascript",
            "suggestionContent": "O createJob passa config diretamente para processTaskExecution, mas o objeto é compartilhado e modificado (linha 69-70, 81). NotificationScheduler (linha 166) usa closure com executionCount que persiste entre execuções. Cada execução vê e modifica o mesmo objeto config. Após algumas execuções, config.retries acumula incorretamente, quebrando a lógica de retry.",
            "existingCode": "createJob(config) {\n  return cron.schedule(config.expression, async () => {\n    await this.processTaskExecution(config);\n  }, {",
            "improvedCode": "createJob(config) {\n  return cron.schedule(config.expression, async () => {\n    // Pass a copy to avoid shared state\n    await this.processTaskExecution({...config});\n  }, {",
            "oneSentenceSummary": "Clone config antes de passar para processTaskExecution para evitar estado compartilhado",
            "relevantLinesStart": 52,
            "relevantLinesEnd": 54,
            "label": "potential_issues"
        },
        {
            "relevantFile": "services/TaskScheduler.js",
            "language": "javascript",
            "suggestionContent": "O updateSchedule para o job antigo mas não verifica se está executando. Se BackupService.performBackup (linha 66-71) demora horas e updateBackupSchedule é chamado durante execução, o job é parado no meio, mas processTaskExecution continua rodando. O novo job pode iniciar enquanto o antigo ainda processa, causando execuções paralelas do mesmo backup.",
            "existingCode": "// Recreate job with new expression\ntask.job.stop();\ntask.config.expression = newExpression;\ntask.config.nextRun = this.getNextRunTime(newExpression);\n\nconst newJob = this.createJob(task.config);\ntask.job = newJob;",
            "improvedCode": "// Check if task is running before stopping\nif (task.config.status === 'running') {\n  throw new Error('Cannot update schedule while task is running');\n}\n\n// Recreate job with new expression\ntask.job.stop();\ntask.config.expression = newExpression;\ntask.config.nextRun = this.getNextRunTime(newExpression);\n\nconst newJob = this.createJob(task.config);\ntask.job = newJob;",
            "oneSentenceSummary": "Verifique se task está rodando antes de atualizar schedule",
            "relevantLinesStart": 125,
            "relevantLinesEnd": 131,
            "label": "logic_error"
        },
        {
            "relevantFile": "services/TaskScheduler.js",
            "language": "javascript",
            "suggestionContent": "Quando retry é agendado via setTimeout (linha 88), o status volta para 'scheduled', mas a verificação na linha 65 previne execução se status for 'running'. Se o processo morrer após marcar 'running' mas antes de completar, a task fica travada eternamente em 'running'. BackupService nunca mais executa após uma falha catastrófica.",
            "existingCode": "if (!task || task.config.status === 'running') {\n  return;\n}",
            "improvedCode": "if (!task) {\n  return;\n}\n\n// Add timeout check for stuck tasks\nif (task.config.status === 'running') {\n  const runningTime = Date.now() - task.config.lastRun;\n  if (runningTime < 3600000) { // 1 hour timeout\n    return;\n  }\n  // Reset stuck task\n  task.config.status = 'scheduled';\n}",
            "oneSentenceSummary": "Adicione timeout para resetar tasks travadas em status 'running'",
            "relevantLinesStart": 65,
            "relevantLinesEnd": 67,
            "label": "potential_issues"
        },
        {
            "relevantFile": "services/TaskScheduler.js",
            "language": "javascript",
            "suggestionContent": "MaintenanceWorker.cleanupOldTasks (linha 142-146) itera sobre this.scheduler.tasks e chama cancelTask durante iteração. cancelTask deleta da Map (linha 113), causando erro de iteração. Além disso, o immediate:true (linha 135) faz cleanup rodar imediatamente e pode deletar tasks que acabaram de ser agendadas mas ainda não executaram.",
            "existingCode": "cancelTask(taskId) {\n  const task = this.tasks.get(taskId);\n  if (task && task.job) {\n    task.job.stop();\n    task.config.status = 'cancelled';\n    this.tasks.delete(taskId);\n  }\n}",
            "improvedCode": "cancelTask(taskId) {\n  const task = this.tasks.get(taskId);\n  if (task && task.job) {\n    task.job.stop();\n    task.config.status = 'cancelled';\n    // Mark for deletion instead of immediate delete\n    task.config.markedForDeletion = true;\n    // Actual deletion happens in a cleanup cycle\n  }\n}",
            "oneSentenceSummary": "Marque tasks para deleção em vez de deletar durante iteração",
            "relevantLinesStart": 108,
            "relevantLinesEnd": 115,
            "label": "error_handling"
        }
    ]
}```