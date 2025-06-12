## Example 003 - Cache Service

### file.js
```javascript
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
```

### diff.txt
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

### suggestions.json
```json
{
    "overallSummary": "Este PR introduz um serviço de cache com suporte a TTL, eviction e memoização. Foram identificados dois problemas importantes: o método set sempre reseta o contador de acessos para 0 mesmo para chaves existentes, e o timer de limpeza não é cancelado quando a instância é destruída, causando memory leak.",
    "codeSuggestions": [
        {
            "relevantFile": "utils/CacheService.js",
            "language": "javascript",
            "suggestionContent": "O método `set` sempre reseta o contador de acessos para 0, mesmo quando está atualizando uma chave existente. Isso quebra completamente a lógica de LRU (Least Recently Used), pois itens frequentemente atualizados sempre terão contador 0 e serão os primeiros a serem removidos, independentemente de quantas vezes foram acessados.",
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
            "suggestionContent": "O `setInterval` em `startCleanupTimer` nunca é cancelado, criando um memory leak. Se múltiplas instâncias de CacheService forem criadas, cada uma terá seu próprio timer rodando indefinidamente, mesmo após a instância não ser mais usada. Isso pode degradar significativamente a performance da aplicação ao longo do tempo.",
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