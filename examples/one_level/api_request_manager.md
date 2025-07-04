## Example 008 - API Request Manager (New Format)
### diff
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
### files
```
<!-- utils/APIRequestManager.js -->
<- CUT CONTENT ->
22: class APIRequestManager {
23:   async request(method, endpoint, options = {}) {
24:     const url = `${this.baseURL}${endpoint}`;
25:     const cacheKey = `${method}:${url}:${JSON.stringify(options.params)}`;
26:     
27:     if (method === 'GET' && options.cache !== false) {
28:       const cached = this.getFromCache(cacheKey);
29:       if (cached) {
30:         return cached;
31:       }
32:     }
33:     if (this.pendingRequests.has(cacheKey)) {
34:       return this.pendingRequests.get(cacheKey);
35:     }
36:     if (!this.checkRateLimit()) {
37:       throw new Error('Rate limit exceeded');
38:     }
39:     const requestPromise = this.executeRequest(method, url, options);
40:     this.pendingRequests.set(cacheKey, requestPromise);
41:     try {
42:       const response = await requestPromise;
43:       
44:       if (method === 'GET' && options.cache !== false) {
45:         this.setCache(cacheKey, response, options.cacheTTL);
46:       }
47:       
48:       return response;
49:     } finally {
50:       this.pendingRequests.delete(cacheKey);
51:     }
52:   }
<- CUT CONTENT ->
54:   async executeRequest(method, url, options, retryCount = 0) {
55:     const config = {
56:       method,
57:       headers: {
58:         ...this.defaultHeaders,
59:         ...options.headers
60:       },
61:       timeout: options.timeout || this.timeout
62:     };
<- CUT CONTENT ->
77:     if (options.params) {
78:       const params = new URLSearchParams(options.params);
79:       url += `?${params}`;
80:     }
<- CUT CONTENT ->
86:     const controller = new AbortController();
87:     const timeoutId = setTimeout(() => controller.abort(), config.timeout);
88:     try {
89:       const response = await fetch(url, {
90:         ...config,
91:         signal: controller.signal
92:       });
93:       clearTimeout(timeoutId);
94:       const data = await response.json();
<- CUT CONTENT ->
110:       if (!response.ok) {
111:         throw new HTTPError(response.status, data);
112:       }
113:       this.recordRequest();
114:       return result;
115:     } catch (error) {
116:       if (error.name === 'AbortError') {
117:         throw new Error('Request timeout');
118:       }
<- CUT CONTENT ->
128:   }
<- CUT CONTENT ->
150:   checkRateLimit() {
151:     const now = Date.now();
152:     const windowStart = now - this.rateLimiter.window;
153:     
154:     this.rateLimiter.requests = this.rateLimiter.requests.filter(
155:       time => time > windowStart
156:     );
157:     return this.rateLimiter.requests.length < this.rateLimiter.maxRequests;
158:   }
159:   recordRequest() {
160:     this.rateLimiter.requests.push(Date.now());
161:   }
<- CUT CONTENT ->

<!-- services/UserService.js -->
<- CUT CONTENT ->
45: class UserService {
46:   constructor(apiManager) {
47:     this.api = apiManager;
48:   }
49:   
50:   async getUser(userId) {
51:     try {
52:       const response = await this.api.get(`/users/${userId}`, {
53:         cache: true,
54:         cacheTTL: 600000
55:       });
56:       return response.data;
57:     } catch (error) {
58:       if (error.message === 'Rate limit exceeded') {
59:         throw new Error('Too many requests. Please try again later.');
60:       }
61:       throw error;
62:     }
63:   }
64:   
65:   async updateUser(userId, data) {
66:     const response = await this.api.put(`/users/${userId}`, data);
67:     return response.data;
68:   }
<- CUT CONTENT ->

<!-- controllers/ProductController.js -->
<- CUT CONTENT ->
112: class ProductController {
113:   constructor(apiManager) {
114:     this.api = apiManager;
115:   }
116:   
117:   async searchProducts(req, res) {
118:     try {
119:       const { category, minPrice, maxPrice } = req.query;
120:       const response = await this.api.get('/products/search', {
121:         params: {
122:           category,
123:           price_min: minPrice,
124:           price_max: maxPrice
125:         }
126:       });
127:       res.json(response.data);
128:     } catch (error) {
129:       if (error.message === 'Rate limit exceeded') {
130:         res.status(429).json({ error: 'Too many requests' });
131:       } else {
132:         res.status(500).json({ error: 'Internal server error' });
133:       }
134:     }
135:   }
<- CUT CONTENT ->

<!-- services/OrderService.js -->
<- CUT CONTENT ->
78: class OrderService {
79:   constructor(apiManager) {
80:     this.api = apiManager;
81:   }
82:   
83:   async createOrder(orderData) {
84:     // First, validate product availability
85:     const productCheck = await this.api.get(`/products/${orderData.productId}/availability`);
86:     
87:     if (!productCheck.data.inStock) {
88:       throw new Error('Product out of stock');
89:     }
90:     
91:     // Then create the order
92:     const response = await this.api.post('/orders', orderData);
93:     return response.data;
94:   }
95:   
96:   async getOrderStatus(orderId) {
97:     const response = await this.api.get(`/orders/${orderId}/status?include=tracking`);
98:     return response.data;
99:   }
<- CUT CONTENT ->
```
### suggestions.json
```json
{
    "overallSummary": "Este PR adiciona rate limiting, request timeout com AbortController e melhora o retry logic. Foram identificados três problemas: recordRequest() é chamado apenas em requisições bem-sucedidas permitindo abuse do rate limit, o timeout não é cancelado em caso de erro antes do abort, e a construção da URL com params pode resultar em dupla interrogação.",
    "codeSuggestions": [
        {
            "relevantFile": "utils/APIRequestManager.js",
            "language": "javascript",
            "suggestionContent": "O recordRequest() só é chamado quando a requisição é bem-sucedida. Isso permite que um atacante faça requisições inválidas infinitamente sem ser limitado pelo rate limiter, pois requisições que falham não são contabilizadas. O rate limit deve contar todas as tentativas, não apenas sucessos. Isso afeta UserService (linha 58) e ProductController (linha 129) que dependem do rate limiting para proteção contra abuse.",
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
            "suggestionContent": "Se o fetch falhar antes do timeout (por exemplo, erro de rede), o clearTimeout nunca é chamado, deixando o timer ativo. Isso pode causar abort em uma requisição já finalizada e acumular timers não limpos na memória. OrderService.createOrder (linha 85-92) faz múltiplas requisições sequenciais que podem ser afetadas por esse memory leak.",
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
            "suggestionContent": "A URL é construída concatenando params diretamente, mas não verifica se a URL já contém query parameters. Se o endpoint já tiver '?', isso resultará em uma URL inválida como 'api.com/users?id=1?name=test'. É necessário verificar se já existe '?' na URL. Isso quebra OrderService.getOrderStatus (linha 97) que já inclui '?include=tracking' no endpoint.",
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