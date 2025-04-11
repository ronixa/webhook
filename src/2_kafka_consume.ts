// This file is ran by the provider, I guess it is an overkilled setup, but if you have a lot of customer, it might makes sens to have this kind of setup ?

import { PubSub } from "./libs/kafka.ts";

type WebhookJob = {
  url: string;
  payload: unknown;
  attempt: number;
  target: string; // Customer id - can be an api key or any other secret shared with customer to identify which Public RSA Certificate to use
  id: number;
};

const pubSub = new PubSub("webhook");
await pubSub.setupConsumer(["events"]);
await pubSub.consume(
  (message: string, { heartbeat }: { heartbeat: () => Promise<void> }) =>
    process(message, { heartbeat }),
);

async function process(
  message: string,
  { heartbeat }: { heartbeat: () => Promise<void> },
) {
  const job: WebhookJob = JSON.parse(message);
  const maxRetries = 5;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(job.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job.payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log(
        `✅ Success on attempt ${attempt}`,
        `id: ${job.id}, target: ${job.target}`,
      );
      break;
    } catch (err) {
      if (attempt < maxRetries) {
        await heartbeat();
        const backoff = Math.pow(2, attempt) * 1000;
        console.warn(
          `⚠️ Attempt ${attempt}, retry in ${backoff}ms failed:`,
          err.message,
          `id: ${job.id}, target: ${job.target}`,
        );
        await delay(backoff);
      } else {
        console.error(
          "🚨 Max retries reached, dropping job:",
          job,
          "You should move the message in a DLQ.",
        );
      }
    }
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
