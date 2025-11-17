import { Kafka, Partitioners } from "kafkajs";
import prisma from "../lib/prisma";
import {
    kafkaProducerMessageCounter,
    kafkaProducerLatency,
    kafkaProducerErrorCounter,
    kafkaConsumerMessageCounter,
    kafkaConsumerProcessingDuration,
    kafkaConsumerErrorCounter,
} from "../lib/kafkaMetrics";

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

// Publish product sync event to Order Service
export async function publishProductSyncEvent(
    eventType: 'CREATED' | 'UPDATED' | 'DELETED',
    productData: any
) {
    const topic = "product.sync";
    const end = kafkaProducerLatency.startTimer({ topic });

    try {
        if (!isProducerConnected) {
            await producer.connect();
            isProducerConnected = true;
            console.log("Kafka producer connected");
        }

        const event = {
            eventType,
            timestamp: new Date().toISOString(),
            data: productData
        };

        await producer.send({
            topic,
            messages: [{
                key: `product-${productData.id}-${Date.now()}`,
                value: JSON.stringify(event)
            }],
        });

        console.log(`Published product sync event: ${eventType}`, productData.id);
        kafkaProducerMessageCounter.inc({ topic, status: 'success' });
        end();
    } catch (error) {
        console.error("Error publishing product sync event:", error);
        kafkaProducerErrorCounter.inc({ topic, error_type: (error as Error).name || 'unknown' });
        kafkaProducerMessageCounter.inc({ topic, status: 'error' });
        end();
        throw error;
    }
}

export async function publishInventoryReserveResult(
    orderId: string,
    status: "RESERVED" | "REJECTED",
    message?: string
) {
    const topic = "inventory.reserve.result";
    const end = kafkaProducerLatency.startTimer({ topic });

    try {
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
            topic,
            messages: [
                {
                    key: `reserve-result-${orderId}`,
                    value: JSON.stringify(payload),
                },
            ],
        });

        kafkaProducerMessageCounter.inc({ topic, status: 'success' });
        end();
    } catch (error) {
        kafkaProducerErrorCounter.inc({ topic, error_type: (error as Error).name || 'unknown' });
        kafkaProducerMessageCounter.inc({ topic, status: 'error' });
        end();
        throw error;
    }
}

const consumer = kafka.consumer({
    groupId: "product-service-group",
});

async function handleOrderCreate(orderData: any) {
    console.log("Processing order.create:", orderData);

    const { orderId, items } = orderData;

    try {
        let canReserve = true;
        let rejectMessage = "";

        // Chỉ kiểm tra sản phẩm có tồn tại và có thể bán không
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
                rejectMessage = `Sản phẩm ${product.name} hiện không có sẵn`;
                if (product.unavailableReason) {
                    rejectMessage += `: ${product.unavailableReason}`;
                }
                break;
            }

            // Kiểm tra nếu sản phẩm hết hàng đến một thời điểm cụ thể
            if (product.soldOutUntil && new Date() < product.soldOutUntil) {
                canReserve = false;
                rejectMessage = `Sản phẩm ${product.name} hết hàng đến ${product.soldOutUntil.toLocaleDateString()}`;
                break;
            }
        }

        if (canReserve) {
            // Tạo bản ghi đặt hàng (không liên quan đến tồn kho)
            await prisma.reservation.create({
                data: {
                    orderId,
                    items: JSON.parse(JSON.stringify(items)),
                    status: "RESERVED",
                },
            });

            await publishInventoryReserveResult(orderId, "RESERVED");
            console.log(`Đơn hàng ${orderId} đã được xác nhận`);
        } else {
            await publishInventoryReserveResult(orderId, "REJECTED", rejectMessage);
            console.log(`Đơn hàng ${orderId} bị từ chối: ${rejectMessage}`);
        }
    } catch (error) {
        console.error("Lỗi khi xử lý order.create:", error);
        await publishInventoryReserveResult(orderId, "REJECTED", "Lỗi hệ thống");
    }
}

async function handlePaymentEvent(paymentData: any) {
    console.log("Processing payment.event:", paymentData);

    const { orderId, paymentStatus, status } = paymentData;
    const actualStatus: string | undefined = paymentStatus || status;

    try {
        const reservation = await prisma.reservation.findUnique({
            where: { orderId },
        });

        if (!reservation) {
            console.log(`Không tìm thấy đặt hàng cho đơn ${orderId}`);
            return;
        }

        if (actualStatus === "success" || actualStatus === "PAID") {
            await prisma.reservation.update({
                where: { orderId },
                data: { status: "COMMITTED" },
            });
            console.log(`Đơn hàng ${orderId} đã được xác nhận thanh toán`);
        } else if (
            actualStatus === "failed" ||
            actualStatus === "FAILED" ||
            actualStatus === "CANCELED"
        ) {
            await prisma.reservation.update({
                where: { orderId },
                data: { status: "RELEASED" },
            });
            console.log(`Đơn hàng ${orderId} đã bị hủy`);
        } else {
            console.log(`Trạng thái thanh toán không xác định cho đơn ${orderId}: ${actualStatus}`);
        }
    } catch (error) {
        console.error("Lỗi khi xử lý payment.event:", error);
    }
}

export async function initKafka() {
    try {
        await consumer.connect();
        await consumer.subscribe({ topics: ["order.create", "payment.event"] });

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const end = kafkaConsumerProcessingDuration.startTimer({ topic });
                const value = message.value?.toString();

                if (!value) {
                    end();
                    return;
                }

                try {
                    const data = JSON.parse(value);

                    switch (topic) {
                        case "order.create":
                            await handleOrderCreate(data);
                            break;
                        case "payment.event":
                            await handlePaymentEvent(data);
                            break;
                        default:
                            console.log(`Chủ đề không được xử lý: ${topic}`);
                    }

                    kafkaConsumerMessageCounter.inc({ topic, status: 'success' });
                    end();
                } catch (error) {
                    console.error(`Lỗi xử lý tin nhắn từ chủ đề ${topic}:`, error);
                    kafkaConsumerErrorCounter.inc({ topic, error_type: (error as Error).name || 'unknown' });
                    kafkaConsumerMessageCounter.inc({ topic, status: 'error' });
                    end();
                }
            },
        });

        console.log("Kafka consumer đã được khởi tạo thành công");
    } catch (error) {
        console.error("Lỗi khởi tạo Kafka:", error);
    }
}
