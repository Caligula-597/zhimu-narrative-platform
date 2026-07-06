/**
 * Vite entry — import order mirrors legacy index.html script chain.
 * Modules use ES exports; startup order keeps diagnostic globals and registries available.
 */
import "../config.js";
import "../src/dom.js";
import "../src/state.js";
import "../src/utils/user-messages.js";
import "../src/utils/wizard-automation-templates.js";
import "../src/runtime/session-auth.js";
import "../src/api/index.js";
import "../src/runtime/ai-draft-store.js";
import "../src/utils/format.js";
import "../src/runtime/session-mode.js";
import "../src/components/onboarding-strip.js";
import "../src/components/first-run-chooser.js";
import "../src/runtime/nav-shell.js";
import "../src/components/status-ui.js";
import "../src/components/ui-semantics.js";
import "../src/runtime/dependency-guard.js";
import "../src/components/service-outage.js";
import "../src/components/emptyState.js";
import "../src/components/toast.js";
import "../src/components/modal.js";
import "../src/components/creator-guide.js";
import "../src/components/collapse-panel.js";
import "../src/views/overview.js";
import "../src/views/platform-runtime.js";
import "../src/runtime/wizard.js";
import "../src/runtime/auth-session.js";
import "../src/runtime/workspace-store.js";
import "../src/runtime/runtime-store.js";
import "../src/runtime/context-coordinator.js";
import "../src/runtime/account-quota.js";
import "../src/runtime/room-events.js";
import "../src/runtime/invite-links.js";
import "../src/runtime/auth-world.js";
import "../src/runtime/view-loader.js";
import "../src/runtime/actions-workspace.js";
import "../src/runtime/global-search.js";
import "../src/runtime/search-focus.js";
import "../src/runtime/livekit-voice.js";
import "../src/runtime/data.js";
import "../src/runtime/actions.js";
import "../app.js";
