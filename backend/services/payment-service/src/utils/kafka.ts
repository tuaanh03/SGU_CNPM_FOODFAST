import { Kafka, Partitioners } from "kafkajs";
import { processPayment } from "./vnpay";
import prisma from "../lib/prisma";
import {
  kafkaProducerMessageCounter,
  kafkaProducerLatency,
  kafkaProducerErrorCounter,
  kafkaConsumerMessageCounter,
  kafkaConsumerProcessingDuration,
  kafkaConsumerErrorCounter,
} from "../lib/kafkaMetrics";

// Kafka Configuration - Hỗ trợ cả local và Confluent Cloud
const kafkaBrokers = process.env.KAFKA_BROKERS?.split(',') || ['kafka:9092'];
const kafkaUsername = process.env.KAFKA_USERNAME;
const kafkaPassword = process.env.KAFKA_PASSWORD;
const useSASL = process.env.KAFKA_SECURITY_PROTOCOL === 'SASL_SSL';

console.log('🔧 Kafka Config:');
console.log('  - Brokers:', kafkaBrokers);
console.log('  - SASL:', useSASL ? 'Enabled (Confluent Cloud)' : 'Disabled (Local)');

const kafka = new Kafka({
  clientId: "payment-service",
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

const producer = kafka.producer({
  createPartitioner: Partitioners.DefaultPartitioner,
});
let isProducerConnected = false;

/**
 * Logic của Payment Service:
 * 1. Tạo PaymentIntent với trạng thái REQUIRES_PAYMENT
 * 2. Tạo PaymentAttempt đầu tiên với trạng thái CREATED
 * 3. Gọi API VNPay để tạo paymentUrl
 * 4. Cập nhật PaymentAttempt với paymentUrl
 */
async function createPaymentIntent(
  orderId: string,
  userId: string,
  amount: number,
  description: string
) {
  try {
    // Bước 1: Tạo PaymentIntent
    const paymentIntent = await prisma.paymentIntent.create({
      data: {
        orderId,
        amount,
        currency: "VND",
        status: "REQUIRES_PAYMENT",
        metadata: {
          userId,
          description,
          createdAt: new Date().toISOString()
        }
      }
    });

    console.log(`PaymentIntent created: ${paymentIntent.id} for order ${orderId}`);

    // Bước 2: Tạo PaymentAttempt đầu tiên
    const vnpTxnRef = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const paymentAttempt = await prisma.paymentAttempt.create({
      data: {
        paymentIntentId: paymentIntent.id,
        amount,
        currency: "VND",
        status: "CREATED",
        pspProvider: "VNPAY",
        vnpTxnRef,
        metadata: {
          userId,
          description,
          orderId
        }
      }
    });

    console.log(`PaymentAttempt created: ${paymentAttempt.id} for PaymentIntent ${paymentIntent.id}`);

    // Bước 3: Gọi API VNPay để tạo paymentUrl
    const vnpayResult = await processPayment(
      orderId,
      userId,
      amount,
      description
    );

    if (vnpayResult.success && vnpayResult.paymentUrl) {
      // Cập nhật PaymentAttempt với status PROCESSING
      await prisma.paymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: {
          status: "PROCESSING",
          vnpRawRequestPayload: {
            paymentUrl: vnpayResult.paymentUrl,
            timestamp: new Date().toISOString()
          }
        }
      });

      // Cập nhật PaymentIntent status
      await prisma.paymentIntent.update({
        where: { id: paymentIntent.id },
        data: {
          status: "PROCESSING"
        }
      });

      console.log(`VNPay payment URL created for order ${orderId}`);

      return {
        success: true,
        paymentIntentId: paymentIntent.id,
        paymentAttemptId: paymentAttempt.id,
        paymentUrl: vnpayResult.paymentUrl
      };
    } else {
      // Cập nhật PaymentAttempt và PaymentIntent thành FAILED
      await prisma.paymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: {
          status: "FAILED"
        }
      });

      await prisma.paymentIntent.update({
        where: { id: paymentIntent.id },
        data: {
          status: "FAILED"
        }
      });

      return {
        success: false,
        paymentIntentId: paymentIntent.id,
        error: vnpayResult.error || "Failed to create payment URL"
      };
    }
  } catch (error: any) {
    console.error("Error creating PaymentIntent:", error);
    return {
      success: false,
      error: error.message || "Error creating payment intent"
    };
  }
}

