import React from 'react';

export interface IconProps {
  size?: number;
  color?: string;
  hoverColor?: string;
  onClick?: () => void;
  className?: string;
  title?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
  'data-testid'?: string;
}

interface IconBaseProps extends IconProps {
  children: React.ReactNode;
  viewBox?: string;
}

export const IconBase: React.FC<IconBaseProps> = ({
  size = 20,
  color = 'currentColor',
  hoverColor,
  onClick,
  className = '',
  title,
  children,
  viewBox = '0 0 24 24',
  style,
  strokeWidth,
  'data-testid': dataTestId,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`transition-all duration-200 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        color: isHovered && hoverColor ? hoverColor : color,
        ...style,
      }}
      strokeWidth={strokeWidth}
      role={onClick ? 'button' : 'img'}
      aria-label={title}
      data-testid={dataTestId}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
};