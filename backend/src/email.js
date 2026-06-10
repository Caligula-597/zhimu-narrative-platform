/** Re-export — import from ./email/index.js in new code. */
export {
  clearTestEmailCapture,
  clearTestResetCapture,
  getEmailProvider,
  getEmailServiceStatus,
  isEmailConfigured,
  isResendConfigured,
  peekTestResetUrl,
  peekTestVerifyUrl,
  publicAppUrl,
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
  sendTransactionalEmail,
  sendWorldMemberInviteEmail,
  peekTestInviteUrl
} from "./email/index.js";
