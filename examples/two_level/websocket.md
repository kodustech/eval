### diff
```diff
## file: 'services/WebSocketManager.js'
@@ -18,25 +18,45 @@
   connect(url, options = {}) {
-    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
-      return Promise.resolve();
+    const connectionId = this.generateConnectionId(url, options);
+    
+    if (this.connections.has(connectionId)) {
+      return this.connections.get(connectionId);
     }
     
-    return new Promise((resolve, reject) => {
-      this.ws = new WebSocket(url);
+    const connectionPromise = this.createConnection(url, options);
+    this.connections.set(connectionId, connectionPromise);
+    
+    return connectionPromise;
+  }
+
+  async createConnection(url, options) {
+    const ws = new WebSocket(url);
+    const timeout = options.timeout || 30000;
+    
+    return new Promise((resolve, reject) => {
+      const timeoutId = setTimeout(() => {
+        ws.close();
+        reject(new Error('Connection timeout'));
+      }, timeout);
       
-      this.ws.onopen = () => {
+      ws.onopen = () => {
+        clearTimeout(timeoutId);
         this.connected = true;
+        this.setupEventHandlers(ws, options);
         resolve();
       };
       
-      this.ws.onerror = (error) => {
+      ws.onerror = (error) => {
+        clearTimeout(timeoutId);
         reject(error);
       };
       
-      this.ws.onclose = () => {
-        this.connected = false;
-        this.handleDisconnect();
-      };
+      this.ws = ws;
     });
   }
 
+  setupEventHandlers(ws, options) {
+    ws.onmessage = (event) => {
+      const data = JSON.parse(event.data);
+      this.handleMessage(data, options);
+    };
+    
+    ws.onclose = () => {
+      this.connected = false;
+      this.reconnectAttempts++;
+      
+      if (options.autoReconnect && this.reconnectAttempts < options.maxReconnects) {
+        setTimeout(() => {
+          this.connect(this.lastUrl, options);
+        }, Math.pow(2, this.reconnectAttempts) * 1000);
+      }
+    };
+  }
+
   send(message) {
@@ -48,18 +68,32 @@
     this.ws.send(JSON.stringify(message));
   }
 
-  subscribe(event, callback) {
-    if (!this.listeners[event]) {
-      this.listeners[event] = [];
+  handleMessage(data, options) {
+    if (options.transformMessage) {
+      data = options.transformMessage(data);
     }
-    this.listeners[event].push(callback);
+    
+    const listeners = this.listeners[data.type] || [];
+    listeners.forEach(callback => {
+      try {
+        callback(data);
+      } catch (error) {
+        console.error('Listener error:', error);
+      }
+    });
   }
 
-  handleDisconnect() {
-    // Attempt to reconnect
-    setTimeout(() => {
-      this.connect(this.lastUrl);
-    }, 5000);
+  subscribe(event, callback) {
+    if (!this.listeners[event]) {
+      this.listeners[event] = new Set();
+    }
+    
+    this.listeners[event].add(callback);
+    
+    return () => {
+      this.listeners[event].delete(callback);
+    };
   }
   ```

   ### files
   ```
   <!-- services/WebSocketManager.js -->
<- CUT CONTENT ->
18:   connect(url, options = {}) {
19:     const connectionId = this.generateConnectionId(url, options);
20:     
21:     if (this.connections.has(connectionId)) {
22:       return this.connections.get(connectionId);
23:     }
24:     
25:     const connectionPromise = this.createConnection(url, options);
26:     this.connections.set(connectionId, connectionPromise);
27:     
28:     return connectionPromise;
29:   }
30: 
31:   async createConnection(url, options) {
32:     const ws = new WebSocket(url);
33:     const timeout = options.timeout || 30000;
34:     
35:     return new Promise((resolve, reject) => {
36:       const timeoutId = setTimeout(() => {
37:         ws.close();
38:         reject(new Error('Connection timeout'));
39:       }, timeout);
40:       
41:       ws.onopen = () => {
42:         clearTimeout(timeoutId);
43:         this.connected = true;
44:         this.setupEventHandlers(ws, options);
45:         resolve();
46:       };
47:       
48:       ws.onerror = (error) => {
49:         clearTimeout(timeoutId);
50:         reject(error);
51:       };
52:       
53:       this.ws = ws;
54:     });
55:   }
56: 
57:   setupEventHandlers(ws, options) {
58:     ws.onmessage = (event) => {
59:       const data = JSON.parse(event.data);
60:       this.handleMessage(data, options);
61:     };
62:     
63:     ws.onclose = () => {
64:       this.connected = false;
65:       this.reconnectAttempts++;
66:       
67:       if (options.autoReconnect && this.reconnectAttempts < options.maxReconnects) {
68:         setTimeout(() => {
69:           this.connect(this.lastUrl, options);
70:         }, Math.pow(2, this.reconnectAttempts) * 1000);
71:       }
72:     };
73:   }
<- CUT CONTENT ->
68:   handleMessage(data, options) {
69:     if (options.transformMessage) {
70:       data = options.transformMessage(data);
71:     }
72:     
73:     const listeners = this.listeners[data.type] || [];
74:     listeners.forEach(callback => {
75:       try {
76:         callback(data);
77:       } catch (error) {
78:         console.error('Listener error:', error);
79:       }
80:     });
81:   }
82: 
83:   subscribe(event, callback) {
84:     if (!this.listeners[event]) {
85:       this.listeners[event] = new Set();
86:     }
87:     
88:     this.listeners[event].add(callback);
89:     
90:     return () => {
91:       this.listeners[event].delete(callback);
92:     };
93:   }
<- CUT CONTENT ->

<!-- components/ChatComponent.js -->
<- CUT CONTENT ->
45: class ChatComponent {
46:   constructor(wsManager) {
47:     this.ws = wsManager;
48:   }
49:   
50:   async initialize() {
51:     // Connect with auto-reconnect
52:     await this.ws.connect('/ws/chat', {
53:       autoReconnect: true,
54:       maxReconnects: 5
55:     });
56:     
57:     // Subscribe to messages
58:     this.ws.subscribe('message', (data) => {
59:       this.displayMessage(data);
60:     });
61:     
62:     // Connect to different endpoint for notifications
63:     await this.ws.connect('/ws/notifications', {
64:       transformMessage: (data) => ({
65:         ...data,
66:         type: 'notification'
67:       })
68:     });
69:   }
70:   
71:   displayMessage(data) {
72:     // Expects data.content but transformer changes structure
73:     this.messageList.append(data.content);
74:   }
<- CUT CONTENT ->

<!-- services/RealtimeSync.js -->
<- CUT CONTENT ->
78: class RealtimeSync {
79:   constructor(wsManager) {
80:     this.ws = wsManager;
81:     this.subscriptions = new Map();
82:   }
83:   
84:   async syncCollection(collection) {
85:     await this.ws.connect('/ws/sync');
86:     
87:     // Subscribe returns unsubscribe function now
88:     const unsubscribe = this.ws.subscribe(`${collection}:update`, (data) => {
89:       this.handleUpdate(collection, data);
90:     });
91:     
92:     // But code expects to store callback reference
93:     this.subscriptions.set(collection, this.handleUpdate);
94:   }
95:   
96:   stopSync(collection) {
97:     const handler = this.subscriptions.get(collection);
98:     // This won't work - subscribe now uses Set
99:     const index = this.ws.listeners[`${collection}:update`].indexOf(handler);
100:    this.ws.listeners[`${collection}:update`].splice(index, 1);
101:  }
<- CUT CONTENT ->

<!-- services/MetricsCollector.js -->
<- CUT CONTENT ->
112: class MetricsCollector {
113:   constructor(wsManager) {
114:     this.ws = wsManager;
115:   }
116:   
117:   async startCollecting() {
118:     // Multiple connects with same URL but different options
119:     await this.ws.connect('/ws/metrics', {
120:       timeout: 5000
121:     });
122:     
123:     this.ws.subscribe('metric', this.processMetric.bind(this));
124:     
125:     // Later, tries to connect again with different timeout
126:     await this.ws.connect('/ws/metrics', {
127:       timeout: 60000  
128:     });
129:     
130:     // Gets cached connection with 5000ms timeout!
131:   }
<- CUT CONTENT ->
```

