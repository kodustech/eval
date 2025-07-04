## Example 007 - Task Queue Processor (Edit)

### diff
```diff
## file: 'services/TaskQueueProcessor.js'

@@ -48,8 +48,11 @@
 
+    await this.runMiddleware(enhancedTask, 'beforeAdd');
+    
     this.queue.push(enhancedTask);
     
-    this.processNext();
+    if (!this.paused && this.active.length < this.concurrency) {
+      this.processNext();
+    }
 
     return enhancedTask.id;
@@ -57,12 +60,17 @@
   }
 
   async addBatch(tasks) {
-    const promises = tasks.map(task => this.addTask(task));
-    return Promise.all(promises);
+    const taskIds = [];
+    
+    for (const task of tasks) {
+      try {
+        const id = await this.addTask(task);
+        taskIds.push(id);
+      } catch (error) {
+        console.error(`Failed to add task:`, error);
+      }
+    }
+    
+    return taskIds;
   }
 
   async processNext() {
@@ -74,8 +82,16 @@
     const task = this.queue.shift();
     this.active.push(task);
 
-    await this.processTask(task);
-    this.active = this.active.filter(t => t.id !== task.id);
+    try {
+      await this.processTask(task);
+    } finally {
+      const index = this.active.indexOf(task);
+      if (index > -1) {
+        this.active.splice(index, 1);
+      }
+      
+      if (this.queue.length > 0) {
+        this.processNext();
+      }
+    }
   }
 
@@ -101,7 +117,10 @@
     task.startedAt = Date.now();
 
     try {
-      const result = await handler(task.data);
+      await this.runMiddleware(task, 'beforeProcess');
+
+      const timeoutPromise = new Promise((_, reject) => {
+        setTimeout(() => reject(new Error('Task timeout')), this.timeout);
+      });
+
+      const result = await Promise.race([
+        handler(task.data),
+        timeoutPromise
+      ]);
 
       task.status = 'completed';
@@ -111,6 +130,8 @@
       const processingTime = task.completedAt - task.startedAt;
       this.metrics.processingTimes.push(processingTime);
       this.metrics.totalProcessed++;
-      this.metrics.averageTime = this.calculateAverageTime();
+      this.updateAverageTime();
+      
+      await this.runMiddleware(task, 'afterProcess');
       
       this.completed.push(task);
@@ -125,8 +146,11 @@
       if (task.attempts < this.retryLimit) {
         task.status = 'pending';
-        // Re-add to queue for retry
-        this.queue.unshift(task);
+        setTimeout(() => {
+          this.queue.unshift(task);
+          if (!this.paused && this.active.length < this.concurrency) {
+            this.processNext();
+          }
+        }, this.retryDelay * task.attempts);
       } else {
         task.status = 'failed';
@@ -134,15 +158,26 @@
         this.failed.push(task);
         this.metrics.totalFailed++;
+        
+        await this.runMiddleware(task, 'afterFail');
       }
     }
   }
 
-  calculateAverageTime() {
-    if (this.metrics.processingTimes.length === 0) return 0;
-    
-    const sum = this.metrics.processingTimes.reduce((acc, time) => acc + time, 0);
-    return sum / this.metrics.processingTimes.length;
+  async runMiddleware(task, phase) {
+    for (const middleware of this.middleware) {
+      if (middleware.phase === phase) {
+        await middleware.fn(task);
+      }
+    }
+  }
+
+  updateAverageTime() {
+    const times = this.metrics.processingTimes.slice(-100);
+    const sum = times.reduce((acc, time) => acc + time, 0);
+    this.metrics.averageTime = sum / times.length;
   }
 
   pause() {
@@ -154,7 +189,7 @@
     this.paused = false;
     
-    // Process any pending tasks up to concurrency limit
-    while (this.active.length < this.concurrency && this.queue.length > 0) {
+    const availableSlots = this.concurrency - this.active.length;
+    for (let i = 0; i < availableSlots && i < this.queue.length; i++) {
       this.processNext();
     }
```

