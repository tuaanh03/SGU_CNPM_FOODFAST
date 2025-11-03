"use client";

import React, { createContext, useContext, useReducer, useEffect, useCallback, type ReactNode } from 'react';
import { cartService } from '@/services/cart.service';
import { getAuthToken } from '@/services/auth.service';
import { toast } from 'sonner';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
}

interface Restaurant {
  id: string;
  name: string;
  imageUrl: string;
}

interface CartState {
  items: CartItem[];
  restaurant: Restaurant | null;
  isOpen: boolean;
  total: number;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: { item: Omit<CartItem, 'quantity'>; restaurant: Restaurant } }
  | { type: 'REMOVE_ITEM'; payload: { id: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'TOGGLE_CART' }
  | { type: 'OPEN_CART' }
  | { type: 'CLOSE_CART' }
  | { type: 'CHANGE_RESTAURANT'; payload: { restaurant: Restaurant; item: Omit<CartItem, 'quantity'> } }
  | { type: 'LOAD_CART'; payload: { items: CartItem[]; restaurant: Restaurant } };

const initialState: CartState = {
  items: [],
  restaurant: null,
  isOpen: false,
  total: 0,
};

function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { item, restaurant } = action.payload;

      // Nếu chưa có nhà hàng hoặc là nhà hàng khác
      if (!state.restaurant || state.restaurant.id !== restaurant.id) {
        // Tạo giỏ hàng mới với nhà hàng mới
        const newItems = [{ ...item, quantity: 1 }];
        return {
          items: newItems,
          restaurant,
          isOpen: true,
          total: calculateTotal(newItems),
        };
      }

      // Cùng nhà hàng, kiểm tra món đã có trong giỏ chưa
      const existingItemIndex = state.items.findIndex(cartItem => cartItem.id === item.id);

      let newItems: CartItem[];
      if (existingItemIndex >= 0) {
        // Món đã có, tăng số lượng
        newItems = state.items.map((cartItem, index) =>
          index === existingItemIndex
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      } else {
        // Món mới, thêm vào giỏ
        newItems = [...state.items, { ...item, quantity: 1 }];
      }

      return {
        ...state,
        items: newItems,
        isOpen: true,
        total: calculateTotal(newItems),
      };
    }

    case 'REMOVE_ITEM': {
      const newItems = state.items.filter(item => item.id !== action.payload.id);
      const newRestaurant = newItems.length === 0 ? null : state.restaurant;

      return {
        ...state,
        items: newItems,
        restaurant: newRestaurant,
        total: calculateTotal(newItems),
      };
    }

    case 'UPDATE_QUANTITY': {
      const { id, quantity } = action.payload;

      if (quantity <= 0) {
        // Xóa món nếu số lượng <= 0
        const newItems = state.items.filter(item => item.id !== id);
        const newRestaurant = newItems.length === 0 ? null : state.restaurant;

        return {
          ...state,
          items: newItems,
          restaurant: newRestaurant,
          total: calculateTotal(newItems),
        };
      }

      const newItems = state.items.map(item =>
        item.id === id ? { ...item, quantity } : item
      );

      return {
        ...state,
        items: newItems,
        total: calculateTotal(newItems),
      };
    }

    case 'CLEAR_CART':
      return {
        items: [],
        restaurant: null,
        isOpen: false,
        total: 0,
      };

    case 'TOGGLE_CART':
      return {
        ...state,
        isOpen: !state.isOpen,
      };

    case 'OPEN_CART':
      return {
        ...state,
        isOpen: true,
      };

    case 'CLOSE_CART':
      return {
        ...state,
        isOpen: false,
      };

    case 'CHANGE_RESTAURANT': {
      const { restaurant, item } = action.payload;
      const newItems = [{ ...item, quantity: 1 }];

      return {
        items: newItems,
        restaurant,
        isOpen: true,
        total: calculateTotal(newItems),
      };
    }

    case 'LOAD_CART': {
      const { items, restaurant } = action.payload;

      return {
        ...state,
        items,
        restaurant,
        total: calculateTotal(items),
      };
    }

    default:
      return state;
  }
}

