import React from 'react';
import { cn } from '@/lib/utils';
import logoSrc from '@/assets/ivintage-logo.png';

interface LogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

const sizeClasses = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16'
};

export const Logo: React.FC<LogoProps> = ({ 
  className, 
  size = 'md', 
  showText = true 
}) => {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <img 
        src={logoSrc}
        alt="iVintage College" 
        className={cn('object-contain bg-transparent', sizeClasses[size])}
      />
      {showText && (
        <div className="flex flex-col">
          <span className="font-bold text-primary text-lg leading-tight">
            IVINTAGE
          </span>
          <span className="text-xs text-muted-foreground leading-tight">
            GROUP OF SCHOOLS
          </span>
        </div>
      )}
    </div>
  );
};