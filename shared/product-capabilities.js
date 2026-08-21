import { PRODUCT_DOMAINS, productDomainDefinition } from "./product-domains/registry.js";

export const PRODUCT_TOOL_CAPABILITIES = Object.freeze(Object.fromEntries(
  Object.entries(PRODUCT_DOMAINS).map(([key, domain]) => [key, Object.freeze({
    label: domain.label,
    dedicated: domain.toolViews,
    shared: Object.freeze([]),
    labels: domain.labels
  })])
));

export function productToolCapabilities(value) {
  return PRODUCT_TOOL_CAPABILITIES[productDomainDefinition(value).key];
}

export function productToolViews(value) {
  const capabilities = productToolCapabilities(value);
  return [...capabilities.dedicated, ...capabilities.shared];
}

export function productSupportsView(value, view) {
  return productToolViews(value).includes(view);
}

export function productToolLabel(value, view, fallback = "") {
  return productToolCapabilities(value).labels[view] || fallback || view;
}

export function productHomeView(value) {
  return productDomainDefinition(value).homeView;
}

export function productAllowsShellView(value, view) {
  return productDomainDefinition(value).allowedViews.includes(view);
}
