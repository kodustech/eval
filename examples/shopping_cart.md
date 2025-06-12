## Example 002 - Shopping Cart Component

### file.js
```javascript
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
```

### diff.txt
```diff
## file: 'components/ShoppingCart.jsx'

@@ -0,0 +1,177 @@
__new hunk__
1 +import React, { useState, useEffect } from 'react';
2 +import { useDispatch, useSelector } from 'react-redux';
3 +import { updateQuantity, removeItem } from '../store/cartSlice';
4 +
5 +const ShoppingCart = ({ onCheckout }) => {
6 +  const dispatch = useDispatch();
7 +  const cartItems = useSelector(state => state.cart.items);
8 +  const [promoCode, setPromoCode] = useState('');
9 +  const [discount, setDiscount] = useState(0);
10 +  const [isLoading, setIsLoading] = useState(false);
11 +
12 +  useEffect(() => {
13 +    if (promoCode) {
14 +      validatePromoCode(promoCode);
15 +    }
16 +  }, [promoCode]);
17 +
18 +  const validatePromoCode = async (code) => {
19 +    setIsLoading(true);
20 +    try {
21 +      const response = await fetch(`/api/promo/validate?code=${code}`);
22 +      const data = await response.json();
23 +      
24 +      if (data.valid) {
25 +        setDiscount(data.discountPercentage);
26 +      } else {
27 +        setDiscount(0);
28 +      }
29 +    } catch (error) {
30 +      console.error('Error validating promo code:', error);
31 +      setDiscount(0);
32 +    }
33 +    setIsLoading(false);
34 +  };
35 +
36 +  const calculateSubtotal = () => {
37 +    return cartItems.reduce((total, item) => {
38 +      return total + (item.price * item.quantity);
39 +    }, 0);
40 +  };
41 +
42 +  const calculateTotal = () => {
43 +    const subtotal = calculateSubtotal();
44 +    const discountAmount = subtotal * (discount / 100);
45 +    return subtotal - discountAmount;
46 +  };
47 +
48 +  const handleQuantityChange = (itemId, newQuantity) => {
49 +    if (newQuantity >= 0) {
50 +      dispatch(updateQuantity({ id: itemId, quantity: newQuantity }));
51 +    }
52 +  };
53 +
54 +  const handleRemoveItem = (itemId) => {
55 +    const item = cartItems.find(item => item.id === itemId);
56 +    if (window.confirm(`Remove ${item.name} from cart?`)) {
57 +      dispatch(removeItem(itemId));
58 +    }
59 +  };
60 +
61 +  const formatPrice = (price) => {
62 +    return `$${price.toFixed(2)}`;
63 +  };
64 +
65 +  const getStockStatus = (item) => {
66 +    if (item.stock === 0) {
67 +      return { message: 'Out of stock', canPurchase: false };
68 +    }
69 +    if (item.stock < item.quantity) {
70 +      return { message: `Only ${item.stock} available`, canPurchase: false };
71 +    }
72 +    if (item.stock <= 5) {
73 +      return { message: 'Low stock', canPurchase: true };
74 +    }
75 +    return { message: '', canPurchase: true };
76 +  };
77 +
78 +  const canCheckout = () => {
79 +    return cartItems.length > 0 && 
80 +           cartItems.every(item => getStockStatus(item).canPurchase);
81 +  };
82 +
83 +  return (
84 +    <div className="shopping-cart">
85 +      <h2>Your Shopping Cart</h2>
86 +      
87 +      {cartItems.length === 0 ? (
88 +        <p className="empty-cart">Your cart is empty</p>
89 +      ) : (
90 +        <>
91 +          <div className="cart-items">
92 +            {cartItems.map(item => {
93 +              const stockStatus = getStockStatus(item);
94 +              
95 +              return (
96 +                <div key={item.id} className="cart-item">
97 +                  <img src={item.image} alt={item.name} />
98 +                  <div className="item-details">
99 +                    <h3>{item.name}</h3>
100 +                    <p className="price">{formatPrice(item.price)}</p>
101 +                    {stockStatus.message && (
102 +                      <p className={`stock-status ${stockStatus.canPurchase ? 'warning' : 'error'}`}>
103 +                        {stockStatus.message}
104 +                      </p>
105 +                    )}
106 +                  </div>
107 +                  <div className="quantity-controls">
108 +                    <button 
109 +                      onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
110 +                      disabled={item.quantity === 0}
111 +                    >
112 +                      -
113 +                    </button>
114 +                    <input 
115 +                      type="number" 
116 +                      value={item.quantity}
117 +                      onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value))}
118 +                      min="0"
119 +                    />
120 +                    <button 
121 +                      onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
122 +                      disabled={item.quantity >= item.stock}
123 +                    >
124 +                      +
125 +                    </button>
126 +                  </div>
127 +                  <button 
128 +                    className="remove-btn"
129 +                    onClick={() => handleRemoveItem(item.id)}
130 +                  >
131 +                    Remove
132 +                  </button>
133 +                </div>
134 +              );
135 +            })}
136 +          </div>
137 +
138 +          <div className="cart-summary">
139 +            <div className="promo-code">
140 +              <input 
141 +                type="text"
142 +                placeholder="Enter promo code"
143 +                value={promoCode}
144 +                onChange={(e) => setPromoCode(e.target.value)}
145 +                disabled={isLoading}
146 +              />
147 +              {isLoading && <span>Validating...</span>}
148 +            </div>
149 +
150 +            <div className="totals">
151 +              <div className="subtotal">
152 +                <span>Subtotal:</span>
153 +                <span>{formatPrice(calculateSubtotal())}</span>
154 +              </div>
155 +              {discount > 0 && (
156 +                <div className="discount">
157 +                  <span>Discount ({discount}%):</span>
158 +                  <span>-{formatPrice(calculateSubtotal() * (discount / 100))}</span>
159 +                </div>
160 +              )}
161 +              <div className="total">
162 +                <span>Total:</span>
163 +                <span>{formatPrice(calculateTotal())}</span>
164 +              </div>
165 +            </div>
166 +
167 +            <button 
168 +              className="checkout-btn"
169 +              onClick={() => onCheckout(calculateTotal())}
170 +              disabled={!canCheckout()}
171 +            >
172 +              Proceed to Checkout
173 +            </button>
174 +          </div>
175 +        </>
176 +      )}
177 +    </div>
178 +  );
179 +};
180 +
181 +export default ShoppingCart;
```

