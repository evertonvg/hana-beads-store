import { sealData } from "iron-session";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "unit-secret-unit-secret-unit-secret-00";

const { currentUser } = vi.hoisted(() => ({ currentUser: vi.fn() }));

vi.mock("next/server", () => ({ connection: () => Promise.resolve() }));
vi.mock("@/lib/data", () => ({ getData: () => ({ auth: { currentUser } }) }));

import {
  clearSession,
  readSession,
  userIdFromSeal,
  writeSession,
} from "@/lib/data/mock/session-cookie";
import { getSession } from "@/lib/session";
import { memoryCookies } from "./memory-cookies";

const ana = { id: "ana", name: "Ana", email: "ana@teste.dev" };
const seal = (data: object) => sealData(data, { password: SECRET });
const inOneHour = () => Date.now() + 60 * 60 * 1000;

afterEach(() => vi.unstubAllEnvs());

describe("getSession", () => {
  beforeEach(() => currentUser.mockReset());

  it("returns the adapter's current user", async () => {
    currentUser.mockResolvedValue(ana);
    expect(await getSession()).toEqual(ana);
  });

  it("is null when the adapter has no session", async () => {
    currentUser.mockResolvedValue(null);
    expect(await getSession()).toBeNull();
  });
});

describe("mock session cookie", () => {
  it("is null without a cookie", async () => {
    expect(await readSession(memoryCookies())).toBeNull();
  });

  it("reads back what it wrote, then clear removes it", async () => {
    const cookies = memoryCookies();
    await writeSession(cookies, "ana", false);
    expect(await readSession(cookies)).toBe("ana");
    expect(await userIdFromSeal(cookies.get("pp_session")?.value)).toBe("ana");
    await clearSession(cookies);
    expect(await readSession(cookies)).toBeNull();
  });

  it("is null when one character of the seal changed", async () => {
    const value = await seal({ userId: "ana", expiresAt: inOneHour() });
    const i = Math.floor(value.indexOf("~") / 2);
    const tampered = `${value.slice(0, i)}${value[i] === "A" ? "B" : "A"}${value.slice(i + 1)}`;
    expect(await userIdFromSeal(tampered)).toBeNull();
    const cookies = memoryCookies();
    cookies.jar.set("pp_session", tampered);
    expect(await readSession(cookies)).toBeNull();
  });

  it("is null when the seal was made with another secret", async () => {
    const other = await sealData(
      { userId: "ana", expiresAt: inOneHour() },
      { password: "another-secret-another-secret-00000" },
    );
    expect(await userIdFromSeal(other)).toBeNull();
  });

  it("is null when expiresAt is in the past or missing", async () => {
    expect(
      await userIdFromSeal(await seal({ userId: "ana", expiresAt: Date.now() - 1000 })),
    ).toBeNull();
    expect(await userIdFromSeal(await seal({ userId: "ana" }))).toBeNull();
  });

  it("is secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const options: Record<string, unknown>[] = [];
    const cookies = memoryCookies();
    await writeSession(
      { ...cookies, set: (n, v, o) => void (options.push(o), cookies.set(n, v, o)) },
      "ana",
      false,
    );
    expect(options[0]).toMatchObject({ secure: true, httpOnly: true, path: "/" });
  });
});
