import { z } from "zod";

// Schema cho từng item trong đơn hàng
const OrderItemSchema = z.object({
  productId: z.string().uuid("Product ID phải là UUID hợp lệ"),
  quantity: z.number().min(1, "Số lượng phải >= 1"),
  // price sẽ được Product Service validate và cung cấp
});

// Schema chính cho Order
export const OrderSchema = z.object({
  items: z.array(OrderItemSchema).min(1, "Đơn hàng phải có ít nhất 1 sản phẩm"),
  deliveryAddress: z.string().optional(),
  contactPhone: z.string().optional(),
  note: z.string().optional(),
  // storeId: optional, nếu order thuộc về một cửa hàng (merchant)
  storeId: z.string().optional(),
  // totalPrice sẽ được tính toán dựa trên items từ Product Service
});
