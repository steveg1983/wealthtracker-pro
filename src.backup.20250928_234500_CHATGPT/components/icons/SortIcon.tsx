import type { SVGProps } from 'react';

interface SortIconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export default function SortIcon({ size = 24, ...props }: SortIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 6h18"/>
      <path d="M7 12h10"/>
      <path d="M10 18h4"/>
    </svg>
  );
}