export async function publishEvent(
  orderId: string,
  userId: string,
  email: string,
  amount: number,
  item: string,
  paymentStatus: string,
  paymentIntentId: string,
  paymentUrl?: string
) {
  const topic = "payment.event";
  const end = kafkaProducerLatency.startTimer({ topic });

  try {
    if (!isProducerConnected) {
      await producer.connect();
      isProducerConnected = true;
    }

    const messageData = {
      orderId,
      userId,
      email,
      amount,
      item,
      paymentStatus,
      paymentIntentId,
      paymentUrl,
    };

    await producer.send({
      topic,
      messages: [
        { key: `message-${Date.now()}`, value: JSON.stringify(messageData) },
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
  groupId: "payment-service-group",
});

/**
 * Xử lý khi order hết hạn
 * Cập nhật PaymentIntent thành FAILED và PaymentAttempt thành CANCELED
 */
async function handleOrderExpired(data: any) {
  const { orderId, reason, timestamp } = data;

  try {
    console.log(`⏰ Handling expired order: ${orderId}, reason: ${reason}`);

    // Tìm PaymentIntent của order
    const paymentIntent = await prisma.paymentIntent.findUnique({
      where: { orderId },
      include: {
        attempts: {
          where: {
            status: {
              in: ["CREATED", "PROCESSING"]
            }
          }
        }
      }
    });

    if (!paymentIntent) {
      console.log(`No PaymentIntent found for order ${orderId}`);
      return;
    }

    // Cập nhật PaymentIntent thành FAILED
    await prisma.paymentIntent.update({
      where: { id: paymentIntent.id },
      data: {
        status: "FAILED",
        metadata: {
          ...(typeof paymentIntent.metadata === 'object' ? paymentIntent.metadata : {}),
          expiredAt: timestamp,
          expiredReason: reason
        }
      }
    });

    console.log(`✅ Updated PaymentIntent ${paymentIntent.id} to FAILED`);

    // Cập nhật tất cả PaymentAttempt đang CREATED hoặc PROCESSING thành CANCELED
    if (paymentIntent.attempts.length > 0) {
      const attemptIds = paymentIntent.attempts.map((a: any) => a.id);

      await prisma.paymentAttempt.updateMany({
        where: {
          id: { in: attemptIds }
        },
        data: {
          status: "CANCELED"
        }
      });

      console.log(`✅ Canceled ${paymentIntent.attempts.length} PaymentAttempt(s) for order ${orderId}`);
    }

  } catch (error) {
    console.error(`Error handling expired order ${orderId}:`, error);
  }
}

/**
 * Xử lý retry payment - tạo PaymentAttempt mới cho PaymentIntent cũ
 */
async function retryPaymentIntent(
  orderId: string,
  userId: string,
  amount: number,
  description: string
) {
  try {
    console.log(`🔄 Retrying payment for order ${orderId}`);

    // Tìm PaymentIntent cũ
    const existingPaymentIntent = await prisma.paymentIntent.findUnique({
      where: { orderId }
    });

    if (!existingPaymentIntent) {
      console.error(`PaymentIntent not found for order ${orderId}. Creating new one...`);
      // Nếu không tìm thấy PaymentIntent cũ, tạo mới
      return await createPaymentIntent(orderId, userId, amount, description);
    }

    console.log(`Found existing PaymentIntent: ${existingPaymentIntent.id}`);

    // Cập nhật PaymentIntent status về REQUIRES_PAYMENT nếu đang FAILED
    if (existingPaymentIntent.status === "FAILED") {
      await prisma.paymentIntent.update({
        where: { id: existingPaymentIntent.id },
        data: { status: "REQUIRES_PAYMENT" }
      });
      console.log(`Updated PaymentIntent ${existingPaymentIntent.id} status to REQUIRES_PAYMENT`);
    }

    // Tạo PaymentAttempt mới
    const vnpTxnRef = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const paymentAttempt = await prisma.paymentAttempt.create({
      data: {
        paymentIntentId: existingPaymentIntent.id,
        amount,
        currency: "VND",
        status: "CREATED",
        pspProvider: "VNPAY",
        vnpTxnRef,
        metadata: {
          userId,
          description,
          orderId,
          isRetry: true,
          retryAt: new Date().toISOString()
        }
      }
    });

    console.log(`✅ Created new PaymentAttempt: ${paymentAttempt.id} (retry) for PaymentIntent ${existingPaymentIntent.id}`);

    // Tạo URL thanh toán VNPay mới
    const vnpayResult = await processPayment(
      orderId,
      userId,
      amount,
      description
    );

    if (vnpayResult.success && vnpayResult.paymentUrl) {
      // Cập nhật PaymentAttempt với status PROCESSING
      await prisma.paymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: {
          status: "PROCESSING",
          vnpRawRequestPayload: {
            paymentUrl: vnpayResult.paymentUrl,
            timestamp: new Date().toISOString()
          }
        }
      });

      // Cập nhật PaymentIntent status
      await prisma.paymentIntent.update({
        where: { id: existingPaymentIntent.id },
        data: {
          status: "PROCESSING"
        }
      });

      console.log(`✅ VNPay payment URL created for retry order ${orderId}`);

      return {
        success: true,
        paymentIntentId: existingPaymentIntent.id,
        paymentAttemptId: paymentAttempt.id,
        paymentUrl: vnpayResult.paymentUrl,
        isRetry: true
      };
    } else {
      // Cập nhật PaymentAttempt thành FAILED
      await prisma.paymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: {
          status: "FAILED"
        }
      });

      return {
        success: false,
        paymentIntentId: existingPaymentIntent.id,
        error: vnpayResult.error || "Failed to create payment URL for retry"
      };
    }
  } catch (error: any) {
    console.error("Error retrying PaymentIntent:", error);
    return {
      success: false,
      error: error.message || "Error retrying payment intent"
    };
  }
}

