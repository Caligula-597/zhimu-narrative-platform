import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSafeOutboundHttpsUrl,
  isPrivateNetworkAddress,
  parseSafeOutboundHttpsUrl,
  resolveSafeOutboundHttpsTarget
} from "../src/outbound-url-policy.js";
import { createPinnedLookup } from "../src/pinned-outbound-fetch.js";

test("private and special-use network addresses are recognized", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "172.16.1.1",
    "192.168.1.1",
    "::1",
    "fd00::1",
    "fe80::1",
    "fec0::1",
    "::ffff:7f00:1",
    "2002:7f00:1::"
  ]) {
    assert.equal(isPrivateNetworkAddress(address), true, address);
  }
  assert.equal(isPrivateNetworkAddress("8.8.8.8"), false);
  assert.equal(isPrivateNetworkAddress("2606:4700:4700::1111"), false);
});

test("LLM base URLs require public-looking HTTPS endpoints without credentials", () => {
  assert.equal(parseSafeOutboundHttpsUrl("https://api.openai.com/v1").hostname, "api.openai.com");
  for (const url of [
    "http://api.openai.com/v1",
    "https://localhost/v1",
    "https://metadata.google.internal/v1",
    "https://127.0.0.1/v1",
    "https://user:pass@example.com/v1",
    "https://example.com:8443/v1"
  ]) {
    assert.throws(() => parseSafeOutboundHttpsUrl(url), (error) => error.code === "LLM_BASE_URL_UNSAFE", url);
  }
});

test("DNS resolution blocks hostnames that resolve to private networks", async () => {
  await assert.rejects(
    () => assertSafeOutboundHttpsUrl("https://llm.example.com/v1", {
      resolver: async () => [{ address: "10.1.2.3", family: 4 }]
    }),
    (error) => error.code === "LLM_BASE_URL_UNSAFE"
  );
  const parsed = await assertSafeOutboundHttpsUrl("https://llm.example.com/v1", {
    resolver: async () => [{ address: "8.8.8.8", family: 4 }]
  });
  assert.equal(parsed.hostname, "llm.example.com");
});

test("safe outbound target retains only the validated DNS answers", async () => {
  const target = await resolveSafeOutboundHttpsTarget("https://llm.example.com/v1", {
    resolver: async () => [
      { address: "8.8.8.8", family: 4 },
      { address: "2606:4700:4700::1111", family: 6 }
    ]
  });
  assert.deepEqual(target.addresses, [
    { address: "8.8.8.8", family: 4 },
    { address: "2606:4700:4700::1111", family: 6 }
  ]);
});

test("public IPv6 literals bypass DNS while mapped private literals are blocked", async () => {
  let resolverCalls = 0;
  const target = await resolveSafeOutboundHttpsTarget("https://[2606:4700:4700::1111]/v1", {
    resolver: async () => {
      resolverCalls += 1;
      return [];
    }
  });
  assert.equal(resolverCalls, 0);
  assert.deepEqual(target.addresses, [{ address: "2606:4700:4700::1111", family: 6 }]);
  await assert.rejects(
    resolveSafeOutboundHttpsTarget("https://[::ffff:7f00:1]/v1"),
    (error) => error?.code === "LLM_BASE_URL_UNSAFE"
  );
});

test("pinned lookup never performs a second DNS resolution", async () => {
  const lookup = createPinnedLookup([{ address: "8.8.8.8", family: 4 }]);
  const selected = await new Promise((resolve, reject) => {
    lookup("llm.example.com", {}, (error, address, family) => {
      if (error) reject(error);
      else resolve({ address, family });
    });
  });
  assert.deepEqual(selected, { address: "8.8.8.8", family: 4 });
});