### files
```
<!-- services/TaskQueueProcessor.js -->
<- CUT CONTENT ->
31:   use(middlewareFn) {
32:     this.middleware.push(middlewareFn);
33:   }
<- CUT CONTENT ->
74:   async processNext() {
75:     if (this.paused || this.queue.length === 0 || this.active.length >= this.concurrency) {
76:       return;
77:     }
78:
79:     const task = this.queue.shift();
80:     this.active.push(task);
81:
82:     try {
83:       await this.processTask(task);
84:     } finally {
85:       const index = this.active.indexOf(task);
86:       if (index > -1) {
87:         this.active.splice(index, 1);
88:       }
89:       
90:       if (this.queue.length > 0) {
91:         this.processNext();
92:       }
93:     }
94:   }
<- CUT CONTENT ->
164:   async runMiddleware(task, phase) {
165:     for (const middleware of this.middleware) {
166:       if (middleware.phase === phase) {
167:         await middleware.fn(task);
168:       }
169:     }
170:   }
171:
172:   updateAverageTime() {
173:     const times = this.metrics.processingTimes.slice(-100);
174:     const sum = times.reduce((acc, time) => acc + time, 0);
175:     this.metrics.averageTime = sum / times.length;
176:   }
<- CUT CONTENT ->

<!-- services/JobScheduler.js -->
<- CUT CONTENT ->
45: class JobScheduler {
46:   constructor(taskProcessor) {
47:     this.processor = taskProcessor;
48:     this.cronJobs = new Map();
49:   }
50:   
51:   async scheduleRecurringJob(schedule, jobData) {
52:     const job = cron.schedule(schedule, async () => {
53:       try {
54:         await this.processor.addTask({
55:           id: `recurring_${Date.now()}`,
56:           type: jobData.type,
57:           data: jobData.data
58:         });
59:       } catch (error) {
60:         console.error('Failed to schedule recurring job:', error);
61:       }
62:     });
63:     
64:     this.cronJobs.set(schedule, job);
65:     return job;
66:   }
67:   
68:   async scheduleBatch(jobs) {
69:     // Relies on addBatch working correctly
70:     const taskIds = await this.processor.addBatch(jobs);
71:     return taskIds;
72:   }
<- CUT CONTENT ->

<!-- services/WorkerManager.js -->
<- CUT CONTENT ->
89: class WorkerManager {
90:   constructor() {
91:     this.processors = [];
92:     this.healthChecks = new Map();
93:   }
94:   
95:   async initializeWorker(workerId, options) {
96:     const processor = new TaskQueueProcessor(options);
97:     
98:     // Setup middleware for logging and monitoring
99:     processor.use(async (task) => {
100:       console.log(`Worker ${workerId} processing task ${task.id}`);
101:     });
102:     
103:     processor.use(async (task) => {
104:       this.updateWorkerMetrics(workerId, task);
105:     });
106:     
107:     this.processors.push({ workerId, processor });
108:     return processor;
109:   }
110:   
111:   getWorkerMetrics(workerId) {
112:     const worker = this.processors.find(w => w.workerId === workerId);
113:     if (!worker) return null;
114:     
115:     return worker.processor.getMetrics();
116:   }
<- CUT CONTENT ->

<!-- services/MetricsCollector.js -->
<- CUT CONTENT ->
134: class MetricsCollector {
135:   constructor(processors) {
136:     this.processors = processors;
137:     this.metricsHistory = [];
138:   }
139:   
140:   collectMetrics() {
141:     const timestamp = Date.now();
142:     const aggregatedMetrics = {
143:       timestamp,
144:       totalProcessed: 0,
145:       totalFailed: 0,
146:       averageTime: 0,
147:       activeCount: 0
148:     };
149:     
150:     let processorCount = 0;
151:     let totalAverageTime = 0;
152:     
153:     this.processors.forEach(processor => {
154:       const metrics = processor.getMetrics();
155:       
156:       aggregatedMetrics.totalProcessed += metrics.totalProcessed;
157:       aggregatedMetrics.totalFailed += metrics.totalFailed;
158:       aggregatedMetrics.activeCount += metrics.activeCount;
159:       
160:       if (metrics.averageTime > 0) {
161:         totalAverageTime += metrics.averageTime;
162:         processorCount++;
163:       }
164:     });
165:     
166:     if (processorCount > 0) {
167:       aggregatedMetrics.averageTime = totalAverageTime / processorCount;
168:     }
169:     
170:     this.metricsHistory.push(aggregatedMetrics);
171:     return aggregatedMetrics;
172:   }
<- CUT CONTENT ->

<!-- services/BackgroundJobService.js -->
<- CUT CONTENT ->
201: class BackgroundJobService {
202:   constructor() {
203:     this.processor = new TaskQueueProcessor({
204:       concurrency: 5,
205:       retryLimit: 3
206:     });
207:     
208:     this.setupHandlers();
209:     this.setupMiddleware();
210:   }
211:   
212:   setupMiddleware() {
213:     // Performance monitoring middleware
214:     this.processor.use(async (task) => {
215:       if (task.startedAt) {
216:         const duration = Date.now() - task.startedAt;
217:         console.log(`Task ${task.id} took ${duration}ms`);
218:       }
219:     });
220:     
221:     // Error logging middleware  
222:     this.processor.use(async (task) => {
223:       if (task.status === 'failed') {
224:         console.error(`Task ${task.id} failed:`, task.errors);
225:       }
226:     });
227:   }
228:   
229:   async processEmailQueue(emails) {
230:     const tasks = emails.map(email => ({
231:       id: `email_${email.id}`,
232:       type: 'send_email',
233:       data: email
234:     }));
235:     
236:     return await this.processor.addBatch(tasks);
237:   }
<- CUT CONTENT ->
```

