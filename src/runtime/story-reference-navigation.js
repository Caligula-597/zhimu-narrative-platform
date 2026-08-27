import { showToast } from "../components/toast.js";
import { studioStore, uiStore, worldStore } from "../state/index.js";
import { go } from "./runtime-facade.js";

/** Navigate from analysis references without coupling one lazy feature view to another. */
export function openStoryReference(type, id) {
  if (!type || !id) return;
  if (type === "clue") {
    uiStore.set({ cluesSelectedId: id, clueDetailTab: "detail" });
    go("clues");
    return;
  }
  if (["chapter", "scene", "item", "investigation_point"].includes(type)) {
    studioStore.set({ studioSelectedNode: { type, id }, studioAnchorEditing: false });
    go("studio");
    return;
  }
  if (type === "truth_claim") {
    worldStore.set({ truthBibleTab: "claims" });
    go("truth");
    return;
  }
  if (type === "segment") {
    worldStore.set({ cloudSelectedSegmentId: id });
    go("structure");
    return;
  }
  if (type === "role") {
    uiStore.set({ writerSelectedRoleId: id });
    go("writer");
    return;
  }
  if (type === "script_section") {
    const section = (studioStore.get().cloudStudio?.sections || []).find((item) => item.id === id);
    if (section?.role_slot_id) uiStore.set({ writerSelectedRoleId: section.role_slot_id });
    go("writer");
    return;
  }
  if (type === "rule") {
    go("rules");
    return;
  }
  if (type === "constitution") {
    go("creatorCockpit");
    return;
  }
  showToast("该诊断对象暂时没有独立编辑入口");
}
