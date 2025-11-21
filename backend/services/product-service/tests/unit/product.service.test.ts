import { createCategorySchema, updateCategorySchema, uuidParamSchema } from '../../src/validations/product.validation';

describe('Product Service - Unit Tests', () => {
  describe('createCategorySchema', () => {
    it('accepts valid category name', () => {
      expect(() => createCategorySchema.parse({ name: 'Drinks' })).not.toThrow();
    });

    it('rejects empty name', () => {
      expect(() => createCategorySchema.parse({ name: '' })).toThrow();
    });

    it('rejects missing name', () => {
      // @ts-ignore
      expect(() => createCategorySchema.parse({})).toThrow();
    });
  });

  describe('updateCategorySchema', () => {
    it('accepts empty object (no update fields)', () => {
      expect(() => updateCategorySchema.parse({})).not.toThrow();
    });

    it('accepts valid name when provided', () => {
      expect(() => updateCategorySchema.parse({ name: 'Snacks' })).not.toThrow();
    });

    it('rejects empty name when provided', () => {
      expect(() => updateCategorySchema.parse({ name: '' })).toThrow();
    });
  });

  describe('uuidParamSchema', () => {
    it('accepts a valid UUID', () => {
      const valid = '123e4567-e89b-12d3-a456-426614174000';
      expect(() => uuidParamSchema.parse({ id: valid })).not.toThrow();
    });

    it('rejects an invalid UUID', () => {
      expect(() => uuidParamSchema.parse({ id: 'not-a-uuid' })).toThrow();
    });

    it('rejects missing id', () => {
      // @ts-ignore
      expect(() => uuidParamSchema.parse({})).toThrow();
    });
  });
});