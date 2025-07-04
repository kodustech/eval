## Example 005 - Notification Service
### diff
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
### files
```
<!-- services/NotificationService.js -->
<- CUT CONTENT ->
10:   subscribe(userId, channel, callback) {
11:     if (!this.subscribers.has(userId)) {
12:       this.subscribers.set(userId, new Map());
13:     }
14:     
15:     const userChannels = this.subscribers.get(userId);
16:     if (!userChannels.has(channel)) {
17:       userChannels.set(channel, []);
18:     }
19:     
20:     userChannels.get(channel).push(callback);
21:     
22:     return () => {
23:       const callbacks = userChannels.get(channel);
24:       const index = callbacks.indexOf(callback);
25:       if (index > -1) {
26:         callbacks.splice(index, 1);
27:       }
28:     };
29:   }
<- CUT CONTENT ->
31:   async notify(userId, channel, data) {
32:     const notification = {
33:       id: Date.now() + Math.random(),
34:       userId,
35:       channel,
36:       data,
37:       timestamp: new Date(),
38:       attempts: 0
39:     };
40: 
41:     this.queue.push(notification);
42:     
43:     if (!this.processing) {
44:       this.processQueue();
45:     }
46:   }
47: 
48:   async processQueue() {
49:     this.processing = true;
50: 
51:     while (this.queue.length > 0) {
52:       const notification = this.queue.shift();
53:       
54:       try {
55:         await this.deliverNotification(notification);
56:       } catch (error) {
57:         notification.attempts++;
58:         
59:         if (notification.attempts < this.retryAttempts) {
60:           setTimeout(() => {
61:             this.queue.push(notification);
62:           }, this.retryDelay * notification.attempts);
63:         } else {
64:           console.error(`Failed to deliver notification after ${this.retryAttempts} attempts:`, error);
65:         }
66:       }
67:     }
68: 
69:     this.processing = false;
70:   }
<- CUT CONTENT ->
72:   async deliverNotification(notification) {
73:     const userSubscribers = this.subscribers.get(notification.userId);
74:     
75:     if (!userSubscribers || !userSubscribers.has(notification.channel)) {
76:       return;
77:     }
78: 
79:     const callbacks = userSubscribers.get(notification.channel);
80:     
81:     const promises = callbacks.map(callback => {
82:       return new Promise((resolve, reject) => {
83:         try {
84:           const result = callback(notification);
85:           if (result instanceof Promise) {
86:             result.then(resolve).catch(reject);
87:           } else {
88:             resolve(result);
89:           }
90:         } catch (error) {
91:           reject(error);
92:         }
93:       });
94:     });
95: 
96:     await Promise.all(promises);
97:   }
<- CUT CONTENT ->
111:   unsubscribeUser(userId) {
112:     return this.subscribers.delete(userId);
113:   }
<- CUT CONTENT ->

<!-- controllers/UserController.js -->
<- CUT CONTENT ->
45: class UserController {
46:   constructor(notificationService, userService) {
47:     this.notifications = notificationService;
48:     this.userService = userService;
49:     this.activeSubscriptions = new Map();
50:   }
51:   
52:   async registerUser(req, res) {
53:     try {
54:       const user = await this.userService.createUser(req.body);
55:       
56:       // Subscribe user to welcome notifications
57:       const unsubscribe = this.notifications.subscribe(
58:         user.id,
59:         'welcome',
60:         async (notification) => {
61:           await this.sendWelcomeEmail(user.email, notification.data);
62:         }
63:       );
64:       
65:       this.activeSubscriptions.set(user.id, unsubscribe);
66:       
67:       // Send initial welcome notification
68:       await this.notifications.notify(user.id, 'welcome', {
69:         userName: user.name,
70:         registrationDate: new Date()
71:       });
72:       
73:       res.status(201).json(user);
74:     } catch (error) {
75:       res.status(400).json({ error: error.message });
76:     }
77:   }
78:   
79:   async deleteUser(req, res) {
80:     const { userId } = req.params;
81:     
82:     // Unsubscribe from all notifications
83:     this.notifications.unsubscribeUser(userId);
84:     
85:     // Try to call the individual unsubscribe function
86:     const unsubscribe = this.activeSubscriptions.get(userId);
87:     if (unsubscribe) {
88:       unsubscribe(); // This might fail after unsubscribeUser
89:       this.activeSubscriptions.delete(userId);
90:     }
91:     
92:     await this.userService.deleteUser(userId);
93:     res.status(204).send();
94:   }
<- CUT CONTENT ->

<!-- services/OrderService.js -->
<- CUT CONTENT ->
112: class OrderService {
113:   constructor(notificationService, paymentService) {
114:     this.notifications = notificationService;
115:     this.paymentService = paymentService;
116:   }
117:   
118:   async createOrder(orderData) {
119:     const order = await this.saveOrder(orderData);
120:     
121:     // Notify user about order creation
122:     await this.notifications.notify(
123:       order.userId,
124:       'order-updates',
125:       {
126:         orderId: order.id,
127:         status: 'created',
128:         items: order.items
129:       }
130:     );
131:     
132:     // Process payment asynchronously
133:     this.processPaymentWithRetry(order);
134:     
135:     return order;
136:   }
137:   
138:   async processPaymentWithRetry(order) {
139:     try {
140:       const payment = await this.paymentService.processPayment(order);
141:       
142:       await this.notifications.notify(
143:         order.userId,
144:         'payment-status',
145:         {
146:           orderId: order.id,
147:           status: 'success',
148:           transactionId: payment.transactionId
149:         }
150:       );
151:     } catch (error) {
152:       // Payment failed - notification retry will handle this
153:       await this.notifications.notify(
154:         order.userId,
155:         'payment-status',
156:         {
157:           orderId: order.id,
158:           status: 'failed',
159:           error: error.message
160:         }
161:       );
162:     }
163:   }
<- CUT CONTENT ->

<!-- services/AdminService.js -->
<- CUT CONTENT ->
78: class AdminService {
79:   constructor(notificationService) {
80:     this.notifications = notificationService;
81:   }
82:   
83:   async broadcastSystemUpdate(updateInfo) {
84:     // Broadcast to all users on system channel
85:     await this.notifications.broadcast('system-updates', {
86:       type: 'maintenance',
87:       message: updateInfo.message,
88:       scheduledTime: updateInfo.scheduledTime
89:     });
90:   }
91:   
92:   async getNotificationMetrics() {
93:     const queueSize = this.notifications.getQueueSize();
94:     const systemSubscribers = this.notifications.getSubscriberCount('system-updates');
95:     
96:     return {
97:       pendingNotifications: queueSize,
98:       systemChannelSubscribers: systemSubscribers,
99:       timestamp: new Date()
100:     };
101:   }
102:   
103:   async flushNotificationQueue() {
104:     const currentSize = this.notifications.getQueueSize();
105:     this.notifications.clearQueue();
106:     
107:     // Notify admins about queue flush
108:     await this.notifications.notify(
109:       'admin',
110:       'admin-alerts',
111:       {
112:         action: 'queue_flushed',
113:         clearedCount: currentSize
114:       }
115:     );
116:   }
<- CUT CONTENT ->
```
### suggestions.json
```json
{
    "overallSummary": "Este PR implementa um serviço de notificações com suporte a múltiplos canais, filas e retry. Foram identificados dois problemas críticos: o processQueue não é chamado quando notificações falhadas são re-adicionadas à fila, e o unsubscribe closure pode acessar dados desatualizados após o usuário ser removido.",
    "codeSuggestions": [
        {
            "relevantFile": "services/NotificationService.js",
            "language": "javascript",
            "suggestionContent": "Quando uma notificação falha e é re-adicionada à fila no setTimeout, o código não verifica se processing ainda é false. Se o processamento terminou antes do setTimeout executar, a notificação ficará na fila indefinidamente sem ser processada, pois processQueue não será chamado novamente. Isso afeta OrderService.processPaymentWithRetry (linha 152-161) que depende do retry de notificações para informar falhas de pagamento, e AdminService.flushNotificationQueue (linha 108-115) que pode não limpar notificações pendentes de retry.",
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
            "suggestionContent": "A função de unsubscribe retornada captura userChannels por referência. Se o usuário for completamente removido via unsubscribeUser(), userChannels não existirá mais em this.subscribers, mas a closure ainda tentará acessá-lo. Isso causa um erro quando alguém tenta chamar a função de unsubscribe após o usuário ser removido. UserController.deleteUser (linha 83-88) demonstra exatamente esse problema: chama unsubscribeUser() primeiro e depois tenta chamar a função unsubscribe individual, o que resultará em erro.",
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