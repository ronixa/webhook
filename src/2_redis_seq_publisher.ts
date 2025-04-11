// deno run -A 2_redis_seq_publisher.ts

import { publicEncrypt } from "node:crypto";
import { Buffer } from "node:buffer";
import { createClient } from "redis";

type WebhookJob = {
  url: string;
  payload: unknown;
  attempt: number;
};

const redis = createClient({
  url: "redis://localhost:6379",
});
redis.on("error", (err) => console.error("Redis Client Error", err));
await redis.connect();

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

    const maxRetries = 5;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(job.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(job.payload),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        console.log(`✅ Success on attempt ${attempt}`);
        break;
      } catch (err) {
        console.warn(`⚠️ Attempt ${attempt} failed:`, err.message);
        if (attempt < maxRetries) {
          const backoff = Math.pow(2, attempt) * 1000;
          await delay(backoff);
        } else {
          console.error("🚨 Max retries reached, dropping job:", job);
        }
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

      await enqueue({ url, payload: encryptedPayload, attempt: 0 });
      return new Response("Accepted", { status: 202 });
    } catch (e) {
      console.error(e);
      return new Response("Invalid JSON", { status: 400 });
    }
  }

  return new Response("Not Found", { status: 404 });
});
