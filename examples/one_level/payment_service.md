## Example 001 - Payment Service

### diff
```diff
## file: 'services/paymentService.js'

@@ -0,0 +1,101 @@
__new hunk__
1 +class PaymentService {
2 +  constructor(database, emailService) {
3 +    this.db = database;
4 +    this.emailService = emailService;
5 +    this.processingPayments = new Set();
6 +  }
7 +
8 +  async processPayment(orderId, paymentMethod, amount) {
9 +    if (this.processingPayments.has(orderId)) {
10 +      throw new Error('Payment already in progress');
11 +    }
12 +
13 +    this.processingPayments.add(orderId);
14 +
15 +    try {
16 +      const order = await this.db.orders.findById(orderId);
17 +      
18 +      if (!order) {
19 +        throw new Error('Order not found');
20 +      }
21 +
22 +      if (order.status !== 'pending') {
23 +        throw new Error('Order is not in pending status');
24 +      }
25 +
26 +      const paymentResult = await this.chargePayment(paymentMethod, amount);
27 +      
28 +      if (paymentResult.success) {
29 +        order.status = 'paid';
30 +        order.paymentId = paymentResult.transactionId;
31 +        await this.db.orders.update(order);
32 +        
33 +        await this.emailService.sendPaymentConfirmation(order.userEmail, {
34 +          orderId: order.id,
35 +          amount: amount,
36 +          transactionId: paymentResult.transactionId
37 +        });
38 +      }
39 +
40 +      this.processingPayments.delete(orderId);
41 +      return paymentResult;
42 +
43 +    } catch (error) {
44 +      this.processingPayments.delete(orderId);
45 +      throw error;
46 +    }
47 +  }
48 +
49 +  async chargePayment(paymentMethod, amount) {
50 +    // Simulate payment processing
51 +    await new Promise(resolve => setTimeout(resolve, 1000));
52 +    
53 +    return {
54 +      success: Math.random() > 0.1,
55 +      transactionId: `txn_${Date.now()}`
56 +    };
57 +  }
58 +
59 +  calculateDiscount(items, discountCode) {
60 +    let totalDiscount = 0;
61 +    
62 +    if (discountCode && discountCode.type === 'percentage') {
63 +      items.forEach(item => {
64 +        const itemDiscount = item.price * (discountCode.value / 100);
65 +        totalDiscount += itemDiscount;
66 +      });
67 +    }
68 +    
69 +    if (discountCode && discountCode.type === 'fixed') {
70 +      totalDiscount = discountCode.value;
71 +    }
72 +    
73 +    return totalDiscount;
74 +  }
75 +
76 +  validateCreditCard(cardNumber) {
77 +    const cleaned = cardNumber.replace(/\s/g, '');
78 +    
79 +    if (cleaned.length < 13 || cleaned.length > 19) {
80 +      return false;
81 +    }
82 +    
83 +    let sum = 0;
84 +    let isEven = false;
85 +    
86 +    for (let i = cleaned.length - 1; i >= 0; i--) {
87 +      let digit = parseInt(cleaned[i]);
88 +      
89 +      if (isEven) {
90 +        digit *= 2;
91 +        if (digit > 9) {
92 +          digit -= 9;
93 +        }
94 +      }
95 +      
96 +      sum += digit;
97 +      isEven = !isEven;
98 +    }
99 +    
100 +    return sum % 10 === 0;
101 +  }
102 +}
103 +
104 +module.exports = PaymentService;
```