### suggestions.md
```
{
    "overallSummary": "Este PR refatora o WebSocketManager adicionando múltiplas conexões, auto-reconnect e transformers. Foram identificados três problemas: this.ws é sobrescrito quebrando múltiplas conexões, options de transformMessage persiste entre reconnects alterando dados, e mudança de Array para Set quebra RealtimeSync.stopSync.",
    "codeSuggestions": [
        {
            "relevantFile": "services/WebSocketManager.js",
            "language": "javascript",
            "suggestionContent": "O código permite múltiplas conexões mas sempre sobrescreve this.ws (linha 53). ChatComponent conecta em /ws/chat e depois /ws/notifications (linha 63), mas a segunda conexão sobrescreve this.ws. Métodos como send() sempre usarão a última conexão. Mensagens do chat serão enviadas para o websocket de notificações.",
            "existingCode": "this.ws = ws;",
            "improvedCode": "// Store each connection separately\nif (!this.websockets) {\n  this.websockets = new Map();\n}\nthis.websockets.set(connectionId, ws);\n// Keep this.ws for backward compatibility with single connection\nif (!this.ws) {\n  this.ws = ws;\n}",
            "oneSentenceSummary": "Armazene cada websocket separadamente em vez de sobrescrever this.ws",
            "relevantLinesStart": 53,
            "relevantLinesEnd": 53,
            "label": "logic_error"
        },
        {
            "relevantFile": "services/WebSocketManager.js",
            "language": "javascript",
            "suggestionContent": "O handleMessage usa options.transformMessage que persiste entre reconnects. ChatComponent (linha 64) define transformer que adiciona type:'notification'. Durante auto-reconnect (linha 69), as options são repassadas. Se o servidor enviar uma mensagem com type:'message', será transformada para type:'notification', quebrando os listeners que esperam 'message'.",
            "existingCode": "handleMessage(data, options) {\n  if (options.transformMessage) {\n    data = options.transformMessage(data);\n  }\n  \n  const listeners = this.listeners[data.type] || [];",
            "improvedCode": "handleMessage(data, options) {\n  // Clone data before transforming to avoid side effects\n  let processedData = data;\n  if (options.transformMessage) {\n    processedData = options.transformMessage({...data});\n  }\n  \n  const listeners = this.listeners[processedData.type] || [];",
            "oneSentenceSummary": "Clone data antes de transformar para evitar mutação de mensagens originais",
            "relevantLinesStart": 68,
            "relevantLinesEnd": 73,
            "label": "potential_issues"
        },
        {
            "relevantFile": "services/WebSocketManager.js",
            "language": "javascript",
            "suggestionContent": "O subscribe agora usa Set em vez de Array mas RealtimeSync.stopSync (linha 99-100) ainda tenta usar indexOf e splice. O código procura o índice do handler num Set (que não tem indexOf) e tenta fazer splice (que não existe em Set). A desinscrição falha silenciosamente, causando memory leak com handlers órfãos.",
            "existingCode": "subscribe(event, callback) {\n  if (!this.listeners[event]) {\n    this.listeners[event] = new Set();\n  }\n  \n  this.listeners[event].add(callback);\n  \n  return () => {\n    this.listeners[event].delete(callback);\n  };\n}",
            "improvedCode": "subscribe(event, callback) {\n  if (!this.listeners[event]) {\n    this.listeners[event] = new Set();\n  }\n  \n  this.listeners[event].add(callback);\n  \n  // Return unsubscribe function\n  return () => {\n    this.listeners[event].delete(callback);\n  };\n}\n\n// Add method for backward compatibility\nunsubscribe(event, callback) {\n  if (this.listeners[event]) {\n    this.listeners[event].delete(callback);\n  }\n}",
            "oneSentenceSummary": "Adicione método unsubscribe para manter compatibilidade com código existente",
            "relevantLinesStart": 83,
            "relevantLinesEnd": 93,
            "label": "potential_issues"
        }
    ]
}
```
