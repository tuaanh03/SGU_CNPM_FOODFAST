"use client";

import React, { createContext, useContext, useReducer, type ReactNode } from 'react';

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
  | { type: 'CHANGE_RESTAURANT'; payload: { restaurant: Restaurant; item: Omit<CartItem, 'quantity'> } };

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
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  const addItem = (item: Omit<CartItem, 'quantity'>, restaurant: Restaurant) => {
    // Nếu đang có giỏ hàng từ nhà hàng khác, hiện thông báo xác nhận
    if (state.restaurant && state.restaurant.id !== restaurant.id && state.items.length > 0) {
      const confirmChange = window.confirm(
        `Bạn có muốn xóa giỏ hàng hiện tại từ "${state.restaurant.name}" và tạo giỏ hàng mới từ "${restaurant.name}" không?`
      );

      if (confirmChange) {
        dispatch({
          type: 'CHANGE_RESTAURANT',
          payload: { restaurant, item }
        });
      }
    } else {
      dispatch({
        type: 'ADD_ITEM',
        payload: { item, restaurant }
      });
    }
  };

  const removeItem = (id: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { id } });
  };

  const updateQuantity = (id: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
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
