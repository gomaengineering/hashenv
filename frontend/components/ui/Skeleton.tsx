interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({ 
  className = '', 
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse'
}: SkeletonProps) {
  const baseClasses = 'bg-[var(--surface-elevated)] rounded';
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md'
  };
  
  const animationClasses = {
    pulse: 'animate-pulse opacity-50',
    wave: 'animate-skeleton-wave',
    none: ''
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  );
}

// Pre-built skeleton components
export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 ? '80%' : '100%'}
          className="h-4"
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 ${className}`}>
      <Skeleton variant="rectangular" height={24} width="60%" className="mb-4" />
      <SkeletonText lines={3} />
    </div>
  );
}

export function SkeletonButton({ className = '' }: { className?: string }) {
  return (
    <Skeleton variant="rectangular" height={40} width={120} className={className} />
  );
}

export function SkeletonAvatar({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <Skeleton variant="circular" width={size} height={size} className={className} />
  );
}
