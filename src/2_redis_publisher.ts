// deno run -A 2_redis_publisher.ts

import { publicEncrypt } from "node:crypto";
import { Buffer } from "node:buffer";
import { createClient } from "redis";

type WebhookJob = {
  url: string;
  payload: unknown;
  attempt: number;
  target: string; // Customer id - can be an api key or any other secret shared with customer to identify which Public RSA Certificate to use
};

const redis = createClient({
  url: "redis://localhost:6379",
});
redis.on("error", (err) => console.error("Redis Client Error", err));
await redis.connect();

const retryDelays = [1000, 2000, 4000, 8000, 16000]; // ms

// Enqueue a job
async function enqueue(job: WebhookJob) {
  await redis.rPush("webhookQueue", JSON.stringify(job));
}

// Background job processor
async function processQueue() {
  while (true) {
    const jobString = await redis.lPop("webhookQueue");
    if (!jobString) {
      await delay(100);
      continue;
    }

    const job = JSON.parse(jobString);
    try {
      const response = await fetch(job.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job.payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with ${response.status}`);
      }

      console.log("✅ Webhook sent successfully");
    } catch (err) {
      console.error(err);
      job.attempt += 1;
      if (job.attempt < retryDelays.length) {
        const delayMs = retryDelays[job.attempt];
        console.warn(`⏳ Retry ${job.attempt} in ${delayMs}ms: ${job.url}`);
        setTimeout(async () => {
          await enqueue(job);
        }, delayMs);
      } else {
        console.error(`💥 Gave up after ${job.attempt} attempts: ${job.url}`);
      }
    }

    await delay(10); // short cooldown
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Start the queue processor
processQueue();

// Start HTTP server using official Deno.serve
Deno.serve({ port: 4242, hostname: "0.0.0.0" }, async (req) => {
  const { pathname } = new URL(req.url);

  if (req.method === "POST" && pathname === "/publish") {
    try {
      const { url, payload } = await req.json();

      if (typeof url !== "string") {
        return new Response("Invalid: 'url' must be a string", { status: 400 });
      }

      // rsa_encrypt.ts
      const publicKeyBase64 = await Deno.readTextFile("public_key.pem");
      const publicKey = Buffer.from(publicKeyBase64, "base64").toString();
      const encryptedMessage = publicEncrypt(
        publicKey,
        JSON.stringify({
          payload: payload,
          timestamp: new Date().getTime(),
        }),
      );
      const encryptedPayload = Buffer.from(encryptedMessage).toString("base64");

      console.log("Encrypted Message (base64):", encryptedPayload);

      await enqueue({
        url,
        payload: encryptedPayload,
        attempt: 0,
        target: "customer-1",
      });
      return new Response("Accepted", { status: 202 });
    } catch (e) {
      console.error(e);
      return new Response("Invalid JSON", { status: 400 });
    }
  }

  return new Response("Not Found", { status: 404 });
});
