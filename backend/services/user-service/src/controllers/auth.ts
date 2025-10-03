import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

// Đăng ký user
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, phone, role = "CUSTOMER" } = req.body;

    // Kiểm tra email đã tồn tại
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email đã được sử dụng"
      });
    }

    // Mã hóa password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Tạo user mới
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        role: role as any
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true
      }
    });

    // Tạo JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      data: {
        user,
        token
      },
      message: "Đăng ký thành công"
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi đăng ký"
    });
  }
};

// Đăng nhập
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Tìm user theo email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        store: true
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Email hoặc mật khẩu không đúng"
      });
    }

    // Kiểm tra account status
    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản đã bị khóa hoặc vô hiệu hóa"
      });
    }

    // Kiểm tra password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Email hoặc mật khẩu không đúng"
      });
    }

    // Tạo JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    // Trả về thông tin user (không bao gồm password)
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: {
        user: userWithoutPassword,
        token
      },
      message: "Đăng nhập thành công"
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi đăng nhập"
    });
  }
};

// Lấy thông tin profile
export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        addresses: true,
        store: true,
        paymentMethods: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy user"
      });
    }

    // Loại bỏ password khỏi response
    const { password, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: userWithoutPassword
    });
  } catch (error) {
    console.error("Error getting profile:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin profile"
    });
  }
};

// Cập nhật profile
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { name, phone, avatar } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(avatar && { avatar })
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      data: user,
      message: "Cập nhật profile thành công"
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật profile"
    });
  }
};
