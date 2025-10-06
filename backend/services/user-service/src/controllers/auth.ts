import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import crypto from "crypto";

// --------------------- Đăng ký user ---------------------
export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, name, phone, role = "CUSTOMER" } = req.body;

        // Kiểm tra email đã tồn tại
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Email đã được sử dụng",
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
                role: role as any,
            },
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                role: true,
                status: true,
                createdAt: true,
            },
        });

        // Tạo JWT token với jti để hỗ trợ logout
        const jti = crypto.randomUUID();
        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role,
            },
            process.env.JWT_SECRET || "secret",
            { expiresIn: "7d", jwtid: jti }
        );

        res.status(201).json({
            success: true,
            data: { user, token },
            message: "Đăng ký thành công",
        });
    } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi đăng ký",
        });
    }
};

// --------------------- Đăng nhập ---------------------
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // Tìm user theo email
        const user = await prisma.user.findUnique({
            where: { email },
            include: { store: true },
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Email hoặc mật khẩu không đúng",
            });
        }

        // Kiểm tra account status
        if (user.status !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                message: "Tài khoản đã bị khóa hoặc vô hiệu hóa",
            });
        }

        // Kiểm tra password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: "Email hoặc mật khẩu không đúng",
            });
        }

        // Tạo JWT token với jti để hỗ trợ logout
        const jti = crypto.randomUUID();
        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role,
            },
            process.env.JWT_SECRET || "secret",
            { expiresIn: "7d", jwtid: jti }
        );

        const { password: _, ...userWithoutPassword } = user;

        res.json({
            success: true,
            data: {
                user: userWithoutPassword,
                token,
            },
            message: "Đăng nhập thành công",
        });
    } catch (error) {
        console.error("Error logging in:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi đăng nhập",
        });
    }
};

// --------------------- Lấy thông tin profile ---------------------
export const getProfile = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                addresses: true,
                store: true,
                paymentMethods: true,
            },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy user",
            });
        }

        const { password, ...userWithoutPassword } = user;

        res.json({
            success: true,
            data: userWithoutPassword,
        });
    } catch (error) {
        console.error("Error getting profile:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy thông tin profile",
        });
    }
};

// --------------------- Cập nhật profile ---------------------
export const updateProfile = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { name, phone, avatar } = req.body;

        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                ...(name && { name }),
                ...(phone && { phone }),
                ...(avatar && { avatar }),
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
                updatedAt: true,
            },
        });

        res.json({
            success: true,
            data: user,
            message: "Cập nhật profile thành công",
        });
    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi cập nhật profile",
        });
    }
};

// --------------------- Đăng xuất ---------------------
export const logout = async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(" ")[1];
        if (!token) {
            return res.status(400).json({
                success: false,
                message: "Thiếu token để đăng xuất",
            });
        }

        // Xác thực token để lấy thông tin jti và exp
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret") as any;
        const jti: string | undefined = decoded?.jti;
        const exp: number | undefined = decoded?.exp; // giây kể từ epoch
        const userId = (req as any)?.user?.userId as string | undefined;

        const expiresAt = exp ? new Date(exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

        // Kiểm tra đã thu hồi trước đó chưa (tránh lỗi unique)
        const exists = await prisma.revokedToken.findFirst({
            where: {
                OR: [
                    ...(jti ? [{ jti }] as any[] : []),
                    { tokenHash }
                ],
                expiresAt: { gt: new Date() }
            }
        });

        if (!exists) {
            await prisma.revokedToken.create({
                data: {
                    jti: jti || null,
                    tokenHash,
                    userId: userId || null,
                    expiresAt
                }
            });
        }

        return res.status(200).json({
            success: true,
            message: "Đăng xuất thành công",
        });
    } catch (error: any) {
        // Nếu token hết hạn, vẫn coi là đã đăng xuất thành công (idempotent)
        if (error?.name === "TokenExpiredError") {
            return res.status(200).json({ success: true, message: "Đăng xuất thành công" });
        }
        console.error("Error logging out:", error);
        return res.status(500).json({ success: false, message: "Lỗi khi đăng xuất" });
    }
};
