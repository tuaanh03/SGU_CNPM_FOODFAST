import { Request, Response } from "express";
import prisma from "../lib/prisma";

// Lấy danh sách địa chỉ của user
export const getAddresses = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.json({
      success: true,
      data: addresses
    });
  } catch (error) {
    console.error("Error getting addresses:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách địa chỉ"
    });
  }
};

// Tạo địa chỉ mới
export const createAddress = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const {
      name,
      phone,
      address,
      ward,
      district,
      province,
      latitude,
      longitude,
      isDefault = false
    } = req.body;

    // Nếu đặt làm địa chỉ mặc định, bỏ default của các địa chỉ khác
    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false }
      });
    }

    const newAddress = await prisma.address.create({
      data: {
        userId,
        name,
        phone,
        address,
        ward,
        district,
        province,
        latitude,
        longitude,
        isDefault
      }
    });

    res.status(201).json({
      success: true,
      data: newAddress,
      message: "Tạo địa chỉ thành công"
    });
  } catch (error) {
    console.error("Error creating address:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo địa chỉ"
    });
  }
};

// Cập nhật địa chỉ
export const updateAddress = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;
    const {
      name,
      phone,
      address,
      ward,
      district,
      province,
      latitude,
      longitude,
      isDefault
    } = req.body;

    // Kiểm tra địa chỉ có thuộc về user không
    const existingAddress = await prisma.address.findFirst({
      where: { id, userId }
    });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy địa chỉ"
      });
    }

    // Nếu đặt làm địa chỉ mặc định, bỏ default của các địa chỉ khác
    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId, id: { not: id } },
        data: { isDefault: false }
      });
    }

    const updatedAddress = await prisma.address.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(address && { address }),
        ...(ward && { ward }),
        ...(district && { district }),
        ...(province && { province }),
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
        ...(isDefault !== undefined && { isDefault })
      }
    });

    res.json({
      success: true,
      data: updatedAddress,
      message: "Cập nhật địa chỉ thành công"
    });
  } catch (error) {
    console.error("Error updating address:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật địa chỉ"
    });
  }
};

// Xóa địa chỉ
export const deleteAddress = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    // Kiểm tra địa chỉ có thuộc về user không
    const existingAddress = await prisma.address.findFirst({
      where: { id, userId }
    });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy địa chỉ"
      });
    }

    await prisma.address.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: "Xóa địa chỉ thành công"
    });
  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa địa chỉ"
    });
  }
};

// Đặt địa chỉ mặc định
export const setDefaultAddress = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { id } = req.params;

    // Kiểm tra địa chỉ có thuộc về user không
    const existingAddress = await prisma.address.findFirst({
      where: { id, userId }
    });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy địa chỉ"
      });
    }

    // Bỏ default của tất cả địa chỉ khác
    await prisma.address.updateMany({
      where: { userId },
      data: { isDefault: false }
    });

    // Đặt địa chỉ này làm mặc định
    const updatedAddress = await prisma.address.update({
      where: { id },
      data: { isDefault: true }
    });

    res.json({
      success: true,
      data: updatedAddress,
      message: "Đã đặt làm địa chỉ mặc định"
    });
  } catch (error) {
    console.error("Error setting default address:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi đặt địa chỉ mặc định"
    });
  }
};
