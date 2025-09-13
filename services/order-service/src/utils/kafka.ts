import { Kafka, Partitioners } from "kafkajs";
import prisma from "../lib/prisma";

const kafka = new Kafka({
  clientId: "order-service",
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

export async function publishEvent(messages: string) {
  if (!isProducerConnected) {
    await producer.connect();
    isProducerConnected = true;
  }
  await producer.send({
    topic: "order.create",
    messages: [{ key: `message-${Date.now()}`, value: messages }],
  });
}

const consumer = kafka.consumer({
  groupId: "order-service-group",
});

export async function runConsumer() {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: "payment.event", fromBeginning: true });

    console.log("Consumer is listening to payment.event");

    // Process messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const event = message.value?.toString() as string;
        const data = JSON.parse(event);

        console.log("Received payment event:", data);

        // Cập nhật order status dựa trên payment event
        if (
          data.paymentStatus === "success" ||
          data.paymentStatus === "failed" ||
          data.paymentStatus === "pending"
        ) {
          try {
            const updateResult = await prisma.order.update({
              where: {
                orderId: data.orderId,
              },
              data: {
                status: data.paymentStatus,
              },
            });

            console.log(
              `Order ${data.orderId} status updated to: ${data.paymentStatus}`
            );

            // Nếu có paymentUrl, log để frontend có thể sử dụng
            if (data.paymentUrl && data.paymentStatus === "pending") {
              console.log(
                `Payment URL for order ${data.orderId}: ${data.paymentUrl}`
              );
              // TODO: Có thể gửi paymentUrl về frontend qua WebSocket hoặc cách khác
            }
          } catch (error) {
            console.error("Error updating order status:", error);
          }
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
