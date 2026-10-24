import { cleanEnvValue } from "@/lib/supabase/env";
import { checkSupabase, describeKey, describeUrl } from "@/lib/supabase/health";

const jwt = (payload: object) =>
  ["eyJhbGciOiJIUzI1NiJ9", Buffer.from(JSON.stringify(payload)).toString("base64url"), "signature"].join(".");

const ANON = jwt({ ref: "abcdefgh", role: "anon" });
const URL_OK = "https://abcdefgh.supabase.co";

describe("describeKey", () => {
  it("reads the project and role from a legacy JWT key without returning the key", () => {
    const info = describeKey(ANON);
    expect(info).toMatchObject({ kind: "legacy-jwt", projectRef: "abcdefgh", role: "anon", hasWhitespace: false });
    expect(JSON.stringify(info)).not.toContain(ANON);
  });

  it("recognises the newer key formats and missing keys", () => {
    expect(describeKey("sb_publishable_abc").kind).toBe("publishable");
    expect(describeKey("sb_secret_abc").kind).toBe("secret");
    expect(describeKey(undefined).kind).toBe("missing");
    expect(describeKey("   ").kind).toBe("missing");
  });

  it("flags quotes and stray whitespace", () => {
    expect(describeKey(`"${ANON}"`)).toMatchObject({ kind: "legacy-jwt", hasQuotes: true });
    expect(describeKey(`${ANON}\n`).hasWhitespace).toBe(true);
  });

  it("spots a pasted .env line, where the value starts with the variable name", () => {
    const info = describeKey(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON}`);
    expect(info).toMatchObject({ kind: "legacy-jwt", hasVariableName: true, projectRef: "abcdefgh" });
    expect(info.length).toBe(ANON.length + "NEXT_PUBLIC_SUPABASE_ANON_KEY=".length);
    expect(describeKey(ANON).hasVariableName).toBe(false);
  });
});

describe("cleanEnvValue", () => {
  it("strips a pasted variable name, quotes and spaces, and leaves good values alone", () => {
    expect(cleanEnvValue(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON}`)).toBe(ANON);
    expect(cleanEnvValue(` "${URL_OK}" \n`)).toBe(URL_OK);
    expect(cleanEnvValue(`NEXT_PUBLIC_SUPABASE_URL="${URL_OK}"`)).toBe(URL_OK);
    expect(cleanEnvValue(ANON)).toBe(ANON);
    expect(cleanEnvValue(URL_OK)).toBe(URL_OK);
    expect(cleanEnvValue("  ")).toBeUndefined();
    expect(cleanEnvValue(undefined)).toBeUndefined();
  });
});

describe("describeUrl", () => {
  it("pulls the project ref out of a Supabase URL", () => {
    expect(describeUrl(URL_OK)).toMatchObject({ valid: true, host: "abcdefgh.supabase.co", projectRef: "abcdefgh" });
    expect(describeUrl("sb_publishable_abc").valid).toBe(false);
    expect(describeUrl(undefined).valid).toBe(false);
  });
});

describe("checkSupabase", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  const respond = (status: number, body: object = {}) => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })) as typeof fetch;
  };

  it("passes when Supabase accepts the URL and key", async () => {
    respond(200);
    const report = await checkSupabase(URL_OK, ANON);
    expect(report).toMatchObject({ ok: true, problems: [], supabase: { status: 200 } });
  });

  it("explains a key from a different project", async () => {
    respond(401, { message: "Invalid API key" });
    const report = await checkSupabase("https://zzzzzzzz.supabase.co", ANON);
    expect(report.ok).toBe(false);
    expect(report.problems.join(" ")).toMatch(/belongs to project abcdefgh, but the URL points to zzzzzzzz/);
    expect(report.supabase).toEqual({ status: 401, message: "Invalid API key" });
  });

  it("works around a pasted .env line but still warns about it", async () => {
    respond(200);
    const report = await checkSupabase(URL_OK, `NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON}`);
    expect(report).toMatchObject({ ok: true, problems: [], key: { hasVariableName: true, projectRef: "abcdefgh" } });
    expect(report.warnings.join(" ")).toMatch(/starts with its variable name/);
    // Supabase gets the cleaned key, not the pasted line.
    expect((global.fetch as jest.Mock).mock.calls[0][1].headers.apikey).toBe(ANON);
  });

  it("warns about a service_role key and doesn't call Supabase without a key", async () => {
    respond(200);
    expect((await checkSupabase(URL_OK, jwt({ ref: "abcdefgh", role: "service_role" }))).problems.join(" ")).toMatch(
      /service_role/,
    );
    const missing = await checkSupabase(URL_OK, undefined);
    expect(missing.problems).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
