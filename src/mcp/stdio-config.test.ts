import { loadConfig, MissingTokenError } from "./stdio-config";

describe("stdio loadConfig", () => {
  it("throws MissingTokenError naming UNIVERSAL_API_TOKEN when it isn't set", () => {
    expect(() => loadConfig({})).toThrow(MissingTokenError);
    expect(() => loadConfig({})).toThrow(/UNIVERSAL_API_TOKEN/);
  });

  it("defaults UNIVERSAL_API_URL to http://localhost:3000", () => {
    const config = loadConfig({ UNIVERSAL_API_TOKEN: "secret" });
    expect(config).toEqual({ baseUrl: "http://localhost:3000", token: "secret" });
  });

  it("uses UNIVERSAL_API_URL when it's set", () => {
    const config = loadConfig({ UNIVERSAL_API_TOKEN: "secret", UNIVERSAL_API_URL: "https://example.com" });
    expect(config).toEqual({ baseUrl: "https://example.com", token: "secret" });
  });
});
