const request = require('supertest');
import * as jwt from 'jsonwebtoken';
import app from '../../src/server';
import prisma from '../../src/lib/prisma';

describe('Product API - Integration Tests', () => {
    let adminToken: string;
    let storeId: string;
    let categoryId: string;
    let productId: string;

    beforeAll(async () => {
        // Create admin JWT token (STORE_ADMIN) using same secret as services
        const secret = process.env.JWT_SECRET_KEY || 'secret';
        adminToken = jwt.sign({ userId: 'test-admin', email: 'admin@test.com', role: 'STORE_ADMIN' }, secret, { expiresIn: '7d' });

        // Determine storeId: prefer TEST_STORE_ID env var, otherwise generate a stable test id
        storeId = process.env.TEST_STORE_ID || `test-store-${Date.now()}`;

        // Create a category in DB for product tests
        const category = await prisma.category.create({ data: { name: `test-category-${Date.now()}` } });
        categoryId = category.id;
    });

    afterAll(async () => {
        // Cleanup: delete created products for the test store and remove test category
        try {
            if (storeId) await prisma.product.deleteMany({ where: { storeId } });
            if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
        } catch (err) {
            // ignore cleanup errors
            console.warn('Cleanup warning:', err);
        }

        await prisma.$disconnect();
    });

    describe('POST /products (Create Product)', () => {
        it('should create a new product', async () => {
            const productData = {
                name: 'Test Product',
                description: 'Test description',
                price: 50000,
                imageUrl: 'https://example.com/image.jpg',
                storeId,
                categoryId,
            };

            const response = await request(app)
                .post('/products')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(productData)
                .expect(201);

            expect(response.body.success).toBe(true);
            // Controller returns the created product directly under `data`
            expect(response.body.data).toMatchObject({
                name: productData.name,
                price: productData.price,
                storeId,
            });

            productId = response.body.data.id;
        });

        it('should reject product creation without authentication', async () => {
            const productData = {
                name: 'Test Product',
                price: 50000,
                storeId,
            };

            await request(app)
                .post('/products')
                .send(productData)
                .expect(401);
        });

        it('should reject product with invalid price', async () => {
            const productData = {
                name: 'Test Product',
                price: -1000,
                storeId,
            };

            const response = await request(app)
                .post('/products')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(productData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /products', () => {
        it('should get all products', async () => {
            const response = await request(app)
                .get('/products')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it('should filter products by storeId', async () => {
            const response = await request(app)
                .get(`/products?storeId=${storeId}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.every((p: any) => p.storeId === storeId)).toBe(true);
        });

        it('should filter products by categoryId', async () => {
            const response = await request(app)
                .get(`/products?categoryId=${categoryId}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.every((p: any) => p.categoryId === categoryId)).toBe(true);
        });
    });

    describe('PUT /products/:id (Update Product)', () => {
        it('should update product', async () => {
            const updateData = {
                name: 'Updated Product Name',
                price: 75000,
            };

            const response = await request(app)
                .put(`/products/${productId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
            // Controller returns updated product under `data`
            expect(response.body.data.name).toBe(updateData.name);
            expect(response.body.data.price).toBe(updateData.price);
        });

        it('should reject update for non-existent product', async () => {
            const updateData = {
                name: 'Updated Name',
            };

            await request(app)
                .put('/products/non-existent-id')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(updateData)
                .expect(404);
        });
    });

    describe('DELETE /products/:id', () => {
        it('should delete product', async () => {
            const response = await request(app)
                .delete(`/products/${productId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify product is deleted
            await request(app)
                .get(`/products/${productId}`)
                .expect(404);
        });
    });
});