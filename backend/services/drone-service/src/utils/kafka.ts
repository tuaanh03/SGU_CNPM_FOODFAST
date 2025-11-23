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
  const { orderId, storeId, pickupLocation, customerInfo, items, totalPrice } = data;

  if (!orderId) {
    console.warn('ORDER_READY_FOR_PICKUP missing orderId, skipping');
    return;
  }

  try {
    // Calculate distance (simplified - use actual calculation in production)
    const distance = calculateDistance(
      pickupLocation?.lat || 0,
      pickupLocation?.lng || 0,
      (customerInfo as any)?.deliveryAddress ? 0 : 0, // Need actual customer coordinates
      (customerInfo as any)?.deliveryAddress ? 0 : 0
    );

    const estimatedTime = Math.ceil(distance * 5); // 5 minutes per km

    // Upsert delivery record (idempotent by orderId)
    const delivery = await prisma.delivery.upsert({
      where: { orderId },
      update: {
        status: 'PENDING',
        restaurantName: pickupLocation?.restaurantName || '',
        restaurantLat: pickupLocation?.lat || 0,
        restaurantLng: pickupLocation?.lng || 0,
        restaurantAddress: pickupLocation?.address || '',
        distance,
        estimatedTime,
      },
      create: {
        orderId,
        droneId: null, // Null - admin will assign later
        restaurantName: pickupLocation?.restaurantName || '',
        restaurantLat: pickupLocation?.lat || 0,
        restaurantLng: pickupLocation?.lng || 0,
        restaurantAddress: pickupLocation?.address || '',
        customerName: (customerInfo as any)?.userId || 'Customer',
        customerPhone: (customerInfo as any)?.contactPhone || '',
        customerLat: 0, // Need actual customer coordinates
        customerLng: 0,
        customerAddress: (customerInfo as any)?.deliveryAddress || '',
        distance,
        estimatedTime,
        status: 'PENDING',
      },
    });

    console.log(`✅ Delivery upserted for order ${orderId}:`, delivery.id);
  } catch (error) {
    console.error(`❌ Error creating delivery for order ${orderId}:`, error);
  }
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

