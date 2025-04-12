// This file is run on the customer side
// The customer has to load its private key and share the public key with the server (the provider)

import { privateDecrypt } from "node:crypto";
import { Buffer } from "node:buffer";

import { metrics, SpanStatusCode, trace } from "@opentelemetry/api";

import { ApiError } from "./libs/error.ts";

const privateKeyBase64 = await Deno.readTextFile("private_key.pem");
const privateKey = Buffer.from(privateKeyBase64, "base64").toString();

const tracer = trace.getTracer("webhook", "1.0.0");
const meter = metrics.getMeter("webhook", "1.0.0");
const counter = meter.createCounter("request_processed", {
  description: "A simple counter",
  unit: "1",
});

function processMessage(req) {
  return tracer.startActiveSpan("processMessage", async (span) => {
    try {
      try {
        if (Math.random() < 0.2) {
          throw new ApiError(
            "🚫 MOCK: Simulated an error on customer side, Force a retry",
            "MOCK_ERROR",
            400,
          );
        }

        const body = await req.json();
        const decryptedMessage = privateDecrypt(
          privateKey,
          Buffer.from(body, "base64"),
        );
        const plaintext = Buffer.from(decryptedMessage).toString();

        console.log("📦 Received webhook payload:", plaintext);
        span?.setStatus({
          code: SpanStatusCode.OK,
          message: "Webhook received!",
        });
        counter.add(1);

        span?.setAttribute(
          "webhook.timestamp",
          JSON.parse(plaintext).timestamp,
        );

        return new Response("Webhook received!", { status: 200 });
      } catch (e) {
        throw new ApiError(
          (e as Error).message || "An unexpected issue has occurred.",
          e.cause || "UNPROCESSABLE",
          e.code || 409,
        );
      }
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

Deno.serve({ port: 9000, onError: onError }, async (req) => {
  const span = trace.getActiveSpan();

  const { method, url } = req;
  const { pathname } = new URL(url);

  if (method === "POST" && pathname === "/webhook") {
    span?.setAttribute("http.route", "/webhook");
    span?.updateName(`${req.method} /webhook`);
    return await processMessage(req);
  }

  throw new ApiError(
    "Not Found",
    "NOT_FOUND",
    404,
  );
});

function onError(err: ApiError) {
  return new Response((err as Error).message, { status: err.code || 500 });
}
