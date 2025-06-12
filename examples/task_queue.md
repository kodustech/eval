## Example 007 - Task Queue Processor (Edit)

### file.js
```javascript
class TaskQueueProcessor {
  constructor(options = {}) {
    this.concurrency = options.concurrency || 3;
    this.retryLimit = options.retryLimit || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.timeout = options.timeout || 30000;
    
    this.queue = [];
    this.active = [];
    this.completed = [];
    this.failed = [];
    this.paused = false;
    
    this.handlers = new Map();
    this.middleware = [];
    this.metrics = {
      totalProcessed: 0,
      totalFailed: 0,
      averageTime: 0,
      processingTimes: []
    };
  }

  registerHandler(taskType, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    this.handlers.set(taskType, handler);
  }

  use(middlewareFn) {
    this.middleware.push(middlewareFn);
  }

  async addTask(task) {
    if (!task.type || !task.id) {
      throw new Error('Task must have type and id');
    }

    const enhancedTask = {
      ...task,
      status: 'pending',
      attempts: 0,
      addedAt: Date.now(),
      errors: []
    };

    await this.runMiddleware(enhancedTask, 'beforeAdd');
    
    this.queue.push(enhancedTask);
    
    if (!this.paused && this.active.length < this.concurrency) {
      this.processNext();
    }

    return enhancedTask.id;
  }

  async addBatch(tasks) {
    const taskIds = [];
    
    for (const task of tasks) {
      try {
        const id = await this.addTask(task);
        taskIds.push(id);
      } catch (error) {
        console.error(`Failed to add task:`, error);
      }
    }
    
    return taskIds;
  }

  async processNext() {
    if (this.paused || this.queue.length === 0 || this.active.length >= this.concurrency) {
      return;
    }

    const task = this.queue.shift();
    this.active.push(task);

    try {
      await this.processTask(task);
    } finally {
      const index = this.active.indexOf(task);
      if (index > -1) {
        this.active.splice(index, 1);
      }
      
      if (this.queue.length > 0) {
        this.processNext();
      }
    }
  }

  async processTask(task) {
    const handler = this.handlers.get(task.type);
    
    if (!handler) {
      task.status = 'failed';
      task.errors.push(new Error(`No handler registered for task type: ${task.type}`));
      this.failed.push(task);
      this.metrics.totalFailed++;
      return;
    }

    task.status = 'processing';
    task.startedAt = Date.now();

    try {
      await this.runMiddleware(task, 'beforeProcess');

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), this.timeout);
      });

      const result = await Promise.race([
        handler(task.data),
        timeoutPromise
      ]);

      task.status = 'completed';
      task.result = result;
      task.completedAt = Date.now();
      
      const processingTime = task.completedAt - task.startedAt;
      this.metrics.processingTimes.push(processingTime);
      this.metrics.totalProcessed++;
      this.updateAverageTime();
      
      await this.runMiddleware(task, 'afterProcess');
      
      this.completed.push(task);
      
    } catch (error) {
      task.attempts++;
      task.errors.push(error);

      if (task.attempts < this.retryLimit) {
        task.status = 'pending';
        setTimeout(() => {
          this.queue.unshift(task);
          if (!this.paused && this.active.length < this.concurrency) {
            this.processNext();
          }
        }, this.retryDelay * task.attempts);
      } else {
        task.status = 'failed';
        task.failedAt = Date.now();
        this.failed.push(task);
        this.metrics.totalFailed++;
        
        await this.runMiddleware(task, 'afterFail');
      }
    }
  }

  async runMiddleware(task, phase) {
    for (const middleware of this.middleware) {
      if (middleware.phase === phase) {
        await middleware.fn(task);
      }
    }
  }

  updateAverageTime() {
    const times = this.metrics.processingTimes.slice(-100);
    const sum = times.reduce((acc, time) => acc + time, 0);
    this.metrics.averageTime = sum / times.length;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    
    const availableSlots = this.concurrency - this.active.length;
    for (let i = 0; i < availableSlots && i < this.queue.length; i++) {
      this.processNext();
    }
  }

  async drain() {
    return new Promise((resolve) => {
      const checkDrained = () => {
        if (this.queue.length === 0 && this.active.length === 0) {
          resolve();
        } else {
          setTimeout(checkDrained, 100);
        }
      };
      checkDrained();
    });
  }

  getMetrics() {
    return {
      ...this.metrics,
      queueLength: this.queue.length,
      activeCount: this.active.length,
      completedCount: this.completed.length,
      failedCount: this.failed.length
    };
  }

  clear() {
    this.queue = [];
    this.completed = [];
    this.failed = [];
  }
}

module.exports = TaskQueueProcessor;
```

### diff.txt
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

### suggestions.json
```json
{
    "overallSummary": "Este PR adiciona timeout handling, middleware support e melhora o batch processing no TaskQueueProcessor. Foram identificados três bugs: o processNext é chamado em loop sem await causando múltiplas execuções simultâneas, o middleware assume estrutura de objeto mas use() adiciona funções diretamente, e updateAverageTime pode dividir por zero.",
    "codeSuggestions": [
        {
            "relevantFile": "services/TaskQueueProcessor.js",
            "language": "javascript",
            "suggestionContent": "No finally block de processNext, this.processNext() é chamado sem await dentro de um loop condicional. Isso pode causar múltiplas tarefas sendo processadas simultaneamente além do limite de concorrência, pois cada chamada inicia imediatamente sem esperar a anterior completar.",
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
            "suggestionContent": "O método use() adiciona funções diretamente ao array middleware, mas runMiddleware espera objetos com propriedades phase e fn. Isso causará erro quando tentar acessar middleware.phase, pois middleware será uma função, não um objeto.",
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
            "suggestionContent": "Em updateAverageTime, quando processingTimes está vazio ou tem menos de 100 itens no início, slice(-100) retorna um array vazio. Dividir por times.length (0) resulta em NaN, que será atribuído a averageTime, causando problemas em métricas e comparações.",
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