import { Kafka, Partitioners } from "kafkajs";
import { processPayment } from "../utils/vnpay";

const kafka = new Kafka({
  clientId: "payment-service",
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

export async function publishEvent(
  orderId: string,
  userId: string,
  email: string,
  amount: number,
  item: string,
  paymentStatus: string,
  paymentIntentId: string,
  paymentUrl?: string // Thêm paymentUrl vào tham số
) {
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
    paymentUrl, // Thêm paymentUrl vào messageData
  };

  await producer.send({
    topic: "payment.event",
    messages: [
      { key: `message-${Date.now()}`, value: JSON.stringify(messageData) },
    ],
  });
}

const consumer = kafka.consumer({
  groupId: "payment-service-group",
});

export async function runConsumer() {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: "order.create", fromBeginning: true });
    console.log("Consumer is listening to order.create");

    // Process messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const orderData = JSON.parse(message.value?.toString() || "{}");
        const { orderId, userId, amount, item } = orderData;

        if (!orderId || !userId || !amount) {
          console.error("Invalid order data:", orderData);
          return;
        }

        console.log(`Processing payment for order ${orderId}`);

        // Tạo VNPay payment URL - không cần thông tin thẻ
        const result = await processPayment(
          orderId,
          userId,
          amount,
          item
        );

        console.log(`Payment URL created for order ${orderId}:`, result);

        if (result.success && result.paymentUrl) {
          const paymentIntentId = result.paymentIntentId!;

          // Publish event với payment URL để frontend có thể redirect
          await publishEvent(
            orderId,
            userId,
            "system@vnpay.com", // Email không cần thiết cho VNPay
            amount,
            item,
            "pending", // Status pending cho đến khi có callback từ VNPay
            paymentIntentId,
            result.paymentUrl // Thêm payment URL vào event
          );

          console.log(`Payment URL sent for order ${orderId}: ${result.paymentUrl}`);
        } else {
          const paymentIntentId = result.paymentIntentId || "N/A";
          await publishEvent(
            orderId,
            userId,
            "system@vnpay.com",
            amount,
            item,
            "failed",
            paymentIntentId,
            "" // No payment URL for failed cases
          );
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
  console.log("Kafka producer disconnected");
  process.exit();
});
