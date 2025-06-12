class NotificationService {
  constructor() {
    this.subscribers = new Map();
    this.queue = [];
    this.processing = false;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }

  subscribe(userId, channel, callback) {
    if (!this.subscribers.has(userId)) {
      this.subscribers.set(userId, new Map());
    }
    
    const userChannels = this.subscribers.get(userId);
    if (!userChannels.has(channel)) {
      userChannels.set(channel, []);
    }
    
    userChannels.get(channel).push(callback);
    
    return () => {
      const callbacks = userChannels.get(channel);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }

  async notify(userId, channel, data) {
    const notification = {
      id: Date.now() + Math.random(),
      userId,
      channel,
      data,
      timestamp: new Date(),
      attempts: 0
    };

    this.queue.push(notification);
    
    if (!this.processing) {
      this.processQueue();
    }
  }

  async processQueue() {
    this.processing = true;

    while (this.queue.length > 0) {
      const notification = this.queue.shift();
      
      try {
        await this.deliverNotification(notification);
      } catch (error) {
        notification.attempts++;
        
        if (notification.attempts < this.retryAttempts) {
          setTimeout(() => {
            this.queue.push(notification);
          }, this.retryDelay * notification.attempts);
        } else {
          console.error(`Failed to deliver notification after ${this.retryAttempts} attempts:`, error);
        }
      }
    }

    this.processing = false;
  }

  async deliverNotification(notification) {
    const userSubscribers = this.subscribers.get(notification.userId);
    
    if (!userSubscribers || !userSubscribers.has(notification.channel)) {
      return;
    }

    const callbacks = userSubscribers.get(notification.channel);
    
    const promises = callbacks.map(callback => {
      return new Promise((resolve, reject) => {
        try {
          const result = callback(notification);
          if (result instanceof Promise) {
            result.then(resolve).catch(reject);
          } else {
            resolve(result);
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    await Promise.all(promises);
  }

  broadcast(channel, data) {
    const notificationPromises = [];
    
    for (const [userId, channels] of this.subscribers) {
      if (channels.has(channel)) {
        notificationPromises.push(this.notify(userId, channel, data));
      }
    }
    
    return Promise.all(notificationPromises);
  }

  unsubscribeUser(userId) {
    return this.subscribers.delete(userId);
  }

  getSubscriberCount(channel) {
    let count = 0;
    
    for (const [userId, channels] of this.subscribers) {
      if (channels.has(channel)) {
        count += channels.get(channel).length;
      }
    }
    
    return count;
  }

  getQueueSize() {
    return this.queue.length;
  }

  clearQueue() {
    this.queue = [];
  }
}

module.exports = NotificationService; 