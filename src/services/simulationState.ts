/**
 * Tiny shared state module so both storageService (plain TS) and
 * useSimulation (Vue composable) can read/write the simulation flag
 * without creating circular dependencies.
 */
export const simState = {
  active: false,
};
