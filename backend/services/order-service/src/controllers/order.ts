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
async function calculateOrderAmount(items: any[]): Promise<{ totalPrice: number; validItems: any[] }> {
    // Gọi Product Service để lấy thông tin và giá của từng sản phẩm
    let totalPrice = 0;
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

            // Sửa từ isActive thành isAvailable để khớp với Product Service schema
            if (!product.isAvailable) {
                throw new Error(`Sản phẩm ${product.name} không còn kinh doanh`);
            }

            // // Kiểm tra stock availability
            // if (product.stockOnHand < item.quantity) {
            //     throw new Error(`Sản phẩm ${product.name} không đủ hàng. Còn lại: ${product.stockOnHand}, yêu cầu: ${item.quantity}`);
            // }

            // Validate quantity
            if (item.quantity <= 0) {
                throw new Error(`Số lượng sản phẩm ${product.name} phải lớn hơn 0`);
            }

            const itemTotal = product.price * item.quantity;
            totalPrice += itemTotal;

            validItems.push({
                productId: item.productId,
                quantity: item.quantity,
                productName: product.name,
                productPrice: product.price,
                subtotal: itemTotal
            });

        } catch (error) {
            throw error;
        }
    }

    return { totalPrice, validItems };
}

export const createOrder = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized: No user ID found"
            });
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

        const { items, deliveryAddress, contactPhone, note } = parsedBody.data;

        try {
            // Tính toán tổng tiền và validate sản phẩm
            const { totalPrice, validItems } = await calculateOrderAmount(items);

            // Tạo order với structure mới theo Prisma schema
            const savedOrder = await prisma.order.create({
                data: {
                    userId,
                    totalPrice,
                    deliveryAddress,
                    contactPhone,
                    note,
                    status: "pending",
                    items: {
                        create: validItems.map(item => ({
                            productId: item.productId,
                            productName: item.productName,
                            productPrice: item.productPrice,
                            quantity: item.quantity
                        }))
                    }
                },
                include: {
                    items: true
                }
            });

            // Payload gửi đến Product Service để reserve inventory
            const orderPayload = {
                orderId: savedOrder.id,
                userId: savedOrder.userId,
                items: items, // Format đơn giản cho Product Service: [{productId, quantity}]
                totalPrice: savedOrder.totalPrice,
                timestamp: new Date().toISOString()
            };

            await publishEvent(JSON.stringify(orderPayload));

            res.status(201).json({
                success: true,
                message: "Đơn hàng đã được tạo và đang chờ kiểm tra tồn kho",
                data: {
                    orderId: savedOrder.id,
                    items: savedOrder.items.map(item => ({
                        productId: item.productId,
                        productName: item.productName,
                        productPrice: item.productPrice,
                        quantity: item.quantity,
                        subtotal: item.productPrice * item.quantity
                    })),
                    totalPrice: savedOrder.totalPrice,
                    status: savedOrder.status,
                    deliveryAddress: savedOrder.deliveryAddress,
                    contactPhone: savedOrder.contactPhone,
                    note: savedOrder.note,
                    createdAt: savedOrder.createdAt
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
            res.status(401).json({
                success: false,
                message: "Người dùng chưa được xác thực"
            });
            return;
        }

        const orderId = req.params.orderId;

        if (!orderId) {
            res.status(400).json({
                success: false,
                message: "Order ID là bắt buộc"
            });
            return;
        }

        const order = await prisma.order.findUnique({
            where: {
                id: orderId,
                userId,
            },
            include: {
                items: true
            }
        });

        if (!order) {
            res.status(404).json({
                success: false,
                message: "Không tìm thấy đơn hàng"
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: {
                orderId: order.id,
                status: order.status,
                totalPrice: order.totalPrice,
                deliveryAddress: order.deliveryAddress,
                contactPhone: order.contactPhone,
                note: order.note,
                items: order.items.map(item => ({
                    productId: item.productId,
                    productName: item.productName,
                    productPrice: item.productPrice,
                    quantity: item.quantity,
                    subtotal: item.productPrice * item.quantity
                })),
                createdAt: order.createdAt,
                updatedAt: order.updatedAt
            },
            message: "Lấy trạng thái đơn hàng thành công",
        });
    } catch (error) {
        console.error("Error while checking order status:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi kiểm tra trạng thái đơn hàng",
            error: error instanceof Error ? error.message : "Lỗi không xác định",
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
                message: "Người dùng chưa được xác thực",
            });
            return;
        }

        if (!orderId) {
            res.status(400).json({
                success: false,
                message: "Order ID là bắt buộc",
            });
            return;
        }

        // Kiểm tra order có thuộc về user này không
        const order = await prisma.order.findUnique({
            where: {
                id: orderId,
                userId,
            },
        });

        if (!order) {
            res.status(404).json({
                success: false,
                message: "Không tìm thấy đơn hàng",
            });
            return;
        }

        // Nếu order đã success hoặc failed, không cần payment URL nữa
        if (order.status === "success") {
            res.status(200).json({
                success: true,
                message: "Đơn hàng đã được thanh toán thành công",
                paymentStatus: "success",
            });
            return;
        }

        if (order.status === "failed") {
            res.status(200).json({
                success: false,
                message: "Thanh toán thất bại. Vui lòng tạo đơn hàng mới",
                paymentStatus: "failed",
            });
            return;
        }

        // Nếu order vẫn đang pending, frontend cần đợi payment URL từ Kafka event
        res.status(200).json({
            success: true,
            message: "Đang xử lý thanh toán. Vui lòng chờ URL thanh toán",
            paymentStatus: order.status,
            orderId: order.id,
        });
    } catch (error) {
        console.error("Error getting payment URL:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi lấy URL thanh toán",
            error: error instanceof Error ? error.message : "Lỗi không xác định",
        });
    }
};

// Thêm function để lấy tất cả orders của user
export const getUserOrders = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Người dùng chưa được xác thực",
            });
            return;
        }

        const { page = 1, limit = 10, status } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const whereCondition: any = { userId };
        if (status && typeof status === 'string') {
            whereCondition.status = status;
        }

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where: whereCondition,
                include: {
                    items: true
                },
                orderBy: {
                    createdAt: 'desc'
                },
                skip,
                take: Number(limit)
            }),
            prisma.order.count({
                where: whereCondition
            })
        ]);

        res.status(200).json({
            success: true,
            data: {
                orders: orders.map(order => ({
                    orderId: order.id,
                    status: order.status,
                    totalPrice: order.totalPrice,
                    deliveryAddress: order.deliveryAddress,
                    contactPhone: order.contactPhone,
                    note: order.note,
                    itemsCount: order.items.length,
                    items: order.items.map(item => ({
                        productId: item.productId,
                        productName: item.productName,
                        productPrice: item.productPrice,
                        quantity: item.quantity,
                        subtotal: item.productPrice * item.quantity
                    })),
                    createdAt: order.createdAt,
                    updatedAt: order.updatedAt
                })),
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    totalPages: Math.ceil(total / Number(limit))
                }
            },
            message: "Lấy danh sách đơn hàng thành công"
        });

    } catch (error) {
        console.error("Error getting user orders:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi lấy danh sách đơn hàng",
            error: error instanceof Error ? error.message : "Lỗi không xác định",
        });
    }
};