function safeHttpStatus(status) {
  const value = Number(status);
  return Number.isInteger(value) && value >= 400 && value <= 599 ? value : null;
}

export function llmProbeFailureMessage(status) {
  const safeStatus = safeHttpStatus(status);
  return safeStatus
    ? `连接测试失败，AI 服务商返回 HTTP ${safeStatus}。请检查 API Key、模型和接口地址。`
    : "连接测试失败，请检查 API Key、模型和接口地址。";
}

export function llmRequestFailureMessage(status) {
  const safeStatus = safeHttpStatus(status);
  return safeStatus
    ? `AI 服务请求失败（HTTP ${safeStatus}），请稍后重试。`
    : "AI 服务请求失败，请稍后重试。";
}
