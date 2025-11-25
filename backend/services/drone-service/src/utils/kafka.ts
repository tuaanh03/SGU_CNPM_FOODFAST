import { Kafka } from 'kafkajs';
import prisma from '../lib/prisma';

// Kafka Configuration - Hỗ trợ cả local và Confluent Cloud
const kafkaBrokers = process.env.KAFKA_BROKERS?.split(',') || ['kafka:9092'];
const kafkaUsername = process.env.KAFKA_USERNAME;
const kafkaPassword = process.env.KAFKA_PASSWORD;
const useSASL = process.env.KAFKA_SECURITY_PROTOCOL === 'SASL_SSL';

console.log('🔧 Kafka Config (Drone Service):');
console.log('  - Brokers:', kafkaBrokers);
console.log('  - SASL:', useSASL ? 'Enabled (Confluent Cloud)' : 'Disabled (Local)');

const kafka = new Kafka({
  clientId: 'drone-service',
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

const consumer = kafka.consumer({ groupId: 'drone-service-group' });
const producer = kafka.producer();
let isProducerConnected = false;

export async function runConsumer() {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'restaurant.order.status', fromBeginning: false });

    console.log('✅ Drone service Kafka consumer subscribed to: restaurant.order.status');

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const event = message.value?.toString();
          if (!event) return;

          const data = JSON.parse(event);
          console.log(`📥 Drone service received event from topic ${topic}:`, data.eventType);

          if (data.eventType === 'ORDER_READY_FOR_PICKUP') {
            await handleOrderReadyForPickup(data);
          }
        } catch (error) {
          console.error(`❌ Error processing ${topic} event:`, error);
        }
      },
    });
  } catch (error) {
    console.error('❌ Error starting drone-service consumer:', error);
  }
}

