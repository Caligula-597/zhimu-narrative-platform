/**
 * P9.0 Semantic Fidelity Audit — deterministic checks on resolved BeatSemantics.
 * No NLP / genre contextualization.
 */

import { semanticsBridgeForTemplate } from "./complete-beat-semantics-data.js";
import { resolveBeatSemantics, formatAgencySummary } from "./story-beat-semantics.js";
import { getStoryTemplate, getStoryVariant } from "./story-mechanism-registry.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function factTypes(list) {
  return asArray(list)
    .map((f) => f?.factType || f?.kind || f?.id)
    .filter(Boolean)
    .map(String);
}

function hasToken(text, token) {
  return String(text || "").includes(String(token));
}

function check(code, ok, expected, actual) {
  return { code, ok: Boolean(ok), expected, actual };
}

/**
 * Resolve progression-band semantics for a template+variant (generic).
 */
export function resolveVariantProgressionSemantics({
  templateId,
  variantId,
  roleBindings = null,
  plot = {},
  phaseBand = 1,
} = {}) {
  const template = getStoryTemplate(templateId);
  const variant = getStoryVariant(templateId, variantId) || template?.variants?.[0] || null;
  const bridge = template?.semanticsBridge || semanticsBridgeForTemplate(templateId);
  const bindings =
    roleBindings ||
    ({
      culprit: { id: "C", name: "真凶" },
      framedCharacter: { id: "F", name: "被嫁祸者" },
      discoverer: { id: "D", name: "发现者" },
      bearer: { id: "B", name: "持有者" },
      factionLead: { id: "L", name: "领袖" },
      memberA: { id: "M", name: "成员" },
      defector: { id: "X", name: "变节者" },
    });
  const semantics = resolveBeatSemantics({
    bridge,
    phaseBand,
    roleBindings: bindings,
    plot,
    variant,
    sourceBlockId: `audit-${templateId}`,
    sourceBeatId: `phase-${phaseBand}`,
  });
  return { template, variant, bridge, semantics };
}

/**
 * @param {{ templateId: string, variantId?: string, block?: object, roleBindings?: object, plot?: object }} args
 */
