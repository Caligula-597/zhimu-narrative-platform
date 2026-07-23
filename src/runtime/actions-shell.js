import { openFeedbackForm } from "../components/feedback-button.js";
import * as modal from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { callRuntime } from "./runtime-facade.js";

const openModal = modal.openModal || (() => {});

export function handleShellAction(action, el) {
  if (action === "save-node" || action === "save-settings") {
    return showToast("配置已保存");
  }
  if (action === "explore") {
    return openModal(
      "调查进行中",
      `你开始调查「${el.dataset.place}」。系统将根据角色状态、持有物品和已解读线索展示可发现的内容。`,
      "确认调查"
    );
  }
  if (action === "export") return showToast("世界数据已准备导出");
  if (action === "token") return showToast("实体小卡功能暂不可用");
  if (action === "open-wizard") return callRuntime("openWizard");
  if (action === "open-creator-guide") return window.zhimuGuide?.openCreatorGuide?.();
  if (action === "open-error-guide") return window.zhimuGuide?.openErrorGuide?.();
  if (action === "report-issue") {
    const subject = el?.dataset?.reportSubject || "";
    const body = el?.dataset?.reportBody || "";
    return openFeedbackForm("bug", subject, body);
  }
  if (action === "unavailable") {
    return showToast(`${el.dataset.feature || "该功能"}暂不可用`);
  }
  return undefined;
}
