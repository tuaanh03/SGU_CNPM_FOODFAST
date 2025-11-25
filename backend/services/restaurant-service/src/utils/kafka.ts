import { Kafka, Partitioners } from 'kafkajs';
import prisma from '../lib/prisma';
import { transitionToPreparing } from '../controllers/store';
import {
  kafkaConsumerMessageCounter,
  kafkaConsumerProcessingDuration,
  kafkaConsumerErrorCounter,
} from '../lib/kafkaMetrics';

// Kafka Configuration - Hỗ trợ cả local và Confluent Cloud
const kafkaBrokers = process.env.KAFKA_BROKERS?.split(',') || ['kafka:9092'];
const kafkaUsername = process.env.KAFKA_USERNAME;
const kafkaPassword = process.env.KAFKA_PASSWORD;
const useSASL = process.env.KAFKA_SECURITY_PROTOCOL === 'SASL_SSL';

console.log('🔧 Kafka Config (Restaurant Service):');
console.log('  - Brokers:', kafkaBrokers);
console.log('  - SASL:', useSASL ? 'Enabled (Confluent Cloud)' : 'Disabled (Local)');

const kafka = new Kafka({
  clientId: 'restaurant-service',
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

const consumer = kafka.consumer({ groupId: 'restaurant-service-group' });
const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner,
});
let isProducerConnected = false;

export async function runConsumer() {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'order.confirmed', fromBeginning: true });
    await consumer.subscribe({ topic: 'delivery.completed', fromBeginning: false });
    console.log('Restaurant service Kafka consumer subscribed to order.confirmed and delivery.completed');

    await consumer.run({
      eachMessage: async (payload: { topic: string; partition: number; message: { value?: Buffer | string | null } }) => {
        const { message, topic } = payload;
        const end = kafkaConsumerProcessingDuration.startTimer({ topic });

        try {
          const event = JSON.parse((message.value?.toString && message.value.toString()) || '{}');
          console.log('Restaurant service received message on', topic, event.eventType || 'no-eventType');

          if (event.eventType === 'ORDER_CONFIRMED') {
            await handleOrderConfirmed(event);
          } else if (event.eventType === 'DELIVERY_COMPLETED_CUSTOMER_VERIFIED') {
            await handleDeliveryCompleted(event);
          }

          kafkaConsumerMessageCounter.inc({ topic, status: 'success' });
          end();
        } catch (err) {
          console.error('Error processing kafka message in restaurant-service:', err);
          kafkaConsumerErrorCounter.inc({ topic, error_type: (err as Error).name || 'unknown' });
          kafkaConsumerMessageCounter.inc({ topic, status: 'error' });
          end();
        }
      }
    });
  } catch (err) {
    console.error('Error starting restaurant-service kafka consumer:', err);
  }
}

async function handleOrderConfirmed(payload: any) {
  const {
    orderId,
    storeId,
    userId,
    items,
    totalPrice,
    deliveryAddress,
    contactPhone,
    note,
    confirmedAt,
    estimatedPrepTime
  } = payload;

  if (!orderId) {
    console.warn('ORDER_CONFIRMED missing orderId, skipping');
    return;
  }

  if (!storeId) {
    console.warn(`ORDER_CONFIRMED missing storeId for order ${orderId}`);
    return;
  }

  // Validate store exists
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) {
    console.warn(`Restaurant (storeId=${storeId}) not found for order ${orderId}`);
    return;
  }

  // Prepare snapshot objects
  const itemsJson = items || [];
  const customerInfo = {
    userId: userId || null,
    deliveryAddress: deliveryAddress || null,
    contactPhone: contactPhone || null,
    note: note || null,
    estimatedPrepTime: estimatedPrepTime || null,
    customerLatitude: payload.customerLatitude || null,
    customerLongitude: payload.customerLongitude || null
  };

  try {
    // Use upsert to ensure idempotency
    const restaurantOrder = await prisma.restaurantOrder.upsert({
      where: { orderId },
      update: {
        storeId,
        items: itemsJson,
        totalPrice: totalPrice || 0,
        customerInfo,
        restaurantStatus: 'CONFIRMED',
        receivedAt: new Date(confirmedAt || Date.now()),
        confirmedAt: new Date(confirmedAt || Date.now()),
      },
      create: {
        orderId,
        storeId,
        items: itemsJson,
        totalPrice: totalPrice || 0,
        customerInfo,
        restaurantStatus: 'CONFIRMED',
        receivedAt: new Date(confirmedAt || Date.now()),
        confirmedAt: new Date(confirmedAt || Date.now()),
      }
    });

    console.log(`RestaurantOrder upserted for store ${storeId}, order ${orderId}`);

    // Schedule automatic transition to PREPARING after 30s
    setTimeout(async () => {
      try {
        await transitionToPreparing(restaurantOrder.id);
        console.log(` transitioning order ${orderId} to PREPARING:`);
      } catch (err) {
        console.error(`Error transitioning order ${orderId} to PREPARING:`, err);
      }
    }, 30000);
  } catch (err) {
    console.error(`Failed to upsert RestaurantOrder for order ${orderId}:`, err);
  }
}

// Handle delivery.completed event - Update RestaurantOrder status to COMPLETED
async function handleDeliveryCompleted(event: any) {
  const { orderId, deliveryId, eventType } = event;

  if (!orderId) {
    console.warn('⚠️ delivery.completed event missing orderId');
    return;
  }

  try {
    console.log(`📦 [handleDeliveryCompleted] Processing event for orderId: ${orderId}`);

    // Find restaurant order
    const restaurantOrder = await prisma.restaurantOrder.findUnique({
      where: { orderId }
    });

    if (!restaurantOrder) {
      console.warn(`⚠️ RestaurantOrder not found for orderId: ${orderId}`);
      return;
    }

    // Only update if event is customer verified
    if (eventType === 'DELIVERY_COMPLETED_CUSTOMER_VERIFIED') {
      // Update RestaurantOrder status to COMPLETED
      await prisma.restaurantOrder.update({
        where: { id: restaurantOrder.id },
        data: {
          restaurantStatus: 'COMPLETED'
        }
      });

      console.log(`✅ [handleDeliveryCompleted] RestaurantOrder ${restaurantOrder.id} status updated to COMPLETED`);

      // Publish status change event
      await publishRestaurantOrderStatusEvent({
        eventType: 'RESTAURANT_ORDER_STATUS_CHANGED',
        orderId: orderId,
        restaurantOrderId: restaurantOrder.id,
        storeId: restaurantOrder.storeId,
        restaurantStatus: 'COMPLETED',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error(`❌ Error handling delivery.completed for orderId ${orderId}:`, error);
  }
}

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

