import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { publishProductSyncEvent } from "../utils/kafka";

// Lấy tất cả sản phẩm
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const { categoryId, isAvailable, storeId } = req.query;

    const where: any = {};
    if (categoryId) where.categoryId = categoryId as string;
    if (isAvailable !== undefined) where.isAvailable = isAvailable === 'true';
    if (storeId) where.storeId = storeId as string;

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách sản phẩm"
    });
  }
};

// Lấy sản phẩm theo ID
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm"
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin sản phẩm"
    });
  }
};

// Tạo sản phẩm mới
export const createProduct = async (req: Request, res: Response) => {
  try {
    const {
      sku,
      name,
      price,
      description,
      imageUrl,
      categoryId,
      isAvailable,
      soldOutUntil,
      unavailableReason,
      storeId
    } = req.body;

    // Kiểm tra SKU đã tồn tại chưa
    const existingSku = await prisma.product.findUnique({
      where: { sku }
    });

    if (existingSku) {
      return res.status(400).json({
        success: false,
        message: "SKU đã tồn tại"
      });
    }

    // Kiểm tra category tồn tại nếu có categoryId
    if (categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId }
      });

      if (!category) {
        return res.status(400).json({
          success: false,
          message: "Danh mục không tồn tại"
        });
      }
    }

    const product = await prisma.product.create({
      data: {
        sku,
        name,
        price: parseInt(price),
        description,
        imageUrl,
        categoryId,
        isAvailable: isAvailable !== false,
        soldOutUntil,
        unavailableReason,
        storeId
      },
      include: {
        category: true
      }
    });

    // Publish event đồng bộ sang Order Service
    await publishProductSyncEvent('CREATED', {
      id: product.id,
      storeId: product.storeId,
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      imageUrl: product.imageUrl,
      categoryId: product.categoryId,
      isAvailable: product.isAvailable,
      soldOutUntil: product.soldOutUntil,
    });

    res.status(201).json({
      success: true,
      data: product,
      message: "Tạo sản phẩm thành công"
    });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo sản phẩm"
    });
  }
};

// Cập nhật sản phẩm
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      sku,
      name,
      price,
      description,
      imageUrl,
      categoryId,
      isAvailable,
      soldOutUntil,
      unavailableReason,
      storeId
    } = req.body;

    // Kiểm tra sản phẩm tồn tại
    const existingProduct = await prisma.product.findUnique({
      where: { id }
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm"
      });
    }

    // Kiểm tra SKU trùng (nếu thay đổi SKU)
    if (sku && sku !== existingProduct.sku) {
      const duplicateSku = await prisma.product.findUnique({
        where: { sku }
      });

      if (duplicateSku) {
        return res.status(400).json({
          success: false,
          message: "SKU đã tồn tại"
        });
      }
    }

    // Kiểm tra category tồn tại nếu có categoryId
    if (categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId }
      });

      if (!category) {
        return res.status(400).json({
          success: false,
          message: "Danh mục không tồn tại"
        });
      }
    }

    const updateData: any = {};
    if (sku !== undefined) updateData.sku = sku;
    if (name !== undefined) updateData.name = name;
    if (price !== undefined) updateData.price = parseInt(price);
    if (description !== undefined) updateData.description = description;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (isAvailable !== undefined) updateData.isAvailable = isAvailable;
    if (soldOutUntil !== undefined) updateData.soldOutUntil = soldOutUntil;
    if (unavailableReason !== undefined) updateData.unavailableReason = unavailableReason;
    if (storeId !== undefined) updateData.storeId = storeId;

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true
      }
    });

    // Publish event đồng bộ sang Order Service
    await publishProductSyncEvent('UPDATED', {
      id: product.id,
      storeId: product.storeId,
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      imageUrl: product.imageUrl,
      categoryId: product.categoryId,
      isAvailable: product.isAvailable,
      soldOutUntil: product.soldOutUntil,
    });

    res.json({
      success: true,
      data: product,
      message: "Cập nhật sản phẩm thành công"
    });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật sản phẩm"
    });
  }
};

// Xóa sản phẩm
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existingProduct = await prisma.product.findUnique({
      where: { id }
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm"
      });
    }

    await prisma.product.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: "Xóa sản phẩm thành công"
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa sản phẩm"
    });
  }
};

// Cập nhật trạng thái sản phẩm (tắt/mở bán)
export const updateProductAvailability = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isAvailable, soldOutUntil, unavailableReason } = req.body;

    const existingProduct = await prisma.product.findUnique({
      where: { id }
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm"
      });
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        isAvailable,
        soldOutUntil,
        unavailableReason
      },
      include: {
        category: true
      }
    });

    // Publish event đồng bộ sang Order Service
    await publishProductSyncEvent('UPDATED', {
      id: product.id,
      storeId: product.storeId,
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      imageUrl: product.imageUrl,
      categoryId: product.categoryId,
      isAvailable: product.isAvailable,
      soldOutUntil: product.soldOutUntil,
    });

    res.json({
      success: true,
      data: product,
      message: "Cập nhật trạng thái sản phẩm thành công"
    });
  } catch (error) {
    console.error("Error updating product availability:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật trạng thái sản phẩm"
    });
  }
};

// Đồng bộ thủ công tất cả sản phẩm sang Order Service
export const syncAllProducts = async (req: Request, res: Response) => {
  try {
    const { storeId } = req.query;

    const where: any = {};
    if (storeId) where.storeId = storeId as string;

    // Lấy tất cả products
    const products = await prisma.product.findMany({
      where,
      include: {
        category: true
      }
    });

    if (products.length === 0) {
      return res.json({
        success: true,
        message: "Không có sản phẩm nào để đồng bộ",
        data: {
          total: 0,
          synced: 0,
          failed: 0
        }
      });
    }

    // Đồng bộ từng product
    let synced = 0;
    let failed = 0;
    const errors: any[] = [];

    for (const product of products) {
      try {
        await publishProductSyncEvent('CREATED', {
          id: product.id,
          storeId: product.storeId,
          name: product.name,
          description: product.description,
          price: product.price.toString(),
          imageUrl: product.imageUrl,
          categoryId: product.categoryId,
          isAvailable: product.isAvailable,
          soldOutUntil: product.soldOutUntil,
        });
        synced++;
      } catch (error) {
        failed++;
        errors.push({
          productId: product.id,
          productName: product.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.json({
      success: true,
      message: `Đồng bộ hoàn tất: ${synced} thành công, ${failed} thất bại`,
      data: {
        total: products.length,
        synced,
        failed,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    console.error("Error syncing products:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi đồng bộ sản phẩm"
    });
  }
};

