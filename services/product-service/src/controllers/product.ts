import { Request, Response } from "express";
import prisma from "../lib/prisma";

// Lấy tất cả sản phẩm
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const { categoryId, isActive } = req.query;

    const where: any = {};
    if (categoryId) where.categoryId = categoryId as string;
    if (isActive !== undefined) where.isActive = isActive === 'true';

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
    const { sku, name, price, categoryId, stockOnHand, isActive } = req.body;

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
        categoryId,
        stockOnHand: parseInt(stockOnHand) || 0,
        isActive: isActive !== false
      },
      include: {
        category: true
      }
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
    const { sku, name, price, categoryId, stockOnHand, isActive } = req.body;

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
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (stockOnHand !== undefined) updateData.stockOnHand = parseInt(stockOnHand);
    if (isActive !== undefined) updateData.isActive = isActive;

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true
      }
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

// Lấy thông tin tồn kho
export const getProductStock = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        sku: true,
        name: true,
        stockOnHand: true,
        reserved: true
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
      data: {
        ...product,
        available: product.stockOnHand - product.reserved
      }
    });
  } catch (error) {
    console.error("Error fetching product stock:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin tồn kho"
    });
  }
};
