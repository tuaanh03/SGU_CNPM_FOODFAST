import request from 'supertest';
import app from '../../src/server';
import prisma from '../../src/lib/prisma';

describe('Auth API - Integration Tests', () => {
    beforeAll(async () => {
        // Clean up test database
        await prisma.user.deleteMany({
            where: { email: { contains: 'test' } },
        });
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe('POST /auth/customer/register', () => {
        it('should register a new customer', async () => {
            const userData = {
                email: 'newcustomer@test.com',
                password: 'Test@123456',
                name: 'Test Customer',
                phone: '0901234567',
            };

            const response = await request(app)
                .post('/auth/customer/register')
                .send(userData)
                .expect(201);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('token');
            expect(response.body.data.user).toMatchObject({
                email: userData.email,
                name: userData.name,
                role: 'CUSTOMER',
            });
        });

        it('should reject duplicate email', async () => {
            const userData = {
                email: 'duplicate@test.com',
                password: 'Test@123456',
                name: 'Test User',
                phone: '0901234567',
            };

            // First registration
            await request(app)
                .post('/auth/customer/register')
                .send(userData)
                .expect(201);

            // Duplicate registration
            const response = await request(app)
                .post('/auth/customer/register')
                .send(userData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('already exists');
        });

        it('should reject invalid email format', async () => {
            const userData = {
                email: 'invalid-email',
                password: 'Test@123456',
                name: 'Test User',
                phone: '0901234567',
            };

            const response = await request(app)
                .post('/auth/customer/register')
                .send(userData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should reject weak password', async () => {
            const userData = {
                email: 'weakpass@test.com',
                password: '12345',
                name: 'Test User',
                phone: '0901234567',
            };

            const response = await request(app)
                .post('/auth/customer/register')
                .send(userData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('password');
        });
    });

    describe('POST /auth/customer/login', () => {
        const testUser = {
            email: 'logintest@test.com',
            password: 'Test@123456',
            name: 'Login Test',
            phone: '0901234567',
        };

        beforeAll(async () => {
            // Create test user
            await request(app)
                .post('/auth/customer/register')
                .send(testUser);
        });

        it('should login with correct credentials', async () => {
            const response = await request(app)
                .post('/auth/customer/login')
                .send({
                    email: testUser.email,
                    password: testUser.password,
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('token');
            expect(response.body.data.user.email).toBe(testUser.email);
        });

        it('should reject wrong password', async () => {
            const response = await request(app)
                .post('/auth/customer/login')
                .send({
                    email: testUser.email,
                    password: 'WrongPassword123',
                })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Invalid');
        });

        it('should reject non-existent email', async () => {
            const response = await request(app)
                .post('/auth/customer/login')
                .send({
                    email: 'nonexistent@test.com',
                    password: 'Test@123456',
                })
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /auth/profile (Protected)', () => {
        let authToken: string;

        beforeAll(async () => {
            // Register and login to get token
            const userData = {
                email: 'profiletest@test.com',
                password: 'Test@123456',
                name: 'Profile Test',
                phone: '0901234567',
            };

            const loginRes = await request(app)
                .post('/auth/customer/register')
                .send(userData);

            authToken = loginRes.body.data.token;
        });

        it('should get profile with valid token', async () => {
            const response = await request(app)
                .get('/auth/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('email', 'profiletest@test.com');
        });

        it('should reject request without token', async () => {
            const response = await request(app)
                .get('/auth/profile')
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('token');
        });

        it('should reject request with invalid token', async () => {
            const response = await request(app)
                .get('/auth/profile')
                .set('Authorization', 'Bearer invalid.token.here')
                .expect(401);

            expect(response.body.success).toBe(false);
        });
    });
});