### suggestions.json
```json
{
    "overallSummary": "Este PR adiciona um componente de carrinho de compras com funcionalidades de gerenciamento de itens, validação de códigos promocionais e cálculo de totais. Foram identificados três problemas: o useEffect valida códigos promocionais a cada digitação causando excesso de requisições, handleQuantityChange com parseInt pode resultar em NaN, e handleRemoveItem não verifica se o item existe antes de acessar suas propriedades.",
    "codeSuggestions": [
        {
            "relevantFile": "components/ShoppingCart.jsx",
            "language": "javascript",
            "suggestionContent": "O useEffect que valida o código promocional é executado a cada mudança no input, causando uma requisição HTTP para cada caractere digitado. Isso pode sobrecarregar o servidor e criar uma experiência ruim para o usuário. Implemente debounce ou valide apenas quando o usuário terminar de digitar (blur) ou clicar em um botão.",
            "existingCode": "useEffect(() => {\n  if (promoCode) {\n    validatePromoCode(promoCode);\n  }\n}, [promoCode]);",
            "improvedCode": "useEffect(() => {\n  if (promoCode) {\n    const timeoutId = setTimeout(() => {\n      validatePromoCode(promoCode);\n    }, 500);\n    \n    return () => clearTimeout(timeoutId);\n  }\n}, [promoCode]);",
            "oneSentenceSummary": "Implemente debounce no useEffect para evitar validações excessivas do código promocional",
            "relevantLinesStart": 12,
            "relevantLinesEnd": 16,
            "label": "async_error"
        },
        {
            "relevantFile": "components/ShoppingCart.jsx",
            "language": "javascript",
            "suggestionContent": "No input de quantidade, parseInt(e.target.value) retornará NaN se o usuário apagar todo o conteúdo ou inserir texto não numérico. Quando NaN é passado para handleQuantityChange, a condição newQuantity >= 0 é false (pois NaN >= 0 é false), então nada acontece, mas o input mostra NaN para o usuário.",
            "existingCode": "onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value))}",
            "improvedCode": "onChange={(e) => {\n  const value = parseInt(e.target.value);\n  handleQuantityChange(item.id, isNaN(value) ? 0 : value);\n}}",
            "oneSentenceSummary": "Trate o caso de NaN ao converter o valor do input para número",
            "relevantLinesStart": 117,
            "relevantLinesEnd": 117,
            "label": "type_comparison"
        },
        {
            "relevantFile": "components/ShoppingCart.jsx",
            "language": "javascript",
            "suggestionContent": "O método handleRemoveItem busca o item no array mas não verifica se ele foi encontrado antes de acessar item.name. Se o item não existir (por exemplo, se foi removido em outra aba), o código tentará acessar a propriedade name de undefined, causando um erro.",
            "existingCode": "const handleRemoveItem = (itemId) => {\n  const item = cartItems.find(item => item.id === itemId);\n  if (window.confirm(`Remove ${item.name} from cart?`)) {\n    dispatch(removeItem(itemId));\n  }\n};",
            "improvedCode": "const handleRemoveItem = (itemId) => {\n  const item = cartItems.find(item => item.id === itemId);\n  if (!item) {\n    return;\n  }\n  if (window.confirm(`Remove ${item.name} from cart?`)) {\n    dispatch(removeItem(itemId));\n  }\n};",
            "oneSentenceSummary": "Verifique se o item existe antes de acessar suas propriedades em handleRemoveItem",
            "relevantLinesStart": 54,
            "relevantLinesEnd": 59,
            "label": "null_pointer"
        }
    ]
}
```