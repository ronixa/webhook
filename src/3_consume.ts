import { privateDecrypt } from "node:crypto";
import { Buffer } from "node:buffer";

Deno.serve({ port: 9000 }, async (req) => {
  const { method, url } = req;
  const { pathname } = new URL(url);

  if (method === "POST" && pathname === "/webhook") {
    try {
      if (Math.random() < 0.8) {
        throw new Error("Mocked error occured...");
      }

      const body = await req.json();
      console.debug("Body received", body);

      // rsa_decrypt.ts
      const privateKeyBase64 = await Deno.readTextFile("private_key.pem");
      const privateKey = Buffer.from(privateKeyBase64, "base64").toString();
      const decryptedMessage = privateDecrypt(
        privateKey,
        Buffer.from(body, "base64"),
      );
      const plaintext = Buffer.from(decryptedMessage).toString();

      console.log("📦 Received webhook payload:", plaintext);
      return new Response("Webhook received!", { status: 200 });
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
  }

  return new Response("Not Found", { status: 404 });
});
