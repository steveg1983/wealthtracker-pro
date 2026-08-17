import type { DecimalInstance } from './decimal';
import type { RecurringDetection } from './recurringDetection';

/**
 * The forward schedule: confirmed recurring patterns, projected ahead.
 *
 * This is the "what is due next?" read of the detection work (Design
 * handover, 17 Aug §1) — and the gate from §5 is the whole contract here:
 * callers hand this function CONFIRMED detections only. An unconfirmed
 * detection is the app's opinion, and an opinion must never appear on a
 * calendar as a payment that is going to happen. The function cannot check
 * the verdicts itself (they live beside the store), so the report's rule is
 * restated at this boundary instead: filter before you project.
 *
 * A projected occurrence is an INFERENCE about the future — weaker even than
 * a detection, which at least describes payments that happened. Every
 * consumer must present these as expected, never as figures in the ledger:
 * the shape carries the detection so the evidence is one hop away.
 */
export interface ExpectedPayment {
  /** The pattern this occurrence is projected from — the evidence. */
  detection: RecurringDetection;
  /** When the payment is expected, stepping the observed rhythm forward. */
  date: Date;
  /** The current figure, as a magnitude — direction is on the detection. */
  amount: DecimalInstance;
}

const DAY_MS = 86_400_000;

/**
 * Occurrences of each pattern inside [from, until], in date order.
 *
 * Each detection is stepped from its own `nextExpected` by its own median
 * interval — the rhythm the payments actually showed, not the calendar's
 * idea of a month. Stopped patterns project nothing: a rhythm that has
 * fallen silent has nothing due. A `nextExpected` already in the past (the
 * payment is late, not yet stopped) is still shown from `from`, because
 * "overdue by three days" is exactly what a schedule is for.
 */
export function projectRecurringSchedule(
  confirmed: readonly RecurringDetection[],
  from: Date,
  until: Date
): ExpectedPayment[] {
  const occurrences: ExpectedPayment[] = [];
  const fromTime = from.getTime();
  const untilTime = until.getTime();
  if (untilTime <= fromTime) return occurrences;

  for (const detection of confirmed) {
    if (detection.stopped || detection.nextExpected === null) continue;
    const step = Math.round(detection.medianIntervalDays) * DAY_MS;
    if (step <= 0) continue;

    // Walk from the pattern's own next-expected; occurrences before the
    // window's start are late payments, folded onto its first day rather
    // than dropped — a schedule that hides the overdue is lying by omission.
    let time = detection.nextExpected.getTime();
    if (time < fromTime) {
      occurrences.push({ detection, date: new Date(fromTime), amount: detection.amount });
      // Resume the walk at the first occurrence past the window's start, so
      // the late payment appears once, not once per missed rhythm.
      while (time < fromTime) time += step;
    }
    for (; time <= untilTime; time += step) {
      occurrences.push({ detection, date: new Date(time), amount: detection.amount });
    }
  }

  return occurrences.sort(
    (a, b) => a.date.getTime() - b.date.getTime() ||
      b.amount.minus(a.amount).toNumber()
  );
}
