const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || "https://app.getzhimu.com";

const header = document.querySelector("[data-header]");
const menuButton = document.querySelector("[data-menu-button]");
const nav = document.querySelector("[data-nav]");
const betaForm = document.querySelector("[data-beta-form]");
const formStatus = document.querySelector("[data-form-status]");
const workflowList = document.querySelector("[data-workflow-list]");
const workflowSteps = [...document.querySelectorAll("[data-workflow-step]")];

function updateHeader() {
  header?.classList.toggle("is-scrolled", window.scrollY > 10);
}

function applySiteLinks(links = {}) {
  if (!links.register && !links.creatorApp && !links.login && !links.officialExample && !links.playerJoin) {
    return;
  }

  const creatorHref = links.creatorApp || links.register;

  document.querySelectorAll("[data-link-register]").forEach((node) => {
    if (links.register) node.setAttribute("href", links.register);
  });
  document.querySelectorAll("[data-link-creator]").forEach((node) => {
    if (creatorHref) node.setAttribute("href", creatorHref);
  });
  document.querySelectorAll("[data-link-login]").forEach((node) => {
    if (links.login) node.setAttribute("href", links.login);
  });
  document.querySelectorAll("[data-link-official]").forEach((node) => {
    if (links.officialExample) node.setAttribute("href", links.officialExample);
  });
  document.querySelectorAll("[data-link-play]").forEach((node) => {
    if (links.playerJoin) node.setAttribute("href", links.playerJoin);
  });
}

async function loadSiteBootstrap() {
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return;

  try {
    const response = await fetch(`${API_ORIGIN}/api/platform/site`);
    if (!response.ok) return;
    const payload = await response.json();
    applySiteLinks(payload.links);
    if (payload.beta?.acceptingApplications === false && formStatus) {
      formStatus.textContent = "内测申请暂未开放，可先直接注册体验。";
    }
  } catch {
    // Static fallback links are already present in the HTML.
  }
}

function updateWorkflowState() {
  if (!workflowList || !workflowSteps.length) return;

  const rect = workflowList.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const visibleProgress = (viewportHeight * 0.72 - rect.top) / Math.max(rect.height, 1);
  const activeCount = Math.max(0, Math.min(workflowSteps.length, Math.ceil(visibleProgress * workflowSteps.length)));

  workflowSteps.forEach((step, index) => {
    step.classList.toggle("is-active", index < activeCount);
  });
}

menuButton?.addEventListener("click", () => {
  const isOpen = nav?.classList.toggle("is-open");
  menuButton.setAttribute("aria-expanded", String(Boolean(isOpen)));
});

nav?.addEventListener("click", () => {
  nav.classList.remove("is-open");
  menuButton?.setAttribute("aria-expanded", "false");
});

window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();
loadSiteBootstrap();

if (workflowList && workflowSteps.length) {
  const workflowRevealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          workflowList.classList.add("is-visible");
        }
      });
    },
    { threshold: 0.22 }
  );

  workflowRevealObserver.observe(workflowList);
  window.addEventListener("scroll", updateWorkflowState, { passive: true });
  window.addEventListener("resize", updateWorkflowState);
  updateWorkflowState();
}

betaForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  betaForm.classList.add("is-submitting");
  formStatus.textContent = "正在提交...";

  const formData = new FormData(betaForm);
  const scale = String(formData.get("scale") || "").trim();
  const payload = {
    email: String(formData.get("email") || "").trim(),
    displayName: String(formData.get("displayName") || "").trim(),
    roleIntent: String(formData.get("roleIntent") || "creator").trim(),
    useCase: String(formData.get("useCase") || "").trim(),
    referralSource: scale ? `预计规模：${scale}` : "",
    contact: String(formData.get("contact") || "").trim(),
    companyWebsite: String(formData.get("companyWebsite") || "").trim()
  };

  try {
    const response = await fetch(`${API_ORIGIN}/api/platform/beta/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        body.code === "BETA_APPLICATION_PENDING"
          ? "该邮箱已有待审申请，请勿重复提交。"
          : body.error || `提交失败（${response.status}）`;
      throw new Error(message);
    }

    formStatus.textContent = body.message || "已收到，后续会按内测节奏联系你。";
    betaForm.reset();
  } catch (error) {
    formStatus.textContent =
      error.message ||
      "暂时没能提交到内测接口。你也可以直接注册，或发邮件到 support@getzhimu.com。";
  } finally {
    betaForm.classList.remove("is-submitting");
  }
});
