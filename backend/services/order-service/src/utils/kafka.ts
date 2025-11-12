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
    messages: [
      {
        key: `order-expired-${payload.orderId}`,
        value: JSON.stringify(payload),
      },
    ],
  });
}

export async function publishRetryPaymentEvent(payload: any) {
  if (!isProducerConnected) {
    await producer.connect();
    isProducerConnected = true;
  }
  await producer.send({
    topic: "order.retry.payment",
    messages: [
      {
        key: `order-retry-${payload.orderId}`,
        value: JSON.stringify(payload),
      },
    ],
  });
}

export async function publishOrderConfirmedEvent(payload: any) {
  if (!isProducerConnected) {
    await producer.connect();
    isProducerConnected = true;
  }
  await producer.send({
    topic: "order.confirmed",
    messages: [
      {
        key: `order-confirmed-${payload.orderId}`,
        value: JSON.stringify(payload),
      },
    ],
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

export async function handlePaymentEvent(data: any) {
  if (
    data.paymentStatus === "success" ||
    data.paymentStatus === "failed" ||
    data.paymentStatus === "pending" ||
    data.paymentStatus === "cancelled"
  ) {
    try {
      let orderStatus: "pending" | "success" | "cancelled";

      if (data.paymentStatus === "success") {
        orderStatus = "success";
      } else if (data.paymentStatus === "cancelled") {
        orderStatus = "cancelled";
        console.log(`⚠️ Order ${data.orderId} cancelled - payment cancelled by user`);
      } else if (data.paymentStatus === "failed") {
        orderStatus = "cancelled";
        console.log(`❌ Order ${data.orderId} cancelled - payment failed`);
      } else {
        orderStatus = "pending";
      }

      await prisma.order.update({
        where: { id: data.orderId },
        data: { status: orderStatus },
      });

      console.log(`Order ${data.orderId} status updated to: ${orderStatus}`);

      if (orderStatus === "success" || orderStatus === "cancelled") {
        await deleteOrderSession(data.orderId);
        console.log(`✅ Deleted Redis session for order ${data.orderId} after status: ${orderStatus}`);
      }

      if (data.paymentStatus === "success") {
        try {
          const order = await prisma.order.findUnique({ where: { id: data.orderId }, include: { items: true } });
          if (order) {
            const items = order.items.map((it: any) => ({
              productId: it.productId,
              productName: it.productName,
              quantity: it.quantity,
              price: it.productPrice,
            }));

            const totalQuantity = order.items.reduce((s: number, it: any) => s + (it.quantity || 0), 0);
            const estimatedPrepTime = Math.max(10, Math.min(60, totalQuantity * 5));

            const confirmedPayload = {
              eventType: "ORDER_CONFIRMED",
              orderId: order.id,
              storeId: order.storeId || null,
              userId: order.userId,
              items,
              totalPrice: order.totalPrice,
              deliveryAddress: order.deliveryAddress,
              contactPhone: order.contactPhone,
              note: order.note,
              confirmedAt: new Date().toISOString(),
              estimatedPrepTime,
            };

            await publishOrderConfirmedEvent(confirmedPayload);
            console.log(`📤 Published ORDER_CONFIRMED for order ${order.id}`);
          } else {
            console.warn(`Order not found when trying to publish ORDER_CONFIRMED: ${data.orderId}`);
          }
        } catch (err) {
          console.error("Error publishing ORDER_CONFIRMED:", err);
        }
      }

      if (data.paymentUrl && data.paymentStatus === "pending") {
        console.log(`Payment URL for order ${data.orderId}: ${data.paymentUrl}`);
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
      await prisma.order.update({ where: { id: orderId }, data: { status: "pending" } });
      console.log(`Order ${orderId} inventory reserved successfully, ready for payment`);
    } else if (status === "REJECTED") {
      await prisma.order.update({ where: { id: orderId }, data: { status: "cancelled" } });
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
      const { id, storeId, name, description, price, imageUrl, categoryId, isAvailable, soldOutUntil } = data;
      const menuId = storeId || 'default-menu';

      await prisma.menuItemRead.upsert({
        where: { menuId_productId: { menuId, productId: id } },
        update: { name, description, price: parseFloat(price), imageUrl, categoryId, isAvailable, soldOutUntil: soldOutUntil ? new Date(soldOutUntil) : null, lastSyncedAt: new Date() },
        create: { id: `menu-item-${id}`, storeId: storeId || 'unknown', menuId, productId: id, name, description, price: parseFloat(price), imageUrl, categoryId, isAvailable, soldOutUntil: soldOutUntil ? new Date(soldOutUntil) : null, displayOrder: 0, version: 1, lastSyncedAt: new Date() }
      });

      console.log(`Product ${id} synchronized to MenuItemRead successfully (${eventType})`);

      if (storeId) {
        const menuItemsCount = await prisma.menuItemRead.count({ where: { storeId } });
        await prisma.restaurantSyncStatus.upsert({ where: { storeId }, update: { menuId, lastSyncedAt: new Date(), totalMenuItems: menuItemsCount, isHealthy: true }, create: { storeId, menuId, lastSyncedAt: new Date(), lastSyncVersion: 1, totalMenuItems: menuItemsCount, isHealthy: true } });
      }

    } else if (eventType === 'DELETED') {
      const { id, storeId } = data;
      await prisma.menuItemRead.deleteMany({ where: { productId: id } });
      console.log(`Product ${id} deleted from MenuItemRead`);

      if (storeId) {
        const remainingItems = await prisma.menuItemRead.count({ where: { storeId } });
        await prisma.restaurantSyncStatus.update({ where: { storeId }, data: { totalMenuItems: remainingItems, lastSyncedAt: new Date() } });
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
