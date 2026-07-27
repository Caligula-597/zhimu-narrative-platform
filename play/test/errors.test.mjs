import assert from "node:assert/strict";
import test from "node:test";
import { formatApiError } from "../src/errors.js";

test("formatApiError maps HTTP status to friendly Chinese", () => {
  assert.match(formatApiError({ status: 500 }), /服务器繁忙/);
  assert.match(formatApiError({ status: 503 }), /暂时不可用/);
  assert.equal(formatApiError({ status: 401 }), "请先登录后再操作。");
  assert.match(formatApiError({ name: "AbortError" }), /超时/);
  assert.match(formatApiError({ code: "NETWORK_ERROR" }), /无法连接/);
  assert.match(formatApiError({ code: "EMAIL_VERIFICATION_PENDING" }), /尚未验证/);
  assert.match(formatApiError({ code: "EMAIL_ALREADY_REGISTERED" }), /完成验证/);
});

test("formatApiError hides raw status-only message", () => {
  assert.equal(formatApiError({ message: "请求失败 (500)" }, "自定义失败"), "自定义失败");
  assert.equal(formatApiError({ code: "ROOM_NOT_FOUND" }), "邀请码无效或房间不存在。");
  assert.match(formatApiError({ code: "VOICE_ROOM_LIMIT_REACHED" }), /语音房已达上限/);
  assert.match(formatApiError({ code: "NOTEBOOK_SOURCE_INVALID" }), /尚未解锁/);
});
