/** WAI-ARIA horizontal tablist keyboard navigation with automatic activation. */
export function handleHorizontalTablistKeydown(event, {
  tabSelector = '[role="tab"]',
} = {}) {
  const tab = event?.target?.closest?.(tabSelector);
  const tablist = tab?.closest?.('[role="tablist"]');
  if (!tab || !tablist) return false;
  const tabs = Array.from(tablist.querySelectorAll(tabSelector)).filter((item) => !item.disabled);
  const index = tabs.indexOf(tab);
  if (index < 0) return false;
  let target = null;
  if (event.key === "ArrowRight") target = tabs[(index + 1) % tabs.length];
  else if (event.key === "ArrowLeft") target = tabs[(index - 1 + tabs.length) % tabs.length];
  else if (event.key === "Home") target = tabs[0];
  else if (event.key === "End") target = tabs.at(-1);
  if (!target) return false;
  event.preventDefault();
  target.focus();
  target.click();
  return true;
}
