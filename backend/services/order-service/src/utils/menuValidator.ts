import prisma from "../lib/prisma";


interface CartItem {
  productId: string;
  quantity: number;
  storeId: string;
}

interface ValidatedItem {
  productId: string;
  productName: string;
  productPrice: number;
  quantity: number;
  subtotal: number;
  priceChanged?: boolean;
  oldPrice?: number;
}

interface ValidationResult {
  isValid: boolean;
  validItems: ValidatedItem[];
  totalPrice: number;
  errors: string[];
  warnings: string[];
}

/**
 * Validate cart items qua MenuItemRead (Read Model)
 * - Kiểm tra món có trong menu không
 * - Kiểm tra isAvailable
 * - Kiểm tra soldOutUntil
 * - Lấy giá hiện tại từ MenuItemRead
 */
export async function validateCartItems(
  cartItems: CartItem[]
): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: true,
    validItems: [],
    totalPrice: 0,
    errors: [],
    warnings: [],
  };

  if (!cartItems || cartItems.length === 0) {
    result.isValid = false;
    result.errors.push("Giỏ hàng trống");
    return result;
  }

  const storeId = cartItems[0].storeId;

  // Query tất cả menu items của store này trong 1 lần
  const productIds = cartItems.map(item => item.productId);
  const menuItems = await prisma.menuItemRead.findMany({
    where: {
      storeId,
      productId: {
        in: productIds,
      },
    },
  });

  // Tạo map để lookup nhanh
  const menuItemMap = new Map(
    menuItems.map(item => [item.productId, item])
  );

  // Validate từng item
  for (const cartItem of cartItems) {
    const menuItem = menuItemMap.get(cartItem.productId);

    // 1. Kiểm tra món có trong menu không
    if (!menuItem) {
      result.isValid = false;
      result.errors.push(
        `Món "${cartItem.productId}" không có trong thực đơn của cửa hàng này`
      );
      continue;
    }

    // 2. Kiểm tra món có đang bán không
    if (!menuItem.isAvailable) {
      result.isValid = false;
      result.errors.push(`Món "${menuItem.name}" hiện không còn bán`);
      continue;
    }

    // 3. Kiểm tra soldOutUntil
    if (menuItem.soldOutUntil && new Date() < menuItem.soldOutUntil) {
      result.isValid = false;
      result.errors.push(
        `Món "${menuItem.name}" tạm hết hàng đến ${menuItem.soldOutUntil.toLocaleDateString('vi-VN')}`
      );
      continue;
    }

    // 4. Validate quantity
    if (cartItem.quantity <= 0) {
      result.isValid = false;
      result.errors.push(`Số lượng món "${menuItem.name}" phải lớn hơn 0`);
      continue;
    }

    // 5. Lấy giá hiện tại và tính toán
    const currentPrice = parseFloat(menuItem.price.toString());
    const subtotal = currentPrice * cartItem.quantity;

    const validatedItem: ValidatedItem = {
      productId: cartItem.productId,
      productName: menuItem.name,
      productPrice: currentPrice,
      quantity: cartItem.quantity,
      subtotal,
    };

    result.validItems.push(validatedItem);
    result.totalPrice += subtotal;
  }

  return result;
}

/**
 * So sánh giá trong cart với giá hiện tại
 * Dùng khi user đã thêm món vào cart trước đó, giờ mới checkout
 */
export async function checkPriceChanges(
  cartItems: Array<{ productId: string; quantity: number; expectedPrice?: number; storeId: string }>
): Promise<{
  hasChanges: boolean;
  changes: Array<{
    productId: string;
    productName: string;
    oldPrice: number;
    newPrice: number;
    quantity: number;
  }>;
}> {
  const changes: Array<{
    productId: string;
    productName: string;
    oldPrice: number;
    newPrice: number;
    quantity: number;
  }> = [];

  const storeId = cartItems[0]?.storeId;
  if (!storeId) {
    return { hasChanges: false, changes: [] };
  }

  const productIds = cartItems.map(item => item.productId);
  const menuItems = await prisma.menuItemRead.findMany({
    where: {
      storeId,
      productId: {
        in: productIds,
      },
    },
  });

  const menuItemMap = new Map(
    menuItems.map(item => [item.productId, item])
  );

  for (const cartItem of cartItems) {
    if (!cartItem.expectedPrice) continue;

    const menuItem = menuItemMap.get(cartItem.productId);
    if (!menuItem) continue;

    const currentPrice = parseFloat(menuItem.price.toString());

    // So sánh giá (làm tròn 2 chữ số thập phân để tránh floating point issues)
    if (Math.abs(currentPrice - cartItem.expectedPrice) > 0.01) {
      changes.push({
        productId: cartItem.productId,
        productName: menuItem.name,
        oldPrice: cartItem.expectedPrice,
        newPrice: currentPrice,
        quantity: cartItem.quantity,
      });
    }
  }

  return {
    hasChanges: changes.length > 0,
    changes,
  };
}

