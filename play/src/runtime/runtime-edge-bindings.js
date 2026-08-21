import { createAdaptivePoller } from "../../../shared/adaptive-poller.js";
import { handleHorizontalTablistKeydown } from "../../../shared/tablist-keyboard.js";
import { tickPlayerPaceClock } from "./player-pace-clock.js";

export function bindPlayRuntimeEdges({
  app,
  windowRef,
  state,
  render,
  syncPlayerDiscovery,
  setVoiceRenderCallback,
  subscribeSessionToken,
  loadSessionUser,
  handleAuthLost,
  syncRoomStream,
  createPacePoller = createAdaptivePoller,
  paceTick = tickPlayerPaceClock,
  tabKeydown = handleHorizontalTablistKeydown,
}) {
  const renderStage = () => render();
  const handleDiscoveryAction = (event) => {
    void syncPlayerDiscovery(event.detail)
      .then((session) => event.detail?.resolve?.(session))
      .catch((error) => event.detail?.reject?.(error));
  };
  const handleTabKeydown = (event) => tabKeydown(event);

  windowRef.addEventListener("zhimu:tabletop-stage-ready", renderStage);
  windowRef.addEventListener("zhimu:tabletop-discovery-ready", renderStage);
  windowRef.addEventListener("zhimu:tabletop-discovery-action", handleDiscoveryAction);
  app.addEventListener("keydown", handleTabKeydown);

  const paceTicker = createPacePoller({
    run: () => paceTick(state.paceClock),
    intervalMs: 1000,
    maxIntervalMs: 1000,
    jitterRatio: 0,
  });
  paceTicker.start({ immediate: false });
  setVoiceRenderCallback(render);

  let externalSessionGeneration = 0;
  const unsubscribeSession = subscribeSessionToken(async (change) => {
    if (change.source !== "storage" && change.source !== "rejected") return;
    const generation = ++externalSessionGeneration;
    if (!change.token) {
      handleAuthLost();
      return;
    }
    await loadSessionUser();
    if (generation !== externalSessionGeneration || !state.user) return;
    syncRoomStream({ force: true });
    render();
  });

  return () => {
    windowRef.removeEventListener("zhimu:tabletop-stage-ready", renderStage);
    windowRef.removeEventListener("zhimu:tabletop-discovery-ready", renderStage);
    windowRef.removeEventListener("zhimu:tabletop-discovery-action", handleDiscoveryAction);
    app.removeEventListener("keydown", handleTabKeydown);
    paceTicker.stop?.();
    unsubscribeSession?.();
  };
}
