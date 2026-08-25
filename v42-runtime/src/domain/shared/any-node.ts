import { z } from "zod";
import { SettingNodeSchema } from "../setting/setting.js";
import { SpaceNodeSchema } from "../space/space.js";
import {
  BackgroundNodeSchema,
  CharacterNodeSchema,
  SituationNodeSchema
} from "../character/character.js";
import { MotivationNodeSchema } from "../motivation/motivation.js";
import { ObjectiveNodeSchema } from "../objective/objective.js";
import { PlotEventNodeSchema } from "../plot/plot-event.js";
import { MechanicNodeSchema } from "../mechanic/mechanic.js";
import { FactNodeSchema, KnowledgeNodeSchema } from "../knowledge/knowledge.js";
import { GMRuleNodeSchema } from "../gm/gm-rule.js";
import { NarrativeSectionSchema } from "../narrative/narrative-section.js";
import { BaseNodeSchema } from "../shared/base-node.js";

const ObjectNodeSchema = BaseNodeSchema.extend({ type: z.literal("object") });
const ResolutionNodeSchema = BaseNodeSchema.extend({
  type: z.literal("resolution")
});

export const AnyDesignNodeSchema = z.discriminatedUnion("type", [
  SettingNodeSchema,
  SpaceNodeSchema,
  CharacterNodeSchema,
  BackgroundNodeSchema,
  SituationNodeSchema,
  MotivationNodeSchema,
  ObjectiveNodeSchema,
  PlotEventNodeSchema,
  MechanicNodeSchema,
  FactNodeSchema,
  KnowledgeNodeSchema,
  GMRuleNodeSchema,
  NarrativeSectionSchema,
  ObjectNodeSchema,
  ResolutionNodeSchema
]);
export type AnyDesignNode = z.infer<typeof AnyDesignNodeSchema>;
