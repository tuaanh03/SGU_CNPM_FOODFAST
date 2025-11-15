import promClient from 'prom-client';
import register from './metrics';

/**
 * Kafka Metrics cho Payment Service
 * Track producer và consumer metrics
 */

// Kafka Producer Metrics
export const kafkaProducerMessageCounter = new promClient.Counter({
  name: 'payment_service_kafka_producer_messages_total',
  help: 'Total number of messages sent to Kafka by topic',
  labelNames: ['topic', 'status'], // status: success, error
  registers: [register],
});

export const kafkaProducerLatency = new promClient.Histogram({
  name: 'payment_service_kafka_producer_latency_seconds',
  help: 'Kafka producer latency in seconds',
  labelNames: ['topic'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const kafkaProducerErrorCounter = new promClient.Counter({
  name: 'payment_service_kafka_producer_errors_total',
  help: 'Total number of Kafka producer errors',
  labelNames: ['topic', 'error_type'],
  registers: [register],
});

// Kafka Consumer Metrics
export const kafkaConsumerMessageCounter = new promClient.Counter({
  name: 'payment_service_kafka_consumer_messages_total',
  help: 'Total number of messages consumed from Kafka by topic',
  labelNames: ['topic', 'status'], // status: success, error
  registers: [register],
});

export const kafkaConsumerProcessingDuration = new promClient.Histogram({
  name: 'payment_service_kafka_consumer_processing_duration_seconds',
  help: 'Kafka consumer message processing duration in seconds',
  labelNames: ['topic'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const kafkaConsumerErrorCounter = new promClient.Counter({
  name: 'payment_service_kafka_consumer_errors_total',
  help: 'Total number of Kafka consumer errors',
  labelNames: ['topic', 'error_type'],
  registers: [register],
});

