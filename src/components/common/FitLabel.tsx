import { useRef, useLayoutEffect } from 'react';

/**
 * A picker's chosen value on ONE line, whatever its length: a combobox trigger
 * is a fixed height, so a wrapping label was always a layout bug. The text
 * first shrinks (down to an 11px floor) and only then ellipsises — long
 * Money-style names like "Household : Other/Misc (Private/Not Seen)" or
 * "American Express Gold (American Express)" stay whole and readable instead of
 * breaking onto a second line.
 *
 * Shared by the category and account pickers so both triggers behave the same.
 */
export default function FitLabel({ text, muted }: { text: string; muted: boolean }): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = (): void => {
      el.style.fontSize = '';
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.clientWidth && size > 11) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);
  return (
    <span
      ref={ref}
      className={`block whitespace-nowrap overflow-hidden text-ellipsis ${
        muted ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'
      }`}
    >
      {text}
    </span>
  );
}
