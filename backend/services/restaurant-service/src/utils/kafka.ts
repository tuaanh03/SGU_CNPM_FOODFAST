import { Kafka } from 'kafkajs';
import prisma from '../lib/prisma';
import { transitionToPreparing } from '../controllers/store';
import {
  kafkaConsumerMessageCounter,
  kafkaConsumerProcessingDuration,
  kafkaConsumerErrorCounter,
} from '../lib/kafkaMetrics';

const kafka = new Kafka({
  clientId: 'restaurant-service',
  brokers: ['kafka:9092'],
});

const consumer = kafka.consumer({ groupId: 'restaurant-service-group' });

export async function runConsumer() {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'order.confirmed', fromBeginning: true });
    console.log('Restaurant service Kafka consumer subscribed to order.confirmed');

    await consumer.run({
      eachMessage: async (payload: { topic: string; partition: number; message: { value?: Buffer | string | null } }) => {
        const { message, topic } = payload;
        const end = kafkaConsumerProcessingDuration.startTimer({ topic });

        try {
          const event = JSON.parse((message.value?.toString && message.value.toString()) || '{}');
          console.log('Restaurant service received message on', topic, event.eventType || 'no-eventType');

          if (event.eventType === 'ORDER_CONFIRMED') {
            await handleOrderConfirmed(event);
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
    estimatedPrepTime: estimatedPrepTime || null
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
