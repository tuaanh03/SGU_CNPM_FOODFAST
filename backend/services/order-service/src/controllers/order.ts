import prisma from "../lib/prisma";
import { Request, Response } from "express";
import { publishEvent } from "../utils/kafka";
import { OrderSchema } from "../validations/order.validation";

interface AuthenticatedRequest extends Request {
  user?: { id: string };
  body: any;
  params: any;
}

// Helper function để tính tổng tiền từ Product Service
async function calculateOrderAmount(items: any[]): Promise<{ amount: number; validItems: any[] }> {
  // Gọi Product Service để lấy thông tin và giá của từng sản phẩm
  let totalAmount = 0;
  const validItems = [];

  for (const item of items) {
    try {
      // Call Product Service API qua API Gateway
      const productResponse = await fetch(`http://api-gateway:3000/api/products/${item.productId}`);

      if (!productResponse.ok) {
        throw new Error(`Sản phẩm ${item.productId} không tồn tại`);
      }

      const productData = await productResponse.json();
      const product = productData.data;

      if (!product.isActive) {
        throw new Error(`Sản phẩm ${product.name} không còn kinh doanh`);
      }

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      validItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        name: product.name,
        sku: product.sku,
        subtotal: itemTotal
      });

    } catch (error) {
      throw error;
    }
  }

  return { amount: totalAmount, validItems };
}

export const createOrder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized: No user ID found" });
      return;
    }

    const parsedBody = OrderSchema.safeParse(req.body);

    if (!parsedBody.success) {
      res.status(400).json({
        success: false,
        message: parsedBody.error.errors.map((err: any) => err.message).join(", "),
      });
      return;
    }

    const { items } = parsedBody.data;

    try {
      // Tính toán tổng tiền và validate sản phẩm
      const { amount, validItems } = await calculateOrderAmount(items);

      // Lưu order với format mới
      const saveOrder = await prisma.order.create({
        data: {
          userId,
          amount,
          item: JSON.stringify(validItems), // Lưu chi tiết items as JSON cho backward compatibility
          status: "pending",
        },
      });

      // Payload gửi đến Product Service để reserve inventory
      const orderPayload = {
        orderId: saveOrder.orderId,
        userId: saveOrder.userId,
        items: items, // Format đơn giản cho Product Service: [{productId, quantity}]
        amount: saveOrder.amount,
        timestamp: new Date().toISOString()
      };

      await publishEvent(JSON.stringify(orderPayload));

      res.status(201).json({
        success: true,
        message: "Đơn hàng đã được tạo và đang chờ kiểm tra tồn kho",
        data: {
          orderId: saveOrder.orderId,
          items: validItems,
          amount: saveOrder.amount,
          status: saveOrder.status,
          createdAt: saveOrder.created_at // Sửa từ createdAt thành created_at
        }
      });

    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Lỗi khi validate sản phẩm"
      });
      return;
    }

  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tạo đơn hàng",
    });
  }
};

export const getOrderStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res
        .status(401)
        .json({ success: false, message: "User not authenticated." });
      return;
    }

    const orderId = req.params.orderId;

    if (!orderId) {
      res
        .status(400)
        .json({ success: false, message: "Order ID is required." });
      return;
    }

    const orderStatus = await prisma.order.findUnique({
      where: {
        orderId,
        userId,
      },
    });

    if (!orderStatus) {
      res.status(404).json({ success: false, message: "Order not found." });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        orderId: orderStatus.orderId,
        status: orderStatus.status,
        amount: orderStatus.amount,
        item: orderStatus.item,
      },
      message: "Order status retrieved successfully.",
    });
  } catch (error) {
    console.error("Error while checking order status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check order status.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getPaymentUrl = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { orderId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated.",
      });
      return;
    }

    if (!orderId) {
      res.status(400).json({
        success: false,
        message: "Order ID is required.",
      });
      return;
    }

    // Kiểm tra order có thuộc về user này không
    const order = await prisma.order.findUnique({
      where: {
        orderId,
        userId,
      },
    });

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found.",
      });
      return;
    }

    // Nếu order đã success hoặc failed, không cần payment URL nữa
    if (order.status === "success") {
      res.status(200).json({
        success: true,
        message: "Order already paid successfully.",
        paymentStatus: "success",
      });
      return;
    }

    if (order.status === "failed") {
      res.status(200).json({
        success: false,
        message: "Payment failed. Please create a new order.",
        paymentStatus: "failed",
      });
      return;
    }

    // Nếu order vẫn đang pending, frontend cần đợi payment URL từ Kafka event
    res.status(200).json({
      success: true,
      message: "Payment is being processed. Please wait for payment URL.",
      paymentStatus: order.status,
      orderId: order.orderId,
    });
  } catch (error) {
    console.error("Error getting payment URL:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get payment URL.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
