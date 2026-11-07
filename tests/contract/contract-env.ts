/** One adapter under contract test: how to build it and how to restore the seeded state. */
export type ContractEnv<P> = { name: string; make: () => P; reset: () => Promise<void> };