// Handle ORDER_READY_FOR_PICKUP event - create/update delivery
async function handleOrderReadyForPickup(data: any) {
  const { orderId, storeId, pickupLocation, deliveryDestination, customerInfo, items, totalPrice } = data;

  if (!orderId) {
    console.warn('ORDER_READY_FOR_PICKUP missing orderId, skipping');
    return;
  }

  try {
    // Extract coordinates from deliveryDestination
    const customerLat = deliveryDestination?.lat || 0;
    const customerLng = deliveryDestination?.lng || 0;
    const restaurantLat = pickupLocation?.lat || 0;
    const restaurantLng = pickupLocation?.lng || 0;

    // Calculate distance
    const distance = calculateDistance(
      restaurantLat,
      restaurantLng,
      customerLat,
      customerLng
    );

    const estimatedTime = Math.ceil(distance * 5); // 5 minutes per km

    // Upsert delivery record (idempotent by orderId)
    const delivery = await prisma.delivery.upsert({
      where: { orderId },
      update: {
        status: 'PENDING',
        storeId, // ✅ Add storeId
        restaurantName: pickupLocation?.restaurantName || '',
        restaurantLat,
        restaurantLng,
        restaurantAddress: pickupLocation?.address || '',
        customerLat,
        customerLng,
        customerAddress: deliveryDestination?.address || '',
        distance,
        estimatedTime,
      },
      create: {
        orderId,
        droneId: null, // Null - admin will assign later
        storeId, // ✅ Add storeId
        restaurantName: pickupLocation?.restaurantName || '',
        restaurantLat,
        restaurantLng,
        restaurantAddress: pickupLocation?.address || '',
        customerName: (customerInfo as any)?.userId || 'Customer',
        customerPhone: (customerInfo as any)?.contactPhone || '',
        customerLat,
        customerLng,
        customerAddress: deliveryDestination?.address || '',
        distance,
        estimatedTime,
        status: 'PENDING',
      },
    });

    console.log(`✅ Delivery created for order ${orderId}:`, delivery.id);

    // Find nearby available drones (within 10km radius)
    const nearbyDrones = await findNearbyDrones(restaurantLat, restaurantLng, 10);

    console.log(`📍 Found ${nearbyDrones.length} drones near restaurant for order ${orderId}`);

    // Publish drones.nearby event to Socket Service for real-time update
    await publishDronesNearbyEvent({
      orderId,
      storeId,
      pickupLocation,
      deliveryDestination,
      drones: nearbyDrones,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ Error creating delivery for order ${orderId}:`, error);
  }
}

// Find nearby available drones
async function findNearbyDrones(lat: number, lng: number, radiusKm: number) {
  const allDrones = await prisma.drone.findMany({
    where: {
      status: 'AVAILABLE',
      battery: { gte: 30 },
      currentLat: { not: null },
      currentLng: { not: null }
    }
  });

  // Calculate distance for each drone
  return allDrones
    .map((drone: any) => {
      const distance = calculateDistance(lat, lng, drone.currentLat!, drone.currentLng!);
      return {
        id: drone.id,
        name: drone.name,
        model: drone.model,
        battery: drone.battery,
        maxPayload: drone.maxPayload,
        currentLat: drone.currentLat,
        currentLng: drone.currentLng,
        distance: Math.round(distance * 100) / 100, // Round to 2 decimals
        status: drone.status
      };
    })
    .filter((drone: any) => drone.distance <= radiusKm)
    .sort((a: any, b: any) => a.distance - b.distance);
}

// Simple distance calculation (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Publish drones.nearby event to Socket Service
async function publishDronesNearbyEvent(payload: any) {
  const topic = 'drones.nearby';

  try {
    if (!isProducerConnected) {
      await producer.connect();
      isProducerConnected = true;
      console.log('✅ Kafka producer connected');
    }

    await producer.send({
      topic,
      messages: [
        {
          key: `drones-nearby-${payload.orderId}`,
          value: JSON.stringify(payload)
        }
      ]
    });

    console.log(`📤 Published drones.nearby event for order ${payload.orderId} with ${payload.drones.length} drones`);
  } catch (error) {
    console.error('❌ Error publishing drones.nearby event:', error);
  }
}

// Publish drone.assigned event to Socket Service
export async function publishDroneAssignedEvent(payload: any) {
  const topic = 'drone.assigned';

  try {
    if (!isProducerConnected) {
      await producer.connect();
      isProducerConnected = true;
      console.log('✅ Kafka producer connected');
    }

    await producer.send({
      topic,
      messages: [
        {
          key: `drone-assigned-${payload.orderId}`,
          value: JSON.stringify(payload)
        }
      ]
    });

    console.log(`📤 Published drone.assigned event for order ${payload.orderId}`);
  } catch (error) {
    console.error('❌ Error publishing drone.assigned event:', error);
  }
}

// Publish pickup.verified event to Socket Service
export async function publishPickupVerifiedEvent(payload: any) {
  const topic = 'pickup.verified';

  try {
    if (!isProducerConnected) {
      await producer.connect();
      isProducerConnected = true;
      console.log('✅ Kafka producer connected');
    }

    await producer.send({
      topic,
      messages: [
        {
          key: `pickup-verified-${payload.orderId}`,
          value: JSON.stringify(payload)
        }
      ]
    });

    console.log(`📤 Published pickup.verified event for order ${payload.orderId}`);
  } catch (error) {
    console.error('❌ Error publishing pickup.verified event:', error);
  }
}

// Publish drone location update (real-time tracking)
export async function publishDroneLocationUpdate(payload: any) {
  const topic = 'drone.location.update';

  try {
    if (!isProducerConnected) {
      await producer.connect();
      isProducerConnected = true;
      console.log('✅ Kafka producer connected');
    }

    await producer.send({
      topic,
      messages: [
        {
          key: `drone-location-${payload.droneId}`,
          value: JSON.stringify(payload)
        }
      ]
    });

    // Log every 10 updates to avoid spam
    if (Math.random() < 0.1) {
      console.log(`📍 Published drone location update for drone ${payload.droneId}`);
    }
  } catch (error) {
    console.error('❌ Error publishing drone location update:', error);
  }
}

// Publish drone arrived at restaurant event
export async function publishDroneArrivedEvent(payload: any) {
  const topic = 'drone.arrived';

  try {
    if (!isProducerConnected) {
      await producer.connect();
      isProducerConnected = true;
      console.log('✅ Kafka producer connected');
    }

    await producer.send({
      topic,
      messages: [
        {
          key: `drone-arrived-${payload.deliveryId}`,
          value: JSON.stringify(payload)
        }
      ]
    });

    console.log(`🎯 Published drone.arrived event for delivery ${payload.deliveryId}`);
  } catch (error) {
    console.error('❌ Error publishing drone arrived event:', error);
  }
}

// Publish otp.generated event to Socket Service
export async function publishOtpGeneratedEvent(payload: any) {
  const topic = 'otp.generated';

  try {
    if (!isProducerConnected) {
      await producer.connect();
      isProducerConnected = true;
      console.log('✅ Kafka producer connected');
    }

    await producer.send({
      topic,
      messages: [
        {
          key: `otp-generated-${payload.deliveryId}`,
          value: JSON.stringify(payload)
        }
      ]
    });

    console.log(`📤 Published otp.generated event for delivery ${payload.deliveryId}`);
  } catch (error) {
    console.error('❌ Error publishing otp.generated event:', error);
  }
}

// Publish customer.otp.generated event to Socket Service
export async function publishCustomerOtpGeneratedEvent(payload: any) {
  const topic = 'customer.otp.generated';

  try {
    if (!isProducerConnected) {
      await producer.connect();
      isProducerConnected = true;
      console.log('✅ Kafka producer connected');
    }

    await producer.send({
      topic,
      messages: [
        {
          key: `customer-otp-generated-${payload.deliveryId}`,
          value: JSON.stringify(payload)
        }
      ]
    });

    console.log(`📤 Published customer.otp.generated event for orderId ${payload.orderId}, OTP: ${payload.otp}`);
  } catch (error) {
    console.error('❌ Error publishing customer.otp.generated event:', error);
  }
}

// Publish drone.arrived.at.customer event to Socket Service
export async function publishDroneArrivedAtCustomerEvent(payload: any) {
  const topic = 'drone.arrived.at.customer';

  try {
    if (!isProducerConnected) {
      await producer.connect();
      isProducerConnected = true;
      console.log('✅ Kafka producer connected');
    }

    await producer.send({
      topic,
      messages: [
        {
          key: `drone-arrived-customer-${payload.deliveryId}`,
          value: JSON.stringify(payload)
        }
      ]
    });

    console.log(`📤 Published drone.arrived.at.customer event for orderId ${payload.orderId}`);
  } catch (error) {
    console.error('❌ Error publishing drone.arrived.at.customer event:', error);
  }
}

// Publish delivery.completed event to Socket Service
export async function publishDeliveryCompletedEvent(payload: any) {
  const topic = 'delivery.completed';

  try {
    if (!isProducerConnected) {
      await producer.connect();
      isProducerConnected = true;
      console.log('✅ Kafka producer connected');
    }

    await producer.send({
      topic,
      messages: [
        {
          key: `delivery-completed-${payload.deliveryId}`,
          value: JSON.stringify(payload)
        }
      ]
    });

    console.log(`📤 Published delivery.completed event for orderId ${payload.orderId}`);
  } catch (error) {
    console.error('❌ Error publishing delivery.completed event:', error);
  }
}