export function auditStorySemanticFidelity({
  templateId,
  variantId = null,
  block = null,
  roleBindings = null,
  plot = {},
} = {}) {
  const tid = templateId || block?.templateId || block?.mechanismId;
  const vid = variantId || block?.variantId || null;
  const checks = [];

  if (!tid) {
    return {
      templateId: null,
      variantId: vid,
      checks: [check("TEMPLATE_REQUIRED", false, "templateId", null)],
      status: "FAIL",
    };
  }

  const { template, variant, bridge, semantics } = resolveVariantProgressionSemantics({
    templateId: tid,
    variantId: vid,
    roleBindings,
    plot,
  });

  checks.push(check("TEMPLATE_KNOWN", Boolean(template || bridge), tid, tid));
  checks.push(
    check(
      "VARIANT_ID_PRESERVED",
      !vid || variant?.id === String(vid),
      vid,
      variant?.id || null,
    ),
  );

  const expectations = record(variant?.semanticExpectations);
  if (Object.keys(expectations).length) {
    for (const token of asArray(expectations.requiredGoalTokens)) {
      checks.push(
        check(
          "REQUIRED_GOAL_TOKEN",
          hasToken(semantics?.goal, token),
          token,
          semantics?.goal || null,
        ),
      );
    }
    for (const token of asArray(expectations.forbiddenGoalTokens)) {
      checks.push(
        check(
          "FORBIDDEN_GOAL_TOKEN",
          !hasToken(semantics?.goal, token) && !hasToken(semantics?.action, token),
          `must_not_contain:${token}`,
          `${semantics?.goal || ""} | ${semantics?.action || ""}`,
        ),
      );
    }
    for (const token of asArray(expectations.requiredTargetTokens)) {
      checks.push(
        check(
          "REQUIRED_TARGET_TOKEN",
          hasToken(semantics?.target, token),
          token,
          semantics?.target || null,
        ),
      );
    }
    if (expectations.requiredActionKind) {
      checks.push(
        check(
          "REQUIRED_ACTION_KIND",
          semantics?.actionKind === expectations.requiredActionKind,
          expectations.requiredActionKind,
          semantics?.actionKind || null,
        ),
      );
    }
    for (const ft of asArray(expectations.requiredFactTypes)) {
      const all = [...factTypes(semantics?.requires), ...factTypes(semantics?.produces)];
      checks.push(
        check("REQUIRED_FACT_TYPE", all.includes(ft), ft, all),
      );
    }
  }

  // M01 structural fidelity when auditing framing family
  if (tid === "M01-FRAMING" && bridge) {
    const crime = resolveBeatSemantics({
      bridge,
      phaseBand: 1,
      roleBindings: roleBindings || {
        culprit: { id: "C", name: "真凶" },
        framedCharacter: { id: "F", name: "被嫁祸者" },
        discoverer: { id: "D", name: "发现者" },
      },
      plot,
      variant,
      sourceBeatId: "beat-crime",
    });
    const falseDir = resolveBeatSemantics({
      bridge,
      phaseBand: 2,
      roleBindings: roleBindings || {
        culprit: { id: "C", name: "真凶" },
        framedCharacter: { id: "F", name: "被嫁祸者" },
        discoverer: { id: "D", name: "发现者" },
      },
      plot,
      variant,
      sourceBeatId: "beat-false",
    });
    const contra = resolveBeatSemantics({
      bridge,
      phaseBand: 3,
      roleBindings: roleBindings || {
        culprit: { id: "C", name: "真凶" },
        framedCharacter: { id: "F", name: "被嫁祸者" },
        discoverer: { id: "D", name: "发现者" },
      },
      plot,
      variant,
      sourceBeatId: "beat-contra",
    });
    const reveal = resolveBeatSemantics({
      bridge,
      phaseBand: 4,
      roleBindings: roleBindings || {
        culprit: { id: "C", name: "真凶" },
        framedCharacter: { id: "F", name: "被嫁祸者" },
        discoverer: { id: "D", name: "发现者" },
      },
      plot,
      variant,
      sourceBeatId: "beat-reveal",
    });

    checks.push(
      check("M01_CRIME_ACTION_DISTINCT", crime?.action !== falseDir?.action, "≠", {
        crime: crime?.action,
        falseDirection: falseDir?.action,
      }),
    );
    checks.push(
      check("M01_CRIME_GOAL_DISTINCT", crime?.goal !== falseDir?.goal, "≠", {
        crime: crime?.goal,
        falseDirection: falseDir?.goal,
      }),
    );
    checks.push(
      check(
        "M01_CRIME_PRODUCES_CRIME_DONE",
        factTypes(crime?.produces).includes("crime_done"),
        "crime_done",
        factTypes(crime?.produces),
      ),
    );
    checks.push(
      check(
        "M01_CRIME_NOT_FALSE_SUSPICION",
        !factTypes(crime?.produces).includes("false_suspicion") &&
          !factTypes(crime?.produces).includes("suspicion"),
        "no false_suspicion on crime",
        factTypes(crime?.produces),
      ),
    );
    checks.push(
      check(
        "M01_FALSE_REQUIRES_PLANTED",
        factTypes(falseDir?.requires).includes("planted_evidence_available"),
        "planted_evidence_available",
        factTypes(falseDir?.requires),
      ),
    );
    checks.push(
      check(
        "M01_FALSE_PRODUCES_SUSPICION",
        factTypes(falseDir?.produces).includes("false_suspicion"),
        "false_suspicion",
        factTypes(falseDir?.produces),
      ),
    );
    checks.push(
      check(
        "M01_CONTRA_REQUIRES_FALSE_SUSPICION",
        factTypes(contra?.requires).includes("false_suspicion"),
        "false_suspicion",
        factTypes(contra?.requires),
      ),
    );
    checks.push(
      check(
        "M01_REVEAL_REQUIRES_CONTRADICTION",
        factTypes(reveal?.requires).includes("contradiction"),
        "contradiction",
        factTypes(reveal?.requires),
      ),
    );
    const crimeSummary = formatAgencySummary(crime);
    const falseSummary = formatAgencySummary(falseDir);
    checks.push(
      check("M01_EVENT_SUMMARY_DISTINCT", crimeSummary !== falseSummary, "≠", {
        crime: crimeSummary,
        falseDirection: falseSummary,
      }),
    );
  }

  const status = checks.every((c) => c.ok) ? "PASS" : "FAIL";
  return {
    templateId: tid,
    variantId: variant?.id || vid,
    semantics,
    checks,
    status,
  };
}
