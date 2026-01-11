import React from 'react';
import Link from 'next/link';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  asLink?: boolean;
  href?: string;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  asLink = false,
  href,
  children,
  className = '',
  onClick,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--background)] disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] hover:shadow-lg hover:shadow-[var(--accent)]/25 focus:ring-[var(--accent)]',
    secondary: 'bg-[var(--surface-elevated)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--surface)] hover:border-[var(--accent)]/50 focus:ring-[var(--accent)]',
    outline: 'bg-transparent text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--surface)] hover:border-[var(--accent)] focus:ring-[var(--accent)]',
    danger: 'bg-[var(--error)] text-white hover:bg-[#F85149] hover:shadow-lg hover:shadow-[var(--error)]/25 focus:ring-[var(--error)]',
    ghost: 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--foreground)] focus:ring-[var(--accent)]',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  
  const classes = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;
  
  if (asLink && href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  
  return (
    <button className={classes} onClick={onClick} {...props}>
      {children}
    </button>
  );
}
