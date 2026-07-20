import { registerCreatorChapterRoutes } from "./creator-chapter-routes.js";
import { registerCreatorDocumentRoutes } from "./creator-document-routes.js";
import { registerCreatorRoleRoutes } from "./creator-role-routes.js";
import { registerCreatorReviewRoutes } from "./creator-review-routes.js";
import { registerCreatorRoomRoutes } from "./creator-room-routes.js";
import { registerCreatorSectionRoutes } from "./creator-section-routes.js";

export async function registerCreatorRoutes(app) {
  await registerCreatorDocumentRoutes(app);
  await registerCreatorReviewRoutes(app);
  await registerCreatorRoleRoutes(app);
  await registerCreatorChapterRoutes(app);
  await registerCreatorSectionRoutes(app);
  await registerCreatorRoomRoutes(app);
}
