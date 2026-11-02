import { describe, expect, it } from "vitest";
import { evaluateGate } from "../../src/server/analysis";
import { DICTIONARIES } from "../../src/app/i18n";
import { STAGE_IDS } from "../../src/shared/model";
import { item, snapshot } from "../analysis/fixture";

describe("gate check labels", () => {
  it("every gate check id has an EN and RU label", () => {
    const s = snapshot();
    item(s, "BR-1", "requirement", { priority: "must", kind: "business" });
    item(s, "CR-1", "change");
    for (const stage of STAGE_IDS) {
      for (const check of evaluateGate(s, stage).checks) {
        for (const dictionary of [DICTIONARIES.en, DICTIONARIES.ru]) {
          expect(Object.keys(dictionary), `${stage}: gate_${check.id}`).toContain(`gate_${check.id}`);
        }
      }
    }
  });
});
