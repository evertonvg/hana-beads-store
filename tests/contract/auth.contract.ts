import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthPort, SignUpInput } from "@/lib/data/ports";

import type { ContractEnv } from "./contract-env";

/** One auth e-mail as the contract sees it (mock inbox or Mailpit). */
export type InboxMessage = { kind: "confirmacao" | "recuperacao"; link: string };

/** Adapter hooks the auth contract needs. There is no `make`: every port lives inside a session. */
export type AuthContractEnv = Omit<ContractEnv<AuthPort>, "make"> & {
  /** Messages sent to `email`, oldest first. */
  readInbox: (email: string) => Promise<InboxMessage[]>;
  /** Runs `fn` with a port bound to a fresh, empty cookie jar (one browser). */
  withSession: <T>(fn: (auth: AuthPort) => Promise<T>) => Promise<T>;
  /** The adapter can revoke other live sessions (the mock's sealed cookies cannot be revoked). */
  revokesOtherSessions?: boolean;
  /**
   * Leaves the re-sign-up flag set on a CONFIRMED account, as when confirming it could not
   * replace the password (the fail-closed path).
   */
  flagAsResignedUp: (userId: string) => Promise<void>;
  /** Wait before an e-mail to the same address is sent again (GoTrue: 1 s locally). */
  emailCooldownMs?: number;
};

const PASSWORD = "Senha@123";

const input = (email: string): SignUpInput => ({
  name: "Pessoa Contrato",
  email,
  phone: "(11) 91234-5678",
  password: PASSWORD,
  acceptTerms: true,
  marketingEmail: false,
  termsVersion: "2026-10-28",
});

const tokenOf = (link: string) => new URL(link, "http://x.invalid").searchParams.get("token_hash");

