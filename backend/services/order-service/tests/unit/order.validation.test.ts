import { OrderSchema } from '../../src/validations/order.validation';

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

