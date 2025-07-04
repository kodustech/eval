## Example 003 - Cache Service (New Format)
### diff
```diff
## file: 'utils/CacheService.js'

@@ -0,0 +1,133 @@
__new hunk__
1 +class CacheService {
2 +  constructor(maxSize = 100, ttlMinutes = 60) {
3 +    this.cache = new Map();
4 +    this.maxSize = maxSize;
5 +    this.ttl = ttlMinutes * 60 * 1000;
6 +    this.accessCount = new Map();
7 +    this.startCleanupTimer();
8 +  }
9 +
10 +  set(key, value, customTtl = null) {
11 +    const expiresAt = Date.now() + (customTtl || this.ttl);
12 +    
13 +    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
14 +      this.evictLeastUsed();
15 +    }
16 +
17 +    this.cache.set(key, {
18 +      value,
19 +      expiresAt,
20 +      createdAt: Date.now()
21 +    });
22 +
23 +    this.accessCount.set(key, 0);
24 +  }
25 +
26 +  get(key) {
27 +    const item = this.cache.get(key);
28 +    
29 +    if (!item) {
30 +      return null;
31 +    }
32 +
33 +    if (Date.now() > item.expiresAt) {
34 +      this.cache.delete(key);
35 +      this.accessCount.delete(key);
36 +      return null;
37 +    }
38 +
39 +    const currentCount = this.accessCount.get(key) || 0;
40 +    this.accessCount.set(key, currentCount + 1);
41 +    
42 +    return item.value;
43 +  }
44 +
45 +  has(key) {
46 +    const item = this.cache.get(key);
47 +    
48 +    if (!item || Date.now() > item.expiresAt) {
49 +      return false;
50 +    }
51 +    
52 +    return true;
53 +  }
54 +
55 +  delete(key) {
56 +    this.cache.delete(key);
57 +    this.accessCount.delete(key);
58 +  }
59 +
60 +  clear() {
61 +    this.cache.clear();
62 +    this.accessCount.clear();
63 +  }
64 +
65 +  evictLeastUsed() {
66 +    let minCount = Infinity;
67 +    let keyToEvict = null;
68 +
69 +    for (const [key, count] of this.accessCount.entries()) {
70 +      if (count < minCount) {
71 +        minCount = count;
72 +        keyToEvict = key;
73 +      }
74 +    }
75 +
76 +    if (keyToEvict) {
77 +      this.cache.delete(keyToEvict);
78 +      this.accessCount.delete(keyToEvict);
79 +    }
80 +  }
81 +
82 +  startCleanupTimer() {
83 +    setInterval(() => {
84 +      const now = Date.now();
85 +      
86 +      for (const [key, item] of this.cache.entries()) {
87 +        if (now > item.expiresAt) {
88 +          this.cache.delete(key);
89 +          this.accessCount.delete(key);
90 +        }
91 +      }
92 +    }, 60000);
93 +  }
94 +
95 +  getStats() {
96 +    const validItems = [];
97 +    const now = Date.now();
98 +
99 +    for (const [key, item] of this.cache.entries()) {
100 +      if (now <= item.expiresAt) {
101 +        validItems.push({
102 +          key,
103 +          size: JSON.stringify(item.value).length,
104 +          accessCount: this.accessCount.get(key),
105 +          age: now - item.createdAt
106 +        });
107 +      }
108 +    }
109 +
110 +    return {
111 +      totalItems: validItems.length,
112 +      totalSize: validItems.reduce((sum, item) => sum + item.size, 0),
113 +      avgAccessCount: validItems.reduce((sum, item) => sum + item.accessCount, 0) / validItems.length,
114 +      items: validItems.sort((a, b) => b.accessCount - a.accessCount)
115 +    };
116 +  }
117 +
118 +  memoize(fn, keyGenerator = (...args) => JSON.stringify(args)) {
119 +    return (...args) => {
120 +      const key = keyGenerator(...args);
121 +      
122 +      if (this.has(key)) {
123 +        return this.get(key);
124 +      }
125 +
126 +      const result = fn(...args);
127 +      this.set(key, result);
128 +      return result;
129 +    };
130 +  }
131 +}
132 +
133 +module.exports = CacheService;
```
### files
```
<!-- utils/CacheService.js -->
<- CUT CONTENT ->
1: class CacheService {
2:   constructor(maxSize = 100, ttlMinutes = 60) {
3:     this.cache = new Map();
4:     this.maxSize = maxSize;
5:     this.ttl = ttlMinutes * 60 * 1000;
6:     this.accessCount = new Map();
7:     this.startCleanupTimer();
8:   }
9: 
10:   set(key, value, customTtl = null) {
11:     const expiresAt = Date.now() + (customTtl || this.ttl);
12:     
13:     if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
14:       this.evictLeastUsed();
15:     }
16: 
17:     this.cache.set(key, {
18:       value,
19:       expiresAt,
20:       createdAt: Date.now()
21:     });
22: 
23:     this.accessCount.set(key, 0);
24:   }
<- CUT CONTENT ->
26:   get(key) {
27:     const item = this.cache.get(key);
28:     
29:     if (!item) {
30:       return null;
31:     }
32: 
33:     if (Date.now() > item.expiresAt) {
34:       this.cache.delete(key);
35:       this.accessCount.delete(key);
36:       return null;
37:     }
38: 
39:     const currentCount = this.accessCount.get(key) || 0;
40:     this.accessCount.set(key, currentCount + 1);
41:     
42:     return item.value;
43:   }
<- CUT CONTENT ->
65:   evictLeastUsed() {
66:     let minCount = Infinity;
67:     let keyToEvict = null;
68: 
69:     for (const [key, count] of this.accessCount.entries()) {
70:       if (count < minCount) {
71:         minCount = count;
72:         keyToEvict = key;
73:       }
74:     }
75: 
76:     if (keyToEvict) {
77:       this.cache.delete(keyToEvict);
78:       this.accessCount.delete(keyToEvict);
79:     }
80:   }
81: 
82:   startCleanupTimer() {
83:     setInterval(() => {
84:       const now = Date.now();
85:       
86:       for (const [key, item] of this.cache.entries()) {
87:         if (now > item.expiresAt) {
88:           this.cache.delete(key);
89:           this.accessCount.delete(key);
90:         }
91:       }
92:     }, 60000);
93:   }
<- CUT CONTENT ->
118:   memoize(fn, keyGenerator = (...args) => JSON.stringify(args)) {
119:     return (...args) => {
120:       const key = keyGenerator(...args);
121:       
122:       if (this.has(key)) {
123:         return this.get(key);
124:       }
125: 
126:       const result = fn(...args);
127:       this.set(key, result);
128:       return result;
129:     };
130:   }
131: }
<- CUT CONTENT ->

<!-- services/UserService.js -->
<- CUT CONTENT ->
32: class UserService {
33:   constructor(cacheService, apiClient) {
34:     this.cache = cacheService;
35:     this.api = apiClient;
36:     // Memoize expensive user data fetching
37:     this.getUserWithRoles = this.cache.memoize(
38:       this._getUserWithRoles.bind(this),
39:       (userId) => `user:${userId}:roles`
40:     );
41:   }
42:   
43:   async getUser(userId) {
44:     const cacheKey = `user:${userId}`;
45:     
46:     // Check cache first
47:     const cached = this.cache.get(cacheKey);
48:     if (cached) {
49:       return cached;
50:     }
51:     
52:     const user = await this.api.fetchUser(userId);
53:     // Cache for 30 minutes
54:     this.cache.set(cacheKey, user, 30 * 60 * 1000);
55:     return user;
56:   }
57:   
58:   async updateUser(userId, data) {
59:     const result = await this.api.updateUser(userId, data);
60:     // Update cache with new data
61:     const cacheKey = `user:${userId}`;
62:     this.cache.set(cacheKey, result);
63:     return result;
64:   }
65:   
66:   async _getUserWithRoles(userId) {
67:     const user = await this.getUser(userId);
68:     const roles = await this.api.fetchUserRoles(userId);
69:     return { ...user, roles };
70:   }
71: }
<- CUT CONTENT ->

<!-- controllers/ProductController.js -->
<- CUT CONTENT ->
88: class ProductController {
89:   constructor(cacheService, productService) {
90:     this.cache = cacheService;
91:     this.productService = productService;
92:   }
93:   
94:   async getProduct(req, res) {
95:     const { id } = req.params;
96:     const cacheKey = `product:${id}`;
97:     
98:     try {
99:       // Try cache first
100:       let product = this.cache.get(cacheKey);
101:       
102:       if (!product) {
103:         product = await this.productService.getProduct(id);
104:         // Cache for 1 hour
105:         this.cache.set(cacheKey, product, 60 * 60 * 1000);
106:       }
107:       
108:       res.json(product);
109:     } catch (error) {
110:       res.status(500).json({ error: error.message });
111:     }
112:   }
113:   
114:   async updateProduct(req, res) {
115:     const { id } = req.params;
116:     const cacheKey = `product:${id}`;
117:     
118:     try {
119:       const updated = await this.productService.updateProduct(id, req.body);
120:       // Update cache with new data
121:       this.cache.set(cacheKey, updated);
122:       res.json(updated);
123:     } catch (error) {
124:       res.status(500).json({ error: error.message });
125:     }
126:   }
127: }
<- CUT CONTENT ->

<!-- services/SessionService.js -->
<- CUT CONTENT ->
145: class SessionService {
146:   constructor(cacheService) {
147:     this.cache = cacheService;
148:   }
149:   
150:   async createSession(userId, data) {
151:     const sessionId = generateSessionId();
152:     const sessionData = {
153:       userId,
154:       ...data,
155:       createdAt: new Date()
156:     };
157:     
158:     // Store session for 24 hours
159:     this.cache.set(`session:${sessionId}`, sessionData, 24 * 60 * 60 * 1000);
160:     return sessionId;
161:   }
162:   
163:   async getSession(sessionId) {
164:     return this.cache.get(`session:${sessionId}`);
165:   }
166:   
167:   async refreshSession(sessionId) {
168:     const session = this.cache.get(`session:${sessionId}`);
169:     if (!session) {
170:       throw new Error('Session not found');
171:     }
172:     
173:     // Re-set to refresh TTL
174:     this.cache.set(`session:${sessionId}`, session, 24 * 60 * 60 * 1000);
175:     return session;
176:   }
177:   
178:   getCacheStats() {
179:     return this.cache.getStats();
180:   }
181: }
<- CUT CONTENT ->
```
### suggestions.json
```json
{
    "overallSummary": "Este PR introduz um serviço de cache com suporte a TTL, eviction e memoização. Foram identificados dois problemas importantes: o método set sempre reseta o contador de acessos para 0 mesmo para chaves existentes, e o timer de limpeza não é cancelado quando a instância é destruída, causando memory leak.",
    "codeSuggestions": [
        {
            "relevantFile": "utils/CacheService.js",
            "language": "javascript",
            "suggestionContent": "O método `set` sempre reseta o contador de acessos para 0, mesmo quando está atualizando uma chave existente. Isso quebra completamente a lógica de LRU (Least Recently Used), pois itens frequentemente atualizados sempre terão contador 0 e serão os primeiros a serem removidos, independentemente de quantas vezes foram acessados. Isso afeta UserService.updateUser (linha 62), ProductController.updateProduct (linha 121) e SessionService.refreshSession (linha 174) que atualizam itens existentes no cache esperando preservar seu histórico de acesso.",
            "existingCode": "this.cache.set(key, {\n  value,\n  expiresAt,\n  createdAt: Date.now()\n});\n\nthis.accessCount.set(key, 0);",
            "improvedCode": "this.cache.set(key, {\n  value,\n  expiresAt,\n  createdAt: Date.now()\n});\n\n// Preserve access count for existing keys\nif (!this.accessCount.has(key)) {\n  this.accessCount.set(key, 0);\n}",
            "oneSentenceSummary": "Preserve o contador de acessos ao atualizar chaves existentes no cache",
            "relevantLinesStart": 17,
            "relevantLinesEnd": 23,
            "label": "logic_error"
        },
        {
            "relevantFile": "utils/CacheService.js",
            "language": "javascript",
            "suggestionContent": "O `setInterval` em `startCleanupTimer` nunca é cancelado, criando um memory leak. Se múltiplas instâncias de CacheService forem criadas, cada uma terá seu próprio timer rodando indefinidamente, mesmo após a instância não ser mais usada. Isso pode degradar significativamente a performance da aplicação ao longo do tempo. SessionService (linha 146) e outros serviços que criam instâncias de CacheService sofrerão com esse leak acumulativo.",
            "existingCode": "startCleanupTimer() {\n  setInterval(() => {\n    const now = Date.now();\n    \n    for (const [key, item] of this.cache.entries()) {\n      if (now > item.expiresAt) {\n        this.cache.delete(key);\n        this.accessCount.delete(key);\n      }\n    }\n  }, 60000);\n}",
            "improvedCode": "startCleanupTimer() {\n  this.cleanupTimer = setInterval(() => {\n    const now = Date.now();\n    \n    for (const [key, item] of this.cache.entries()) {\n      if (now > item.expiresAt) {\n        this.cache.delete(key);\n        this.accessCount.delete(key);\n      }\n    }\n  }, 60000);\n}\n\ndestroy() {\n  if (this.cleanupTimer) {\n    clearInterval(this.cleanupTimer);\n  }\n  this.clear();\n}",
            "oneSentenceSummary": "Armazene referência do timer e adicione método destroy para prevenir memory leak",
            "relevantLinesStart": 82,
            "relevantLinesEnd": 93,
            "label": "memory_leak"
        }
    ]
}
```