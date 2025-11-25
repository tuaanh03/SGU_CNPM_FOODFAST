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
    console.log('🔌 [Socket-Service] Connecting Kafka consumer...');
    await consumer.connect();
    console.log('✅ [Socket-Service] Kafka consumer connected');

    // Subscribe to các topics cần thiết
    console.log('📋 [Socket-Service] Subscribing to topic: order.confirmed');
    await consumer.subscribe({ topic: "order.confirmed", fromBeginning: true });
    console.log('✅ [Socket-Service] Subscribed to: order.confirmed');

    console.log('📋 [Socket-Service] Subscribing to topic: restaurant.order.status');
    await consumer.subscribe({ topic: "restaurant.order.status", fromBeginning: true });
    console.log('✅ [Socket-Service] Subscribed to: restaurant.order.status');

    await consumer.subscribe({ topic: "drones.nearby", fromBeginning: false });
    await consumer.subscribe({ topic: "drone.assigned", fromBeginning: false });
    await consumer.subscribe({ topic: "pickup.verified", fromBeginning: false });
    await consumer.subscribe({ topic: "otp.generated", fromBeginning: false });
    await consumer.subscribe({ topic: "drone.location.update", fromBeginning: false });
    await consumer.subscribe({ topic: "drone.arrived", fromBeginning: false });
    await consumer.subscribe({ topic: "delivery.completed", fromBeginning: false });
    await consumer.subscribe({ topic: "customer.otp.generated", fromBeginning: false });
    await consumer.subscribe({ topic: "drone.arrived.at.customer", fromBeginning: false });

    console.log("✅ Socket service Kafka consumer subscribed to: order.confirmed, restaurant.order.status, drones.nearby, drone.assigned, pickup.verified, otp.generated, drone.location.update, drone.arrived, delivery.completed, customer.otp.generated, drone.arrived.at.customer");

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
          } else if (topic === "drones.nearby") {
            await handleDronesNearby(data);
          } else if (topic === "drone.assigned") {
            await handleDroneAssigned(data);
          } else if (topic === "pickup.verified") {
            await handlePickupVerified(data);
          } else if (topic === "otp.generated") {
            await handleOtpGenerated(data);
          } else if (topic === "drone.location.update") {
            await handleDroneLocationUpdate(data);
          } else if (topic === "drone.arrived") {
            await handleDroneArrived(data);
          } else if (topic === "delivery.completed") {
            await handleDeliveryCompleted(data);
          } else if (topic === "customer.otp.generated") {
            await handleCustomerOtpGenerated(data);
          } else if (topic === "drone.arrived.at.customer") {
            await handleDroneArrivedAtCustomer(data);
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

    // Emit to restaurant room for merchant visibility (SAME FORMAT as RESTAURANT_ORDER_STATUS_CHANGED)
    if (storeId) {
      const merchantPayload = {
        orderId,
        storeId,
        restaurantStatus: "READY_FOR_PICKUP",
        timestamp: data.readyAt || new Date().toISOString(),
      };
      io.to(`restaurant:${storeId}`).emit("order:status:update", merchantPayload);
      socketEmitCounter.inc({ event_name: "order:status:update" });
      console.log(`✅ Emitted order:status:update to restaurant:${storeId} - Status: READY_FOR_PICKUP`);
    }

    // Emit to customer room (order:orderId)
    if (orderId) {
      const customerPayload = {
        orderId,
        storeId,
        restaurantStatus: "READY_FOR_PICKUP",
        timestamp: data.readyAt || new Date().toISOString(),
      };
      io.to(`order:${orderId}`).emit("order:status:update", customerPayload);
      socketEmitCounter.inc({ event_name: "order:status:update" });
      console.log(`✅ Emitted order:status:update to order:${orderId} - Status: READY_FOR_PICKUP`);
    }
  }
}

export const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner,
});
let isProducerConnected = false;

