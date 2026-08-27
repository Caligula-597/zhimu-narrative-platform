import assert from "node:assert/strict";
import test from "node:test";
import { previewOpeningPackage } from "../src/opening-package-service.js";

test("opening package preview requires rights confirmation", async () => {
  await assert.rejects(
    () => previewOpeningPackage({
      creationType: "murder_mystery",
      hostHandbook: { filename: "host.docx", contentBase64: "dGVzdA==" }
    }),
    (error) => error?.code === "IMPORT_RIGHTS_CONFIRMATION_REQUIRED"
  );
});

test("opening package preview requires host handbook file", async () => {
  await assert.rejects(
    () => previewOpeningPackage({
      creationType: "murder_mystery",
      rightsConfirmed: true
    }),
    (error) => error?.code === "OPENING_PACKAGE_HOST_REQUIRED"
  );
});
