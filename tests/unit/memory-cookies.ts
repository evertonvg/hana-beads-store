import { createMockAuth } from "@/lib/data/mock/auth";

/** One browser's cookie jar, enough for iron-session (deleting = empty value or maxAge 0). */
export function memoryCookies() {
  const jar = new Map<string, string>();
  return {
    jar,
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) as string } : undefined),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string, options: { maxAge?: number }) => {
      if (value === "" || options.maxAge === 0) jar.delete(name);
      else jar.set(name, value);
    },
  };
}

/** The mock auth port bound to its own fresh cookie jar (outside a Next request). */
export function mockAuthInJar() {
  const cookies = memoryCookies();
  return createMockAuth({ cookies: () => Promise.resolve(cookies) });
}
