import promClient from 'prom-client';
import register from './metrics';

/**
 * Kafka Metrics cho Restaurant Service
 * Track consumer metrics
 */

// Kafka Consumer Metrics
export const kafkaConsumerMessageCounter = new promClient.Counter({
  name: 'restaurant_service_kafka_consumer_messages_total',
  help: 'Total number of messages consumed from Kafka by topic',
  labelNames: ['topic', 'status'], // status: success, error
  registers: [register],
});

export const kafkaConsumerProcessingDuration = new promClient.Histogram({
  name: 'restaurant_service_kafka_consumer_processing_duration_seconds',
  help: 'Kafka consumer message processing duration in seconds',
  labelNames: ['topic'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const kafkaConsumerErrorCounter = new promClient.Counter({
  name: 'restaurant_service_kafka_consumer_errors_total',
  help: 'Total number of Kafka consumer errors',
  labelNames: ['topic', 'error_type'],
  registers: [register],
});

