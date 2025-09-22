import { Request, Response } from "express";
import prisma from "../lib/prisma";

// Lấy tất cả danh mục
export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { products: true }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách danh mục"
    });
  }
};

// Lấy danh mục theo ID
export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        products: {
          where: {
            isAvailable: true
          }
        },
        _count: {
          select: { products: true }
        }
      }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy danh mục"
      });
    }

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin danh mục"
    });
  }
};

// Tạo danh mục mới
export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    // Kiểm tra tên danh mục đã tồn tại chưa
    const existingCategory = await prisma.category.findUnique({
      where: { name }
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Tên danh mục đã tồn tại"
      });
    }

    const category = await prisma.category.create({
      data: { name }
    });

    res.status(201).json({
      success: true,
      data: category,
      message: "Tạo danh mục thành công"
    });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo danh mục"
    });
  }
};

// Cập nhật danh mục
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    // Kiểm tra danh mục tồn tại
    const existingCategory = await prisma.category.findUnique({
      where: { id }
    });

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy danh mục"
      });
    }

    // Kiểm tra tên trùng (nếu thay đổi tên)
    if (name && name !== existingCategory.name) {
      const duplicateName = await prisma.category.findUnique({
        where: { name }
      });

      if (duplicateName) {
        return res.status(400).json({
          success: false,
          message: "Tên danh mục đã tồn tại"
        });
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: { name }
    });

    res.json({
      success: true,
      data: category,
      message: "Cập nhật danh mục thành công"
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật danh mục"
    });
  }
};

// Xóa danh mục
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existingCategory = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy danh mục"
      });
    }

    // Kiểm tra danh mục có sản phẩm không
    if (existingCategory._count.products > 0) {
      return res.status(400).json({
        success: false,
        message: "Không thể xóa danh mục đang có sản phẩm"
      });
    }

    await prisma.category.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: "Xóa danh mục thành công"
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa danh mục"
    });
  }
};
