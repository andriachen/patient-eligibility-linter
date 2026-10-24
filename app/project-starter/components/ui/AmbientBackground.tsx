/** Plain white page background. The three ambient color blobs that used to live here
 *  were dropped so the UI reads as clean white; the body already paints var(--page)
 *  via globals.css, so this layer just reserves the stacking context. */
export function AmbientBackground() {
  return <div aria-hidden className="enter-bg pointer-events-none fixed inset-0 -z-10 bg-page" />;
}