// Publish restaurant order status change event
// Handle drones.nearby event - emit to admin dashboard
async function handleDronesNearby(data: any) {
  if (!io) {
    console.warn("⚠️ Socket.IO not initialized yet");
    return;
  }

  const { orderId, storeId, pickupLocation, deliveryDestination, drones, timestamp } = data;

  if (!orderId) {
    console.warn("⚠️ drones.nearby event missing orderId");
    return;
  }

  const payload = {
    orderId,
    storeId,
    pickupLocation,
    deliveryDestination,
    drones,
    timestamp
  };

  // Emit to admin-dashboard room
  io.to("admin-dashboard").emit("drones:nearby", payload);
  socketEmitCounter.inc({ event_name: "drones:nearby" });

  console.log(`✅ Emitted drones:nearby to admin-dashboard - order ${orderId}, ${drones.length} drones`);

  // Also emit to specific order room
  io.to(`order:${orderId}`).emit("drones:nearby", payload);
  socketEmitCounter.inc({ event_name: "drones:nearby" });
}

// Handle drone.assigned event - emit to restaurant merchant and customer
async function handleDroneAssigned(data: any) {
  if (!io) {
    console.warn("⚠️ Socket.IO not initialized yet");
    return;
  }

  const { orderId, deliveryId, drone, delivery, assignedAt, timestamp } = data;

  if (!orderId) {
    console.warn("⚠️ drone.assigned event missing orderId");
    return;
  }

  const payload = {
    eventType: 'DRONE_ASSIGNED',
    orderId,
    deliveryId,
    drone,
    delivery,
    assignedAt,
    timestamp
  };

  // Emit to customer tracking this order
  io.to(`order:${orderId}`).emit("drone:assigned", payload);
  socketEmitCounter.inc({ event_name: "drone:assigned" });
  console.log(`✅ Emitted drone:assigned to order:${orderId} (customer)`);

  // Emit to restaurant merchant (if we have storeId from delivery)
  // Note: We need to extract storeId from the original order
  // For now, emit to all restaurants or use a specific room
  io.to("restaurant-merchants").emit("drone:assigned", payload);
  socketEmitCounter.inc({ event_name: "drone:assigned" });
  console.log(`✅ Emitted drone:assigned to restaurant-merchants`);

  // Also emit to admin-dashboard
  io.to("admin-dashboard").emit("drone:assigned", payload);
  socketEmitCounter.inc({ event_name: "drone:assigned" });
  console.log(`✅ Emitted drone:assigned to admin-dashboard`);
}

// Handle pickup.verified event - emit when restaurant verifies OTP
async function handlePickupVerified(data: any) {
  if (!io) {
    console.warn("⚠️ Socket.IO not initialized yet");
    return;
  }

  const { orderId, deliveryId, status, drone, verifiedAt, timestamp } = data;

  if (!orderId) {
    console.warn("⚠️ pickup.verified event missing orderId");
    return;
  }

  const payload = {
    eventType: 'PICKUP_VERIFIED',
    orderId,
    deliveryId,
    status,
    drone,
    verifiedAt,
    timestamp
  };

  // Emit to customer tracking this order
  io.to(`order:${orderId}`).emit("pickup:verified", payload);
  socketEmitCounter.inc({ event_name: "pickup:verified" });
  console.log(`✅ Emitted pickup:verified to order:${orderId} (customer)`);

  // Emit to restaurant merchant
  io.to("restaurant-merchants").emit("pickup:verified", payload);
  socketEmitCounter.inc({ event_name: "pickup:verified" });
  console.log(`✅ Emitted pickup:verified to restaurant-merchants`);

  // Emit to admin-dashboard for tracking
  io.to("admin-dashboard").emit("pickup:verified", payload);
  socketEmitCounter.inc({ event_name: "pickup:verified" });
  console.log(`✅ Emitted pickup:verified to admin-dashboard`);
}

