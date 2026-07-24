export function isUncertainHostWrite(error) {
  return error?.code === "NETWORK_ERROR"
    || error?.code === "REQUEST_TIMEOUT"
    || error?.name === "AbortError"
    || error instanceof TypeError;
}
