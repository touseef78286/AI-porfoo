import { describe, expect, it } from "vitest";

import { CORE_PACKAGE_NAME } from "../src/index.js";

describe("@lpi/core scaffold", () => {
  it("exposes its package identity", () => {
    expect(CORE_PACKAGE_NAME).toBe("@lpi/core");
  });
});
