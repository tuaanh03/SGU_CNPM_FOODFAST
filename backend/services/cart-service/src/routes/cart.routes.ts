import express from 'express';
import { verifyToken } from '../middleware/auth';
import { checkSession, optionalCheckSession } from '../middleware/checkSession';
import {
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  clearAllCarts,
  getAllCarts,
} from '../controllers/cart.controller';

const router = express.Router();

router.post('/add', verifyToken, checkSession, addToCart);

router.get('/:restaurantId', verifyToken, optionalCheckSession, getCart);

router.put('/:restaurantId/:productId', verifyToken, optionalCheckSession, updateCartItem);

router.delete('/:restaurantId/:productId', verifyToken, optionalCheckSession, removeFromCart);

router.delete('/:restaurantId', verifyToken, optionalCheckSession, clearCart);

router.delete('/all/clear', verifyToken, clearAllCarts);

router.get('/all/list', verifyToken, getAllCarts);

export default router;

