import { Kafka, Partitioners } from "kafkajs";
import prisma from "../lib/prisma";
import { deleteOrderSession } from "./redisSessionManager";

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

export async function publishOrderExpirationEvent(payload: any) {
  if (!isProducerConnected) {
    await producer.connect();
    isProducerConnected = true;
  }
  await producer.send({
    topic: "order.expired",
    messages: [{
      key: `order-expired-${payload.orderId}`,
      value: JSON.stringify(payload)
    }],
  });
}

const consumer = kafka.consumer({
  groupId: "order-service-group",
});

export async function runConsumer() {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: "payment.event", fromBeginning: true });
    await consumer.subscribe({ topic: "inventory.reserve.result", fromBeginning: true });
    await consumer.subscribe({ topic: "product.sync", fromBeginning: true });

    console.log("Consumer is listening to payment.event, inventory.reserve.result, and product.sync");

    // Process messages
    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        const event = message.value?.toString() as string;
        const data = JSON.parse(event);

        console.log(`Received event from topic ${topic}:`, data);

        try {
          if (topic === "payment.event") {
            await handlePaymentEvent(data);
          } else if (topic === "inventory.reserve.result") {
            await handleInventoryReserveResult(data);
          } else if (topic === "product.sync") {
            await handleProductSync(data);
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

async function handlePaymentEvent(data: any) {
  if (
    data.paymentStatus === "success" ||
    data.paymentStatus === "failed" ||
    data.paymentStatus === "pending"
  ) {
    try {
      // Map payment status to OrderStatus enum (lowercase)
      let orderStatus: "pending" | "success" | "cancelled";
      if (data.paymentStatus === "success") {
        orderStatus = "success";
      } else if (data.paymentStatus === "failed") {
        orderStatus = "cancelled";
      } else {
        orderStatus = "pending";
      }

      await prisma.order.update({
        where: {
          id: data.orderId, // Sử dụng id thay vì orderId
        },
        data: {
          status: orderStatus,
        },
      });

      console.log(
        `Order ${data.orderId} status updated to: ${orderStatus}`
      );

      // Xóa session trong Redis khi thanh toán thành công hoặc thất bại
      if (data.paymentStatus === "success" || data.paymentStatus === "failed") {
        await deleteOrderSession(data.orderId);
        console.log(`✅ Deleted Redis session for order ${data.orderId} after payment ${data.paymentStatus}`);
      }

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
}

async function handleInventoryReserveResult(data: any) {
  const { orderId, status, message } = data;

  try {
    if (status === "RESERVED") {
      // Cập nhật order status thành "pending" - đợi thanh toán
      await prisma.order.update({
        where: { id: orderId }, // Sử dụng id thay vì orderId
        data: {
          status: "pending"
        },
      });
      console.log(`Order ${orderId} inventory reserved successfully, ready for payment`);

    } else if (status === "REJECTED") {
      // Cập nhật order status thành "cancelled" - không đủ hàng
      await prisma.order.update({
        where: { id: orderId }, // Sử dụng id thay vì orderId
        data: {
          status: "cancelled"
        },
      });

      // Xóa session trong Redis khi order bị hủy
      await deleteOrderSession(orderId);

      console.log(`Order ${orderId} cancelled due to inventory shortage: ${message}`);
    }
  } catch (error) {
    console.error("Error handling inventory reserve result:", error);
  }
}

async function handleProductSync(event: any) {
  const { eventType, data } = event;

  try {
    console.log(`Processing product sync event: ${eventType}`, data);

    if (eventType === 'CREATED' || eventType === 'UPDATED') {
      // Đồng bộ product vào bảng MenuItemRead
      const {
        id,
        storeId,
        name,
        description,
        price,
        imageUrl,
        categoryId,
        isAvailable,
        soldOutUntil,
      } = data;

      // Vì Product không có menuId, ta sẽ dùng storeId làm menuId tạm
      const menuId = storeId || 'default-menu';

      await prisma.menuItemRead.upsert({
        where: {
          menuId_productId: {
            menuId,
            productId: id
          }
        },
        update: {
          name,
          description,
          price: parseFloat(price),
          imageUrl,
          categoryId,
          isAvailable,
          soldOutUntil: soldOutUntil ? new Date(soldOutUntil) : null,
          lastSyncedAt: new Date()
        },
        create: {
          id: `menu-item-${id}`,
          storeId: storeId || 'unknown',
          menuId,
          productId: id,
          name,
          description,
          price: parseFloat(price),
          imageUrl,
          categoryId,
          isAvailable,
          soldOutUntil: soldOutUntil ? new Date(soldOutUntil) : null,
          displayOrder: 0,
          version: 1,
          lastSyncedAt: new Date()
        }
      });

      console.log(`Product ${id} synchronized to MenuItemRead successfully (${eventType})`);

      // Cập nhật RestaurantSyncStatus
      if (storeId) {
        const menuItemsCount = await prisma.menuItemRead.count({
          where: { storeId }
        });

        await prisma.restaurantSyncStatus.upsert({
          where: { storeId },
          update: {
            menuId,
            lastSyncedAt: new Date(),
            totalMenuItems: menuItemsCount,
            isHealthy: true
          },
          create: {
            storeId,
            menuId,
            lastSyncedAt: new Date(),
            lastSyncVersion: 1,
            totalMenuItems: menuItemsCount,
            isHealthy: true
          }
        });
      }

    } else if (eventType === 'DELETED') {
      // Xóa product khỏi bảng MenuItemRead
      const { id, storeId } = data;

      await prisma.menuItemRead.deleteMany({
        where: {
          productId: id
        }
      });

      console.log(`Product ${id} deleted from MenuItemRead`);

      // Cập nhật count trong RestaurantSyncStatus
      if (storeId) {
        const remainingItems = await prisma.menuItemRead.count({
          where: { storeId }
        });

        await prisma.restaurantSyncStatus.update({
          where: { storeId },
          data: {
            totalMenuItems: remainingItems,
            lastSyncedAt: new Date()
          }
        });
      }
    }

  } catch (error) {
    console.error("Error handling product sync:", error);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  await producer.disconnect();
  await consumer.disconnect();
  console.log("Kafka producer disconnected");
  process.exit();
});
