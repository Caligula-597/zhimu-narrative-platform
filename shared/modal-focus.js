const DEFAULT_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

let generatedDialogId = 0;

function escapeAttribute(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function focusReturnTarget(element) {
  const candidate = element?.closest?.(DEFAULT_FOCUSABLE_SELECTOR) || element;
  if (!candidate || candidate === document.body || candidate === document.documentElement) return null;
  if (candidate.id) {
    return { element: candidate, id: candidate.id, selector: "" };
  }

  const attributes = ["data-action", "data-view", "data-clue-id", "data-room-id", "name", "href"];
  const selector = attributes
    .filter((name) => candidate.hasAttribute?.(name))
    .map((name) => `[${name}="${escapeAttribute(candidate.getAttribute(name))}"]`)
    .join("");
  return {
    element: candidate,
    selector: selector ? `${candidate.localName || ""}${selector}` : ""
  };
}

function restoreFocus(target) {
  let element = null;
  if (target?.element?.isConnected) element = target.element;
  else if (target?.id) element = document.getElementById(target.id);
  else if (target?.selector) element = document.querySelector(target.selector);
  element?.focus?.({ preventScroll: true });
}

function isFocusableVisible(element) {
  if (!element || element.hidden || element.getAttribute("aria-hidden") === "true") return false;
  if (typeof element.getClientRects === "function" && element.getClientRects().length === 0) return false;
  return true;
}

function focusableElements(dialog) {
  return [...(dialog?.querySelectorAll(DEFAULT_FOCUSABLE_SELECTOR) || [])].filter(isFocusableVisible);
}

function ensureDialogSemantics(dialog, titleIdPrefix) {
  if (!dialog) return;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  if (!dialog.hasAttribute("tabindex")) dialog.setAttribute("tabindex", "-1");

  if (dialog.hasAttribute("aria-label")) return;
  const labelledBy = dialog.getAttribute("aria-labelledby")?.trim();
  if (labelledBy && labelledBy.split(/\s+/).every((id) => document.getElementById(id))) return;
  if (labelledBy) dialog.removeAttribute("aria-labelledby");
  const heading = dialog.querySelector("h1, h2, h3");
  if (!heading) {
    dialog.setAttribute("aria-label", "对话框");
    return;
  }
  if (!heading.id) {
    generatedDialogId += 1;
    heading.id = `${titleIdPrefix}-${generatedDialogId}`;
  }
  dialog.setAttribute("aria-labelledby", heading.id);
}

/**
 * Keeps modal focus inside the active dialog and restores it after close.
 * Call beforeRender()/afterRender() around full-DOM renders, or sync() after a
 * class-based modal is opened or closed.
 */
export function createModalFocusController({
  backdropSelector,
  dialogSelector = "[role='dialog'], .modal",
  closeSelector = "[data-close]",
  titleIdPrefix = "modal-title",
  onEscape
}) {
  let open = Boolean(document.querySelector(backdropSelector));
  let returnTarget = null;

  const getBackdrop = () => document.querySelector(backdropSelector);
  const getDialog = () => getBackdrop()?.querySelector(dialogSelector) || null;

  function focusDialog(dialog) {
    const target = focusableElements(dialog)[0] || dialog;
    requestAnimationFrame(() => {
      if (dialog?.contains(document.activeElement) && isFocusableVisible(document.activeElement)) return;
      target?.focus?.({ preventScroll: true });
    });
  }

  function transition(nextOpen, previousOpen, openingTarget = null) {
    if (nextOpen) {
      const dialog = getDialog();
      ensureDialogSemantics(dialog, titleIdPrefix);
      if (!previousOpen) {
        returnTarget = openingTarget || focusReturnTarget(document.activeElement);
        focusDialog(dialog);
      }
    } else if (previousOpen) {
      requestAnimationFrame(() => restoreFocus(returnTarget));
      returnTarget = null;
    }
    open = nextOpen;
  }

  function sync() {
    transition(Boolean(getBackdrop()), open);
  }

  function beforeRender() {
    return {
      wasOpen: open,
      activeTarget: focusReturnTarget(document.activeElement)
    };
  }

  function afterRender(snapshot) {
    transition(Boolean(getBackdrop()), Boolean(snapshot?.wasOpen), snapshot?.activeTarget || null);
  }

  function handleKeydown(event) {
    if (!open) return;
    const dialog = getDialog();
    if (!dialog) return;

    if (event.key === "Escape") {
      event.preventDefault();
      if (typeof onEscape === "function") onEscape();
      else dialog.querySelector(closeSelector)?.click?.();
      return;
    }

    if (event.key !== "Tab") return;
    const focusables = focusableElements(dialog);
    if (!focusables.length) {
      event.preventDefault();
      dialog.focus?.({ preventScroll: true });
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!dialog.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  document.addEventListener("keydown", handleKeydown);

  return {
    afterRender,
    beforeRender,
    destroy: () => document.removeEventListener("keydown", handleKeydown),
    sync
  };
}
