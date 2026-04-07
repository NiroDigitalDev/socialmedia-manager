/**
 * Sanity-test R2 credentials by uploading + reading + deleting one tiny object.
 *
 * Usage:
 *   railway run --service socialmedia-manager bun scripts/test-r2.ts
 */
import { uploadToR2, getFromR2, deleteFromR2 } from "@/lib/r2";

const testKey = `_health/test-${Date.now()}.txt`;
const testBody = Buffer.from("hello from r2 test");

async function main() {
  console.log(`Bucket: ${process.env.R2_BUCKET_NAME}`);
  console.log(`Account: ${process.env.R2_ACCOUNT_ID}`);
  console.log(`Public URL: ${process.env.R2_PUBLIC_URL ?? "(not set)"}\n`);

  console.log(`1. Uploading ${testKey}...`);
  await uploadToR2(testKey, testBody, "text/plain");
  console.log("   ok\n");

  console.log(`2. Reading ${testKey}...`);
  const { body, contentType } = await getFromR2(testKey);
  const decoded = Buffer.from(body).toString();
  console.log(`   ok (${body.byteLength} bytes, type=${contentType})`);
  console.log(`   content: "${decoded}"\n`);

  if (decoded !== testBody.toString()) {
    throw new Error("round-trip content mismatch");
  }

  console.log(`3. Deleting ${testKey}...`);
  await deleteFromR2(testKey);
  console.log("   ok\n");

  console.log("R2 connection works.");
}

main().catch((err) => {
  console.error("R2 test failed:", err);
  process.exit(1);
});
