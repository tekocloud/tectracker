import { describe, expect, it, vi } from "vitest";
import { initial, uid } from "./core";

describe("IDs im Browser", () => {
  it("erzeugt eindeutige UUIDs auch ohne die HTTPS-only randomUUID-API", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: crypto.getRandomValues.bind(crypto),
    });
    try {
      const ids = Array.from({ length: 100 }, uid);
      expect(new Set(ids).size).toBe(100);
      for (const id of ids)
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(initial().profiles[0].id).toMatch(/^[0-9a-f-]{36}$/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
