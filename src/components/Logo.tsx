import React from 'react';
import { Wallet, TrendingUp } from 'lucide-react';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  iconClassName?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function Logo({ className, iconClassName, size = 'md' }: LogoProps) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  };

  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-9 h-9'
  };

  return (
    <div className={cn(
      "relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg shadow-blue-200 dark:shadow-none overflow-hidden",
      sizes[size],
      className
    )}>
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-1/2 h-1/3 bg-white/10 rounded-full blur-lg translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 w-1/2 h-1/3 bg-white/5 rounded-full blur-lg -translate-x-1/2 translate-y-1/2" />
      
      {/* Main Logo Icon */}
      <div className="relative">
        <Wallet className={cn("text-white", iconSizes[size], iconClassName)} />
        <div className={cn(
          "absolute bg-emerald-400 rounded-full border-2 border-blue-600 flex items-center justify-center shadow-sm",
          size === 'lg' ? "-bottom-1 -right-1 p-1" : "-bottom-0.5 -right-0.5 p-0.5"
        )}>
          <TrendingUp className={cn("text-white", size === 'lg' ? "w-3 h-3" : "w-2 h-2")} />
        </div>
      </div>
    </div>
  );
}
