import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'surface' | 'elevated' | 'bordered';
}

export function Card({ 
  children, 
  className = '', 
  padding = 'md',
  variant = 'surface',
  ...props
}: CardProps): React.JSX.Element {
  const paddingStyles = {
    none: '',
    sm: 'p-[var(--spacing-4)]',
    md: 'p-[var(--spacing-6)]',
    lg: 'p-[var(--spacing-8)]',
  };
  
  const variantStyles = {
    surface: `
      bg-[var(--color-surface-primary)]
      border border-[var(--color-border-primary)]
    `,
    elevated: `
      bg-[var(--color-surface-elevated)]
      shadow-[var(--shadow-md)]
    `,
    bordered: `
      bg-[var(--color-background-secondary)]
      border-2 border-[var(--color-border-secondary)]
    `,
  };
  
  return (
    <div 
      className={`
        rounded-[var(--radius-lg)]
        ${variantStyles[variant]}
        ${paddingStyles[padding]}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '', ...props }: CardHeaderProps): React.JSX.Element {
  return (
    <div className={`mb-[var(--spacing-4)] ${className}`} {...props}>
      {children}
    </div>
  );
}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
  className?: string;
}

export function CardTitle({ children, className = '', ...props }: CardTitleProps): React.JSX.Element {
  return (
    <h3 className={`
      text-[var(--font-size-lg)] 
      font-[var(--font-weight-semibold)] 
      text-[var(--color-text-primary)]
      ${className}
    `} {...props}>
      {children}
    </h3>
  );
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className = '', ...props }: CardContentProps): React.JSX.Element {
  return (
    <div className={`text-[var(--color-text-secondary)] ${className}`} {...props}>
      {children}
    </div>
  );
}