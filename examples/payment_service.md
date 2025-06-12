## Example 001 - Payment Service

### file.js
```javascript
class PaymentService {
  constructor(database, emailService) {
    this.db = database;
    this.emailService = emailService;
    this.processingPayments = new Set();
  }

  async processPayment(orderId, paymentMethod, amount) {
    if (this.processingPayments.has(orderId)) {
      throw new Error('Payment already in progress');
    }

    this.processingPayments.add(orderId);

    try {
      const order = await this.db.orders.findById(orderId);
      
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status !== 'pending') {
        throw new Error('Order is not in pending status');
      }

      const paymentResult = await this.chargePayment(paymentMethod, amount);
      
      if (paymentResult.success) {
        order.status = 'paid';
        order.paymentId = paymentResult.transactionId;
        await this.db.orders.update(order);
        
        await this.emailService.sendPaymentConfirmation(order.userEmail, {
          orderId: order.id,
          amount: amount,
          transactionId: paymentResult.transactionId
        });
      }

      this.processingPayments.delete(orderId);
      return paymentResult;

    } catch (error) {
      this.processingPayments.delete(orderId);
      throw error;
    }
  }

  async chargePayment(paymentMethod, amount) {
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: Math.random() > 0.1,
      transactionId: `txn_${Date.now()}`
    };
  }

  calculateDiscount(items, discountCode) {
    let totalDiscount = 0;
    
    if (discountCode && discountCode.type === 'percentage') {
      items.forEach(item => {
        const itemDiscount = item.price * (discountCode.value / 100);
        totalDiscount += itemDiscount;
      });
    }
    
    if (discountCode && discountCode.type === 'fixed') {
      totalDiscount = discountCode.value;
    }
    
    return totalDiscount;
  }

  validateCreditCard(cardNumber) {
    const cleaned = cardNumber.replace(/\s/g, '');
    
    if (cleaned.length < 13 || cleaned.length > 19) {
      return false;
    }
    
    let sum = 0;
    let isEven = false;
    
    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned[i]);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  }
}

module.exports = PaymentService;
```

### diff.txt
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

### suggestions.json
```json
{
    "overallSummary": "Este PR introduz um serviço de pagamento com funcionalidades de processamento, validação e cálculo de descontos. Foram identificados dois problemas críticos: o método processPayment não retorna o resultado quando o pagamento falha, e o validateCreditCard não valida se a entrada contém apenas dígitos antes do processamento.",
    "codeSuggestions": [
        {
            "relevantFile": "services/paymentService.js",
            "language": "javascript",
            "suggestionContent": "O método `processPayment` tem um bug sutil mas crítico: quando `paymentResult.success` é false, o método não retorna nada (undefined). O código remove o orderId do Set de processamento mas não retorna o paymentResult, causando comportamento inconsistente para o chamador que espera sempre receber um resultado.",
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
            "suggestionContent": "O método `validateCreditCard` não valida se o cartão contém apenas dígitos após remover espaços. Se a entrada contiver letras ou caracteres especiais, `parseInt()` retornará NaN, que quando somado resulta em NaN. Como `NaN % 10` também é NaN (que é falsy), a validação pode retornar false para entradas inválidas por coincidência, mas o comportamento é incorreto e imprevisível.",
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