interface CartContextType {
  state: CartState;
  dispatch: React.Dispatch<CartAction>;
  addItem: (item: Omit<CartItem, 'quantity'>, restaurant: Restaurant) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  getTotalItems: () => number;
  formatPrice: (price: number) => string;
  loadCartForRestaurant: (restaurantId: string, restaurant: Restaurant) => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // Hàm load cart cho restaurant cụ thể
  const loadCartForRestaurant = useCallback(async (restaurantId: string, restaurant: Restaurant) => {
    const token = getAuthToken();
    if (!token) {
      // Không có token → Clear cart
      dispatch({ type: 'CLEAR_CART' });
      return;
    }

    try {
      const response = await cartService.getCart(restaurantId);

      if (response.success && response.data.items.length > 0) {
        // Có cart trong Redis → Load vào state
        const items: CartItem[] = response.data.items.map((item: any) => ({
          id: item.productId,
          name: item.name || item.productName,
          price: item.price || item.productPrice,
          quantity: item.quantity,
          imageUrl: item.image || item.productImage,
        }));

        dispatch({
          type: 'LOAD_CART',
          payload: { items, restaurant }
        });

        // Lưu vào localStorage
        localStorage.setItem('cart_restaurantId', restaurantId);
        localStorage.setItem('cart_restaurant', JSON.stringify(restaurant));
      } else {
        // Không có cart trong Redis cho restaurant này → Clear cart
        // Đảm bảo không hiển thị cart của restaurant khác
        dispatch({ type: 'CLEAR_CART' });
        // Không xóa localStorage vì user có thể quay lại restaurant có cart
      }
    } catch (error) {
      console.error('Error loading cart for restaurant:', error);
      // Nếu API error → Clear cart để tránh hiển thị sai
      dispatch({ type: 'CLEAR_CART' });
    }
  }, []); // Empty deps vì chỉ dùng dispatch và service calls

  // Load giỏ hàng từ localStorage khi component mount (chỉ load nếu có)
  useEffect(() => {
    const loadCartFromLocalStorage = async () => {
      const token = getAuthToken();
      if (!token) return;

      try {
        const savedRestaurantId = localStorage.getItem('cart_restaurantId');
        const savedRestaurant = localStorage.getItem('cart_restaurant');

        if (!savedRestaurantId || !savedRestaurant) return;

        const restaurant: Restaurant = JSON.parse(savedRestaurant);

        // Load cart từ backend
        await loadCartForRestaurant(savedRestaurantId, restaurant);
      } catch (error) {
        console.error('Error loading cart from localStorage:', error);
      }
    };

    loadCartFromLocalStorage();
  }, [loadCartForRestaurant]);

  const addItem = async (item: Omit<CartItem, 'quantity'>, restaurant: Restaurant) => {
    const token = getAuthToken();

    // Logic mới: Cho phép nhiều giỏ hàng từ các restaurant khác nhau
    // Mỗi restaurant có giỏ hàng riêng trong Redis

    if (token) {
      try {
        // Thêm vào giỏ hàng của restaurant
        await cartService.addToCart({
          restaurantId: restaurant.id,
          productId: item.id,
          quantity: 1,
          productName: item.name,
          productPrice: item.price,
          productImage: item.imageUrl,
        });

        // Load lại giỏ hàng của restaurant này từ backend
        const response = await cartService.getCart(restaurant.id);

        if (response.success && response.data.items.length > 0) {
          const items: CartItem[] = response.data.items.map((backendItem: any) => ({
            id: backendItem.productId,
            name: backendItem.name || backendItem.productName,
            price: backendItem.price || backendItem.productPrice,
            quantity: backendItem.quantity,
            imageUrl: backendItem.image || backendItem.productImage,
          }));

          dispatch({
            type: 'LOAD_CART',
            payload: { items, restaurant }
          });
        }

        // Lưu restaurant hiện tại vào localStorage
        localStorage.setItem('cart_restaurantId', restaurant.id);
        localStorage.setItem('cart_restaurant', JSON.stringify(restaurant));

        toast.success('Đã thêm vào giỏ hàng');
      } catch (error: any) {
        console.error('Error syncing cart to backend:', error);
        toast.error(error.message || 'Lỗi khi thêm vào giỏ hàng');
        return;
      }
    } else {
      // Không có token, update local state
      dispatch({
        type: 'ADD_ITEM',
        payload: { item, restaurant }
      });

      localStorage.setItem('cart_restaurantId', restaurant.id);
      localStorage.setItem('cart_restaurant', JSON.stringify(restaurant));

      toast.success('Đã thêm vào giỏ hàng');
    }
  };

