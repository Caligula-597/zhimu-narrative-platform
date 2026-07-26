import assert from "node:assert/strict";
import test from "node:test";
import { renderAccountLlmSection } from "../src/components/account-llm.js";

const presets = {
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-v4-flash",
    models: ["deepseek-v4-flash", "deepseek-v4-pro"]
  },
  qwen: {
    label: "阿里云百炼（Qwen）",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    models: ["qwen-plus"]
  },
  openai_compatible: {
    label: "自定义 OpenAI 兼容接口",
    baseUrl: "https://api.example.com/v1",
    defaultModel: "",
    models: []
  }
};

test("BYOK-only account panel hides platform routing and exposes provider/model choices", () => {
  const html = renderAccountLlmSection({
    encryptionReady: true,
    presets,
    preferences: { routingMode: "own_only" },
    connections: [],
    platform: {
      available: false,
      model: null,
      note: "平台 AI 池暂不面向用户开放；创作调用只使用您保存的 API。"
    }
  });

  assert.match(html, /仅使用您的 API/);
  assert.match(html, /平台密钥不会加入用户调用池/);
  assert.doesNotMatch(html, /data-llm-routing/);
  assert.match(html, /value="deepseek"/);
  assert.match(html, /value="qwen"/);
  assert.match(html, /value="openai_compatible"/);
  assert.match(html, /value="deepseek-v4-flash"/);
  assert.match(html, /value="qwen-plus"/);
  assert.match(html, /模型标识（可输入自定义模型）/);
});

test("saved connections render only masked API key hints", () => {
  const html = renderAccountLlmSection({
    encryptionReady: true,
    presets,
    preferences: { routingMode: "own_only" },
    connections: [{
      id: "11111111-2222-4333-8444-555555555555",
      name: "我的千问",
      provider: "qwen",
      baseUrl: presets.qwen.baseUrl,
      model: "qwen-plus",
      apiKeyHint: "••••1234",
      isActive: true,
      enabled: true
    }],
    platform: { available: false }
  });

  assert.match(html, /阿里云百炼（Qwen）/);
  assert.match(html, /Key ••••1234/);
  assert.doesNotMatch(html, /api_key_ciphertext/);
});
