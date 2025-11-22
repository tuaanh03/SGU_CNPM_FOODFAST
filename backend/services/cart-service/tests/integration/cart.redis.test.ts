import { redisClient } from '../../src/config/redis';
import { addToCart, getCart, updateCartItem, clearCart } from '../../src/controllers/cart.controller';

describe('Cart Service - Redis Integration Tests', () => {
    const testUserId = 'test-user-123';
    const testRestaurantId = 'test-restaurant-456';

    beforeEach(async () => {
        // Clear test data
        await redisClient.del(`cart:${testUserId}:${testRestaurantId}`);
    });

    afterAll(async () => {
        await redisClient.quit();
    });

    describe('addToCart', () => {
        it('should add item to cart in Redis', async () => {
            const item = {
                productId: 'product-1',
                name: 'Test Product',
                price: 50000,
                quantity: 2,
            };

            await addToCart(testUserId, testRestaurantId, item);

            // Verify in Redis
            const cartData = await redisClient.get(`cart:${testUserId}:${testRestaurantId}`);
            expect(cartData).not.toBeNull();

            const cart = JSON.parse(cartData!);
            expect(cart.items).toHaveLength(1);
            expect(cart.items[0]).toMatchObject(item);
            expect(cart.totalPrice).toBe(100000); // 50000 * 2
        });

        it('should update quantity if product already in cart', async () => {
            const item = {
                productId: 'product-1',
                name: 'Test Product',
                price: 50000,
                quantity: 2,
            };

            // Add first time
            await addToCart(testUserId, testRestaurantId, item);

            // Add again
            await addToCart(testUserId, testRestaurantId, { ...item, quantity: 3 });

            const cartData = await redisClient.get(`cart:${testUserId}:${testRestaurantId}`);
            const cart = JSON.parse(cartData!);

            expect(cart.items).toHaveLength(1);
            expect(cart.items[0].quantity).toBe(5); // 2 + 3
            expect(cart.totalPrice).toBe(250000); // 50000 * 5
        });
    });

    describe('getCart', () => {
        it('should retrieve cart from Redis', async () => {
            // Setup cart
            const item = {
                productId: 'product-1',
                name: 'Test Product',
                price: 50000,
                quantity: 2,
            };
            await addToCart(testUserId, testRestaurantId, item);

            // Get cart
            const cart = await getCart(testUserId, testRestaurantId);

            expect(cart).not.toBeNull();
            expect(cart.items).toHaveLength(1);
            expect(cart.items[0]).toMatchObject(item);
        });

        it('should return null for non-existent cart', async () => {
            const cart = await getCart('non-existent-user', 'non-existent-restaurant');
            expect(cart).toBeNull();
        });
    });

    describe('updateCart', () => {
        it('should update item quantity', async () => {
            // Setup cart
            const item = {
                productId: 'product-1',
                name: 'Test Product',
                price: 50000,
                quantity: 2,
            };
            await addToCart(testUserId, testRestaurantId, item);

            // Update quantity
            await updateCart(testUserId, testRestaurantId, 'product-1', 5);

            const cart = await getCart(testUserId, testRestaurantId);
            expect(cart.items[0].quantity).toBe(5);
            expect(cart.totalPrice).toBe(250000);
        });

        it('should remove item if quantity is 0', async () => {
            // Setup cart
            const item = {
                productId: 'product-1',
                name: 'Test Product',
                price: 50000,
                quantity: 2,
            };
            await addToCart(testUserId, testRestaurantId, item);

            // Update to 0
            await updateCart(testUserId, testRestaurantId, 'product-1', 0);

            const cart = await getCart(testUserId, testRestaurantId);
            expect(cart.items).toHaveLength(0);
            expect(cart.totalPrice).toBe(0);
        });
    });

    describe('clearCart', () => {
        it('should clear all items from cart', async () => {
            // Setup cart with multiple items
            await addToCart(testUserId, testRestaurantId, {
                productId: 'product-1',
                name: 'Product 1',
                price: 50000,
                quantity: 2,
            });
            await addToCart(testUserId, testRestaurantId, {
                productId: 'product-2',
                name: 'Product 2',
                price: 30000,
                quantity: 1,
            });

            // Clear cart
            await clearCart(testUserId, testRestaurantId);

            const cartData = await redisClient.get(`cart:${testUserId}:${testRestaurantId}`);
            expect(cartData).toBeNull();
        });
    });
});