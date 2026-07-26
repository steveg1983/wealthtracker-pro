import React, { useEffect, useState } from 'react';

/**
 * On-device viewport diagnostics, rendered only when the URL carries
 * ?viewport-debug=1.
 *
 * Exists because of a bug reproducible only on a real iPhone: every page's
 * content sits ~55pt left of centre with an empty band down the right edge,
 * on every route, across builds — and none of it reproduces in a desktop
 * browser at the same logical width. The numbers that distinguish the
 * possible causes (layout-viewport inflation, a persistent visual-viewport
 * zoom, a rogue wide element) are exactly the ones a screenshot cannot show,
 * so the device has to report them itself.
 */
export default function ViewportDebugOverlay(): React.JSX.Element | null {
  const enabled = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('viewport-debug') === '1';

  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const read = (): void => {
      const doc = document.documentElement;
      const vv = window.visualViewport;
      // The widest in-flow element is the usual culprit for a fitted-out
      // initial zoom — name it if there is one.
      let widest = { name: 'none', right: 0 };
      document.querySelectorAll('body *').forEach(n => {
        const r = n.getBoundingClientRect();
        if (r.right > widest.right && r.width > 0) {
          widest = { name: `${n.tagName}.${String(n.className).slice(0, 30)}`, right: Math.round(r.right) };
        }
      });
      // The content chain: on the affected device the page-level numbers are
      // all clean (440 wide, scale 1.0, no overflow) yet the visible content
      // column stops ~55pt short of the right edge — so whichever of these
      // boxes is narrower than its parent is the culprit.
      const box = (sel: string): string => {
        const el = document.querySelector(sel);
        if (!el) return `${sel}: none`;
        const r = el.getBoundingClientRect();
        return `${sel}: L${Math.round(r.left)} W${Math.round(r.width)} R${Math.round(window.innerWidth - r.right)}`;
      };
      setLines([
        `innerW ${window.innerWidth} · clientW ${doc.clientWidth}`,
        `docScrollW ${doc.scrollWidth} · bodyScrollW ${document.body.scrollWidth}`,
        vv ? `visualVp w ${Math.round(vv.width)} · scale ${vv.scale.toFixed(3)} · offL ${Math.round(vv.offsetLeft)}` : 'no visualViewport',
        `screen ${window.screen.width}x${window.screen.height} · dpr ${window.devicePixelRatio}`,
        `widest right-edge: ${widest.right}px (${widest.name})`,
        box('main'),
        box('main > div'),
        box('.page-transition'),
        box('.page-transition > *'),
        `html ${box('html')} · body ${box('body')}`,
      ]);
    };

    read();
    const t = setInterval(read, 2000);
    return () => clearInterval(t);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      // Highest z in the app; pointer-events none so it can never trap a tap.
      className="fixed top-20 left-2 right-2 z-[9999] pointer-events-none rounded-lg bg-black/80 text-green-300 text-[11px] font-mono p-2 leading-4"
      role="status"
      aria-label="Viewport diagnostics"
    >
      {lines.map(l => <div key={l}>{l}</div>)}
    </div>
  );
}
