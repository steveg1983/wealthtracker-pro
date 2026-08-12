/**
 * WHERE A CAUGHT ERROR GOES — the contract, named by neither edition.
 *
 * `services/loggingService.ts` is the app's one sink for anything worth keeping
 * a record of, and it had exactly one cloud dependency: two functions imported
 * from `lib/sentry.ts`, which imports `@sentry/react`, which posts to a server.
 * That single edge is why `loggers/scopedLogger.ts` — imported by sixty-seven
 * modules, most of them shared UI with nothing to do with the cloud — was a
 * forbidden module in a desktop build.
 *
 * ── LOGGING IS FINE ON A DEVICE. TELEMETRY IS NOT ───────────────────────────
 *
 * The two were tangled and are now told apart, which is the whole of this seam:
 *
 *   the LOGGER    a scope, four levels, a ring buffer, a console. It runs
 *                 anywhere and a desktop wants it as much as a browser does;
 *   the TELEMETRY where a caught error is REPORTED. In a browser that is a
 *                 server; in a program that promises the money never leaves the
 *                 machine it can only be this machine.
 *
 * So the logger keeps its specifier and all sixty-seven of its callers, and the
 * two lines underneath it that reach a network become `@telemetry` — resolved by
 * the build, as `@data` is, to `editions/cloud/telemetry.ts` in a browser and to
 * `desktop/editions/telemetry.ts` in a window. Neither bundle contains the
 * other's sink because neither bundle's graph can reach it.
 *
 * ── WHY THE LEVELS ARE DECLARED HERE AND NOT IMPORTED FROM SENTRY ───────────
 *
 * `Sentry.SeverityLevel` is the same six words and it would be erased at build,
 * so importing it would cost a desktop bundle nothing. It would still be wrong,
 * for the reason `services/local/preferencesTransport.ts` gives about the same
 * temptation: a device module that NAMES a cloud package has made the cloud
 * package the definition of something, and the next person to widen the seam
 * reads that as permission. The union is asserted equal to Sentry's where the
 * cloud side is written, which is the only place both are in scope.
 */

/** How bad it was. The same six words Sentry uses, deliberately. */
export type TelemetryLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';

/** Whatever the caller thought was worth attaching. */
export type TelemetryContext = Record<string, unknown>;

/** Report a thrown thing. */
export type CaptureException = (error: Error, context?: TelemetryContext) => void;

/** Report something that did not throw but is worth knowing about. */
export type CaptureMessage = (
  message: string,
  level?: TelemetryLevel,
  context?: TelemetryContext
) => void;
