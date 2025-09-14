import { z } from "zod";

// Validation cho tạo sản phẩm
export const createProductSchema = z.object({
  sku: z.string().min(1, "SKU không được để trống"),
  name: z.string().min(1, "Tên sản phẩm không được để trống"),
  price: z.number().min(0, "Giá sản phẩm phải >= 0").or(z.string().transform(val => parseInt(val))),
  categoryId: z.string().uuid("ID danh mục không hợp lệ").optional(),
  stockOnHand: z.number().min(0, "Tồn kho phải >= 0").or(z.string().transform(val => parseInt(val))).optional(),
  isActive: z.boolean().optional()
});

// Validation cho cập nhật sản phẩm
export const updateProductSchema = z.object({
  sku: z.string().min(1, "SKU không được để trống").optional(),
  name: z.string().min(1, "Tên sản phẩm không được để trống").optional(),
  price: z.number().min(0, "Giá sản phẩm phải >= 0").or(z.string().transform(val => parseInt(val))).optional(),
  categoryId: z.string().uuid("ID danh mục không hợp lệ").optional(),
  stockOnHand: z.number().min(0, "Tồn kho phải >= 0").or(z.string().transform(val => parseInt(val))).optional(),
  isActive: z.boolean().optional()
});

// Validation cho tạo danh mục
export const createCategorySchema = z.object({
  name: z.string().min(1, "Tên danh mục không được để trống")
});

// Validation cho cập nhật danh mục
export const updateCategorySchema = z.object({
  name: z.string().min(1, "Tên danh mục không được để trống").optional()
});

// Validation cho UUID params
export const uuidParamSchema = z.object({
  id: z.string().uuid("ID không hợp lệ")
});