export async function runConsumer() {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: "order.create", fromBeginning: true });
    await consumer.subscribe({ topic: "order.retry.payment", fromBeginning: true });
    await consumer.subscribe({ topic: "order.expired", fromBeginning: true });
    console.log("Consumer is listening to order.create, order.retry.payment, and order.expired");

    // Process messages
    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        const end = kafkaConsumerProcessingDuration.startTimer({ topic });

        try {
          const orderData = JSON.parse(message.value?.toString() || "{}");

          // Xử lý order.expired event
          if (topic === "order.expired") {
            await handleOrderExpired(orderData);
            kafkaConsumerMessageCounter.inc({ topic, status: 'success' });
            end();
            return;
          }

          // Xử lý order.create event và order.retry.payment event
          const { orderId, userId, totalPrice, items, isRetry } = orderData;
          const isRetryPayment = topic === "order.retry.payment" || isRetry === true;

          if (!orderId || !userId || !totalPrice) {
            console.error("Invalid order data:", orderData);
            kafkaConsumerErrorCounter.inc({ topic, error_type: 'invalid_data' });
            kafkaConsumerMessageCounter.inc({ topic, status: 'error' });
            end();
            return;
          }

          console.log(`Processing payment for order ${orderId}${isRetryPayment ? ' (RETRY)' : ''}`);

          // Tạo mô tả đơn hàng từ items
          const orderDescription =
            items && items.length > 0
              ? `Order ${orderId} - ${items.length} items`
              : `Order ${orderId}`;

          // Kiểm tra nếu là retry payment
          let result;
          if (isRetryPayment) {
            // Gọi retryPaymentIntent để tìm PaymentIntent cũ và tạo PaymentAttempt mới
            result = await retryPaymentIntent(
              orderId,
              userId,
              totalPrice,
              orderDescription
            );
          } else {
            // Gọi createPaymentIntent để tạo PaymentIntent và PaymentAttempt mới
            result = await createPaymentIntent(
              orderId,
              userId,
              totalPrice,
              orderDescription
            );
          }

          console.log(`Payment processing result for order ${orderId}:`, result);

          if (result.success && result.paymentUrl) {
            const paymentIntentId = result.paymentIntentId!;

            // Publish event với payment URL để frontend có thể redirect
            await publishEvent(
              orderId,
              userId,
              "system@vnpay.com",
              totalPrice,
              orderDescription,
              "pending",
              paymentIntentId,
              result.paymentUrl
            );

            console.log(`Payment URL sent for order ${orderId}: ${result.paymentUrl}`);
          } else {
            // Nếu là retry và failed, không publish event "failed"
            // Vì PaymentIntent vẫn REQUIRES_PAYMENT, user có thể retry lại
            if (isRetryPayment) {
              console.error(`❌ Retry payment failed for order ${orderId}: ${'error' in result ? result.error : 'Unknown error'}`);
              console.log(`User can retry again. PaymentIntent still active.`);
              // Không publish event để tránh Order Service xóa session
            } else {
              // Nếu là lần tạo đầu tiên và failed, publish event "failed"
              const paymentIntentId = result.paymentIntentId || "N/A";
              await publishEvent(
                orderId,
                userId,
                "system@vnpay.com",
                totalPrice,
                orderDescription,
                "failed",
                paymentIntentId,
                ""
              );
            }
          }

          kafkaConsumerMessageCounter.inc({ topic, status: 'success' });
          end();
        } catch (error) {
          console.error(`Error processing ${topic} event:`, error);
          kafkaConsumerErrorCounter.inc({ topic, error_type: (error as Error).name || 'unknown' });
          kafkaConsumerMessageCounter.inc({ topic, status: 'error' });
          end();
        }
      },
    });
  } catch (error) {
    console.error("Error in Kafka consumer:", error);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  await producer.disconnect();
  await consumer.disconnect();
  console.log("Kafka producer and consumer disconnected");
  process.exit();
});

