class CacheService {
  constructor(maxSize = 100, ttlMinutes = 60) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000;
    this.accessCount = new Map();
    this.startCleanupTimer();
  }

  set(key, value, customTtl = null) {
    const expiresAt = Date.now() + (customTtl || this.ttl);
    
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLeastUsed();
    }

    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now()
    });

    this.accessCount.set(key, 0);
  }

  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.accessCount.delete(key);
      return null;
    }

    const currentCount = this.accessCount.get(key) || 0;
    this.accessCount.set(key, currentCount + 1);
    
    return item.value;
  }

  has(key) {
    const item = this.cache.get(key);
    
    if (!item || Date.now() > item.expiresAt) {
      return false;
    }
    
    return true;
  }

  delete(key) {
    this.cache.delete(key);
    this.accessCount.delete(key);
  }

  clear() {
    this.cache.clear();
    this.accessCount.clear();
  }

  evictLeastUsed() {
    let minCount = Infinity;
    let keyToEvict = null;

    for (const [key, count] of this.accessCount.entries()) {
      if (count < minCount) {
        minCount = count;
        keyToEvict = key;
      }
    }

    if (keyToEvict) {
      this.cache.delete(keyToEvict);
      this.accessCount.delete(keyToEvict);
    }
  }

  startCleanupTimer() {
    setInterval(() => {
      const now = Date.now();
      
      for (const [key, item] of this.cache.entries()) {
        if (now > item.expiresAt) {
          this.cache.delete(key);
          this.accessCount.delete(key);
        }
      }
    }, 60000);
  }

  getStats() {
    const validItems = [];
    const now = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (now <= item.expiresAt) {
        validItems.push({
          key,
          size: JSON.stringify(item.value).length,
          accessCount: this.accessCount.get(key),
          age: now - item.createdAt
        });
      }
    }

    return {
      totalItems: validItems.length,
      totalSize: validItems.reduce((sum, item) => sum + item.size, 0),
      avgAccessCount: validItems.reduce((sum, item) => sum + item.accessCount, 0) / validItems.length,
      items: validItems.sort((a, b) => b.accessCount - a.accessCount)
    };
  }

  memoize(fn, keyGenerator = (...args) => JSON.stringify(args)) {
    return (...args) => {
      const key = keyGenerator(...args);
      
      if (this.has(key)) {
        return this.get(key);
      }

      const result = fn(...args);
      this.set(key, result);
      return result;
    };
  }
}

module.exports = CacheService; 