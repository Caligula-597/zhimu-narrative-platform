/**
 * Runtime State Machine + Host Exception Remediation — shared types.
 *
 * Covers 《长生叹》M-01~M-08 runtime state machine requirements. Each machine
 * describes the advancement of one runtime stage under host control as a chain
 * of states. Every state defines: entering condition, the actions the host must
 * drive, where it transfers next, and an "exception remediation" note for when
 * that stage cannot advance as scripted.
 */

/**
 * @typedef {Object} RuntimeState
 * @property {string} id
 * @property {string} name        — state name, e.g. "线索未揭示"
 * @property {string} description — what the world looks like in this state
 * @property {string} condition   — condition to enter this state
 * @property {string} action      — host actions that advance this state
 * @property {string} nextState   — target state this transfers to
 * @property {string} remedy      — exception remediation when stuck at this stage
 */

/**
 * @typedef {Object} RuntimeStateMachine
 * @property {string}         id
 * @property {string}         worldId
 * @property {string}         title      — short label, e.g. "M-01"
 * @property {number}         sequence   — runtime execution order
 * @property {string}         startState — initial state name
 * @property {string}         endState   — terminal state name
 * @property {string}         summary    — overview of this runtime machine
 * @property {RuntimeState[]} states     — ordered runtime states
 * @property {string}         createdAt
 * @property {string}         updatedAt
 */

export const RUNTIME_STATE_MACHINE_EDITOR_VERSION = 1;

export const RUNTIME_STATE_MACHINE_API_PREFIX = "/api/worlds/:worldId/runtime-state-machines";

/** Default empty draft for a new runtime state machine */
export function emptyRuntimeStateMachineDraft() {
  return {
    title: "",
    sequence: 1,
    startState: "",
    endState: "",
    summary: "",
    states: []
  };
}

/** Create an empty runtime state. */
export function createRuntimeState(name = "", description = "", condition = "", action = "", nextState = "", remedy = "") {
  return {
    id: "",
    name,
    description,
    condition,
    action,
    nextState,
    remedy
  };
}

/** Build a runtime state machine for client-side use. */
export function buildRuntimeStateMachine(overrides = {}) {
  return {
    id: overrides.id || "",
    worldId: overrides.worldId || "",
    title: overrides.title || "",
    sequence: Number(overrides.sequence) || 1,
    startState: overrides.startState || "",
    endState: overrides.endState || "",
    summary: overrides.summary || "",
    states: overrides.states || [],
    createdAt: overrides.createdAt || "",
    updatedAt: overrides.updatedAt || ""
  };
}