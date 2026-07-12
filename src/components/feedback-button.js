/** Global feedback button + modal form for bug reports, feature requests, and general feedback. */
import { request } from "../api/client.js";
import { modal, modalBackdrop } from "../dom.js";
import { escapeHtml } from "../utils/format.js";
import { closeModal } from "./modal.js";
import { showToast } from "./toast.js";
import { setHtml } from "../../shared/safe-dom.js";

const FEEDBACK_KINDS = [
  { id: "feedback", label: "反馈" },
  { id: "bug", label: "Bug 报告" },
  { id: "feature", label: "功能建议" }
];

let buttonEl = null;

export function openFeedbackForm(prefillKind = "feedback", prefillSubject = "", prefillBody = "") {
  const selectedKind = FEEDBACK_KINDS.some((kind) => kind.id === prefillKind) ? prefillKind : "feedback";
  const kindOptions = FEEDBACK_KINDS
    .map((k) => `<option value="${k.id}"${k.id === selectedKind ? " selected" : ""}>${escapeHtml(k.label)}</option>`)
    .join("");
  const subjectValue = escapeHtml(prefillSubject);
  const bodyValue = escapeHtml(prefillBody);

  modal.className = "modal feedback-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "feedback-title");
  setHtml(modal, `
    <h2 id="feedback-title">提交反馈</h2>
    <p class="muted">遇到问题或有想法？告诉我们，我们会认真对待每一条。</p>
    <div class="form-group">
      <label for="feedback-kind">类型</label>
      <select class="field" id="feedback-kind" data-feedback-field="kind">${kindOptions}</select>
      <label for="feedback-subject">主题</label>
      <input class="field" id="feedback-subject" data-feedback-field="subject" value="${subjectValue}" placeholder="一句话描述" maxlength="200">
      <label for="feedback-body">详情</label>
      <textarea class="field" id="feedback-body" data-feedback-field="body" rows="5" placeholder="详细描述你遇到的问题或建议…" maxlength="4000">${bodyValue}</textarea>
    </div>
    <div class="modal-actions">
      <button class="secondary-btn" data-close>取消</button>
      <button class="primary-btn" data-feedback-submit>提交</button>
    </div>`);
  modalBackdrop.classList.add("show");

  modal.querySelector("[data-close]").onclick = closeModal;
  modal.querySelector("[data-feedback-field='subject']")?.focus();
  modal.querySelector("[data-feedback-submit]").onclick = async () => {
    const fields = Object.fromEntries(
      Array.from(modal.querySelectorAll("[data-feedback-field]")).map((el) => [el.dataset.feedbackField, el.value.trim()])
    );
    if (!fields.subject || !fields.body) {
      showToast("请填写主题和详情");
      return;
    }
    const submitBtn = modal.querySelector("[data-feedback-submit]");
    submitBtn.disabled = true;
    submitBtn.setAttribute("aria-busy", "true");
    submitBtn.textContent = "提交中…";
    try {
      await request("/feedback", {
        method: "POST",
        body: {
          kind: fields.kind || "feedback",
          subject: fields.subject,
          body: fields.body,
          pageUrl: window.location.href,
          userAgent: navigator.userAgent
        }
      });
      closeModal();
      showToast("反馈已提交，感谢你的支持");
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.removeAttribute("aria-busy");
      submitBtn.textContent = "提交";
      showToast("提交失败，请稍后重试");
    }
  };
}

export function mountFeedbackButton() {
  if (buttonEl) return;
  buttonEl = document.createElement("button");
  buttonEl.className = "feedback-fab";
  buttonEl.type = "button";
  buttonEl.setAttribute("aria-label", "提交反馈");
  buttonEl.dataset.feedbackMounted = "true";
  setHtml(buttonEl, `<span aria-hidden="true">?</span><b>反馈</b>`);
  buttonEl.onclick = () => openFeedbackForm();
  document.body.appendChild(buttonEl);
}
