/** Re-export surface for main.js and tests — views live under ./views, chrome under ./components */
export { renderApp } from "./components/shell.js";
export { renderHeader } from "./components/header.js";
export { renderStepper } from "./components/stepper.js";
export { renderLanding } from "./views/landing.js";
export { renderJoin } from "./views/join.js";
export { renderLobby } from "./views/lobby.js";
export { renderPlaza, renderPlazaThread } from "./views/plaza.js";
export { renderFriends, renderMessages, renderDm } from "./views/social.js";
export { renderAuth } from "./views/auth.js";
export { renderGame, renderGameHome, renderSections, renderClues, renderExploration, renderInventory } from "./views/game.js";
export { renderVoiceTab, renderVoiceHub, renderVoiceChat } from "./views/voice.js";
