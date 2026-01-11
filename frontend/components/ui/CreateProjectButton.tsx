import React from 'react';
import Link from 'next/link';
import { Button } from './Button';

interface CreateProjectButtonProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  asLink?: boolean;
  href?: string;
  onClick?: () => void;
}

export function CreateProjectButton({ 
  size = 'md', 
  className = '',
  asLink = true,
  href = '/projects/new',
  onClick
}: CreateProjectButtonProps) {
  const iconSize = size === 'lg' ? 'w-5 h-5' : size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
  
  const icon = (
    <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );

  if (asLink && href) {
    return (
      <Button variant="primary" size={size} asLink href={href} className={className}>
        {icon}
        <span className={size === 'sm' ? 'ml-1.5' : 'ml-2'}>Create Project</span>
      </Button>
    );
  }

  return (
    <Button variant="primary" size={size} onClick={onClick} className={className}>
      {icon}
      <span className={size === 'sm' ? 'ml-1.5' : 'ml-2'}>Create Project</span>
    </Button>
  );
}
