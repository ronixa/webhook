// deno run -A 2_kafka_publisher.ts

import { publicEncrypt } from "node:crypto";
import { Buffer } from "node:buffer";

import { PubSub } from "./libs/kafka.ts";

type WebhookJob = {
  url: string;
  payload: unknown;
  attempt: number;
  target: string; // Customer id - can be an api key or any other secret shared with customer to identify which Public RSA Certificate to use
  id: number;
};

const pubSub = new PubSub("webhook");
await pubSub.setupProducer();

// Enqueue a job
async function enqueue(job: WebhookJob) {
  await pubSub.sendMessage("events", [
    { key: job.target, value: JSON.stringify(job) },
  ]);
}

// For local debugging
let id = 0;

// Start HTTP server using official Deno.serve
Deno.serve({ port: 4242, hostname: "0.0.0.0" }, async (req) => {
  const { pathname } = new URL(req.url);

  if (req.method === "POST" && pathname === "/publish") {
    try {
      const { url, payload, target } = await req.json();

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
        target,
        id: ++id,
      });
      return new Response("Accepted", { status: 202 });
    } catch (e) {
      console.error(e);
      return new Response("Invalid JSON", { status: 400 });
    }
  }

  return new Response("Not Found", { status: 404 });
});