// Handle otp.generated event - emit OTP to restaurant merchant
async function handleOtpGenerated(data: any) {
  if (!io) {
    console.warn("⚠️ Socket.IO not initialized yet");
    return;
  }

  const { deliveryId, orderId, storeId, otp, expiresIn, restaurantName, timestamp } = data;

  if (!orderId) {
    console.warn("⚠️ otp.generated event missing orderId");
    return;
  }

  const payload = {
    eventType: 'OTP_GENERATED',
    deliveryId,
    orderId,
    otp,
    expiresIn,
    restaurantName,
    timestamp
  };

  // Emit to specific order room (customer tracking this order)
  io.to(`order:${orderId}`).emit("otp:generated", payload);
  socketEmitCounter.inc({ event_name: "otp:generated" });
  console.log(`✅ Emitted otp:generated to order:${orderId} - OTP: ${otp}`);

  // Emit to specific restaurant room (merchant tracking this store)
  if (storeId) {
    io.to(`restaurant:${storeId}`).emit("otp:generated", payload);
    socketEmitCounter.inc({ event_name: "otp:generated" });
    console.log(`✅ Emitted otp:generated to restaurant:${storeId} - OTP: ${otp}`);
  } else {
    console.warn("⚠️ otp.generated event missing storeId, merchant may not receive OTP");
  }
}

// Handle drone.location.update event - emit drone position real-time
async function handleDroneLocationUpdate(data: any) {
  if (!io) {
    console.warn("⚠️ Socket.IO not initialized yet");
    return;
  }

  const { droneId, deliveryId, orderId, lat, lng, timestamp } = data;

  if (!orderId) {
    console.warn("⚠️ drone.location.update event missing orderId");
    return;
  }

  const payload = {
    eventType: 'DRONE_LOCATION_UPDATE',
    droneId,
    deliveryId,
    orderId,
    lat,
    lng,
    timestamp
  };

  // Emit to specific order room (admin tracking this order)
  io.to(`order:${orderId}`).emit("drone:location", payload);
  socketEmitCounter.inc({ event_name: "drone:location" });

  // Emit to admin-dashboard room
  io.to("admin-dashboard").emit("drone:location", payload);
  socketEmitCounter.inc({ event_name: "drone:location" });
}

// Handle drone.arrived event - Auto generate OTP
async function handleDroneArrived(data: any) {
  if (!io) {
    console.warn("⚠️ Socket.IO not initialized yet");
    return;
  }

  const { deliveryId, droneId, orderId, storeId, timestamp } = data;

  if (!deliveryId) {
    console.warn("⚠️ drone.arrived event missing deliveryId");
    return;
  }

  console.log(`🎯 Drone ${droneId} arrived at restaurant for delivery ${deliveryId}, orderId: ${orderId}, storeId: ${storeId}`);

  // Note: OTP will be generated by Drone Service and published via otp.generated event
  // Socket Service only emits arrival notification

  // Emit notification to admin and merchant
  const payload = {
    eventType: 'DRONE_ARRIVED',
    deliveryId,
    droneId,
    orderId, // ✅ Thêm orderId để frontend match
    timestamp
  };

  // Emit to admin dashboard
  io.to("admin-dashboard").emit("drone:arrived", payload);
  socketEmitCounter.inc({ event_name: "drone:arrived" });
  console.log(`✅ Emitted drone:arrived to admin-dashboard`);

  // Emit to specific restaurant room
  if (storeId) {
    io.to(`restaurant:${storeId}`).emit("drone:arrived", payload);
    socketEmitCounter.inc({ event_name: "drone:arrived" });
    console.log(`✅ Emitted drone:arrived to restaurant:${storeId} with orderId: ${orderId}`);
  } else {
    console.warn("⚠️ drone.arrived event missing storeId, merchant may not receive notification");
  }
}

