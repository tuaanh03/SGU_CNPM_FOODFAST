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

// New: Lấy orders cho cửa hàng của merchant (STORE_ADMIN)
export const getMyOrders = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    // Tìm store của merchant
    const store = await prisma.store.findUnique({ where: { ownerId: userId } });
    if (!store) {
      return res.status(404).json({ success: false, message: "Bạn chưa có cửa hàng" });
    }

    const { page = 1, limit = 20, status } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { storeId: store.id };
    if (status) where.restaurantStatus = status;

    const [orders, total] = await Promise.all([
      prisma.restaurantOrder.findMany({ where, orderBy: { receivedAt: 'desc' }, skip, take: Number(limit) }),
      prisma.restaurantOrder.count({ where })
    ]);

    // Map to response shape
    const data = orders.map((o: any) => ({
      id: o.id,
      orderId: o.orderId,
      storeId: o.storeId,
      items: o.items,
      totalPrice: o.totalPrice,
      customerInfo: o.customerInfo,
      restaurantStatus: o.restaurantStatus,
      receivedAt: o.receivedAt,
      confirmedAt: o.confirmedAt,
      readyAt: o.readyAt
    }));

    res.json({ success: true, data, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } });
  } catch (error) {
    console.error('Error getting store orders:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy đơn hàng của cửa hàng' });
  }
};

// New: transitionToPreparing helper used by kafka consumer to auto-start preparing
export async function transitionToPreparing(restaurantOrderId: string) {
  console.log(` transitioning order to PREPARING:`)
  const updated = await prisma.restaurantOrder.update({
    where: { id: restaurantOrderId },
    data: {
      restaurantStatus: "PREPARING",
      preparingStartedAt: new Date()
    }
  });

  console.log(`📦 Order ${updated.orderId} is now PREPARING`);

  // Publish event to Kafka for socket-service to emit real-time
  const { publishRestaurantOrderStatusEvent } = require('../utils/kafka');
  try {
    await publishRestaurantOrderStatusEvent({
      eventType: "RESTAURANT_ORDER_STATUS_CHANGED",
      orderId: updated.orderId,
      storeId: updated.storeId,
      restaurantStatus: "PREPARING",
      timestamp: new Date().toISOString(),
    });
    console.log(`📤 Published PREPARING status for order ${updated.orderId}`);
  } catch (err) {
    console.error(`Error publishing status change for order ${updated.orderId}:`, err);
  }
}

// New: transitionToReady helper - notify order is ready for pickup
export async function transitionToReady(restaurantOrderId: string) {
  const updated = await prisma.restaurantOrder.update({
    where: { id: restaurantOrderId },
    data: {
      restaurantStatus: "READY_FOR_PICKUP",
      readyAt: new Date()
    }
  });

  console.log(`✅ Order ${updated.orderId} is READY for pickup`);

  // Fetch store info để include trong payload
  const store = await prisma.store.findUnique({ where: { id: updated.storeId } });

  // Publish event to Kafka
  const { publishRestaurantOrderStatusEvent } = require('../utils/kafka');
  try {
    await publishRestaurantOrderStatusEvent({
      eventType: "ORDER_READY_FOR_PICKUP",
      orderId: updated.orderId,
      storeId: updated.storeId,
      restaurantStatus: "READY_FOR_PICKUP",
      readyAt: new Date().toISOString(),
      pickupLocation: {
        storeId: updated.storeId,
        restaurantName: store?.name || '',
        address: store?.address || '',
        lat: store?.latitude || null,
        lng: store?.longitude || null,
      },
      customerInfo: updated.customerInfo,
      items: updated.items,
      totalPrice: updated.totalPrice,
    });
    console.log(`📤 Published ORDER_READY_FOR_PICKUP for order ${updated.orderId}`);
  } catch (err) {
    console.error(`Error publishing ORDER_READY_FOR_PICKUP for order ${updated.orderId}:`, err);
  }
}

// API endpoint: merchant báo đơn ready for pickup
export const updateOrderToReady = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { restaurantOrderId } = req.params;

    // Verify store ownership
    const store = await prisma.store.findUnique({ where: { ownerId: userId } });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Bạn chưa có cửa hàng' });
    }

    const ro = await prisma.restaurantOrder.findUnique({ where: { id: restaurantOrderId } });
    if (!ro) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }
    if (ro.storeId !== store.id) {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập đơn hàng này' });
    }

    // Call helper to update status and publish event
    await transitionToReady(restaurantOrderId);

    res.json({
      success: true,
      message: 'Đã thông báo đội giao hàng (Ready for pickup)',
      data: { restaurantOrderId, status: 'READY_FOR_PICKUP' }
    });
  } catch (err) {
    console.error('Error updating order to ready:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật trạng thái' });
  }
};

