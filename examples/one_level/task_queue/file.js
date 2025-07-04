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