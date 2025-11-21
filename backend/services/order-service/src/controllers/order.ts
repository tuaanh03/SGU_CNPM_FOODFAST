import prisma from "../lib/prisma";
import { Request, Response } from "express";
import { publishEvent } from "../utils/kafka";
import { OrderSchema } from "../validations/order.validation";
import { validateCartItems } from "../utils/menuValidator";
import { fetchUserCart, clearUserCart } from "../utils/cartHelper";
import { createOrderSession } from "../utils/redisSessionManager";

// Import metrics
import {
    ordersCreatedCounter,
    orderProcessingDurationByStatus,
    orderValueHistogram,
    sessionOperationsCounter
} from "../lib/metrics";

// API Gateway URL from environment variable
const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';

interface AuthenticatedRequest extends Request {
    user?: { id: string };
    body: any;
    params: any;
}

//okorder

// Helper function để tính tổng tiền từ Product Service
export async function calculateOrderAmount(items: any[]): Promise<{ totalPrice: number; validItems: any[] }> {
    // Gọi Product Service để lấy thông tin và giá của từng sản phẩm
    let totalPrice = 0;
    const validItems = [];

    for (const item of items) {
        try {
            // Call Product Service API qua API Gateway
            const productResponse = await fetch(`${API_GATEWAY_URL}/api/products/${item.productId}`);

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
    const processingTimer = orderProcessingDurationByStatus.startTimer({ status: 'pending' });

    try {
        const userId = req.user?.id;

        if (!userId) {
            processingTimer();
            res.status(401).json({
                success: false,
                message: "Unauthorized: No user ID found"
            });
            return;
        }

        const parsedBody = OrderSchema.safeParse(req.body);

        if (!parsedBody.success) {
            processingTimer();
            res.status(400).json({
                success: false,
                message: parsedBody.error.errors.map((err: any) => err.message).join(", "),
            });
            return;
        }

        const { items, deliveryAddress, contactPhone, note, storeId } = parsedBody.data;

        try {
            // Tính toán tổng tiền và validate sản phẩm
            const { totalPrice, validItems } = await calculateOrderAmount(items);

            // Tạo session trong Redis và lấy expirationTime
            const sessionDurationMinutes = parseInt(process.env.ORDER_SESSION_DURATION_MINUTES || '15');
            const expirationTime = new Date(Date.now() + sessionDurationMinutes * 60 * 1000);

            // Tạo order với status PENDING theo workflow mới
            const savedOrder = await prisma.order.create({
                data: {
                    userId,
                    storeId: storeId || null,
                    totalPrice,
                    deliveryAddress,
                    contactPhone,
                    note,
                    status: "pending", // Order ở trạng thái PENDING
                    expirationTime, // Thời điểm hết hạn thanh toán
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

            // Track metrics
            ordersCreatedCounter.inc({ status: 'pending', action: 'created' });
            orderValueHistogram.observe(totalPrice);
            sessionOperationsCounter.inc({ operation: 'create' });
            processingTimer();

            // Tạo session trong Redis với TTL
            const session = await createOrderSession(
                savedOrder.id,
                savedOrder.userId || '',
                savedOrder.totalPrice,
                sessionDurationMinutes
            );

            // Payload gửi đến Payment Service qua Kafka (bất đồng bộ)
            const orderPayload = {
                orderId: savedOrder.id,
                userId: savedOrder.userId,
                storeId: savedOrder.storeId || null,
                items: validItems, // Gửi thông tin items cho payment
                totalPrice: savedOrder.totalPrice,
                expiresAt: session.expirationTime.toISOString(),
                timestamp: new Date().toISOString()
            };

            // Publish event order.create để Payment Service consumer
            await publishEvent(JSON.stringify(orderPayload));

            res.status(201).json({
                success: true,
                message: "Đơn hàng đã được tạo ở trạng thái PENDING, đang xử lý thanh toán",
                data: {
                    orderId: savedOrder.id,
                    items: savedOrder.items.map((item: any) => ({
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
                    storeId: savedOrder.storeId,
                    session: {
                        expiresAt: session.expirationTime.toISOString(),
                        durationMinutes: session.durationMinutes
                    },
                    createdAt: savedOrder.createdAt,
                    expirationTime: savedOrder.expirationTime
                }
            });

        } catch (error: any) {
            processingTimer();
            res.status(400).json({
                success: false,
                message: error.message || "Lỗi khi validate sản phẩm"
            });
            return;
        }

    } catch (error) {
        console.error("Error creating order:", error);
        processingTimer();
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

        const order = await prisma.order.findFirst({
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
                items: order.items.map((item: any) => ({
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
        const order = await prisma.order.findFirst({
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

        // Nếu order đã success, không cần payment URL nữa
        if (order.status === "success") {
            res.status(200).json({
                success: true,
                message: "Đơn hàng đã được thanh toán thành công",
                paymentStatus: "success",
            });
            return;
        }

        // Nếu order đã cancelled (hết hạn hoặc thất bại), không thể lấy payment URL
        if (order.status === "cancelled") {
            res.status(200).json({
                success: false,
                message: "Đơn hàng đã hết hạn thanh toán. Vui lòng tạo đơn hàng mới",
                paymentStatus: "cancelled",
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

        const ordersData = orders.map((order: any) => ({
            id: order.id,
            orderId: order.id,
            status: order.status,
            totalPrice: order.totalPrice,
            deliveryAddress: order.deliveryAddress,
            contactPhone: order.contactPhone,
            note: order.note,
            expirationTime: order.expirationTime,
            itemsCount: order.items.length,
            items: order.items.map((item: any) => ({
                productId: item.productId,
                productName: item.productName,
                productPrice: item.productPrice,
                quantity: item.quantity,
                subtotal: item.productPrice * item.quantity
            })),
            storeId: order.storeId,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
        }));

        res.status(200).json({
            success: true,
            data: ordersData,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
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

export const createOrderFromCart = async (req: AuthenticatedRequest, res: Response) => {
    const processingTimer = orderProcessingDurationByStatus.startTimer({ status: 'pending' });

    try {
        const userId = req.user?.id;

        if (!userId) {
            processingTimer();
            res.status(401).json({
                success: false,
                message: "Unauthorized: No user ID found"
            });
            return;
        }

        const { storeId, deliveryAddress, contactPhone, note } = req.body;

        if (!storeId) {
            processingTimer();
            res.status(400).json({
                success: false,
                message: "storeId is required"
            });
            return;
        }

        // Lấy token từ request header
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
            processingTimer();
            res.status(401).json({
                success: false,
                message: "No authorization token provided"
            });
            return;
        }

        // Bước 1: Lấy cart từ Cart Service (Redis) - truyền token
        let cartItems;
        try {
            cartItems = await fetchUserCart(token, storeId);
        } catch (error: any) {
            processingTimer();
            res.status(400).json({
                success: false,
                message: error.message || "Không thể lấy giỏ hàng"
            });
            return;
        }

        if (!cartItems || cartItems.length === 0) {
            processingTimer();
            res.status(400).json({
                success: false,
                message: "Giỏ hàng trống"
            });
            return;
        }

        // Bước 2: Validate qua MenuItemRead (Read Model)
        const validationResult = await validateCartItems(cartItems);

        if (!validationResult.isValid) {
            processingTimer();
            res.status(400).json({
                success: false,
                message: "Giỏ hàng có lỗi",
                errors: validationResult.errors
            });
            return;
        }

        // Bước 3: Kiểm tra giá có thay đổi không (optional - nếu cart có lưu expectedPrice)
        // const priceCheck = await checkPriceChanges(cartItems);
        // if (priceCheck.hasChanges) {
        //     return res.status(200).json({
        //         success: false,
        //         requireConfirmation: true,
        //         message: "Giá một số món đã thay đổi. Vui lòng xác nhận lại.",
        //         priceChanges: priceCheck.changes,
        //         newTotal: validationResult.totalPrice
        //     });
        // }

        // Bước 4: Tạo Order với status PENDING theo workflow mới
        const sessionDurationMinutes = parseInt(process.env.ORDER_SESSION_DURATION_MINUTES || '15');
        const expirationTime = new Date(Date.now() + sessionDurationMinutes * 60 * 1000);

        const savedOrder = await prisma.order.create({
            data: {
                userId,
                storeId: storeId || null,
                totalPrice: validationResult.totalPrice,
                deliveryAddress,
                contactPhone,
                note,
                status: "pending", // Order ở trạng thái PENDING
                expirationTime, // Thời điểm hết hạn thanh toán
                items: {
                    create: validationResult.validItems.map(item => ({
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

        // Track metrics
        ordersCreatedCounter.inc({ status: 'pending', action: 'created' });
        orderValueHistogram.observe(validationResult.totalPrice);
        sessionOperationsCounter.inc({ operation: 'create' });
        processingTimer();

        // Tạo session trong Redis với TTL
        const session = await createOrderSession(
            savedOrder.id,
            savedOrder.userId || '',
            savedOrder.totalPrice,
            sessionDurationMinutes
        );

        // Bước 5: Publish event order.create cho Payment Service (bất đồng bộ)
        const orderPayload = {
            orderId: savedOrder.id,
            userId: savedOrder.userId,
            storeId: savedOrder.storeId || null,
            items: validationResult.validItems, // Gửi full items info với price snapshot
            totalPrice: savedOrder.totalPrice,
            expiresAt: session.expirationTime.toISOString(),
            timestamp: new Date().toISOString()
        };

        await publishEvent(JSON.stringify(orderPayload));

        // Bước 6: Clear cart sau khi tạo order thành công
        await clearUserCart(token, storeId);

        res.status(201).json({
            success: true,
            message: "Đơn hàng đã được tạo ở trạng thái PENDING, đang xử lý thanh toán",
            data: {
                orderId: savedOrder.id,
                items: savedOrder.items.map((item: any) => ({
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
                storeId: savedOrder.storeId,
                session: {
                    expiresAt: session.expirationTime.toISOString(),
                    durationMinutes: session.durationMinutes
                },
                createdAt: savedOrder.createdAt,
                expirationTime: savedOrder.expirationTime
            }
        });

    } catch (error: any) {
        console.error("Create order from cart error:", error);
        processingTimer();
        res.status(500).json({
            success: false,
            message: error.message || "Lỗi khi tạo đơn hàng từ giỏ hàng"
        });
    }
};

/**
 * Retry payment trong thời gian session còn active
 * Tạo payment attempt mới và URL thanh toán VNPay mới cho payment intent cũ
 */
export const retryPayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const { orderId } = req.params;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
            return;
        }

        if (!orderId) {
            res.status(400).json({
                success: false,
                message: "Order ID là bắt buộc"
            });
            return;
        }

        // Lấy order và kiểm tra quyền sở hữu
        const order = await prisma.order.findFirst({
            where: {
                id: orderId,
                userId
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

        // Kiểm tra trạng thái order
        if (order.status === "success") {
            res.status(400).json({
                success: false,
                message: "Đơn hàng đã được thanh toán thành công"
            });
            return;
        }

        // Kiểm tra nếu order không phải pending (có thể là failed hoặc bất kỳ status nào khác)
        if (order.status !== "pending") {
            res.status(400).json({
                success: false,
                message: "Đơn hàng không ở trạng thái chờ thanh toán. Vui lòng tạo đơn hàng mới",
                error: "ORDER_NOT_PENDING"
            });
            return;
        }

        // Kiểm tra session còn tồn tại trong Redis không
        const { checkOrderSession, getOrderSession, getSessionTTL } = require('../utils/redisSessionManager');
        const sessionExists = await checkOrderSession(orderId);

        if (!sessionExists) {
            // Session đã hết hạn
            // Cập nhật trạng thái order nếu chưa được cập nhật
            if (order.status === 'pending') {
                await prisma.order.update({
                    where: { id: orderId },
                    data: { status: 'cancelled' }
                });
            }

            res.status(400).json({
                success: false,
                message: "Phiên thanh toán đã hết hạn. Vui lòng tạo đơn hàng mới",
                error: "SESSION_EXPIRED"
            });
            return;
        }

        // Lấy thông tin session để kiểm tra thời gian còn lại
        const sessionData = await getOrderSession(orderId);
        const ttlSeconds = await getSessionTTL(orderId);

        if (ttlSeconds <= 0) {
            res.status(400).json({
                success: false,
                message: "Phiên thanh toán đã hết hạn. Vui lòng tạo đơn hàng mới",
                error: "SESSION_EXPIRED"
            });
            return;
        }

        // Publish event riêng cho retry payment
        // Topic: order.retry.payment (chỉ Payment Service lắng nghe, tránh trigger Inventory Service)
        // Payment Service sẽ tìm PaymentIntent cũ dựa trên orderId
        // và tạo PaymentAttempt mới với URL VNPay mới
        const { publishRetryPaymentEvent } = require('../utils/kafka');
        const retryPayload = {
            orderId: order.id,
            userId: order.userId,
            totalPrice: order.totalPrice,
            items: order.items.map(item => ({
                productId: item.productId,
                productName: item.productName,
                productPrice: item.productPrice,
                quantity: item.quantity
            })),
            isRetry: true, // Flag để Payment Service biết đây là retry
            expiresAt: sessionData.expirationTime,
            timestamp: new Date().toISOString()
        };

        await publishRetryPaymentEvent(retryPayload);

        const remainingMinutes = Math.ceil(ttlSeconds / 60);

        res.status(200).json({
            success: true,
            message: "Đang xử lý thanh toán lại. Vui lòng chờ URL thanh toán mới",
            data: {
                orderId: order.id,
                status: order.status,
                totalPrice: order.totalPrice,
                sessionRemainingMinutes: remainingMinutes,
                retryInitiated: true
            }
        });

    } catch (error: any) {
        console.error("Retry payment error:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi thử lại thanh toán",
            error: error.message || "Lỗi không xác định"
        });
    }
};
