## Example 008 - API Request Manager (Edit)

### file.js
```javascript
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
```

### diff.txt
```diff
## file: 'utils/APIRequestManager.js'

@@ -10,6 +10,11 @@
     this.pendingRequests = new Map();
     this.requestInterceptors = [];
     this.responseInterceptors = [];
+    this.rateLimiter = {
+      requests: [],
+      maxRequests: options.rateLimit || 100,
+      window: options.rateLimitWindow || 60000
+    };
   }
 
   addRequestInterceptor(interceptor) {
@@ -33,15 +38,25 @@
       }
     }
 
-    // Deduplicate concurrent identical requests
     if (this.pendingRequests.has(cacheKey)) {
       return this.pendingRequests.get(cacheKey);
     }
 
+    if (!this.checkRateLimit()) {
+      throw new Error('Rate limit exceeded');
+    }
+
     const requestPromise = this.executeRequest(method, url, options);
     this.pendingRequests.set(cacheKey, requestPromise);
 
-    const response = await requestPromise;
-    this.pendingRequests.delete(cacheKey);
+    try {
+      const response = await requestPromise;
+      
+      if (method === 'GET' && options.cache !== false) {
+        this.setCache(cacheKey, response, options.cacheTTL);
+      }
+      
+      return response;
+    } finally {
+      this.pendingRequests.delete(cacheKey);
+    }
-
-    if (method === 'GET' && options.cache !== false) {
-      this.setCache(cacheKey, response, options.cacheTTL);
-    }
-
-    return response;
   }
 
@@ -74,7 +89,12 @@
       url += `?${params}`;
     }
 
-    // Apply request interceptors
+    for (const interceptor of this.requestInterceptors) {
+      await interceptor(config);
+    }
+
+    const controller = new AbortController();
+    const timeoutId = setTimeout(() => controller.abort(), config.timeout);
+
     try {
-      const response = await fetch(url, config);
+      const response = await fetch(url, {
+        ...config,
+        signal: controller.signal
+      });
+
+      clearTimeout(timeoutId);
+
       const data = await response.json();
 
@@ -97,14 +117,23 @@
         headers: response.headers,
         ok: response.ok
       };
 
+      for (const interceptor of this.responseInterceptors) {
+        await interceptor(result);
+      }
+
       if (!response.ok) {
         throw new HTTPError(response.status, data);
       }
 
+      this.recordRequest();
       return result;
 
     } catch (error) {
+      if (error.name === 'AbortError') {
+        throw new Error('Request timeout');
+      }
+
       if (retryCount < this.maxRetries && this.shouldRetry(error)) {
-        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
+        const delay = Math.pow(2, retryCount) * 1000;
+        await new Promise(resolve => setTimeout(resolve, delay));
         return this.executeRequest(method, url, options, retryCount + 1);
       }
@@ -121,6 +150,24 @@
     return error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT';
   }
 
+  checkRateLimit() {
+    const now = Date.now();
+    const windowStart = now - this.rateLimiter.window;
+    
+    this.rateLimiter.requests = this.rateLimiter.requests.filter(
+      time => time > windowStart
+    );
+
+    return this.rateLimiter.requests.length < this.rateLimiter.maxRequests;
+  }
+
+  recordRequest() {
+    this.rateLimiter.requests.push(Date.now());
+  }
+
   getFromCache(key) {
     const cached = this.cache.get(key);
     
@@ -145,10 +192,10 @@
       expiresAt: Date.now() + ttl
     });
 
-    // Simple LRU: remove oldest when cache is too large
     if (this.cache.size > 1000) {
-      const oldestKey = this.cache.keys().next().value;
-      this.cache.delete(oldestKey);
+      const firstKey = this.cache.keys().next().value;
+      this.cache.delete(firstKey);
     }
   }
```

### suggestions.json
```json
{
    "overallSummary": "Este PR adiciona rate limiting, request timeout com AbortController e melhora o retry logic. Foram identificados três problemas: recordRequest() é chamado apenas em requisições bem-sucedidas permitindo abuse do rate limit, o timeout não é cancelado em caso de erro antes do abort, e a construção da URL com params pode resultar em dupla interrogação.",
    "codeSuggestions": [
        {
            "relevantFile": "utils/APIRequestManager.js",
            "language": "javascript",
            "suggestionContent": "O recordRequest() só é chamado quando a requisição é bem-sucedida. Isso permite que um atacante faça requisições inválidas infinitamente sem ser limitado pelo rate limiter, pois requisições que falham não são contabilizadas. O rate limit deve contar todas as tentativas, não apenas sucessos.",
            "existingCode": "if (!response.ok) {\n  throw new HTTPError(response.status, data);\n}\n\nthis.recordRequest();\nreturn result;",
            "improvedCode": "this.recordRequest(); // Record all attempts, not just successful ones\n\nif (!response.ok) {\n  throw new HTTPError(response.status, data);\n}\n\nreturn result;",
            "oneSentenceSummary": "Mova recordRequest() para antes da verificação de erro para contabilizar todas as requisições",
            "relevantLinesStart": 110,
            "relevantLinesEnd": 115,
            "label": "logic_error"
        },
        {
            "relevantFile": "utils/APIRequestManager.js",
            "language": "javascript",
            "suggestionContent": "Se o fetch falhar antes do timeout (por exemplo, erro de rede), o clearTimeout nunca é chamado, deixando o timer ativo. Isso pode causar abort em uma requisição já finalizada e acumular timers não limpos na memória.",
            "existingCode": "const controller = new AbortController();\nconst timeoutId = setTimeout(() => controller.abort(), config.timeout);\n\ntry {\n  const response = await fetch(url, {\n    ...config,\n    signal: controller.signal\n  });\n\n  clearTimeout(timeoutId);",
            "improvedCode": "const controller = new AbortController();\nconst timeoutId = setTimeout(() => controller.abort(), config.timeout);\n\ntry {\n  const response = await fetch(url, {\n    ...config,\n    signal: controller.signal\n  });\n\n  clearTimeout(timeoutId);",
            "oneSentenceSummary": "Adicione clearTimeout no bloco finally para garantir limpeza do timer em todos os casos",
            "relevantLinesStart": 86,
            "relevantLinesEnd": 94,
            "label": "memory_leak"
        },
        {
            "relevantFile": "utils/APIRequestManager.js",
            "language": "javascript",
            "suggestionContent": "A URL é construída concatenando params diretamente, mas não verifica se a URL já contém query parameters. Se o endpoint já tiver '?', isso resultará em uma URL inválida como 'api.com/users?id=1?name=test'. É necessário verificar se já existe '?' na URL.",
            "existingCode": "if (options.params) {\n  const params = new URLSearchParams(options.params);\n  url += `?${params}`;\n}",
            "improvedCode": "if (options.params) {\n  const params = new URLSearchParams(options.params);\n  const separator = url.includes('?') ? '&' : '?';\n  url += `${separator}${params}`;\n}",
            "oneSentenceSummary": "Verifique se a URL já contém '?' antes de adicionar query parameters",
            "relevantLinesStart": 77,
            "relevantLinesEnd": 80,
            "label": "logic_error"
        }
    ]
}
```