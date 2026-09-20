import { maskToken } from "./mcp-token";

describe("maskToken", () => {
  it("keeps a recognised prefix and the last four characters, masking the rest with a fixed number of bullets", () => {
    expect(maskToken("ua_abcdefgh1234")).toBe("ua_••••••••1234");
  });

  it("does not vary the number of bullets with the token's real length", () => {
    const short = maskToken("ua_ab1234");
    const long = maskToken("ua_abcdefghijklmnopqrstuvwxyz1234");
    expect(short.replace(/[^•]/g, "").length).toBe(long.replace(/[^•]/g, "").length);
  });

  it("masks a token with no recognisable prefix the same way", () => {
    expect(maskToken("abcdefgh1234")).toBe("••••••••1234");
  });

  it("never reveals a short token in full", () => {
    const masked = maskToken("ab");
    expect(masked).not.toContain("ab");
  });
});
