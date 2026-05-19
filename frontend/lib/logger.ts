export const logger = {
  // Intentionally no-op in app runtime to avoid console noise in production builds.
  // Keep function signatures so call sites remain unchanged.
  info: (..._args: unknown[]) => {},
  warn: (..._args: unknown[]) => {},
  error: (..._args: unknown[]) => {},
};