  const removeItem = async (id: string) => {
    if (!state.restaurant) return;

    const token = getAuthToken();

    // Nếu có token, đồng bộ với backend
    if (token) {
      try {
        await cartService.removeFromCart(state.restaurant.id, id);

        // Load lại giỏ hàng từ backend
        const response = await cartService.getCart(state.restaurant.id);

        if (response.success) {
          if (response.data.items.length > 0) {
            const items: CartItem[] = response.data.items.map((item: any) => ({
              id: item.productId,
              name: item.name || item.productName,
              price: item.price || item.productPrice,
              quantity: item.quantity,
              imageUrl: item.image || item.productImage,
            }));

            dispatch({
              type: 'LOAD_CART',
              payload: { items, restaurant: state.restaurant }
            });
          } else {
            // Giỏ hàng trống, clear state
            dispatch({ type: 'CLEAR_CART' });
            localStorage.removeItem('cart_restaurantId');
            localStorage.removeItem('cart_restaurant');
          }
        }

        toast.success('Đã xóa khỏi giỏ hàng');
      } catch (error: any) {
        console.error('Error syncing remove to backend:', error);
        toast.error('Lỗi khi xóa khỏi giỏ hàng');
      }
    } else {
      // Không có token, chỉ update local state
      dispatch({ type: 'REMOVE_ITEM', payload: { id } });
      toast.success('Đã xóa khỏi giỏ hàng');
    }
  };

  const updateQuantity = async (id: string, quantity: number) => {
    if (!state.restaurant) return;

    const token = getAuthToken();

    // Nếu có token, đồng bộ với backend
    if (token) {
      try {
        if (quantity <= 0) {
          await cartService.removeFromCart(state.restaurant.id, id);
        } else {
          await cartService.updateQuantity(state.restaurant.id, id, quantity);
        }

        // Load lại giỏ hàng từ backend
        const response = await cartService.getCart(state.restaurant.id);

        if (response.success) {
          if (response.data.items.length > 0) {
            const items: CartItem[] = response.data.items.map((item: any) => ({
              id: item.productId,
              name: item.name || item.productName,
              price: item.price || item.productPrice,
              quantity: item.quantity,
              imageUrl: item.image || item.productImage,
            }));

            dispatch({
              type: 'LOAD_CART',
              payload: { items, restaurant: state.restaurant }
            });
          } else {
            // Giỏ hàng trống, clear state
            dispatch({ type: 'CLEAR_CART' });
            localStorage.removeItem('cart_restaurantId');
            localStorage.removeItem('cart_restaurant');
          }
        }
      } catch (error: any) {
        console.error('Error syncing quantity to backend:', error);
        toast.error('Lỗi khi cập nhật giỏ hàng');
      }
    } else {
      // Không có token, chỉ update local state
      dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
    }
  };

  const clearCart = async () => {
    const token = getAuthToken();

    // Nếu có token và có restaurant, đồng bộ với backend
    if (token && state.restaurant) {
      try {
        await cartService.clearCart(state.restaurant.id);
      } catch (error: any) {
        console.error('Error syncing clear to backend:', error);
      }
    }

    // Xóa localStorage
    localStorage.removeItem('cart_restaurantId');
    localStorage.removeItem('cart_restaurant');

    // Cập nhật local state
    dispatch({ type: 'CLEAR_CART' });
    toast.success('Đã xóa giỏ hàng');
  };

  const toggleCart = () => {
    dispatch({ type: 'TOGGLE_CART' });
  };

  const openCart = () => {
    dispatch({ type: 'OPEN_CART' });
  };

  const closeCart = () => {
    dispatch({ type: 'CLOSE_CART' });
  };

  const getTotalItems = () => {
    return state.items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  return (
    <CartContext.Provider value={{
      state,
      dispatch,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      toggleCart,
      openCart,
      closeCart,
      getTotalItems,
      formatPrice,
      loadCartForRestaurant,
    }}>
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

