import { mountFeedbackButton } from "../components/feedback-button.js";
import { studioStore, userStore } from "../state/index.js";
import { initWebVitalsReporting } from "../../shared/web-vitals.js";

/** Start telemetry and the single authoritative authentication/data bootstrap. */
export function startApplication({ runtime, render }) {
  mountFeedbackButton();
  initWebVitalsReporting({ app: "app", endpoint: "/api/metrics/web-vitals" });

  const startupAuth = runtime.handleStartupAuthParams?.();
  Promise.resolve(startupAuth)
    .then(async () => {
      // Keep startup to one authoritative auth probe. A former module-load
      // probe raced this call and could overwrite a successful result.
      // World membership uses the same session and may be prefetched while
      // /auth/me resolves, but is not applied before the profile probe ends.
      const profilePromise = window.zhimuAuthSession?.syncProfile?.();
      runtime.prefetchWorlds?.();
      await profilePromise;
      window.zhimuAuthSession?.syncAuthBanner?.();
      return runtime.loadCloudData();
    })
    .catch((error) => {
      studioStore.set({ cloudLoading: false });
      userStore.set({ apiError: error.message || String(error) });
      render();
    })
    .finally(() => {
      if (!window.zhimuAuthSession?.isLoggedIn?.()) {
        window.zhimuAuthSession?.promptAuthIfNeeded?.();
      }
    });
}
