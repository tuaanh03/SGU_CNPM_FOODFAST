import { Kafka, Partitioners } from "kafkajs";
import prisma from "../lib/prisma";

const kafka = new Kafka({
    clientId: "product-service",
    brokers: ["kafka:9092"],
    retry: {
        initialRetryTime: 100,
        maxRetryTime: 30000,
        retries: 10,
        factor: 0.2,
    },
});

const producer = kafka.producer({
    createPartitioner: Partitioners.DefaultPartitioner,
});
let isProducerConnected = false;

export async function publishInventoryReserveResult(
    orderId: string,
    status: "RESERVED" | "REJECTED",
    message?: string
) {
    if (!isProducerConnected) {
        await producer.connect();
        isProducerConnected = true;
    }

    const payload = {
        orderId,
        status,
        message: message || "",
        timestamp: new Date().toISOString(),
    };

    await producer.send({
        topic: "inventory.reserve.result",
        messages: [
            {
                key: `reserve-result-${orderId}`,
                value: JSON.stringify(payload),
            },
        ],
    });
}

const consumer = kafka.consumer({
    groupId: "product-service-group",
});

export async function runConsumer() {
    try {
        await consumer.connect();

        // Subscribe to both topics
        await consumer.subscribe({ topic: "order.create", fromBeginning: true });
        await consumer.subscribe({ topic: "payment.event", fromBeginning: true });

        console.log(
            "Product Service Consumer is listening to order.create and payment.event"
        );

        await consumer.run({
            eachMessage: async ({ topic, message }) => {
                const eventStr = message.value?.toString();
                if (!eventStr) {
                    console.warn(`Received empty message on topic ${topic}`);
                    return;
                }

                let data: unknown;
                try {
                    data = JSON.parse(eventStr);
                } catch {
                    console.error(`Invalid JSON on topic ${topic}:`, eventStr);
                    return;
                }

                console.log(`Received event from topic ${topic}:`, data);

                try {
                    if (topic === "order.create") {
                        await handleOrderCreate(data as any);
                    } else if (topic === "payment.event") {
                        await handlePaymentEvent(data as any);
                    }
                } catch (error) {
                    console.error(`Error processing ${topic} event:`, error);
                }
            },
        });
    } catch (error) {
        console.error("Error starting consumer:", error);
    }
}

// ================== Types & Helpers ==================
interface ReservationItem {
    productId: string;
    quantity: number; // int
    price: number; // int (VND)
}

function isReservationItem(x: unknown): x is ReservationItem {
    const v = x as Partial<ReservationItem> | null | undefined;
    return (
        !!v &&
        typeof v.productId === "string" &&
        typeof v.quantity === "number" &&
        Number.isInteger(v.quantity) &&
        typeof v.price === "number" &&
        Number.isInteger(v.price)
    );
}

/**
 * Parse & validate dữ liệu items lấy từ Prisma JsonValue.
 * - Hỗ trợ trường hợp lưu string JSON hoặc mảng object.
 * - Ném Error nếu format sai để transaction rollback đúng cách.
 */
function parseReservationItems(raw: unknown): ReservationItem[] {
    let val: unknown = raw;

    if (typeof val === "string") {
        try {
            val = JSON.parse(val);
        } catch {
            throw new Error("Invalid reservation.items JSON string");
        }
    }
    if (!Array.isArray(val)) {
        throw new Error("reservation.items must be an array");
    }
    if (!val.every(isReservationItem)) {
        throw new Error("reservation.items has invalid element(s)");
    }
    return val as ReservationItem[];
}

// ================ Handlers ===================

