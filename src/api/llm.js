/**
 * Account LLM (BYOK) API.
 */
import { request } from "./client.js";

export function getAccountLlm() {
  return request("/account/llm");
}

export function updateAccountLlmPreferences(payload) {
  return request("/account/llm/preferences", { method: "PUT", body: payload });
}

export function createAccountLlmConnection(payload) {
  return request("/account/llm/connections", { method: "POST", body: payload });
}

export function updateAccountLlmConnection(connectionId, payload) {
  return request(`/account/llm/connections/${connectionId}`, { method: "PUT", body: payload });
}

export function deleteAccountLlmConnection(connectionId) {
  return request(`/account/llm/connections/${connectionId}`, { method: "DELETE" });
}

export function activateAccountLlmConnection(connectionId) {
  return request(`/account/llm/connections/${connectionId}/activate`, { method: "POST", body: {} });
}

export function testAccountLlmConnection(connectionId) {
  return request(`/account/llm/connections/${connectionId}/test`, { method: "POST", body: {} });
}
