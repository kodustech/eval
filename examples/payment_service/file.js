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