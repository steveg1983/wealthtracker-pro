interface AriaLiveRegionProps {
  message: string;
  level?: 'polite' | 'assertive';
}

export function AriaLiveRegion({ message, level = 'polite' }: AriaLiveRegionProps) {
  return (
    <div
      aria-live={level}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}