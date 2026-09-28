#!/usr/bin/env node

import { auditRolePacketPreflight, buildProductionPackets } from "./auction-night-role-host-showcase.mjs";

const { roles } = buildProductionPackets();
const result = auditRolePacketPreflight(roles, ["A", "F", "G"]);
console.log(JSON.stringify({
  status: result.ok ? "ROLE_PACKET_PREFLIGHT_PASS" : "ROLE_PACKET_PREFLIGHT_BLOCKED",
  realWriterCalled: false,
  scope: ["A", "F", "G"],
  issues: result.issues,
}, null, 2));
if (!result.ok) process.exitCode = 1;
