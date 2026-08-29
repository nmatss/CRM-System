/**
 * Build identity.
 *
 * Every log line, health response and metrics sample carries this, so an
 * incident can be tied to the exact artifact that produced it instead of to
 * "whatever was deployed at the time".
 *
 * The values are injected at build time by `script/build.ts`; running from
 * source reports `dev`, which is itself useful information.
 */

declare const __BUILD_COMMIT__: string | undefined;
declare const __BUILD_TIME__: string | undefined;
declare const __BUILD_VERSION__: string | undefined;

function fromDefine(value: string | undefined, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export const buildInfo = {
  commit: fromDefine(
    typeof __BUILD_COMMIT__ === "string" ? __BUILD_COMMIT__ : undefined,
    process.env.BUILD_COMMIT ?? "dev",
  ),
  builtAt: fromDefine(
    typeof __BUILD_TIME__ === "string" ? __BUILD_TIME__ : undefined,
    process.env.BUILD_TIME ?? "unknown",
  ),
  version: fromDefine(
    typeof __BUILD_VERSION__ === "string" ? __BUILD_VERSION__ : undefined,
    process.env.BUILD_VERSION ?? "1.0.0",
  ),
} as const;

/** Short identifier used in logs and metrics labels. */
export const buildId = `${buildInfo.version}+${buildInfo.commit}`;
