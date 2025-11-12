import { Request, Response } from "express";
import prisma from "../lib/prisma";

// Tạo cửa hàng mới (chỉ STORE_ADMIN)
export const createStore = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const {
      name,
      description,
      avatar,
      cover,
      address,
      ward,
      district,
      province,
      phone,
      email,
      openTime,
      closeTime,
      latitude,
      longitude
    } = req.body;

    // Kiểm tra user đã có cửa hàng chưa
    const existingStore = await prisma.store.findUnique({
      where: { ownerId: userId }
    });

    if (existingStore) {
      return res.status(400).json({
        success: false,
        message: "Bạn đã có cửa hàng rồi"
      });
    }

    const store = await prisma.store.create({
      data: {
        ownerId: userId,
        name,
        description,
        avatar,
        cover,
        address,
        ward,
        district,
        province,
        latitude,
        longitude,
        phone,
        email,
        openTime,
        closeTime
      }
    });

    res.status(201).json({
      success: true,
      data: store,
      message: "Tạo cửa hàng thành công"
    });
  } catch (error) {
    console.error("Error creating store:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo cửa hàng"
    });
  }
};

// Lấy thông tin cửa hàng của mình
export const getMyStore = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const store = await prisma.store.findUnique({
      where: { ownerId: userId }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Bạn chưa có cửa hàng"
      });
    }

    res.json({
      success: true,
      data: store
    });
  } catch (error) {
    console.error("Error getting store:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin cửa hàng"
    });
  }
};

// Cập nhật thông tin cửa hàng
export const updateStore = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const {
      name,
      description,
      avatar,
      cover,
      address,
      ward,
      district,
      province,
      latitude,
      longitude,
      phone,
      email,
      openTime,
      closeTime,
      isActive
    } = req.body;

    const store = await prisma.store.findUnique({
      where: { ownerId: userId }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Bạn chưa có cửa hàng"
      });
    }

    const updatedStore = await prisma.store.update({
      where: { ownerId: userId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(avatar && { avatar }),
        ...(cover && { cover }),
        ...(address && { address }),
        ...(ward && { ward }),
        ...(district && { district }),
        ...(province && { province }),
        ...(latitude !== undefined && { latitude }),
        ...(longitude !== undefined && { longitude }),
        ...(phone && { phone }),
        ...(email && { email }),
        ...(openTime && { openTime }),
        ...(closeTime && { closeTime }),
        ...(isActive !== undefined && { isActive })
      }
    });

    res.json({
      success: true,
      data: updatedStore,
      message: "Cập nhật cửa hàng thành công"
    });
  } catch (error) {
    console.error("Error updating store:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật cửa hàng"
    });
  }
};

// Lấy danh sách tất cả cửa hàng (public)
export const getAllStores = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, search, isActive } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ];
    }
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [stores, total] = await Promise.all([
      prisma.store.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.store.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        stores,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error("Error getting stores:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách cửa hàng"
    });
  }
};

// Lấy thông tin cửa hàng theo ID (public)
export const getStoreById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const store = await prisma.store.findUnique({
      where: { id }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy cửa hàng"
      });
    }

    res.json({
      success: true,
      data: store
    });
  } catch (error) {
    console.error("Error getting store:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin cửa hàng"
    });
  }
};

// Kiểm tra xem user đã có store hay chưa (internal endpoint)
export const checkStoreByOwnerId = async (req: Request, res: Response) => {
  try {
    const { ownerId } = req.params;

    const store = await prisma.store.findUnique({
      where: { ownerId }
    });

    res.json({
      success: true,
      data: {
        hasStore: !!store,
        store: store || null
      }
    });
  } catch (error) {
    console.error("Error checking store:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi kiểm tra cửa hàng"
    });
  }
};