// Xử lý sự kiện order.create - Reserve inventory
async function handleOrderCreate(orderData: any) {
    console.log("Processing order.create:", orderData);

    const { orderId, items } = orderData;

    try {
        // Kiểm tra tồn kho cho tất cả items
        const reservationItems: ReservationItem[] = [];
        let canReserve = true;
        let rejectMessage = "";

        for (const item of items as Array<{ productId: string; quantity: number }>) {
            const product = await prisma.product.findUnique({
                where: { id: item.productId },
            });

            if (!product) {
                canReserve = false;
                rejectMessage = `Sản phẩm ${item.productId} không tồn tại`;
                break;
            }

            if (!product.isAvailable) {
                canReserve = false;
                rejectMessage = `Sản phẩm ${product.name} không còn kinh doanh`;
                break;
            }

            const availableStock = product.stockOnHand - product.reserved;
            if (availableStock < item.quantity) {
                canReserve = false;
                rejectMessage = `Sản phẩm ${product.name} không đủ tồn kho (còn ${availableStock}, cần ${item.quantity})`;
                break;
            }

            reservationItems.push({
                productId: item.productId,
                quantity: item.quantity,
                price: product.price,
            });
        }

        if (canReserve) {
            // Tạo reservation và cập nhật reserved quantity
            await prisma.$transaction(async (tx) => {
                // Tạo reservation record - convert to JSON cho Prisma
                await tx.reservation.create({
                    data: {
                        orderId,
                        items: JSON.parse(JSON.stringify(reservationItems)), // Safe JSON conversion
                        status: "RESERVED",
                    },
                });

                // Cập nhật reserved quantity cho từng sản phẩm
                for (const item of reservationItems) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: {
                            reserved: {
                                increment: item.quantity,
                            },
                        },
                    });
                }
            });

            // Publish RESERVED event
            await publishInventoryReserveResult(orderId, "RESERVED");
            console.log(`Successfully reserved inventory for order ${orderId}`);
        } else {
            // Publish REJECTED event
            await publishInventoryReserveResult(orderId, "REJECTED", rejectMessage);
            console.log(
                `Rejected reservation for order ${orderId}: ${rejectMessage}`
            );
        }
    } catch (error) {
        console.error("Error processing order.create:", error);
        await publishInventoryReserveResult(
            orderId,
            "REJECTED",
            "Lỗi hệ thống khi xử lý đặt hàng"
        );
    }
}

// Xử lý sự kiện payment.event - Commit hoặc Release inventory
async function handlePaymentEvent(paymentData: any) {
    console.log("Processing payment.event:", paymentData);

    const { orderId, paymentStatus, status } = paymentData;

    // Lấy status từ cả hai field có thể có
    const actualStatus: string | undefined = paymentStatus || status;

    try {
        const reservation = await prisma.reservation.findUnique({
            where: { orderId },
        });

        if (!reservation) {
            console.log(`No reservation found for order ${orderId}`);
            return;
        }

        console.log(
            `Processing order ${orderId} with status: ${actualStatus ?? "undefined"}`
        );

        // Xử lý cả "success" và "PAID" cho thanh toán thành công
        if (actualStatus === "success" || actualStatus === "PAID") {
            // Commit: trừ hẳn kho và cập nhật reservation
            await prisma.$transaction(async (tx) => {
                const items = parseReservationItems(reservation.items as unknown);

                // Trừ stock_on_hand và giảm reserved
                for (const item of items) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: {
                            stockOnHand: {
                                decrement: item.quantity,
                            },
                            reserved: {
                                decrement: item.quantity,
                            },
                        },
                    });
                }

                // Cập nhật status reservation
                await tx.reservation.update({
                    where: { orderId },
                    data: { status: "COMMITTED" },
                });
            });

            console.log(
                `Successfully committed inventory for order ${orderId} with status ${actualStatus}`
            );
        } else if (
            actualStatus === "failed" ||
            actualStatus === "FAILED" ||
            actualStatus === "CANCELED"
        ) {
            // Release: trả lại reserved quantity
            await prisma.$transaction(async (tx) => {
                const items = parseReservationItems(reservation.items as unknown);

                // Giảm reserved quantity
                for (const item of items) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: {
                            reserved: {
                                decrement: item.quantity,
                            },
                        },
                    });
                }

                // Cập nhật status reservation
                await tx.reservation.update({
                    where: { orderId },
                    data: { status: "RELEASED" },
                });
            });

            console.log(
                `Successfully released inventory for order ${orderId} with status ${actualStatus}`
            );
        } else {
            console.log(
                `Unknown payment status for order ${orderId}: ${actualStatus} (raw paymentStatus: ${paymentStatus}, raw status: ${status})`
            );
        }
    } catch (error) {
        console.error("Error processing payment.event:", error);
    }
}

process.on("SIGTERM", async () => {
    console.log("SIGTERM received, closing consumer...");
    await consumer.disconnect();
    if (isProducerConnected) {
        await producer.disconnect();
    }
});

process.on("SIGINT", async () => {
    console.log("SIGINT received, closing consumer...");
    await consumer.disconnect();
    if (isProducerConnected) {
        await producer.disconnect();
    }
});
