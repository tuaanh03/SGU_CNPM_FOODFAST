import { Kafka, Partitioners } from "kafkajs";
import { Server as SocketIOServer } from "socket.io";
import { socketEmitCounter } from "../lib/metrics";

// Kafka Configuration - Hỗ trợ cả local và Confluent Cloud
const kafkaBrokers = process.env.KAFKA_BROKERS?.split(',') || ['kafka:9092'];
const kafkaUsername = process.env.KAFKA_USERNAME;
const kafkaPassword = process.env.KAFKA_PASSWORD;
const useSASL = process.env.KAFKA_SECURITY_PROTOCOL === 'SASL_SSL';

console.log('🔧 Kafka Config (Socket Service):');
console.log('  - Brokers:', kafkaBrokers);
console.log('  - SASL:', useSASL ? 'Enabled (Confluent Cloud)' : 'Disabled (Local)');

const kafka = new Kafka({
  clientId: "socket-service",
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

const consumer = kafka.consumer({
  groupId: "socket-service-group",
});

let io: SocketIOServer;

export function setSocketIO(socketIO: SocketIOServer) {
  io = socketIO;
}

export async function runConsumer() {
  try {
    await consumer.connect();

    // Subscribe to các topics cần thiết
    await consumer.subscribe({ topic: "order.confirmed", fromBeginning: true });
    await consumer.subscribe({ topic: "restaurant.order.status", fromBeginning: true });

    console.log("✅ Socket service Kafka consumer subscribed to: order.confirmed, restaurant.order.status");

    // Process messages
    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const event = message.value?.toString() as string;
          const data = JSON.parse(event);

          console.log(`📥 Socket service received event from topic ${topic}:`, data);

          if (topic === "order.confirmed") {
            await handleOrderConfirmed(data);
          } else if (topic === "restaurant.order.status") {
            await handleRestaurantOrderStatus(data);
          }
        } catch (error) {
          console.error(`❌ Error processing ${topic} event:`, error);
        }
      },
    });
  } catch (error) {
    console.error("❌ Error starting socket-service consumer:", error);
  }
}

// Handle ORDER_CONFIRMED event - emit to restaurant
async function handleOrderConfirmed(data: any) {
  if (!io) {
    console.warn("⚠️ Socket.IO not initialized yet");
    return;
  }

  const { eventType, orderId, storeId, items, totalPrice, deliveryAddress, contactPhone, note, confirmedAt, estimatedPrepTime } = data;

  if (eventType === "ORDER_CONFIRMED" && storeId) {
    // Emit to restaurant room
    const eventData = {
      orderId,
      storeId,
      items,
      totalPrice,
      deliveryAddress,
      contactPhone,
      note,
      confirmedAt,
      estimatedPrepTime,
      status: "CONFIRMED",
    };

    io.to(`restaurant:${storeId}`).emit("order:confirmed", eventData);
    socketEmitCounter.inc({ event_name: "order:confirmed" });

    console.log(`✅ Emitted order:confirmed to restaurant:${storeId} for order ${orderId}`);
  }
}

// Handle restaurant order status change - emit to order-service/customer
async function handleRestaurantOrderStatus(data: any) {
  if (!io) {
    console.warn("⚠️ Socket.IO not initialized yet");
    return;
  }

  const { eventType, orderId, storeId, restaurantStatus, timestamp } = data;

  if (eventType === "RESTAURANT_ORDER_STATUS_CHANGED") {
    const eventData = {
      orderId,
      storeId,
      restaurantStatus,
      timestamp,
    };

    // Emit to order room (customers tracking this order)
    io.to(`order:${orderId}`).emit("order:status:update", eventData);
    socketEmitCounter.inc({ event_name: "order:status:update" });
    console.log(`✅ Emitted order:status:update to order:${orderId} - Status: ${restaurantStatus}`);

    // Emit to restaurant room (merchant tracking orders)
    if (storeId) {
      io.to(`restaurant:${storeId}`).emit("order:status:update", eventData);
      socketEmitCounter.inc({ event_name: "order:status:update" });
      console.log(`✅ Emitted order:status:update to restaurant:${storeId} - Status: ${restaurantStatus}`);
    }
  }

  // Handle ORDER_READY_FOR_PICKUP event - emit to dispatch queue
  if (eventType === "ORDER_READY_FOR_PICKUP") {
    const dispatchPayload = {
      orderId,
      storeId,
      restaurantStatus: "READY_FOR_PICKUP",
      readyAt: data.readyAt,
      pickupLocation: data.pickupLocation,
      customerInfo: data.customerInfo,
      items: data.items,
      totalPrice: data.totalPrice,
      timestamp: data.readyAt || new Date().toISOString(),
    };

    // Emit to dispatch room (admin dispatchers)
    io.to("dispatch").emit("dispatch:delivery:created", dispatchPayload);
    socketEmitCounter.inc({ event_name: "dispatch:delivery:created" });
    console.log(`✅ Emitted dispatch:delivery:created to dispatch room - order ${orderId}`);

    // Also emit to restaurant room for merchant visibility
    if (storeId) {
      io.to(`restaurant:${storeId}`).emit("order:status:update", dispatchPayload);
      socketEmitCounter.inc({ event_name: "order:status:update" });
      console.log(`✅ Emitted order:status:update to restaurant:${storeId} - Ready for pickup`);
    }
  }
}

export const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner,
});
let isProducerConnected = false;

// Publish restaurant order status change event
export async function publishRestaurantOrderStatusEvent(payload: any) {
  const topic = "restaurant.order.status";

  try {
    if (!isProducerConnected) {
      await producer.connect();
      isProducerConnected = true;
    }
    await producer.send({
      topic,
      messages: [
        {
          key: `restaurant-order-${payload.orderId}`,
          value: JSON.stringify(payload),
        },
      ],
    });
    console.log(`📤 Published restaurant.order.status for order ${payload.orderId}`);
  } catch (error) {
    console.error("❌ Error publishing restaurant.order.status:", error);
    throw error;
  }
}

