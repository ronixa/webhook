import { randomBytes } from "node:crypto";
import { type Consumer, Kafka, Partitioners, type Producer } from "kafkajs";

export function generateId(): string {
  return randomBytes(33).toString("hex");
}

export const kafkaProducer: Kafka = new Kafka({
  clientId: `${generateId()}-producer`,
  brokers: ["127.0.0.1:9092"],
});

export const kafkaConsumer: Kafka = new Kafka({
  clientId: `${generateId()}-consumer`,
  brokers: ["127.0.0.1:9092"],
});

export const kafkaAdmin: Kafka = new Kafka({
  clientId: `${generateId()}-admin`,
  brokers: ["127.0.0.1:9092"],
});

export class PubSub {
  private producer: Producer;
  private consumer: Consumer;

  constructor(groupId: string) {
    this.producer = kafkaProducer.producer({
      allowAutoTopicCreation: true,
      createPartitioner: Partitioners.DefaultPartitioner,
    });
    this.consumer = kafkaConsumer.consumer({ groupId });

    this.producer.on("producer.connect", () => {
      console.log("Kafka Producer connected");
    });
    this.producer.on("producer.disconnect", () => {
      console.log("Kafka Producer disconnected");
    });

    this.consumer.on("consumer.connect", () => {
      console.log("Kafka Consumer connected");
    });
    this.consumer.on("consumer.disconnect", () => {
      console.log("Kafka Consumer disconnected");
    });
  }

  async close() {
    await this.producer.disconnect();
    await this.consumer.disconnect();
  }

  async setupProducer() {
    try {
      await this.producer.connect();
    } catch (e) {
      console.error("Producer error", e);
    }
    return this;
  }

  async setupConsumer(topics: string[]) {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({
        topics: topics,
        fromBeginning: true,
      });
    } catch (e) {
      console.log("Consumer Error: ", e);
    }
    return this;
  }

  async consume(
    fn: (
      message: string,
      { heartbeat }: { heartbeat: () => Promise<void> },
    ) => Promise<void>,
  ) {
    try {
      await this.consumer.run({
        partitionsConsumedConcurrently: 3,
        sessionTimeout: 90_000,
        autoCommit: false,
        eachMessage: async ({
          topic,
          partition,
          message,
          heartbeat,
          _pause,
        }) => {
          if (!message?.value?.toString()) {
            throw new Error("No payload received");
          }

          try {
            await fn(message?.value?.toString(), { heartbeat });
          } catch {
            console.error("Failure to process the message.");
          } finally {
            // mark the message as processed after tried to process it (so this way if the consumer/server crashes it is gonna be retried)
            // if: it was accepted by customer Server
            // if: the message exhausted all retries (or move it in a DLQ)
            await this.consumer.commitOffsets([
              {
                topic,
                partition,
                offset: (Number(message.offset) + 1).toString(),
              },
            ]);
          }
        },
      });
    } catch (e) {
      console.log("Consumer Run Error: ", (e as Error).message);
    }
  }

  async sendMessage(topic: string, messages: { key: string; value: string }[]) {
    await this.producer.send({
      topic,
      messages,
      timeout: 30000,
    });
  }
}
