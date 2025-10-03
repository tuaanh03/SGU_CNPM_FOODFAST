import prisma from "../lib/prisma";
import { Request, Response } from "express";

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; role: string };
}

export const addPaymentMethod = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { cardNumber, expiryDate, cardholderName, isDefault = false } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: No user ID found"
      });
      return;
    }

    // Kiểm tra thẻ đã tồn tại chưa
    const isCardNumberExists = await prisma.paymentMethod.findFirst({
      where: {
        cardNumber,
        userId,
      },
    });

    if (isCardNumberExists) {
      res.status(409).json({
        success: false,
        message: "Thẻ này đã được thêm trước đó"
      });
      return;
    }

    // Nếu đặt làm thẻ mặc định, bỏ default của các thẻ khác
    if (isDefault) {
      await prisma.paymentMethod.updateMany({
        where: { userId },
        data: { isDefault: false }
      });
    }

    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        userId,
        cardNumber,
        cardholderName,
        expiryDate,
        isDefault,
      },
    });

    res.status(201).json({
      success: true,
      data: paymentMethod,
      message: "Thêm phương thức thanh toán thành công",
    });
  } catch (error: any) {
    console.error("Error adding payment method:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi thêm phương thức thanh toán",
      error: error.message,
    });
  }
};

export const getPaymentMethods = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: No user ID found"
      });
      return;
    }

    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.status(200).json({
      success: true,
      data: paymentMethods,
      message: "Lấy danh sách phương thức thanh toán thành công",
    });
  } catch (error: any) {
    console.error("Error fetching payment methods:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách phương thức thanh toán",
      error: error.message,
    });
  }
};

export const updatePaymentMethod = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { cardNumber, expiryDate, cardholderName, isDefault } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: No user ID found"
      });
      return;
    }

    // Kiểm tra payment method có thuộc về user không
    const existingPaymentMethod = await prisma.paymentMethod.findFirst({
      where: { id, userId }
    });

    if (!existingPaymentMethod) {
      res.status(404).json({
        success: false,
        message: "Không tìm thấy phương thức thanh toán"
      });
      return;
    }

    // Nếu đặt làm mặc định, bỏ default của các thẻ khác
    if (isDefault) {
      await prisma.paymentMethod.updateMany({
        where: { userId, id: { not: id } },
        data: { isDefault: false }
      });
    }

    const updatedPaymentMethod = await prisma.paymentMethod.update({
      where: { id },
      data: {
        ...(cardNumber && { cardNumber }),
        ...(expiryDate && { expiryDate }),
        ...(cardholderName && { cardholderName }),
        ...(isDefault !== undefined && { isDefault })
      }
    });

    res.status(200).json({
      success: true,
      data: updatedPaymentMethod,
      message: "Cập nhật phương thức thanh toán thành công",
    });
  } catch (error: any) {
    console.error("Error updating payment method:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật phương thức thanh toán",
      error: error.message,
    });
  }
};

export const deletePaymentMethod = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: No user ID found"
      });
      return;
    }

    // Kiểm tra payment method có thuộc về user không
    const existingPaymentMethod = await prisma.paymentMethod.findFirst({
      where: { id, userId }
    });

    if (!existingPaymentMethod) {
      res.status(404).json({
        success: false,
        message: "Không tìm thấy phương thức thanh toán"
      });
      return;
    }

    await prisma.paymentMethod.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: "Xóa phương thức thanh toán thành công",
    });
  } catch (error: any) {
    console.error("Error deleting payment method:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa phương thức thanh toán",
      error: error.message,
    });
  }
};

export const setDefaultPaymentMethod = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: No user ID found"
      });
      return;
    }

    // Kiểm tra payment method có thuộc về user không
    const existingPaymentMethod = await prisma.paymentMethod.findFirst({
      where: { id, userId }
    });

    if (!existingPaymentMethod) {
      res.status(404).json({
        success: false,
        message: "Không tìm thấy phương thức thanh toán"
      });
      return;
    }

    // Bỏ default của tất cả payment methods khác
    await prisma.paymentMethod.updateMany({
      where: { userId },
      data: { isDefault: false }
    });

    // Đặt payment method này làm mặc định
    const updatedPaymentMethod = await prisma.paymentMethod.update({
      where: { id },
      data: { isDefault: true }
    });

    res.status(200).json({
      success: true,
      data: updatedPaymentMethod,
      message: "Đã đặt làm phương thức thanh toán mặc định",
    });
  } catch (error: any) {
    console.error("Error setting default payment method:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi đặt phương thức thanh toán mặc định",
      error: error.message,
    });
  }
};
