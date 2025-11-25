import { Kafka, Partitioners } from "kafkajs";
import prisma from "../lib/prisma";
import { deleteOrderSession } from "./redisSessionManager";
// Business metrics only - no Kafka/Redis metrics
import {
  ordersCreatedCounter,
  orderProcessingDurationByStatus,
  sessionOperationsCounter
} from "../lib/metrics";

// Kafka Configuration - Hỗ trợ cả local và Confluent Cloud
const kafkaBrokers = process.env.KAFKA_BROKERS?.split(',') || ['kafka:9092'];
const kafkaUsername = process.env.KAFKA_USERNAME;
const kafkaPassword = process.env.KAFKA_PASSWORD;
const useSASL = process.env.KAFKA_SECURITY_PROTOCOL === 'SASL_SSL';

console.log('🔧 Kafka Config (Order Service):');
console.log('  - Brokers:', kafkaBrokers);
console.log('  - SASL:', useSASL ? 'Enabled (Confluent Cloud)' : 'Disabled (Local)');

const kafka = new Kafka({
  clientId: "order-service",
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

export async function publishEvent(messages: string) {
  const topic = "order.create";

  try {
    if (!isProducerConnected) {
      console.log('📡 Connecting Kafka producer...');
      await producer.connect();
      isProducerConnected = true;
      console.log('✅ Kafka producer connected');
    }
    await producer.send({
      topic,
      messages: [{ key: `message-${Date.now()}`, value: messages }],
    });
    console.log(`✅ Published to ${topic}`);
  } catch (error) {
    console.error(`❌ Failed to publish to ${topic}:`, error);
    throw error;
  }
}

export async function publishOrderExpirationEvent(payload: any) {
  const topic = "order.expired";

  try {
    if (!isProducerConnected) {
      await producer.connect();
      isProducerConnected = true;
    }
    await producer.send({
      topic,
      messages: [
        {
          key: `order-expired-${payload.orderId}`,
          value: JSON.stringify(payload),
        },
      ],
    });
  } catch (error) {
    throw error;
  }
}

export async function publishRetryPaymentEvent(payload: any) {
  const topic = "order.retry.payment";

  try {
    if (!isProducerConnected) {
      await producer.connect();
      isProducerConnected = true;
    }
    await producer.send({
      topic,
      messages: [
        {
          key: `order-retry-${payload.orderId}`,
          value: JSON.stringify(payload),
        },
      ],
    });
  } catch (error) {
    throw error;
  }
}

export async function publishOrderConfirmedEvent(payload: any) {
  const topic = "order.confirmed";

  try {
    if (!isProducerConnected) {
      await producer.connect();
      isProducerConnected = true;
    }
    await producer.send({
      topic,
      messages: [
        {
          key: `order-confirmed-${payload.orderId}`,
          value: JSON.stringify(payload),
        },
      ],
    });
  } catch (error) {
    throw error;
  }
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
    await consumer.subscribe({ topic: "restaurant.order.status", fromBeginning: true });
    await consumer.subscribe({ topic: "delivery.completed", fromBeginning: false });

    console.log("Consumer is listening to payment.event, inventory.reserve.result, product.sync, restaurant.order.status, and delivery.completed");

    // Process messages
    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const event = message.value?.toString() as string;
          const data = JSON.parse(event);

          console.log(`Received event from topic ${topic}:`, data);

          if (topic === "payment.event") {
            await handlePaymentEvent(data);
          } else if (topic === "inventory.reserve.result") {
            await handleInventoryReserveResult(data);
          } else if (topic === "product.sync") {
            await handleProductSync(data);
          } else if (topic === "restaurant.order.status") {
            await handleRestaurantOrderStatus(data);
          } else if (topic === "delivery.completed") {
            await handleDeliveryCompleted(data);
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
    const processingTimer = orderProcessingDurationByStatus.startTimer({ status: data.paymentStatus });

    try {
      let orderStatus: "pending" | "confirmed" | "cancelled";
      let action: string;

      if (data.paymentStatus === "success") {
        // Payment thành công → chuyển sang CONFIRMED (chờ restaurant xử lý)
        orderStatus = "confirmed";
        action = "confirmed";
        console.log(`✅ Order ${data.orderId} payment success - status changed to CONFIRMED`);
      } else if (data.paymentStatus === "cancelled") {
        orderStatus = "cancelled";
        action = "cancelled";
        console.log(`⚠️ Order ${data.orderId} cancelled - payment cancelled by user`);
      } else if (data.paymentStatus === "failed") {
        orderStatus = "cancelled";
        action = "cancelled";
        console.log(`❌ Order ${data.orderId} cancelled - payment failed`);
      } else {
        orderStatus = "pending";
        action = "created";
      }

      await prisma.order.update({
        where: { id: data.orderId },
        data: { status: orderStatus },
      });

      // Track order status update
      ordersCreatedCounter.inc({ status: orderStatus, action });
      processingTimer();

      console.log(`Order ${data.orderId} status updated to: ${orderStatus}`);

      // Chỉ xóa session khi cancelled, KHÔNG xóa khi confirmed vì order vẫn đang xử lý
      if (orderStatus === "cancelled") {
        await deleteOrderSession(data.orderId);
        sessionOperationsCounter.inc({ operation: 'expire' });
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
              customerLatitude: order.customerLatitude,
              customerLongitude: order.customerLongitude,
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
      processingTimer();
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

// Handle restaurant order status changes
async function handleRestaurantOrderStatus(data: any) {
  const { eventType, orderId, restaurantStatus, timestamp } = data;

  try {
    if (eventType === "RESTAURANT_ORDER_STATUS_CHANGED") {
      console.log(`📥 Received restaurant status update for order ${orderId}: ${restaurantStatus}`);

      // Map restaurant status to order status
      let orderStatus: "confirmed" | "preparing" | "readyForPickup" | "delivering" | "completed" | "cancelled" | "pending";

      switch (restaurantStatus) {
        case "CONFIRMED":
          orderStatus = "confirmed";
          break;
        case "PREPARING":
          orderStatus = "preparing";
          break;
        case "READY":
          orderStatus = "readyForPickup";
          break;
        case "DELIVERING":
          orderStatus = "delivering";
          break;
        case "COMPLETED":
          orderStatus = "completed";
          // Xóa session khi hoàn thành
          await deleteOrderSession(orderId);
          sessionOperationsCounter.inc({ operation: 'expire' });
          console.log(`✅ Deleted Redis session for completed order ${orderId}`);
          break;
        case "CANCELLED":
          orderStatus = "cancelled";
          await deleteOrderSession(orderId);
          sessionOperationsCounter.inc({ operation: 'expire' });
          break;
        default:
          console.warn(`Unknown restaurant status: ${restaurantStatus}`);
          return;
      }

      // Update order status
      await prisma.order.update({
        where: { id: orderId },
        data: { status: orderStatus as any },
      });

      ordersCreatedCounter.inc({ status: orderStatus, action: 'restaurant_update' });
      console.log(`✅ Order ${orderId} status updated to: ${orderStatus}`);
    }
  } catch (error) {
    console.error("Error handling restaurant order status:", error);
  }
}

// Handle delivery.completed event - Update Order status to COMPLETED
async function handleDeliveryCompleted(data: any) {
  const { orderId, deliveryId, eventType } = data;

  if (!orderId) {
    console.warn('⚠️ delivery.completed event missing orderId');
    return;
  }

  try {
    console.log(`📦 [handleDeliveryCompleted] Processing event for orderId: ${orderId}`);

    // Find order
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      console.warn(`⚠️ Order ${orderId} not found in database`);
      return;
    }

    // Only update if event is customer verified
    if (eventType === 'DELIVERY_COMPLETED_CUSTOMER_VERIFIED') {
      // Update Order status to COMPLETED
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'completed' as any
        }
      });

      console.log(`✅ [handleDeliveryCompleted] Order ${orderId} status updated to COMPLETED`);
      ordersCreatedCounter.inc({ status: 'completed', action: 'delivery_completed' });
    }
  } catch (error) {
    console.error(`❌ Error handling delivery.completed for orderId ${orderId}:`, error);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  await producer.disconnect();
  await consumer.disconnect();
  console.log("Kafka producer disconnected");
  process.exit();
});
