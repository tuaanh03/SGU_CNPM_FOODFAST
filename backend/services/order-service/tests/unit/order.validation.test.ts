import { OrderSchema } from '../../src/validations/order.validation';
import { calculateOrderAmount } from '../../src/controllers/order';

describe('Order Validation', () => {
    describe('OrderSchema', () => {
        it('should validate valid order data', () => {
            const validData = {
                items: [
                    { productId: '123e4567-e89b-12d3-a456-426614174000', quantity: 2 }
                ],
                deliveryAddress: '123 Test Street',
                contactPhone: '0123456789',
                note: 'Test note'
            };

            const result = OrderSchema.safeParse(validData);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toEqual(validData);
            }
        });

        it('should accept order with only items', () => {
            const validData = {
                items: [
                    { productId: '123e4567-e89b-12d3-a456-426614174000', quantity: 1 }
                ]
            };

            const result = OrderSchema.safeParse(validData);

            expect(result.success).toBe(true);
        });

        it('should reject empty items array', () => {
            const invalidData = {
                items: [],
                deliveryAddress: '123 Test Street'
            };

            const result = OrderSchema.safeParse(invalidData);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.errors[0].message).toContain('ít nhất 1 sản phẩm');
            }
        });

        it('should reject invalid product ID format', () => {
            const invalidData = {
                items: [
                    { productId: 'invalid-uuid', quantity: 2 }
                ]
            };

            const result = OrderSchema.safeParse(invalidData);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.errors[0].message).toContain('UUID hợp lệ');
            }
        });

        it('should reject quantity less than 1', () => {
            const invalidData = {
                items: [
                    { productId: '123e4567-e89b-12d3-a456-426614174000', quantity: 0 }
                ]
            };

            const result = OrderSchema.safeParse(invalidData);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.errors[0].message).toContain('>= 1');
            }
        });

        it('should reject negative quantity', () => {
            const invalidData = {
                items: [
                    { productId: '123e4567-e89b-12d3-a456-426614174000', quantity: -1 }
                ]
            };

            const result = OrderSchema.safeParse(invalidData);

            expect(result.success).toBe(false);
        });

        it('should validate multiple items', () => {
            const validData = {
                items: [
                    { productId: '123e4567-e89b-12d3-a456-426614174000', quantity: 2 },
                    { productId: '223e4567-e89b-12d3-a456-426614174000', quantity: 1 },
                    { productId: '323e4567-e89b-12d3-a456-426614174000', quantity: 3 }
                ],
                deliveryAddress: '123 Test Street'
            };

            const result = OrderSchema.safeParse(validData);

            expect(result.success).toBe(true);
        });

        it('should reject if items field is missing', () => {
            const invalidData = {
                deliveryAddress: '123 Test Street'
            };

            const result = OrderSchema.safeParse(invalidData);

            expect(result.success).toBe(false);
        });

        it('should accept optional fields as undefined', () => {
            const validData = {
                items: [
                    { productId: '123e4567-e89b-12d3-a456-426614174000', quantity: 1 }
                ],
                deliveryAddress: undefined,
                contactPhone: undefined,
                note: undefined
            };

            const result = OrderSchema.safeParse(validData);

            expect(result.success).toBe(true);
        });

        it('should validate string types for optional fields', () => {
            const invalidData = {
                items: [
                    { productId: '123e4567-e89b-12d3-a456-426614174000', quantity: 1 }
                ],
                deliveryAddress: 123, // Should be string
                contactPhone: '0123456789',
                note: 'Test'
            };

            const result = OrderSchema.safeParse(invalidData);

            expect(result.success).toBe(false);
        });
    });
});

// ----------------- Tests for calculateOrderAmount -----------------
describe('calculateOrderAmount', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        // restore global.fetch
        // @ts-ignore
        global.fetch = originalFetch;
        jest.resetAllMocks();
    });

    it('calculates totalPrice and returns validItems for valid products', async () => {
        const items = [
            { productId: 'p1', quantity: 2 },
            { productId: 'p2', quantity: 1 }
        ];

        // Mock fetch responses for p1 and p2
        const mockFetch = jest.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: 'p1', name: 'Prod1', price: 10000, isAvailable: true } }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: 'p2', name: 'Prod2', price: 20000, isAvailable: true } }) });

        // @ts-ignore
        global.fetch = mockFetch;

        const result = await calculateOrderAmount(items);

        expect(result.totalPrice).toBe(10000 * 2 + 20000 * 1);
        expect(result.validItems.length).toBe(2);
        expect(result.validItems[0]).toMatchObject({ productId: 'p1', quantity: 2, productPrice: 10000 });
    });

    it('throws when product not found (fetch.ok = false)', async () => {
        const items = [{ productId: 'p1', quantity: 1 }];
        // @ts-ignore
        global.fetch = jest.fn().mockResolvedValue({ ok: false });

        await expect(calculateOrderAmount(items)).rejects.toThrow(/không tồn tại|not exist|does not exist/i);
    });

    it('throws when product is not available', async () => {
        const items = [{ productId: 'p1', quantity: 1 }];
        // @ts-ignore
        global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { id: 'p1', name: 'Prod1', price: 10000, isAvailable: false } }) });

        await expect(calculateOrderAmount(items)).rejects.toThrow(/không còn kinh doanh|not available/i);
    });

    it('throws when quantity is invalid (<= 0)', async () => {
        const items = [{ productId: 'p1', quantity: 0 }];
        // @ts-ignore
        global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { id: 'p1', name: 'Prod1', price: 10000, isAvailable: true } }) });

        await expect(calculateOrderAmount(items)).rejects.toThrow(/phải lớn hơn 0|greater than 0/i);
    });
});
