/**
 * Vite entry — import order mirrors legacy index.html script chain.
 * Each module still attaches to window.*; this file only defines load order.
 */
import "../config.js";
import "../src/dom.js";
import "../src/state.js";
import "../src/utils/user-messages.js";
import "../src/utils/wizard-automation-templates.js";
import "../src/api/client.js";
import "../rule-visual.js";
import "../src/utils/format.js";
import "../src/components/emptyState.js";
import "../src/components/toast.js";
import "../src/components/modal.js";
import "../src/components/creator-guide.js";
import "../src/views/overview.js";
import "../src/views/writer.js";
import "../src/views/studio.js";
import "../src/views/assets.js";
import "../src/views/rules.js";
import "../src/views/director.js";
import "../src/views/player.js";
import "../src/views/archive.js";
import "../src/views/settings.js";
import "../src/runtime/wizard.js";
import "../src/runtime/auth-world.js";
import "../src/runtime/auth-session.js";
import "../src/runtime/global-search.js";
import "../src/runtime/livekit-voice.js";
import "../src/runtime/data.js";
import "../src/runtime/actions.js";
import "../app.js";
