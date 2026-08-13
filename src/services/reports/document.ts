/**
 * A custom report's two JSON columns, read once and read the same way by every
 * engine.
 *
 * ── WHY THIS IS A MODULE AND NOT TWO PRIVATE HELPERS ────────────────────────
 *
 * `components` and `filters` are the only values this app stores as free JSON
 * and then reads back as a CLOSED type. Everything else the seam carries is a
 * column with a shape the schema itself enforces — a `numeric(20,2)`, a
 * `CHECK`-ed enum, a `uuid` — so a mapper that misread one would be caught by
 * the store long before it reached a screen. Nothing constrains the inside of a
 * jsonb blob, on either engine, so the ONLY thing standing between a malformed
 * component and a render is the function that reads it.
 *
 * There are two engines and a backup that all have to read it, and `rows.ts`
 * records at length why the local mappers cannot import the cloud's twins
 * (`planningService.ts` reaches a Supabase client on its first line). Left to
 * itself that argument produces two independent readers of one blob, which is
 * the shape `columns.ts` opens by calling out: *"one side learns a column, or
 * renames one, or converts it a shade differently, and the other does not"*.
 * Here it would be worse than a missing field — the two engines would DRAW
 * DIFFERENT REPORTS from the same stored definition.
 *
 * So the reading is here, once, in a module that imports two types and nothing
 * else. It is the same arrangement `services/preferences/document.ts` has, for
 * the same reason and with the same consequence: it is erased to a couple of
 * functions and a frozen array at build, and a desktop bundle can contain it.
 *
 * ── WHAT IT DOES WITH SOMETHING IT CANNOT READ ──────────────────────────────
 *
 * A component whose `type` this build has never heard of is DROPPED, not
 * defaulted, and the difference matters enough to be the loudest sentence in
 * this file. Defaulting it — to 'summary-stats', say, the way `oneOf` defaults
 * every closed set elsewhere in the data layer — would draw a block of income
 * and expense totals where the person put something else, and label it with
 * their own title. A report that shows LESS than it should is a report somebody
 * can see is wrong; a report that shows something else entirely, under the right
 * heading, is one they will believe.
 *
 * The cost is stated rather than hidden: a build that drops a component it
 * cannot read will also not carry that component when the report is next saved,
 * because a save writes back what this build is holding. That is a real way to
 * lose a component — and it is the price of never rendering an invented one.
 * `preferencesService`'s document makes the opposite trade for the opposite
 * reason: an unknown PREFERENCE can travel through untouched because nothing
 * renders it.
 *
 * Everything else is repaired rather than dropped. A missing title is a blank
 * title, a width outside the three the grid can lay out becomes 'full', and a
 * config that is not an object is an empty one — none of those can misrepresent
 * anything, and refusing a whole report over a missing string would cost
 * somebody a report they can plainly see they built.
 */

import type {
  CustomReport,
  ReportComponent,
  ReportComponentConfig,
  ReportComponentType
} from '../../types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

/**
 * Every component kind this build can draw, as a runtime lookup.
 *
 * Spelled out rather than derived, for the reason `rows.ts` gives about
 * `DISMISSAL_KINDS`: this is the APP's vocabulary, and a list derived from
 * whatever a store happened to contain would start admitting a kind the renderer
 * has no case for — which is precisely the component this file exists to drop.
 * `CustomReportBuilder`'s catalog is what fills the picker; this is what decides
 * whether a STORED one can be read back, and they are different questions
 * (the catalog offers seven of these twelve; the other five are types the app's
 * union has always named and no generator has ever been written for, so a report
 * carrying one reads back and draws nothing rather than being thrown away).
 */
const REPORT_COMPONENT_TYPES: Record<ReportComponentType, true> = {
  'summary-stats': true,
  'line-chart': true,
  'bar-chart': true,
  'pie-chart': true,
  table: true,
  'text-block': true,
  'date-comparison': true,
  'category-breakdown': true,
  'account-summary': true,
  'transaction-list': true,
  'budget-progress': true,
  'goal-tracker': true
};

const COMPONENT_WIDTHS: Record<ReportComponent['width'], true> = {
  full: true,
  half: true,
  third: true
};

const DATE_RANGES: Record<CustomReport['filters']['dateRange'], true> = {
  month: true,
  quarter: true,
  year: true,
  custom: true
};

/**
 * A stored string as one of a closed set, or the fallback.
 *
 * The same three lines `services/local/mappers/values.ts` exports under this
 * name, written out rather than imported: that module is the LOCAL engine's
 * value layer and this one is shared by both engines, so the arrow would point
 * the wrong way — a cloud mapper reading a report would be reaching into the
 * device port's internals for a type guard.
 */
