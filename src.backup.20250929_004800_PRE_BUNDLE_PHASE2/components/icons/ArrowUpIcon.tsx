import { IconBase, type IconProps } from './IconBase';

export function ArrowUpIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 15l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </IconBase>
  );
}