### files
```
<!-- services/paymentService.js -->
<- CUT CONTENT ->
1: class PaymentService {
2:   constructor(database, emailService) {
3:     this.db = database;
4:     this.emailService = emailService;
5:     this.processingPayments = new Set();
6:   }
7:
8:   async processPayment(orderId, paymentMethod, amount) {
9:     if (this.processingPayments.has(orderId)) {
10:       throw new Error('Payment already in progress');
11:     }
12:
13:     this.processingPayments.add(orderId);
14:
15:     try {
16:       const order = await this.db.orders.findById(orderId);
17:       
18:       if (!order) {
19:         throw new Error('Order not found');
20:       }
21:
22:       if (order.status !== 'pending') {
23:         throw new Error('Order is not in pending status');
24:       }
25:
26:       const paymentResult = await this.chargePayment(paymentMethod, amount);
27:       
28:       if (paymentResult.success) {
29:         order.status = 'paid';
30:         order.paymentId = paymentResult.transactionId;
31:         await this.db.orders.update(order);
32:         
33:         await this.emailService.sendPaymentConfirmation(order.userEmail, {
34:           orderId: order.id,
35:           amount: amount,
36:           transactionId: paymentResult.transactionId
37:         });
38:       }
39:
40:       this.processingPayments.delete(orderId);
41:       return paymentResult;
42:
43:     } catch (error) {
44:       this.processingPayments.delete(orderId);
45:       throw error;
46:     }
47:   }
<- CUT CONTENT ->
76:   validateCreditCard(cardNumber) {
77:     const cleaned = cardNumber.replace(/\s/g, '');
78:     
79:     if (cleaned.length < 13 || cleaned.length > 19) {
80:       return false;
81:     }
82:     
83:     let sum = 0;
84:     let isEven = false;
85:     
86:     for (let i = cleaned.length - 1; i >= 0; i--) {
87:       let digit = parseInt(cleaned[i]);
88:       
89:       if (isEven) {
90:         digit *= 2;
91:         if (digit > 9) {
92:           digit -= 9;
93:         }
94:       }
95:       
96:       sum += digit;
97:       isEven = !isEven;
98:     }
99:     
100:     return sum % 10 === 0;
101:   }
<- CUT CONTENT ->

<!-- controllers/checkoutController.js -->
<- CUT CONTENT ->
58: class CheckoutController {
59:   async processCheckout(req, res) {
60:     try {
61:       const { orderId, paymentMethod, amount } = req.body;
62:       
63:       const result = await this.paymentService.processPayment(orderId, paymentMethod, amount);
64:       
65:       if (result.success) {
66:         res.json({ 
67:           success: true, 
68:           transactionId: result.transactionId,
69:           message: 'Payment processed successfully' 
70:         });
71:       } else {
72:         res.status(400).json({ 
73:           success: false, 
74:           error: 'Payment failed' 
75:         });
76:       }
77:     } catch (error) {
78:       res.status(500).json({ error: error.message });
79:     }
80:   }
<- CUT CONTENT ->

<!-- services/orderService.js -->
<- CUT CONTENT ->
124: class OrderService {
125:   async completeOrder(orderId, paymentData) {
126:     const order = await this.db.orders.findById(orderId);
127:     
128:     if (!order) {
129:       throw new Error('Order not found');
130:     }
131:     
132:     const paymentResult = await this.paymentService.processPayment(
133:       orderId, 
134:       paymentData.method, 
135:       order.totalAmount
136:     );
137:     
138:     if (paymentResult && paymentResult.success) {
139:       await this.updateOrderStatus(orderId, 'completed');
140:       await this.inventory.reserveItems(order.items);
141:       return { success: true, orderId, transactionId: paymentResult.transactionId };
142:     } else {
143:       await this.updateOrderStatus(orderId, 'payment_failed');
144:       return { success: false, orderId, error: 'Payment processing failed' };
145:     }
146:   }
<- CUT CONTENT ->

<!-- services/refundService.js -->
<- CUT CONTENT ->
89: class RefundService {
90:   async processRefund(orderId, refundData) {
91:     const { cardNumber, amount } = refundData;
92:     
93:     if (!this.paymentService.validateCreditCard(cardNumber)) {
94:       throw new Error('Invalid credit card number for refund');
95:     }
96:     
97:     const order = await this.db.orders.findById(orderId);
98:     if (!order || order.status !== 'paid') {
99:       throw new Error('Order not eligible for refund');
100:     }
101:     
102:     return await this.processRefundTransaction(order, amount);
103:   }
<- CUT CONTENT ->

<!-- middleware/paymentValidation.js -->
<- CUT CONTENT ->
34: class PaymentValidationMiddleware {
35:   validatePaymentData(req, res, next) {
36:     const { paymentMethod } = req.body;
37:     
38:     if (paymentMethod.type === 'credit_card') {
39:       const isValid = this.paymentService.validateCreditCard(paymentMethod.cardNumber);
40:       
41:       if (!isValid) {
42:         return res.status(400).json({ 
43:           error: 'Invalid credit card number' 
44:         });
45:       }
46:     }
47:     
48:     next();
49:   }
<- CUT CONTENT ->
```