// Handle customer.otp.generated event - emit OTP to customer
async function handleCustomerOtpGenerated(data: any) {
  if (!io) {
    console.warn("⚠️ Socket.IO not initialized yet");
    return;
  }

  const { deliveryId, orderId, storeId, otp, expiresIn, timestamp } = data;

  if (!orderId) {
    console.warn("⚠️ customer.otp.generated event missing orderId");
    return;
  }

  console.log(`🔐 Customer OTP generated for order ${orderId}: ${otp}`);

  const payload = {
    eventType: 'CUSTOMER_OTP_GENERATED',
    deliveryId,
    orderId,
    storeId,
    otp,
    expiresIn,
    timestamp
  };

  // Emit to customer tracking this order
  io.to(`order:${orderId}`).emit("customer:otp:generated", payload);
  socketEmitCounter.inc({ event_name: "customer:otp:generated" });
  console.log(`✅ Emitted customer:otp:generated to order:${orderId} - OTP: ${otp}`);

  // Also emit to admin for monitoring
  io.to("admin-dashboard").emit("customer:otp:generated", payload);
  socketEmitCounter.inc({ event_name: "customer:otp:generated" });
  console.log(`✅ Emitted customer:otp:generated to admin-dashboard`);
}

// Handle drone.arrived.at.customer event
async function handleDroneArrivedAtCustomer(data: any) {
  if (!io) {
    console.warn("⚠️ Socket.IO not initialized yet");
    return;
  }

  const { deliveryId, droneId, orderId, storeId, timestamp } = data;

  if (!orderId) {
    console.warn("⚠️ drone.arrived.at.customer event missing orderId");
    return;
  }

  console.log(`🎯 Drone ${droneId} arrived at customer for order ${orderId}`);

  const payload = {
    eventType: 'DRONE_ARRIVED_AT_CUSTOMER',
    deliveryId,
    droneId,
    orderId,
    storeId,
    timestamp
  };

  // Emit to customer tracking this order
  io.to(`order:${orderId}`).emit("drone:arrived:customer", payload);
  socketEmitCounter.inc({ event_name: "drone:arrived:customer" });
  console.log(`✅ Emitted drone:arrived:customer to order:${orderId}`);

  // Emit to admin-dashboard
  io.to("admin-dashboard").emit("drone:arrived:customer", payload);
  socketEmitCounter.inc({ event_name: "drone:arrived:customer" });
  console.log(`✅ Emitted drone:arrived:customer to admin-dashboard`);

  // Emit to merchant for notification
  if (storeId) {
    io.to(`restaurant:${storeId}`).emit("drone:arrived:customer", payload);
    socketEmitCounter.inc({ event_name: "drone:arrived:customer" });
    console.log(`✅ Emitted drone:arrived:customer to restaurant:${storeId}`);
  }
}

// Handle delivery.completed event - emit when drone delivers to customer
async function handleDeliveryCompleted(data: any) {
  if (!io) {
    console.warn("⚠️ Socket.IO not initialized yet");
    return;
  }

  const { deliveryId, droneId, orderId, storeId, deliveredAt, timestamp } = data;

  if (!orderId) {
    console.warn("⚠️ delivery.completed event missing orderId");
    return;
  }

  console.log(`🎉 Delivery ${deliveryId} completed for order ${orderId}`);

  const payload = {
    eventType: 'DELIVERY_COMPLETED',
    deliveryId,
    droneId,
    orderId,
    storeId,
    deliveredAt,
    timestamp
  };

  // Emit to customer tracking this order
  io.to(`order:${orderId}`).emit("delivery:completed", payload);
  socketEmitCounter.inc({ event_name: "delivery:completed" });
  console.log(`✅ Emitted delivery:completed to order:${orderId} (customer)`);

  // Emit to restaurant merchant
  if (storeId) {
    io.to(`restaurant:${storeId}`).emit("delivery:completed", payload);
    socketEmitCounter.inc({ event_name: "delivery:completed" });
    console.log(`✅ Emitted delivery:completed to restaurant:${storeId}`);
  }

  // Emit to admin-dashboard
  io.to("admin-dashboard").emit("delivery:completed", payload);
  socketEmitCounter.inc({ event_name: "delivery:completed" });
  console.log(`✅ Emitted delivery:completed to admin-dashboard`);
}

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

//auto-deploy