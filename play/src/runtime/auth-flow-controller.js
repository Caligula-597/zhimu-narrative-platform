import { revokeSessionForLogout } from "../../../shared/auth-state.js";

export function createAuthFlowController(ctx) {
  const {
    api, state, render, setBusy, setToast, formatApiError, setSessionToken,
    clearSession, cleanAuthUrl, normalizeUser, refreshHome, handleLookupInvite,
    syncPlatformStream, ensureSession, getPlayOrigin, isSafeOAuthRedirectUrl,
    allowedOAuthProviders, resetVoiceOnLeave, disconnectRoomEvents,
    disconnectPlatformEvents, roomEventCtx, platformEventCtx, persistRoom,
    isUuid, windowRef = window, random = Math.random
  } = ctx;

  async function handleEmailVerify(token) {
    const result = await api.verifyEmail(token);
    if (result.token) setSessionToken(result.token);
    state.user = normalizeUser(result.user);
    cleanAuthUrl();
    setToast("邮箱已验证，可以使用社区功能了", render);
  }

  async function handleForgotSubmit(form) {
    const email = form.email.value.trim();
    await runBusy(async () => {
      await api.forgotPassword(email);
      setToast("若该邮箱已注册，重置链接已发送，请查收邮件", render);
      state.authMode = "login";
      render();
    }, "发送失败");
  }

  async function handleResetSubmit(form) {
    const password = form.password.value;
    if (!state.resetToken) return setToast("重置链接无效", render);
    await runBusy(async () => {
      await api.resetPassword(state.resetToken, password);
      state.authMode = "login";
      state.resetToken = "";
      cleanAuthUrl();
      setToast("密码已更新，请使用新密码登录", render);
      render();
    }, "重置失败");
  }

  async function handleResendVerification() {
    await runBusy(async () => {
      if (state.authMode === "verify") {
        const result = await api.resendVerificationCode(
          state.pendingVerificationChallenge?.id || ""
        );
        state.pendingVerificationChallenge =
          result.verificationChallenge || state.pendingVerificationChallenge;
        setToast("新的邮箱验证码已发送，请查收", render);
        render();
        return;
      }
      await api.resendVerification();
      setToast("验证邮件已发送，请查收", render);
    }, "发送失败");
  }

  async function finishLogin(result, welcomeFallback) {
    setSessionToken(result.token);
    state.user = normalizeUser(result.user);
    state.view = state.roomId ? "game" : (state.joinPreview ? "join" : "landing");
    cleanAuthUrl();
    if (state.roomId) await refreshHome();
    else if (state.inviteCode && !state.joinPreview) await handleLookupInvite({ silent: true }).catch(() => {});
    setToast(`欢迎，${state.user?.displayName || result.user?.displayName || result.user?.email || welcomeFallback}`, render);
    syncPlatformStream();
  }

  async function handleGuestSubmit(form) {
    const customName = form.displayName?.value?.trim() || "";
    const displayName = customName || `玩家${Math.floor(random() * 9000 + 1000)}`;
    await runBusy(async () => finishLogin(await api.guest(displayName), "访客"), "访客登录失败");
  }

  async function handleAuthSubmit(form) {
    const email = form.email.value.trim();
    const password = form.password.value;
    const displayName = form.displayName?.value?.trim() || "";
    await runBusy(async () => {
      const result = state.authMode === "register"
        ? await api.register(email, displayName, password)
        : await api.login(email, password);
      if (result.pendingEmailVerification) {
        if (result.token) setSessionToken(result.token);
        state.pendingVerificationEmail = email;
        state.pendingVerificationChallenge = result.verificationChallenge || null;
        state.authMode = "verify";
        setToast(
          result.verificationEmailSent === false
            ? "账号已创建，可尝试重新发送验证码"
            : "验证码已发送，请完成邮箱验证",
          render
        );
        render();
        return;
      }
      await finishLogin(result, "玩家");
    }, "登录失败");
  }

  async function handleVerificationSubmit(form) {
    const challengeId = state.pendingVerificationChallenge?.id;
    const code = String(form.code?.value || "").replace(/\D/g, "").slice(0, 6);
    if (!challengeId || !/^\d{6}$/.test(code)) {
      setToast("请输入 6 位邮箱验证码", render);
      return;
    }
    await runBusy(async () => {
      const result = await api.verifyEmailCode(challengeId, code);
      state.pendingVerificationEmail = "";
      state.pendingVerificationChallenge = null;
      await finishLogin(result, "玩家");
      setToast("邮箱验证成功，已自动登录玩家端", render);
    }, "邮箱验证码无效或已过期");
  }

  async function handleOAuth(provider) {
    if (!allowedOAuthProviders.has(provider)) {
      setToast("不支持的登录方式", render);
      return;
    }
    setBusy(true, render);
    try {
      await ensureSession();
      const { url } = await api.oauthStartUrl(provider, getPlayOrigin());
      if (!isSafeOAuthRedirectUrl(url)) throw new Error("OAuth 跳转地址无效");
      windowRef.location.assign(url);
    } catch (error) {
      setToast(error.message || "OAuth 暂不可用", render);
      setBusy(false, render);
    }
  }

  async function handleLogout() {
    try {
      await revokeSessionForLogout(api.logout);
    } catch (error) {
      setToast(formatApiError(error, "退出登录失败，请检查网络后重试"), render);
      return;
    }
    await resetVoiceOnLeave();
    disconnectRoomEvents(roomEventCtx);
    disconnectPlatformEvents(platformEventCtx);
    clearSession();
    persistRoom("", isUuid);
    state.home = null;
    state.user = null;
    state.view = "landing";
    render();
  }

  async function runBusy(operation, fallback) {
    setBusy(true, render);
    try {
      await operation();
    } catch (error) {
      setToast(formatApiError(error, fallback), render);
    } finally {
      setBusy(false, render);
    }
  }

  return {
    handleEmailVerify, handleForgotSubmit, handleResetSubmit,
    handleResendVerification, handleGuestSubmit, handleAuthSubmit,
    handleVerificationSubmit,
    handleOAuth, handleLogout
  };
}
