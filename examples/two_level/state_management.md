### diff

```diff
## file: 'services/StateManager.js'
@@ -15,22 +15,45 @@
   subscribe(key, callback) {
-    if (!this.subscribers[key]) {
-      this.subscribers[key] = [];
+    const id = this.generateId();
+    
+    if (!this.subscribers.has(key)) {
+      this.subscribers.set(key, new Map());
     }
-    this.subscribers[key].push(callback);
+    
+    this.subscribers.get(key).set(id, {
+      callback,
+      active: true,
+      lastCalled: null
+    });
+    
+    return () => this.unsubscribe(key, id);
   }
 
-  setState(key, value) {
+  setState(key, value, options = {}) {
     const oldValue = this.state[key];
-    this.state[key] = value;
+    
+    if (options.merge && typeof oldValue === 'object' && typeof value === 'object') {
+      this.state[key] = { ...oldValue, ...value };
+    } else {
+      this.state[key] = value;
+    }
+    
+    this.lastUpdated[key] = Date.now();
     
-    if (this.subscribers[key] && oldValue !== value) {
-      this.subscribers[key].forEach(callback => {
-        callback(value, oldValue);
-      });
+    if (this.shouldNotify(key, oldValue, this.state[key])) {
+      this.notifySubscribers(key, this.state[key], oldValue);
     }
   }
 
+  shouldNotify(key, oldValue, newValue) {
+    if (oldValue === newValue) return false;
+    
+    // Deep comparison for objects
+    if (typeof oldValue === 'object' && typeof newValue === 'object') {
+      return JSON.stringify(oldValue) !== JSON.stringify(newValue);
+    }
+    
+    return true;
+  }
+
   getState(key) {
     return this.state[key];
   }
@@ -42,13 +65,29 @@
     };
   }
 
-  notifySubscribers(key, value, oldValue) {
-    const callbacks = this.subscribers[key] || [];
-    callbacks.forEach(callback => {
+  async notifySubscribers(key, value, oldValue) {
+    const subscribers = this.subscribers.get(key);
+    if (!subscribers) return;
+    
+    const promises = [];
+    
+    for (const [id, subscriber] of subscribers) {
+      if (!subscriber.active) continue;
+      
+      subscriber.lastCalled = Date.now();
+      
       try {
-        callback(value, oldValue);
+        const result = subscriber.callback(value, oldValue);
+        if (result instanceof Promise) {
+          promises.push(result);
+        }
       } catch (error) {
-        console.error('Subscriber error:', error);
+        console.error(`Subscriber ${id} error:`, error);
+        subscriber.active = false;
       }
-    });
+    }
+    
+    if (promises.length > 0) {
+      await Promise.all(promises);
+    }
   }
   ```
