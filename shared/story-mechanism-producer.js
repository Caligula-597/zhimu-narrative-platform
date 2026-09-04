/**
 * @deprecated 请使用 story-mechanism-engine.js
 * 兼容层：旧 import 路径继续可用。
 */

export {
  StoryMechanismEngineError as StoryMechanismProducerError,
  generateStoryMechanism,
  generateM01Framing,
  acceptStoryBlock,
  swapStoryVariant,
  swapStorySlot,
  editStorySlot,
  lockStorySlot,
  replaceStoryBlock,
  removeStoryBlock,
  createDemoProjectState,
  replaceStoryBlock as writeBackBlock,
} from "./story-mechanism-engine.js";
