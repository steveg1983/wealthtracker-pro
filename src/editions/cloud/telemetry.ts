/**
 * `@telemetry`, in a browser: Sentry.
 *
 * The cloud half of the seam `editions/telemetry.ts` declares, and the twin of
 * `desktop/editions/telemetry.ts`. Two typed re-bindings and nothing else, for
 * the reason `services/port/index.ts` is one line: the CHOICE is the file, and a
 * choosing file that also does work is a file whose work only one edition gets.
 *
 * The annotations are the point. `captureMessage`'s second argument is
 * `Sentry.SeverityLevel` on this side and `TelemetryLevel` on the other, and
 * they are the same six words — this is the one module where both are in scope,
 * so this is where the compiler is made to say so. If Sentry ever adds a
 * seventh, this line stops compiling rather than the device twin quietly
 * becoming a narrower thing than the interface it claims to answer.
 */

import { captureException as sentryCaptureException, captureMessage as sentryCaptureMessage } from '../../lib/sentry';
import type { CaptureException, CaptureMessage } from '../telemetry';

/** One specifier, values and types together. See `services/port/index.ts`. */
export type { CaptureException, CaptureMessage, TelemetryContext, TelemetryLevel } from '../telemetry';

export const captureException: CaptureException = sentryCaptureException;
export const captureMessage: CaptureMessage = sentryCaptureMessage;
