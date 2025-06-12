class APIRequestManager {
  constructor(baseURL, options = {}) {
    this.baseURL = baseURL;
    this.defaultHeaders = options.headers || {};
    this.timeout = options.timeout || 10000;
    this.maxRetries = options.maxRetries || 3;
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    this.rateLimiter = {
      requests: [],
      maxRequests: options.rateLimit || 100,
      window: options.rateLimitWindow || 60000
    };
  }

  addRequestInterceptor(interceptor) {
    this.requestInterceptors.push(interceptor);
  }

  addResponseInterceptor(interceptor) {
    this.responseInterceptors.push(interceptor);
  }

  async request(method, endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const cacheKey = `${method}:${url}:${JSON.stringify(options.params)}`;
    
    if (method === 'GET' && options.cache !== false) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey);
    }

    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded');
    }

    const requestPromise = this.executeRequest(method, url, options);
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const response = await requestPromise;
      
      if (method === 'GET' && options.cache !== false) {
        this.setCache(cacheKey, response, options.cacheTTL);
      }
      
      return response;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  async executeRequest(method, url, options, retryCount = 0) {
    const config = {
      method,
      headers: {
        ...this.defaultHeaders,
        ...options.headers
      },
      timeout: options.timeout || this.timeout
    };

    if (options.body) {
      config.body = JSON.stringify(options.body);
      config.headers['Content-Type'] = 'application/json';
    }

    if (options.params) {
      const params = new URLSearchParams(options.params);
      url += `?${params}`;
    }

    for (const interceptor of this.requestInterceptors) {
      await interceptor(config);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      const response = await fetch(url, {
        ...config,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      const result = {
        data,
        status: response.status,
        headers: response.headers,
        ok: response.ok
      };

      for (const interceptor of this.responseInterceptors) {
        await interceptor(result);
      }

      if (!response.ok) {
        throw new HTTPError(response.status, data);
      }

      this.recordRequest();
      return result;

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }

      if (retryCount < this.maxRetries && this.shouldRetry(error)) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeRequest(method, url, options, retryCount + 1);
      }

      throw error;
    }
  }

  shouldRetry(error) {
    if (error instanceof HTTPError) {
      return error.status >= 500 || error.status === 429;
    }
    return error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT';
  }

  checkRateLimit() {
    const now = Date.now();
    const windowStart = now - this.rateLimiter.window;
    
    this.rateLimiter.requests = this.rateLimiter.requests.filter(
      time => time > windowStart
    );

    return this.rateLimiter.requests.length < this.rateLimiter.maxRequests;
  }

  recordRequest() {
    this.rateLimiter.requests.push(Date.now());
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  setCache(key, data, ttl = 300000) {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl
    });

    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  clearCache() {
    this.cache.clear();
  }

  async get(endpoint, options = {}) {
    return this.request('GET', endpoint, options);
  }

  async post(endpoint, body, options = {}) {
    return this.request('POST', endpoint, { ...options, body });
  }

  async put(endpoint, body, options = {}) {
    return this.request('PUT', endpoint, { ...options, body });
  }

  async patch(endpoint, body, options = {}) {
    return this.request('PATCH', endpoint, { ...options, body });
  }

  async delete(endpoint, options = {}) {
    return this.request('DELETE', endpoint, options);
  }
}

class HTTPError extends Error {
  constructor(status, data) {
    super(`HTTP Error ${status}`);
    this.status = status;
    this.data = data;
  }
}

module.exports = { APIRequestManager, HTTPError }; 