### suggestions.json
```json
{
    "overallSummary": "Este PR introduz um serviço de pagamento com funcionalidades de processamento, validação e cálculo de descontos. Foram identificados dois problemas críticos: o método processPayment não retorna o resultado quando o pagamento falha, e o validateCreditCard não valida se a entrada contém apenas dígitos antes do processamento.",
    "codeSuggestions": [
        {
            "relevantFile": "services/paymentService.js",
            "language": "javascript",
            "suggestionContent": "O método `processPayment` tem um bug sutil mas crítico: quando `paymentResult.success` é false, o método não retorna nada (undefined). O código remove o orderId do Set de processamento mas não retorna o paymentResult, causando comportamento inconsistente para o chamador que espera sempre receber um resultado. Isso quebra o CheckoutController (linha 66) que verifica `result.success` e pode tentar acessar propriedades de undefined, e o OrderService (linha 138) que faz `paymentResult && paymentResult.success` indicando que já teve que se defender contra este bug.",
            "existingCode": "if (paymentResult.success) {\n  order.status = 'paid';\n  order.paymentId = paymentResult.transactionId;\n  await this.db.orders.update(order);\n  \n  await this.emailService.sendPaymentConfirmation(order.userEmail, {\n    orderId: order.id,\n    amount: amount,\n    transactionId: paymentResult.transactionId\n  });\n}\n\nthis.processingPayments.delete(orderId);\nreturn paymentResult;",
            "improvedCode": "if (paymentResult.success) {\n  order.status = 'paid';\n  order.paymentId = paymentResult.transactionId;\n  await this.db.orders.update(order);\n  \n  await this.emailService.sendPaymentConfirmation(order.userEmail, {\n    orderId: order.id,\n    amount: amount,\n    transactionId: paymentResult.transactionId\n  });\n}\n\nthis.processingPayments.delete(orderId);\nreturn paymentResult;",
            "oneSentenceSummary": "Garanta que paymentResult seja sempre retornado, independentemente do sucesso do pagamento",
            "relevantLinesStart": 28,
            "relevantLinesEnd": 41,
            "label": "logic_error"
        },
        {
            "relevantFile": "services/paymentService.js",
            "language": "javascript",
            "suggestionContent": "O método `validateCreditCard` não valida se o cartão contém apenas dígitos após remover espaços. Se a entrada contiver letras ou caracteres especiais, `parseInt()` retornará NaN, que quando somado resulta em NaN. Como `NaN % 10` também é NaN (que é falsy), a validação pode retornar false para entradas inválidas por coincidência, mas o comportamento é incorreto e imprevisível. Isso afeta o RefundService (linha 93) que confia nesta validação para processar estornos e o PaymentValidationMiddleware (linha 39) que usa este método para validar dados de pagamento em requests HTTP.",
            "existingCode": "const cleaned = cardNumber.replace(/\\s/g, '');\n\nif (cleaned.length < 13 || cleaned.length > 19) {\n  return false;\n}\n\nlet sum = 0;\nlet isEven = false;\n\nfor (let i = cleaned.length - 1; i >= 0; i--) {\n  let digit = parseInt(cleaned[i]);",
            "improvedCode": "const cleaned = cardNumber.replace(/\\s/g, '');\n\nif (!/^\\d+$/.test(cleaned)) {\n  return false;\n}\n\nif (cleaned.length < 13 || cleaned.length > 19) {\n  return false;\n}\n\nlet sum = 0;\nlet isEven = false;\n\nfor (let i = cleaned.length - 1; i >= 0; i--) {\n  let digit = parseInt(cleaned[i]);",
            "oneSentenceSummary": "Adicione validação para garantir que o número do cartão contenha apenas dígitos",
            "relevantLinesStart": 76,
            "relevantLinesEnd": 87,
            "label": "type_comparison"
        }
    ]
}
```