// deno run -A __tests__/setup.ts
import { kafkaAdmin } from "./libs/kafka.ts";

await kafkaAdmin.admin().connect();

await kafkaAdmin.admin().deleteTopics({
  topics: ["events"],
});

await kafkaAdmin.admin().createTopics({
  topics: [{ topic: "events", numPartitions: 6 }],
});

await kafkaAdmin.admin().disconnect();
