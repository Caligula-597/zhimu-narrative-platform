/** Re-export — import from ./email/index.js in new code. */
export {
  clearTestEmailCapture,
  getEmailProvider,
  getPublicEmailServiceStatus,
  getEmailServiceStatus,
  isEmailConfigured,
  peekTestResetUrl,
  peekTestVerificationCode,
  peekTestVerifyUrl,
  publicAppUrl,
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
  sendTransactionalEmail,
  sendWorldMemberInviteEmail,
  peekTestInviteUrl
} from "./email/index.js";
