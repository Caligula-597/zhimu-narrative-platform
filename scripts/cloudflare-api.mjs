/**
 * Minimal Cloudflare API v4 client (no extra deps).
 */
const BASE = "https://api.cloudflare.com/client/v4";

export async function cfRequest(token, path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await res.json();
  if (!payload.success) {
    const msg = payload.errors?.map((e) => e.message).join("; ") || res.statusText;
    throw new Error(msg || "Cloudflare API error");
  }
  return payload.result;
}

export async function verifyToken(token) {
  return cfRequest(token, "/user/tokens/verify");
}

export async function getZoneByName(token, zoneName) {
  const zones = await cfRequest(token, `/zones?name=${encodeURIComponent(zoneName)}`);
  return zones[0] ?? null;
}

export async function listDnsRecords(token, zoneId, { type, name } = {}) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (name) params.set("name", name);
  const q = params.toString();
  return cfRequest(token, `/zones/${zoneId}/dns_records${q ? `?${q}` : ""}`);
}

export async function upsertDnsRecord(token, zoneId, { type, name, content, proxied, ttl = 1, priority, zoneName }) {
  const fqdn = name.includes(".") ? name : zoneName ? `${name}.${zoneName}` : name;
  const byName = await listDnsRecords(token, zoneId, { name: fqdn });
  const sameType = byName.filter((r) => r.type === type);
  const payload = {
    type,
    name: fqdn,
    content,
    proxied: proxied ?? undefined,
    ttl: proxied ? 1 : ttl,
    priority
  };

  if (sameType[0]?.id) {
    return cfRequest(token, `/zones/${zoneId}/dns_records/${sameType[0].id}`, {
      method: "PATCH",
      body: payload
    });
  }

  for (const record of byName) {
    if (record.type === type) continue;
    await deleteDnsRecord(token, zoneId, record.id);
  }

  return cfRequest(token, `/zones/${zoneId}/dns_records`, { method: "POST", body: payload });
}

export async function deleteDnsRecord(token, zoneId, recordId) {
  return cfRequest(token, `/zones/${zoneId}/dns_records/${recordId}`, { method: "DELETE" });
}

export async function listPagesProjects(token, accountId) {
  return cfRequest(token, `/accounts/${accountId}/pages/projects`);
}

export async function createPagesProject(token, accountId, input) {
  return cfRequest(token, `/accounts/${accountId}/pages/projects`, { method: "POST", body: input });
}

export async function addPagesDomain(token, accountId, projectName, domain) {
  return cfRequest(token, `/accounts/${accountId}/pages/projects/${projectName}/domains`, {
    method: "POST",
    body: { name: domain }
  });
}

export async function createDirectUploadDeployment(token, accountId, projectName, manifest) {
  return cfRequest(token, `/accounts/${accountId}/pages/projects/${projectName}/deployments`, {
    method: "POST",
    body: { manifest }
  });
}
