import { generateKeyPairSync } from "node:crypto";
import { Buffer } from "node:buffer";

// Generate RSA key pair (2048-bit key)
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 4096,
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem",
  },
  publicKeyEncoding: {
    type: "spki",
    format: "pem",
  },
});

// Save to disk
await Deno.writeTextFile(
  "private_key.pem",
  Buffer.from(privateKey).toString("base64"),
);
await Deno.writeTextFile(
  "public_key.pem",
  Buffer.from(publicKey).toString("base64"),
);

console.log("🔐 Keys generated and saved to disk:");
console.log(" - private_key.pem");
console.log(" - public_key.pem");
