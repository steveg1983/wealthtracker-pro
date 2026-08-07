/**
 * WCAG 2.5.3 "Label in Name", enforced across every component.
 *
 * An `aria-label` REPLACES the visible <label> as a control's accessible name.
 * Speech-input users say what they can see, so the visible text must still
 * appear inside that name — otherwise saying the visible label does not reach
 * the field.
 *
 * This exists because the two names drift. AddAccountModal's card field was
 * labelled "Card Number — last 4 digits only" but announced as "Last four
 * digits of the card number": each was reasonable on its own, and nothing
 * connected them. A per-component test cannot catch that class of bug, because
 * the next one will appear in a component nobody thought to check.
 *
 * Parsed with the TypeScript compiler rather than regex: an arrow function in a
 * JSX attribute (`onChange={(e) => ...}`) contains '>', which silently
 * truncates any regex-based tag matcher and yields a false all-clear.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const SRC = path.resolve(__dirname, '../..');

function componentFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) componentFiles(p, out);
    else if (entry.endsWith('.tsx') && !/\.(test|spec)\./.test(entry)) out.push(p);
  }
  return out;
}

const normalise = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Every string literal reachable from an attribute value, including ternaries. */
function literalsOf(node: ts.Node | undefined): string[] {
  if (!node) return [];
  const out: string[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text);
    ts.forEachChild(n, visit);
  };
  visit(node);
  return out;
}

function attribute(el: ts.JsxOpeningLikeElement, name: string): ts.Node | undefined {
  for (const prop of el.attributes.properties) {
    if (ts.isJsxAttribute(prop) && prop.name.getText() === name) return prop.initializer ?? undefined;
  }
  return undefined;
}

/** A visually hidden label carries no visible text, so 2.5.3 does not apply. */
function isScreenReaderOnly(el: ts.JsxOpeningLikeElement): boolean {
  return literalsOf(attribute(el, 'className')).some((c) => /\bsr-only\b/.test(c));
}

/** Visible text of a <label>: JSX text plus literals in expression children. */
function visibleText(label: ts.JsxElement): string[] {
  const parts: string[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isJsxText(n)) {
      const t = normalise(n.text);
      if (t) parts.push(t);
    } else if (
      (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) &&
      n.parent &&
      (ts.isJsxExpression(n.parent) || ts.isConditionalExpression(n.parent))
    ) {
      parts.push(n.text);
    }
    ts.forEachChild(n, visit);
  };
  label.children.forEach(visit);
  // "(Optional)" is a hint, not part of what a user would speak.
  return parts.filter((t) => !/^\(?optional\)?$/i.test(t));
}

interface Violation {
  file: string;
  line: number;
  id: string;
  visible: string;
  aria: string;
}

function scan(): Violation[] {
  const violations: Violation[] = [];

  for (const file of componentFiles(SRC)) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );

    const visibleLabels = new Map<string, string[]>();
    const named: Array<{ ids: string[]; arias: string[]; line: number }> = [];

    const visit = (node: ts.Node): void => {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText() === 'label') {
        if (!isScreenReaderOnly(node.openingElement)) {
          for (const id of literalsOf(attribute(node.openingElement, 'htmlFor'))) {
            const texts = visibleText(node);
            if (texts.length) visibleLabels.set(id, texts);
          }
        }
      }
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        const ids = literalsOf(attribute(node, 'id'));
        const arias = literalsOf(attribute(node, 'aria-label'));
        if (ids.length && arias.length) {
          named.push({ ids, arias, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);

    for (const control of named) {
      for (const id of control.ids) {
        const visible = visibleLabels.get(id);
        if (!visible) continue; // aria-label with no visible label is legitimate
        for (const aria of control.arias) {
          if (visible.some((v) => aria.toLowerCase().includes(v.toLowerCase()))) continue;
          violations.push({
            file: path.relative(SRC, file),
            line: control.line,
            id,
            visible: visible.join(' | '),
            aria
          });
        }
      }
    }
  }

  return violations;
}

describe('WCAG 2.5.3 Label in Name', () => {
  it('never lets an aria-label hide the visible label it replaces', () => {
    const violations = scan().map(
      (v) => `${v.file}:${v.line} #${v.id} — visible "${v.visible}" is not contained in aria-label "${v.aria}"`
    );
    expect(violations).toEqual([]);
  });

  it('actually inspects the component tree', () => {
    // Guards the guard: a broken walker would report zero violations forever.
    expect(componentFiles(SRC).length).toBeGreaterThan(100);
  });
});