### suggestions.json
```json
{
    "overallSummary": "Este PR adiciona timeout handling, middleware support e melhora o batch processing no TaskQueueProcessor. Foram identificados três bugs: o processNext é chamado em loop sem await causando múltiplas execuções simultâneas, o middleware assume estrutura de objeto mas use() adiciona funções diretamente, e updateAverageTime pode dividir por zero.",
    "codeSuggestions": [
        {
            "relevantFile": "services/TaskQueueProcessor.js",
            "language": "javascript",
            "suggestionContent": "No finally block de processNext, this.processNext() é chamado sem await dentro de um loop condicional. Isso pode causar múltiplas tarefas sendo processadas simultaneamente além do limite de concorrência, pois cada chamada inicia imediatamente sem esperar a anterior completar. Isso quebra o WorkerManager (linha 96) que confia no limite de concorrência para balancear workers, e afeta o JobScheduler (linha 54) que pode sobrecarregar o sistema ao agendar jobs em lote.",
            "existingCode": "} finally {\n  const index = this.active.indexOf(task);\n  if (index > -1) {\n    this.active.splice(index, 1);\n  }\n  \n  if (this.queue.length > 0) {\n    this.processNext();\n  }\n}",
            "improvedCode": "} finally {\n  const index = this.active.indexOf(task);\n  if (index > -1) {\n    this.active.splice(index, 1);\n  }\n  \n  // Use setImmediate or process.nextTick to avoid stack overflow\n  if (this.queue.length > 0) {\n    setImmediate(() => this.processNext());\n  }\n}",
            "oneSentenceSummary": "Use setImmediate para evitar processamento simultâneo além do limite de concorrência",
            "relevantLinesStart": 86,
            "relevantLinesEnd": 94,
            "label": "async_error"
        },
        {
            "relevantFile": "services/TaskQueueProcessor.js",
            "language": "javascript",
            "suggestionContent": "O método use() adiciona funções diretamente ao array middleware, mas runMiddleware espera objetos com propriedades phase e fn. Isso causará erro quando tentar acessar middleware.phase, pois middleware será uma função, não um objeto. Isso quebra o WorkerManager (linhas 99 e 103) que configura middleware para logging e monitoring, e o BackgroundJobService (linhas 214 e 222) que adiciona middleware de performance e error logging, causando falhas silenciosas no sistema de middleware.",
            "existingCode": "use(middlewareFn) {\n  this.middleware.push(middlewareFn);\n}\n\n// ...\n\nasync runMiddleware(task, phase) {\n  for (const middleware of this.middleware) {\n    if (middleware.phase === phase) {\n      await middleware.fn(task);\n    }\n  }\n}",
            "improvedCode": "use(phase, middlewareFn) {\n  if (typeof middlewareFn !== 'function') {\n    throw new Error('Middleware must be a function');\n  }\n  this.middleware.push({ phase, fn: middlewareFn });\n}\n\n// ...\n\nasync runMiddleware(task, phase) {\n  for (const middleware of this.middleware) {\n    if (middleware.phase === phase) {\n      await middleware.fn(task);\n    }\n  }\n}",
            "oneSentenceSummary": "Ajuste o método use para criar objetos com phase e fn conforme esperado por runMiddleware",
            "relevantLinesStart": 31,
            "relevantLinesEnd": 33,
            "label": "type_comparison"
        },
        {
            "relevantFile": "services/TaskQueueProcessor.js",
            "language": "javascript",
            "suggestionContent": "Em updateAverageTime, quando processingTimes está vazio ou tem menos de 100 itens no início, slice(-100) retorna um array vazio. Dividir por times.length (0) resulta em NaN, que será atribuído a averageTime, causando problemas em métricas e comparações. Isso quebra o MetricsCollector (linha 161) que verifica se averageTime > 0 mas NaN > 0 é false, causando métricas incorretas no dashboard e afetando decisões de auto-scaling baseadas em performance.",
            "existingCode": "updateAverageTime() {\n  const times = this.metrics.processingTimes.slice(-100);\n  const sum = times.reduce((acc, time) => acc + time, 0);\n  this.metrics.averageTime = sum / times.length;\n}",
            "improvedCode": "updateAverageTime() {\n  const times = this.metrics.processingTimes.slice(-100);\n  if (times.length === 0) {\n    this.metrics.averageTime = 0;\n    return;\n  }\n  const sum = times.reduce((acc, time) => acc + time, 0);\n  this.metrics.averageTime = sum / times.length;\n}",
            "oneSentenceSummary": "Adicione verificação para array vazio antes de calcular média para evitar NaN",
            "relevantLinesStart": 166,
            "relevantLinesEnd": 170,
            "label": "type_comparison"
        }
    ]
}
```