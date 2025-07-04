import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateQuantity, removeItem } from '../store/cartSlice';

const ShoppingCart = ({ onCheckout }) => {
  const dispatch = useDispatch();
  const cartItems = useSelector(state => state.cart.items);
  const [promoCode, setPromoCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (promoCode) {
      validatePromoCode(promoCode);
    }
  }, [promoCode]);

  const validatePromoCode = async (code) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/promo/validate?code=${code}`);
      const data = await response.json();
      
      if (data.valid) {
        setDiscount(data.discountPercentage);
      } else {
        setDiscount(0);
      }
    } catch (error) {
      console.error('Error validating promo code:', error);
      setDiscount(0);
    }
    setIsLoading(false);
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discountAmount = subtotal * (discount / 100);
    return subtotal - discountAmount;
  };

  const handleQuantityChange = (itemId, newQuantity) => {
    if (newQuantity >= 0) {
      dispatch(updateQuantity({ id: itemId, quantity: newQuantity }));
    }
  };

  const handleRemoveItem = (itemId) => {
    const item = cartItems.find(item => item.id === itemId);
    if (window.confirm(`Remove ${item.name} from cart?`)) {
      dispatch(removeItem(itemId));
    }
  };

  const formatPrice = (price) => {
    return `$${price.toFixed(2)}`;
  };

  const getStockStatus = (item) => {
    if (item.stock === 0) {
      return { message: 'Out of stock', canPurchase: false };
    }
    if (item.stock < item.quantity) {
      return { message: `Only ${item.stock} available`, canPurchase: false };
    }
    if (item.stock <= 5) {
      return { message: 'Low stock', canPurchase: true };
    }
    return { message: '', canPurchase: true };
  };

  const canCheckout = () => {
    return cartItems.length > 0 && 
           cartItems.every(item => getStockStatus(item).canPurchase);
  };

  return (
    <div className="shopping-cart">
      <h2>Your Shopping Cart</h2>
      
      {cartItems.length === 0 ? (
        <p className="empty-cart">Your cart is empty</p>
      ) : (
        <>
          <div className="cart-items">
            {cartItems.map(item => {
              const stockStatus = getStockStatus(item);
              
              return (
                <div key={item.id} className="cart-item">
                  <img src={item.image} alt={item.name} />
                  <div className="item-details">
                    <h3>{item.name}</h3>
                    <p className="price">{formatPrice(item.price)}</p>
                    {stockStatus.message && (
                      <p className={`stock-status ${stockStatus.canPurchase ? 'warning' : 'error'}`}>
                        {stockStatus.message}
                      </p>
                    )}
                  </div>
                  <div className="quantity-controls">
                    <button 
                      onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                      disabled={item.quantity === 0}
                    >
                      -
                    </button>
                    <input 
                      type="number" 
                      value={item.quantity}
                      onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value))}
                      min="0"
                    />
                    <button 
                      onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                      disabled={item.quantity >= item.stock}
                    >
                      +
                    </button>
                  </div>
                  <button 
                    className="remove-btn"
                    onClick={() => handleRemoveItem(item.id)}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>

          <div className="cart-summary">
            <div className="promo-code">
              <input 
                type="text"
                placeholder="Enter promo code"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                disabled={isLoading}
              />
              {isLoading && <span>Validating...</span>}
            </div>

            <div className="totals">
              <div className="subtotal">
                <span>Subtotal:</span>
                <span>{formatPrice(calculateSubtotal())}</span>
              </div>
              {discount > 0 && (
                <div className="discount">
                  <span>Discount ({discount}%):</span>
                  <span>-{formatPrice(calculateSubtotal() * (discount / 100))}</span>
                </div>
              )}
              <div className="total">
                <span>Total:</span>
                <span>{formatPrice(calculateTotal())}</span>
              </div>
            </div>

            <button 
              className="checkout-btn"
              onClick={() => onCheckout(calculateTotal())}
              disabled={!canCheckout()}
            >
              Proceed to Checkout
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ShoppingCart; 