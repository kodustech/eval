## Example 005 - Notification Service

### file.js
```javascript
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
```

### diff.txt
```diff
## file: 'services/NotificationService.js'

@@ -0,0 +1,135 @@
__new hunk__
1 +class NotificationService {
2 +  constructor() {
3 +    this.subscribers = new Map();
4 +    this.queue = [];
5 +    this.processing = false;
6 +    this.retryAttempts = 3;
7 +    this.retryDelay = 1000;
8 +  }
9 +
10 +  subscribe(userId, channel, callback) {
11 +    if (!this.subscribers.has(userId)) {
12 +      this.subscribers.set(userId, new Map());
13 +    }
14 +    
15 +    const userChannels = this.subscribers.get(userId);
16 +    if (!userChannels.has(channel)) {
17 +      userChannels.set(channel, []);
18 +    }
19 +    
20 +    userChannels.get(channel).push(callback);
21 +    
22 +    return () => {
23 +      const callbacks = userChannels.get(channel);
24 +      const index = callbacks.indexOf(callback);
25 +      if (index > -1) {
26 +        callbacks.splice(index, 1);
27 +      }
28 +    };
29 +  }
30 +
31 +  async notify(userId, channel, data) {
32 +    const notification = {
33 +      id: Date.now() + Math.random(),
34 +      userId,
35 +      channel,
36 +      data,
37 +      timestamp: new Date(),
38 +      attempts: 0
39 +    };
40 +
41 +    this.queue.push(notification);
42 +    
43 +    if (!this.processing) {
44 +      this.processQueue();
45 +    }
46 +  }
47 +
48 +  async processQueue() {
49 +    this.processing = true;
50 +
51 +    while (this.queue.length > 0) {
52 +      const notification = this.queue.shift();
53 +      
54 +      try {
55 +        await this.deliverNotification(notification);
56 +      } catch (error) {
57 +        notification.attempts++;
58 +        
59 +        if (notification.attempts < this.retryAttempts) {
60 +          setTimeout(() => {
61 +            this.queue.push(notification);
62 +          }, this.retryDelay * notification.attempts);
63 +        } else {
64 +          console.error(`Failed to deliver notification after ${this.retryAttempts} attempts:`, error);
65 +        }
66 +      }
67 +    }
68 +
69 +    this.processing = false;
70 +  }
71 +
72 +  async deliverNotification(notification) {
73 +    const userSubscribers = this.subscribers.get(notification.userId);
74 +    
75 +    if (!userSubscribers || !userSubscribers.has(notification.channel)) {
76 +      return;
77 +    }
78 +
79 +    const callbacks = userSubscribers.get(notification.channel);
80 +    
81 +    const promises = callbacks.map(callback => {
82 +      return new Promise((resolve, reject) => {
83 +        try {
84 +          const result = callback(notification);
85 +          if (result instanceof Promise) {
86 +            result.then(resolve).catch(reject);
87 +          } else {
88 +            resolve(result);
89 +          }
90 +        } catch (error) {
91 +          reject(error);
92 +        }
93 +      });
94 +    });
95 +
96 +    await Promise.all(promises);
97 +  }
98 +
99 +  broadcast(channel, data) {
100 +    const notificationPromises = [];
101 +    
102 +    for (const [userId, channels] of this.subscribers) {
103 +      if (channels.has(channel)) {
104 +        notificationPromises.push(this.notify(userId, channel, data));
105 +      }
106 +    }
107 +    
108 +    return Promise.all(notificationPromises);
109 +  }
110 +
111 +  unsubscribeUser(userId) {
112 +    return this.subscribers.delete(userId);
113 +  }
114 +
115 +  getSubscriberCount(channel) {
116 +    let count = 0;
117 +    
118 +    for (const [userId, channels] of this.subscribers) {
119 +      if (channels.has(channel)) {
120 +        count += channels.get(channel).length;
121 +      }
122 +    }
123 +    
124 +    return count;
125 +  }
126 +
127 +  getQueueSize() {
128 +    return this.queue.length;
129 +  }
130 +
131 +  clearQueue() {
132 +    this.queue = [];
133 +  }
134 +}
135 +
136 +module.exports = NotificationService;
```

### suggestions.json
```json
{
    "overallSummary": "Este PR implementa um serviço de notificações com suporte a múltiplos canais, filas e retry. Foram identificados dois problemas críticos: o processQueue não é chamado quando notificações falhadas são re-adicionadas à fila, e o unsubscribe closure pode acessar dados desatualizados após o usuário ser removido.",
    "codeSuggestions": [
        {
            "relevantFile": "services/NotificationService.js",
            "language": "javascript",
            "suggestionContent": "Quando uma notificação falha e é re-adicionada à fila no setTimeout, o código não verifica se processing ainda é false. Se o processamento terminou antes do setTimeout executar, a notificação ficará na fila indefinidamente sem ser processada, pois processQueue não será chamado novamente.",
            "existingCode": "if (notification.attempts < this.retryAttempts) {\n  setTimeout(() => {\n    this.queue.push(notification);\n  }, this.retryDelay * notification.attempts);\n}",
            "improvedCode": "if (notification.attempts < this.retryAttempts) {\n  setTimeout(() => {\n    this.queue.push(notification);\n    if (!this.processing) {\n      this.processQueue();\n    }\n  }, this.retryDelay * notification.attempts);\n}",
            "oneSentenceSummary": "Chame processQueue após re-adicionar notificações falhadas à fila se não estiver processando",
            "relevantLinesStart": 59,
            "relevantLinesEnd": 63,
            "label": "async_error"
        },
        {
            "relevantFile": "services/NotificationService.js",
            "language": "javascript",
            "suggestionContent": "A função de unsubscribe retornada captura userChannels por referência. Se o usuário for completamente removido via unsubscribeUser(), userChannels não existirá mais em this.subscribers, mas a closure ainda tentará acessá-lo. Isso causa um erro quando alguém tenta chamar a função de unsubscribe após o usuário ser removido.",
            "existingCode": "return () => {\n  const callbacks = userChannels.get(channel);\n  const index = callbacks.indexOf(callback);\n  if (index > -1) {\n    callbacks.splice(index, 1);\n  }\n};",
            "improvedCode": "return () => {\n  const currentUserChannels = this.subscribers.get(userId);\n  if (!currentUserChannels) {\n    return;\n  }\n  const callbacks = currentUserChannels.get(channel);\n  if (callbacks) {\n    const index = callbacks.indexOf(callback);\n    if (index > -1) {\n      callbacks.splice(index, 1);\n    }\n  }\n};",
            "oneSentenceSummary": "Verifique se o usuário ainda existe antes de tentar remover callbacks no unsubscribe",
            "relevantLinesStart": 22,
            "relevantLinesEnd": 28,
            "label": "null_pointer"
        }
    ]
}
```