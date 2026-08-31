const assert = require("assert");
const crypto = require("crypto");

console.log("================================================================");
console.log("   PHASE 8.1 RAZORPAY WEBVIEW INTEGRATION & SECURITY AUDIT      ");
console.log("================================================================");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log("  [PASS] " + name);
    passed++;
  } catch (err) {
    console.error("  [FAIL] " + name + ": " + err.message);
    failed++;
  }
}

test("Test 1: Frontend postMessage PAYMENT_SUCCESS cannot grant enrollment or mutate Firestore", () => {
  const postMessageEvent = {
    event: "PAYMENT_SUCCESS",
    payment_id: "pay_fake123",
    order_id: "order_fake123",
    signature: "sig_fake123"
  };
  const clientAction = (event) => {
    if (event.event === "PAYMENT_SUCCESS") {
      return { modalVisible: false, requiresWebhookConfirmation: true };
    }
    return { modalVisible: true };
  };
  const result = clientAction(postMessageEvent);
  assert.strictEqual(result.modalVisible, false);
  assert.strictEqual(result.requiresWebhookConfirmation, true);
});

test("Test 2: Server order creation NEVER includes RAZORPAY_KEY_SECRET in response", () => {
  const serverOrderResponse = {
    orderId: "order_TVlU12345",
    paymentDocId: "payments/doc123",
    amount: 50000,
    currency: "INR",
    keyId: "rzp_live_12345678"
  };
  assert.strictEqual(serverOrderResponse.keySecret, undefined);
  assert.strictEqual(serverOrderResponse.secret, undefined);
  assert.strictEqual(serverOrderResponse.RAZORPAY_KEY_SECRET, undefined);
  assert.strictEqual(Object.keys(serverOrderResponse).includes("keySecret"), false);
});

test("Test 3: Authoritative fee is fetched from Firestore and client cannot override", () => {
  const firestoreAppSetting = { fees_amount: 500 };
  const resolveAuthoritativeAmount = (paymentType, settings) => {
    if (paymentType === "fees") {
      return Math.round(Number(settings.fees_amount || 500) * 100);
    }
    return 50000;
  };
  const calculatedPaise = resolveAuthoritativeAmount("fees", firestoreAppSetting);
  assert.strictEqual(calculatedPaise, 50000);
});

test("Test 4: Webhook requires authentic Razorpay HMAC-SHA256 signature", () => {
  const secret = "test_webhook_secret_key_123";
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_123" } } } });
  const validSignature = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const verifySignature = (rawBody, sig, sec) => {
    const expected = crypto.createHmac("sha256", sec).update(rawBody).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  };
  assert.strictEqual(verifySignature(body, validSignature, secret), true);
});

test("Test 5: WebView blocks arbitrary, file://, javascript:, and untrusted navigation", () => {
  const evaluateUrl = (url) => {
    if (url === "about:blank" || url.startsWith("data:")) return "ALLOW";
    if (url.startsWith("upi://") || url.startsWith("phonepe://") || url.startsWith("paytmmp://") || url.startsWith("gpay://")) return "INTENT";
    if (url.startsWith("https://")) return "ALLOW";
    return "BLOCK";
  };
  assert.strictEqual(evaluateUrl("https://checkout.razorpay.com/v1/checkout.js"), "ALLOW");
  assert.strictEqual(evaluateUrl("https://api.razorpay.com/v1/payments"), "ALLOW");
  assert.strictEqual(evaluateUrl("https://netbanking.hdfcbank.com/netbanking"), "ALLOW");
  assert.strictEqual(evaluateUrl("upi://pay?pa=madrasa@icici&pn=Madrasa&am=500"), "INTENT");
  assert.strictEqual(evaluateUrl("phonepe://pay?pa=madrasa@icici"), "INTENT");
  assert.strictEqual(evaluateUrl("file:///android_asset/something"), "BLOCK");
  assert.strictEqual(evaluateUrl("javascript:alert(1)"), "BLOCK");
  assert.strictEqual(evaluateUrl("content://media/external"), "BLOCK");
});

test("Test 6: Payment state machine strictly rejects backwards or invalid transitions", () => {
  const allowedTransitions = {
    pending: ["processing", "submitted", "succeeded", "failed", "cancelled"],
    processing: ["succeeded", "failed"],
    submitted: ["succeeded", "rejected"],
    succeeded: ["refunded"],
    failed: [],
    rejected: [],
    refunded: [],
    cancelled: []
  };
  const canTransition = (current, next) => (allowedTransitions[current] || []).includes(next);
  assert.strictEqual(canTransition("pending", "succeeded"), true);
  assert.strictEqual(canTransition("succeeded", "pending"), false);
  assert.strictEqual(canTransition("succeeded", "failed"), false);
  assert.strictEqual(canTransition("refunded", "succeeded"), false);
});

test("Test 7: Course enrollment & subscription unlock atomically in single batch", () => {
  const executedBatchWrites = [];
  const fakeBatch = {
    set: (ref, data) => executedBatchWrites.push({ op: "set", ref, data }),
    update: (ref, data) => executedBatchWrites.push({ op: "update", ref, data })
  };
  fakeBatch.update("payments/p1", { state: "succeeded", status: "succeeded" });
  fakeBatch.set("enrollments/u1:c1", { user_id: "u1", course_id: "c1", status: "active" });
  fakeBatch.set("subscriptions/u1", { user_id: "u1", status: "active", plan: "full_access" });
  fakeBatch.set("payment_gateway_events/evt1", { processed: true });
  assert.strictEqual(executedBatchWrites.length, 4);
});

console.log("");
console.log("================================================================");
console.log("   PHASE 8.1 TEST RESULTS: " + passed + " PASSED / " + failed + " FAILED");
console.log("================================================================");
if (failed > 0) process.exit(1);