### files
   ```
   <!-- services/StateManager.js -->
<- CUT CONTENT ->
15:   subscribe(key, callback) {
16:     const id = this.generateId();
17:     
18:     if (!this.subscribers.has(key)) {
19:       this.subscribers.set(key, new Map());
20:     }
21:     
22:     this.subscribers.get(key).set(id, {
23:       callback,
24:       active: true,
25:       lastCalled: null
26:     });
27:     
28:     return () => this.unsubscribe(key, id);
29:   }
30: 
31:   setState(key, value, options = {}) {
32:     const oldValue = this.state[key];
33:     
34:     if (options.merge && typeof oldValue === 'object' && typeof value === 'object') {
35:       this.state[key] = { ...oldValue, ...value };
36:     } else {
37:       this.state[key] = value;
38:     }
39:     
40:     this.lastUpdated[key] = Date.now();
41:     
42:     if (this.shouldNotify(key, oldValue, this.state[key])) {
43:       this.notifySubscribers(key, this.state[key], oldValue);
44:     }
45:   }
46: 
47:   shouldNotify(key, oldValue, newValue) {
48:     if (oldValue === newValue) return false;
49:     
50:     // Deep comparison for objects
51:     if (typeof oldValue === 'object' && typeof newValue === 'object') {
52:       return JSON.stringify(oldValue) !== JSON.stringify(newValue);
53:     }
54:     
55:     return true;
56:   }
<- CUT CONTENT ->
65:   async notifySubscribers(key, value, oldValue) {
66:     const subscribers = this.subscribers.get(key);
67:     if (!subscribers) return;
68:     
69:     const promises = [];
70:     
71:     for (const [id, subscriber] of subscribers) {
72:       if (!subscriber.active) continue;
73:       
74:       subscriber.lastCalled = Date.now();
75:       
76:       try {
77:         const result = subscriber.callback(value, oldValue);
78:         if (result instanceof Promise) {
79:           promises.push(result);
80:         }
81:       } catch (error) {
82:         console.error(`Subscriber ${id} error:`, error);
83:         subscriber.active = false;
84:       }
85:     }
86:     
87:     if (promises.length > 0) {
88:       await Promise.all(promises);
89:     }
90:   }
<- CUT CONTENT ->

<!-- components/UserProfile.js -->
<- CUT CONTENT ->
45: class UserProfile {
46:   constructor(stateManager) {
47:     this.state = stateManager;
48:     
49:     // Subscribe to user changes
50:     this.state.subscribe('currentUser', (user) => {
51:       this.updateUI(user);
52:       this.fetchUserPreferences(user.id);
53:     });
54:   }
55:   
56:   async updateProfile(updates) {
57:     const currentUser = this.state.getState('currentUser');
58:     
59:     // Merge updates with current user
60:     this.state.setState('currentUser', updates, { merge: true });
61:     
62:     // Save to server
63:     await api.updateUser(currentUser.id, updates);
64:   }
65:   
66:   async fetchUserPreferences(userId) {
67:     const prefs = await api.getUserPreferences(userId);
68:     // This triggers another notification!
69:     this.state.setState('currentUser', { preferences: prefs }, { merge: true });
70:   }
<- CUT CONTENT ->

<!-- services/AuthService.js -->
<- CUT CONTENT ->
78: class AuthService {
79:   constructor(stateManager) {
80:     this.state = stateManager;
81:   }
82:   
83:   async login(credentials) {
84:     const response = await api.login(credentials);
85:     const user = response.user;
86:     
87:     // Set user synchronously
88:     this.state.setState('currentUser', user);
89:     
90:     // Navigate happens before subscribers finish
91:     window.location.href = '/dashboard';
92:   }
93:   
94:   logout() {
95:     // Clear user state
96:     this.state.setState('currentUser', null);
97:     
98:     // But subscribers might still be running!
99:     window.location.href = '/login';
100:   }
<- CUT CONTENT ->

<!-- components/NotificationPanel.js -->
<- CUT CONTENT ->
112: class NotificationPanel {
113:   constructor(stateManager) {
114:     this.state = stateManager;
115:     this.unsubscribe = null;
116:   }
117:   
118:   init() {
119:     // Subscribe returns unsubscribe function
120:     this.unsubscribe = this.state.subscribe('notifications', async (notifications) => {
121:       // Heavy async operation
122:       await this.renderNotifications(notifications);
123:       await this.playSound();
124:       await this.updateBadgeCount(notifications.length);
125:     });
126:   }
127:   
128:   destroy() {
129:     // But what if notification is still processing?
130:     if (this.unsubscribe) {
131:       this.unsubscribe();
132:     }
133:   }
<- CUT CONTENT ->
```
### suggestions.json
```
{
    "overallSummary": "Este PR refatora o StateManager para usar Maps e adiciona notificações assíncronas. Foram identificados três problemas críticos: notifySubscribers não é await causando race conditions, merge com setState pode criar loops infinitos de notificações, e JSON.stringify para comparação falha com propriedades em ordem diferente.",
    "codeSuggestions": [
        {
            "relevantFile": "services/StateManager.js",
            "language": "javascript",
            "suggestionContent": "O notifySubscribers agora é async mas não é await no setState. AuthService.login (linha 91) navega imediatamente após setState, mas os subscribers ainda estão rodando. UserProfile.fetchUserPreferences é async e ainda estará executando quando a página mudar, causando erros de 'cannot update unmounted component'. O Promise.all dentro de notifySubscribers completa mas ninguém espera.",
            "existingCode": "if (this.shouldNotify(key, oldValue, this.state[key])) {\n  this.notifySubscribers(key, this.state[key], oldValue);\n}",
            "improvedCode": "if (this.shouldNotify(key, oldValue, this.state[key])) {\n  // Need to await async notifications\n  await this.notifySubscribers(key, this.state[key], oldValue);\n}",
            "oneSentenceSummary": "Adicione await ao chamar notifySubscribers para evitar race conditions",
            "relevantLinesStart": 42,
            "relevantLinesEnd": 44,
            "label": "potential_issues"
        },
        {
            "relevantFile": "services/StateManager.js",
            "language": "javascript",
            "suggestionContent": "UserProfile.fetchUserPreferences (linha 69) é chamado no subscriber e faz setState com merge, que notifica subscribers novamente, incluindo ele mesmo. Isso cria um loop infinito: updateProfile → notifica → fetchUserPreferences → setState merge → notifica → fetchUserPreferences... O sistema trava com requisições infinitas à API.",
            "existingCode": "subscriber.lastCalled = Date.now();\n\ntry {\n  const result = subscriber.callback(value, oldValue);",
            "improvedCode": "// Prevent recursive notifications\nif (subscriber.isProcessing) {\n  return;\n}\n\nsubscriber.isProcessing = true;\nsubscriber.lastCalled = Date.now();\n\ntry {\n  const result = subscriber.callback(value, oldValue);\n  // ... rest of code\n} finally {\n  subscriber.isProcessing = false;\n}",
            "oneSentenceSummary": "Previna notificações recursivas adicionando flag isProcessing",
            "relevantLinesStart": 74,
            "relevantLinesEnd": 77,
            "label": "logic_error"
        },
        {
            "relevantFile": "services/StateManager.js",
            "language": "javascript",
            "suggestionContent": "JSON.stringify para comparar objetos falha quando propriedades estão em ordem diferente. Se currentUser tem {id: 1, name: 'John'} e setState recebe {name: 'John', id: 1}, shouldNotify retorna true mesmo sendo igual. NotificationPanel será notificado desnecessariamente (linha 120), executando operações pesadas como playSound sem mudança real nos dados.",
            "existingCode": "// Deep comparison for objects\nif (typeof oldValue === 'object' && typeof newValue === 'object') {\n  return JSON.stringify(oldValue) !== JSON.stringify(newValue);\n}",
            "improvedCode": "// Deep comparison for objects\nif (typeof oldValue === 'object' && typeof newValue === 'object') {\n  // Sort keys for consistent comparison\n  const sortObject = (obj) => {\n    if (!obj || typeof obj !== 'object') return obj;\n    return Object.keys(obj).sort().reduce((result, key) => {\n      result[key] = obj[key];\n      return result;\n    }, {});\n  };\n  return JSON.stringify(sortObject(oldValue)) !== JSON.stringify(sortObject(newValue));\n}",
            "oneSentenceSummary": "Use comparação de objetos que não depende da ordem das propriedades",
            "relevantLinesStart": 50,
            "relevantLinesEnd": 53,
            "label": "performance_and_optimization"
        }
    ]
}
```

