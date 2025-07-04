## Example 002 - Shopping Cart Component

### diff
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

### files
```
<!-- components/ShoppingCart.jsx -->
<- CUT CONTENT ->
12:   useEffect(() => {
13:     if (promoCode) {
14:       validatePromoCode(promoCode);
15:     }
16:   }, [promoCode]);
<- CUT CONTENT ->
48:   const handleQuantityChange = (itemId, newQuantity) => {
49:     if (newQuantity >= 0) {
50:       dispatch(updateQuantity({ id: itemId, quantity: newQuantity }));
51:     }
52:   };
53:
54:   const handleRemoveItem = (itemId) => {
55:     const item = cartItems.find(item => item.id === itemId);
56:     if (window.confirm(`Remove ${item.name} from cart?`)) {
57:       dispatch(removeItem(itemId));
58:     }
59:   };
<- CUT CONTENT ->
114:                     <input 
115:                       type="number" 
116:                       value={item.quantity}
117:                       onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value))}
118:                       min="0"
119:                     />
<- CUT CONTENT ->

<!-- pages/CheckoutPage.jsx -->
<- CUT CONTENT ->
67: const CheckoutPage = () => {
68:   const [checkoutData, setCheckoutData] = useState(null);
69:   const navigate = useNavigate();
70:   
71:   const handleCartCheckout = (totalAmount) => {
72:     setCheckoutData({
73:       total: totalAmount,
74:       timestamp: new Date().toISOString()
75:     });
76:     
77:     navigate('/payment', { 
78:       state: { amount: totalAmount, source: 'cart' }
79:     });
80:   };
81:   
82:   return (
83:     <div className="checkout-page">
84:       <ShoppingCart onCheckout={handleCartCheckout} />
85:       <OrderSummary checkoutData={checkoutData} />
86:     </div>
87:   );
88: };
<- CUT CONTENT ->

<!-- hooks/usePromoCode.js -->
<- CUT CONTENT ->
23: const usePromoCode = () => {
24:   const [validationCache, setValidationCache] = useState({});
25:   const [isValidating, setIsValidating] = useState(false);
26:   
27:   const validatePromoCode = useCallback(async (code) => {
28:     if (validationCache[code]) {
29:       return validationCache[code];
30:     }
31:     
32:     setIsValidating(true);
33:     try {
34:       const response = await fetch(`/api/promo/validate?code=${code}`);
35:       const data = await response.json();
36:       
37:       setValidationCache(prev => ({
38:         ...prev,
39:         [code]: data
40:       }));
41:       
42:       return data;
43:     } catch (error) {
44:       console.error('Promo validation failed:', error);
45:       return { valid: false };
46:     } finally {
47:       setIsValidating(false);
48:     }
49:   }, [validationCache]);
<- CUT CONTENT ->

<!-- components/ProductCard.jsx -->
<- CUT CONTENT ->
156: const ProductCard = ({ product }) => {
157:   const dispatch = useDispatch();
158:   
159:   const handleAddToCart = () => {
160:     const cartItem = {
161:       id: product.id,
162:       name: product.name,
163:       price: product.price,
164:       quantity: 1,
165:       stock: product.stock
166:     };
167:     
168:     dispatch(addToCart(cartItem));
169:   };
170:   
171:   const handleQuickRemove = () => {
172:     // Direct removal without confirmation - relies on ShoppingCart's handleRemoveItem
173:     if (window.confirm(`Remove ${product.name}?`)) {
174:       dispatch(removeItem(product.id));
175:     }
176:   };
<- CUT CONTENT ->

<!-- store/cartSlice.js -->
<- CUT CONTENT ->
89: const cartSlice = createSlice({
90:   name: 'cart',
91:   initialState: {
92:     items: [],
93:     totalItems: 0
94:   },
95:   reducers: {
96:     updateQuantity: (state, action) => {
97:       const { id, quantity } = action.payload;
98:       const item = state.items.find(item => item.id === id);
99:       
100:       if (item && quantity >= 0) {
101:         item.quantity = quantity;
102:         state.totalItems = state.items.reduce((total, item) => total + item.quantity, 0);
103:       }
104:     },
105:     removeItem: (state, action) => {
106:       const itemId = action.payload;
107:       state.items = state.items.filter(item => item.id !== itemId);
108:       state.totalItems = state.items.reduce((total, item) => total + item.quantity, 0);
109:     }
110:   }
111: });
<- CUT CONTENT ->
```

### suggestions.json
```json
{
    "overallSummary": "Este PR adiciona um componente de carrinho de compras com funcionalidades de gerenciamento de itens, validação de códigos promocionais e cálculo de totais. Foram identificados três problemas: o useEffect valida códigos promocionais a cada digitação causando excesso de requisições, handleQuantityChange com parseInt pode resultar em NaN, e handleRemoveItem não verifica se o item existe antes de acessar suas propriedades.",
    "codeSuggestions": [
        {
            "relevantFile": "components/ShoppingCart.jsx",
            "language": "javascript",
            "suggestionContent": "O useEffect que valida o código promocional é executado a cada mudança no input, causando uma requisição HTTP para cada caractere digitado. Isso pode sobrecarregar o servidor e criar uma experiência ruim para o usuário. O problema afeta também o usePromoCode hook (linha 27) que já implementa cache mas não consegue mitigar as chamadas excessivas vindas do ShoppingCart, e pode causar conflitos com o CheckoutPage (linha 71) que depende dos dados de desconto para calcular o total final.",
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
            "suggestionContent": "No input de quantidade, parseInt(e.target.value) retornará NaN se o usuário apagar todo o conteúdo ou inserir texto não numérico. Quando NaN é passado para handleQuantityChange, a condição newQuantity >= 0 é false (pois NaN >= 0 é false), então nada acontece, mas o input mostra NaN para o usuário. Isso quebra o Redux cartSlice (linha 100) que espera sempre receber números válidos, e pode causar inconsistências no ProductCard (linha 160) que confia na atualização correta das quantidades.",
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
            "suggestionContent": "O método handleRemoveItem busca o item no array mas não verifica se ele foi encontrado antes de acessar item.name. Se o item não existir (por exemplo, se foi removido em outra aba), o código tentará acessar a propriedade name de undefined, causando um erro. Isso também afeta o ProductCard (linha 173) que implementa lógica similar de remoção e pode quebrar quando múltiplos componentes tentam remover o mesmo item simultaneamente, e pode causar inconsistências no cartSlice (linha 107) que assume que os IDs passados sempre existem.",
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