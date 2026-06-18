import { JOIN_STEPS } from "../constants.js";

export function renderStepper(activeStep) {
  return `
    <ol class="stepper" aria-label="加入流程">
      ${JOIN_STEPS.map((step) => {
        const done = activeStep > step.id;
        const active = activeStep === step.id;
        return `
          <li class="stepper-item ${done ? "is-done" : ""} ${active ? "is-active" : ""}">
            <span class="stepper-dot">${done ? "✓" : step.id}</span>
            <div>
              <strong>${step.label}</strong>
              <small>${step.hint}</small>
            </div>
          </li>`;
      }).join("")}
    </ol>`;
}
