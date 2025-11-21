import { Kafka, Partitioners, EachMessagePayload } from "kafkajs";
import prisma from "../lib/prisma";
import {
    kafkaProducerMessageCounter,
    kafkaProducerLatency,
    kafkaProducerErrorCounter,
    kafkaConsumerMessageCounter,
    kafkaConsumerProcessingDuration,
    kafkaConsumerErrorCounter,
} from "../lib/kafkaMetrics";

// Allow disabling Kafka via env (useful for tests / environments without Kafka)
const isKafkaDisabled = process.env.DISABLE_KAFKA === 'true' || process.env.NODE_ENV === 'test';

if (isKafkaDisabled) {
    console.log('Kafka is disabled via DISABLE_KAFKA or test env; producer/consumer will not be initialized');
}

// Kafka Configuration - Hỗ trợ cả local và Confluent Cloud
const kafkaBrokers = process.env.KAFKA_BROKERS?.split(',') || ['kafka:9092'];
const kafkaUsername = process.env.KAFKA_USERNAME;
const kafkaPassword = process.env.KAFKA_PASSWORD;
const useSASL = process.env.KAFKA_SECURITY_PROTOCOL === 'SASL_SSL';

console.log('🔧 Kafka Config (Product Service):');
console.log('  - Brokers:', kafkaBrokers);
console.log('  - SASL:', useSASL ? 'Enabled (Confluent Cloud)' : 'Disabled (Local)');

// If Kafka is disabled, create no-op placeholders
let kafka: any = null;
let producer: any = null;
let consumer: any = null;
let isProducerConnected = false;

if (!isKafkaDisabled) {
    kafka = new Kafka({
        clientId: "product-service",
        brokers: kafkaBrokers,
        ssl: useSASL,
        sasl: useSASL && kafkaUsername && kafkaPassword ? {
            mechanism: 'plain',
            username: kafkaUsername,
            password: kafkaPassword
        } : undefined,
        retry: {
            initialRetryTime: 100,
            maxRetryTime: 30000,
            retries: 10,
            factor: 0.2,
        },
    });

    producer = kafka.producer({
        createPartitioner: Partitioners.DefaultPartitioner,
    });

    consumer = kafka.consumer({
        groupId: "product-service-group",
    });
}

// Publish product sync event to Order Service
export async function publishProductSyncEvent(
    eventType: 'CREATED' | 'UPDATED' | 'DELETED',
    productData: any
) {
    if (isKafkaDisabled) {
        // No-op in test or when disabled; log for visibility
        console.log('[Kafka disabled] publishProductSyncEvent', eventType, productData?.id);
        return;
    }

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
    if (isKafkaDisabled) {
        console.log('[Kafka disabled] publishInventoryReserveResult', orderId, status);
        return;
    }

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

// The consumer processing functions remain unchanged; they will not be invoked when initKafka is a no-op

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
    if (isKafkaDisabled) {
        console.log('initKafka: Kafka is disabled; skipping consumer setup');
        return;
    }

    try {
        await consumer.connect();
        await consumer.subscribe({ topics: ["order.create", "payment.event"] });

        await consumer.run({
            eachMessage: async (payload: EachMessagePayload) => {
                const { topic, message } = payload;
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