const oneOf = <T extends string>(
  value: unknown,
  allowed: Record<T, true>,
  fallback: T
): T => {
  const isAllowed = (candidate: string): candidate is T =>
    Object.prototype.hasOwnProperty.call(allowed, candidate);
  return typeof value === 'string' && isAllowed(value) ? value : fallback;
};

const isComponentType = (value: string): value is ReportComponentType =>
  Object.prototype.hasOwnProperty.call(REPORT_COMPONENT_TYPES, value);

/**
 * One component's settings.
 *
 * The value union is what JSON can hold and what the generators read: a scalar,
 * or a flat array of them. Anything else — a nested object, a function that
 * somehow survived a stringify — is dropped KEY BY KEY rather than costing the
 * whole config, because a generator reads the handful of keys it understands and
 * a key it does not is already none of its business.
 */
const parseConfig = (value: unknown): ReportComponentConfig => {
  if (!isRecord(value)) return {};
  const config: ReportComponentConfig = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === null || typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
      config[key] = entry;
      continue;
    }
    if (Array.isArray(entry)) {
      const elements: Array<string | number | boolean | null> = [];
      let usable = true;
      for (const element of entry) {
        if (element === null || typeof element === 'string' || typeof element === 'number' || typeof element === 'boolean') {
          elements.push(element);
        } else {
          usable = false;
          break;
        }
      }
      if (usable) config[key] = elements;
    }
  }
  return config;
};

const parseComponent = (value: unknown): ReportComponent | null => {
  if (!isRecord(value)) return null;
  const type = text(value.type);
  // The one refusal in this file. See the header for why it is a refusal and not
  // a default.
  //
  // Asked through the type GUARD rather than with a bare `in`, so the narrowing
  // is the compiler's: `isComponentType` proves `type is ReportComponentType`,
  // which is what lets the field below be assigned rather than asserted. The
  // version that tested `type in REPORT_COMPONENT_TYPES` needed a cast on the
  // very next line to say the same thing, and a cast is a claim the compiler
  // takes on trust — here, about the one value in this file that arrives from
  // outside it.
  if (type === undefined || !isComponentType(type)) return null;
  return {
    id: text(value.id) ?? '',
    type,
    title: text(value.title) ?? '',
    config: parseConfig(value.config),
    width: oneOf<ReportComponent['width']>(value.width, COMPONENT_WIDTHS, 'full')
  };
};

/**
 * A report's components, IN THE ORDER THEY ARE STORED IN.
 *
 * Order is the layout: the builder's list is the sequence the viewer renders
 * down the page, and a reader that sorted — by title, by type, by anything —
 * would rearrange somebody's report every time it was opened. It is the same
 * property `columns.ts` states for `strings`, and it is load-bearing for the
 * same kind of reason.
 */
export const parseReportComponents = (value: unknown): ReportComponent[] => {
  if (!Array.isArray(value)) return [];
  const components: ReportComponent[] = [];
  for (const entry of value) {
    const component = parseComponent(entry);
    if (component !== null) components.push(component);
  }
  return components;
};

/**
 * Which rows a report is about.
 *
 * `dateRange` is the only required field and the only one with a default, and
 * 'month' is it: a report with no period is not a report, and the month is what
 * the builder starts every new one on.
 *
 * The three lists are omitted rather than emptied when the stored value is not a
 * list of strings, and that is not tidiness — `customReportService` reads
 * `filters.accounts && filters.accounts.length > 0` to decide whether to filter
 * at all, so an empty array and an absent one mean the same thing to the
 * generator, while `[]` written back to the store would claim the person had
 * chosen to filter to no accounts.
 */
export const parseReportFilters = (value: unknown): CustomReport['filters'] => {
  const raw = isRecord(value) ? value : {};
  const strings = (entry: unknown): string[] | undefined => {
    if (!Array.isArray(entry)) return undefined;
    const list = entry.filter((element): element is string => typeof element === 'string');
    return list.length > 0 ? list : undefined;
  };
  const filters: CustomReport['filters'] = {
    dateRange: oneOf<CustomReport['filters']['dateRange']>(raw.dateRange, DATE_RANGES, 'month')
  };
  const start = text(raw.customStartDate);
  if (start !== undefined) filters.customStartDate = start;
  const end = text(raw.customEndDate);
  if (end !== undefined) filters.customEndDate = end;
  const accounts = strings(raw.accounts);
  if (accounts !== undefined) filters.accounts = accounts;
  const categories = strings(raw.categories);
  if (categories !== undefined) filters.categories = categories;
  const tags = strings(raw.tags);
  if (tags !== undefined) filters.tags = tags;
  return filters;
};