/** Behaviour every AuthPort adapter must share (e-mail confirmation, sessions, recovery). */
export function describeAuthContract(env: AuthContractEnv) {
  describe(`auth contract (${env.name})`, () => {
    // Unique per test: a real test inbox (Mailpit) is not cleared by `reset`.
    let email: string;

    beforeEach(async () => {
      await env.reset();
      email = `contrato-${crypto.randomUUID().slice(0, 8)}@teste.dev`;
    });

    async function latest(to: string, kind: InboxMessage["kind"]): Promise<string> {
      const found = (await env.readInbox(to)).filter((m) => m.kind === kind).at(-1);
      const token = found && tokenOf(found.link);
      if (!token) throw new Error(`no ${kind} e-mail for ${to}`);
      return token;
    }

    it("signs up pending confirmation and sends the confirmation e-mail", async () => {
      await env.withSession(async (auth) => {
        const r = await auth.signUp(input(email), "/conta");
        expect(r.status).toBe("confirmacao_pendente");
        expect(typeof r.userId).toBe("string");
        expect(await auth.currentUser()).toBeNull();
      });
      const inbox = await env.readInbox(email);
      expect(inbox.map((m) => m.kind)).toEqual(["confirmacao"]);
    });

    it("refuses to sign in before confirming: unconfirmed with the right password, null otherwise", async () => {
      await env.withSession(async (auth) => {
        await auth.signUp(input(email), "/conta");
        expect(await auth.signIn(email, PASSWORD, false)).toEqual({
          error: "email_nao_confirmado",
        });
        expect(await auth.signIn(email, "Errada@123", false)).toBeNull();
        expect(await auth.currentUser()).toBeNull();
      });
    });

    it("answers an e-mail that already has an account with userId null", async () => {
      await env.withSession(async (auth) => {
        expect(await auth.signUp(input(" ANA@teste.dev "), "/conta")).toEqual({
          status: "confirmacao_pendente",
          userId: null,
        });
      });
    });

    it("confirms with the e-mail link once, signing the user in", async () => {
      const userId = await env.withSession(async (auth) => {
        const r = await auth.signUp(input(email), "/conta");
        return r.userId;
      });
      const token = await latest(email, "confirmacao");
      await env.withSession(async (auth) => {
        expect(await auth.verifyEmailLink(token, "email")).toEqual({
          ok: true,
          mustSetPassword: false,
        });
        expect(await auth.currentUser()).toEqual({
          id: userId,
          name: "Pessoa Contrato",
          email,
        });
        // A confirmation link session may also choose a password without the current one.
        expect(await auth.linkSessionAllowsPasswordReset()).toBe(true);
      });
      await env.withSession(async (auth) => {
        expect(await auth.verifyEmailLink(token, "email")).toEqual({ ok: false });
        expect(await auth.currentUser()).toBeNull();
      });
    });

    it("a new sign-up for a pending e-mail keeps nobody's password (no pre-hijack)", async () => {
      const first = await env.withSession((auth) =>
        auth.signUp(
          { ...input(email), password: "Primeira@123", name: "Quem Chegou Antes" },
          "/conta",
        ),
      );
      const again = await env.withSession((auth) =>
        auth.signUp({ ...input(email), password: "Segunda@123", name: "Dona do E-mail" }, "/conta"),
      );
      expect(again).toEqual({ status: "confirmacao_pendente", userId: first.userId });
      const token = await latest(email, "confirmacao");
      await env.withSession(async (auth) => {
        expect(await auth.verifyEmailLink(token, "email")).toEqual({
          ok: true,
          mustSetPassword: true,
        });
        expect(await auth.currentUser()).toMatchObject({ name: "Dona do E-mail", email });
        // Neither sign-up's password opens the account…
        await env.withSession(async (other) => {
          expect(await other.signIn(email, "Primeira@123", false)).toBeNull();
          expect(await other.signIn(email, "Segunda@123", false)).toBeNull();
        });
        // …until the confirmed user chooses one in the session the link opened.
        expect(await auth.updatePassword("Terceira@123")).toEqual({ ok: true });
      });
      await env.withSession(async (auth) => {
        expect(await auth.signIn(email, "Terceira@123", false)).toMatchObject({ email });
      });
    });

    it("a recovery link on a re-signed-up pending account keeps nobody's password", async () => {
      await env.withSession((auth) =>
        auth.signUp({ ...input(email), password: "Primeira@123" }, "/conta"),
      );
      await env.withSession((auth) =>
        auth.signUp({ ...input(email), password: "Segunda@123" }, "/conta"),
      );
      await new Promise((r) => setTimeout(r, env.emailCooldownMs ?? 0));
      // "Esqueci a senha" on the still pending account: the recovery link proves the e-mail.
      await env.withSession((auth) => auth.requestPasswordReset(email));
      const token = await latest(email, "recuperacao");
      await env.withSession(async (auth) => {
        expect(await auth.verifyEmailLink(token, "recovery")).toEqual({
          ok: true,
          mustSetPassword: true,
        });
        expect(await auth.currentUser()).toMatchObject({ email });
        await env.withSession(async (other) => {
          expect(await other.signIn(email, "Primeira@123", false)).toBeNull();
          expect(await other.signIn(email, "Segunda@123", false)).toBeNull();
        });
        expect(await auth.updatePassword("Terceira@123")).toEqual({ ok: true });
      });
      await env.withSession(async (auth) => {
        expect(await auth.signIn(email, "Terceira@123", false)).toMatchObject({ email });
      });
    });

    it("refuses to sign in a confirmed account still flagged as re-signed-up", async () => {
      const { userId } = await env.withSession((auth) => auth.signUp(input(email), "/conta"));
      const token = await latest(email, "confirmacao");
      await env.withSession((auth) => auth.verifyEmailLink(token, "email"));
      await env.flagAsResignedUp(userId as string);
      await env.withSession(async (auth) => {
        expect(await auth.signIn(email, PASSWORD, true)).toBeNull();
        expect(await auth.currentUser()).toBeNull();
      });
    });

    it("rejects a made-up token", async () => {
      await env.withSession(async (auth) => {
        expect(await auth.verifyEmailLink(crypto.randomUUID(), "email")).toEqual({ ok: false });
        expect(await auth.verifyEmailLink(crypto.randomUUID(), "recovery")).toEqual({
          ok: false,
        });
        expect(await auth.currentUser()).toBeNull();
      });
    });

    it("signs in a confirmed user, then signs out", async () => {
      await env.withSession(async (auth) => {
        const user = await auth.signIn("ana@teste.dev", PASSWORD, true);
        expect(user).toMatchObject({ name: "Ana Souza", email: "ana@teste.dev" });
        expect(await auth.currentUser()).toEqual(user);
        await auth.signOut();
        expect(await auth.currentUser()).toBeNull();
      });
    });

    it("keeps sessions apart", async () => {
      await env.withSession(async (auth) => {
        expect(await auth.signIn("ana@teste.dev", PASSWORD, false)).not.toBeNull();
      });
      await env.withSession(async (auth) => {
        expect(await auth.currentUser()).toBeNull();
      });
    });

    it("resolves a reset request for an unknown e-mail without sending anything", async () => {
      await env.withSession(async (auth) => {
        await expect(auth.requestPasswordReset(email)).resolves.toBeUndefined();
      });
      expect(await env.readInbox(email)).toEqual([]);
    });

    it("recovers the password: the old one stops working and the new one works", async () => {
      await env.withSession((auth) => auth.requestPasswordReset("ana@teste.dev"));
      const token = await latest("ana@teste.dev", "recuperacao");
      await env.withSession(async (auth) => {
        expect(await auth.verifyEmailLink(token, "recovery")).toEqual({
          ok: true,
          mustSetPassword: false,
        });
        expect(await auth.updatePassword("Nova@1234")).toEqual({ ok: true });
      });
      await env.withSession(async (auth) => {
        expect(await auth.signIn("ana@teste.dev", PASSWORD, false)).toBeNull();
        expect(await auth.signIn("ana@teste.dev", "Nova@1234", false)).toMatchObject({
          email: "ana@teste.dev",
        });
      });
    });

    it("only a session an e-mail link opened in the last 15 minutes may reset the password", async () => {
      await env.withSession(async (auth) => {
        expect(await auth.linkSessionAllowsPasswordReset()).toBe(false);
        expect(await auth.signIn("ana@teste.dev", PASSWORD, false)).not.toBeNull();
        expect(await auth.linkSessionAllowsPasswordReset()).toBe(false);
      });
      await env.withSession((auth) => auth.requestPasswordReset("ana@teste.dev"));
      const token = await latest("ana@teste.dev", "recuperacao");
      await env.withSession(async (auth) => {
        expect(await auth.verifyEmailLink(token, "recovery")).toMatchObject({ ok: true });
        expect(await auth.linkSessionAllowsPasswordReset()).toBe(true);
        // Only the clock moves: the session itself is still valid, the proof is not.
        vi.useFakeTimers({ toFake: ["Date"] });
        try {
          vi.setSystemTime(Date.now() + 16 * 60 * 1000);
          expect(await auth.linkSessionAllowsPasswordReset()).toBe(false);
        } finally {
          vi.useRealTimers();
        }
      });
    });

    it.skipIf(!env.revokesOtherSessions)(
      "changing the password signs every other session out",
      async () => {
        await env.withSession(async (other) => {
          expect(await other.signIn("ana@teste.dev", PASSWORD, true)).not.toBeNull();
          await env.withSession(async (auth) => {
            expect(await auth.signIn("ana@teste.dev", PASSWORD, false)).not.toBeNull();
            expect(await auth.updatePassword("Nova@1234")).toEqual({ ok: true });
            expect(await auth.currentUser()).toMatchObject({ email: "ana@teste.dev" });
          });
          expect(await other.currentUser()).toBeNull();
        });
      },
    );

    it("refuses to update the password without a session", async () => {
      await env.withSession(async (auth) => {
        expect(await auth.updatePassword("Nova@1234")).toEqual({ ok: false });
      });
    });
  });
}
