// deno run -A 2_publisher.ts
// The retry approach is NOT Sequential. To get a fully sequential you need to handle the retry in-code, (instead of pushing in the queue),
// See redis seq example for details.

import { publicEncrypt } from "node:crypto";
import { Buffer } from "node:buffer";

type WebhookJob = {
  url: string;
  payload: unknown;
  attempt: number;
  target: string; // Customer id - can be an api key or any other secret shared with customer to identify which Public RSA Certificate to use
};

const retryDelays = [1000, 2000, 4000, 8000, 16000]; // ms
const queue: WebhookJob[] = [];

// Enqueue a job
function enqueue(url: string, payload: unknown) {
  queue.push({ url, payload, attempt: 0, target: "customer-1" });
}

// Background job processor
async function processQueue() {
  while (true) {
    const job = queue.shift();
    if (!job) {
      await delay(100);
      continue;
    }

    try {
      const res = await fetch(job.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job.payload),
      });

      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      console.log(`✅ Webhook sent to ${job.url}`);
    } catch (err) {
      console.error(err);
      const nextAttempt = job.attempt + 1;
      if (nextAttempt < retryDelays.length) {
        const delayMs = retryDelays[job.attempt];
        console.warn(`⏳ Retry ${nextAttempt} in ${delayMs}ms: ${job.url}`);
        setTimeout(() => {
          queue.push({ ...job, attempt: nextAttempt });
        }, delayMs);
      } else {
        console.error(`💥 Gave up after ${nextAttempt} attempts: ${job.url}`);
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

      enqueue(url, encryptedPayload);
      return new Response("Accepted", { status: 202 });
    } catch (e) {
      console.error(e);
      return new Response("Invalid JSON", { status: 400 });
    }
  }

  return new Response("Not Found", { status: 404 });
});
