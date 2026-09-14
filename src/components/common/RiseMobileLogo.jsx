import React from 'react';

/**
 * RiseMobileLogo Component
 * Official 3D Chrome Metallic RiseMobile Brand Logo
 */
export const RiseMobileLogo = ({ 
  isExpanded = true, 
  size = 'md',
  className = '' 
}) => {
  // Generous size configurations for Full Logo (Expanded) vs Icon Only (Collapsed)
  const fullSizeClasses = {
    sm: 'h-8 max-w-[160px]',
    md: 'h-11 max-w-[230px]',
    lg: 'h-14 sm:h-16 max-w-[300px]',
    xl: 'h-18 sm:h-22 max-w-[380px]',
    '2xl': 'h-24 sm:h-28 max-w-[460px]'
  };

  const iconSizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-11 h-11',
    lg: 'w-14 h-14',
    xl: 'w-18 h-18',
    '2xl': 'w-24 h-24'
  };

  return (
    <div className={`flex items-center select-none transition-transform group-hover:scale-102 ${className}`}>
      {isExpanded ? (
        <img 
          src="/logo-risemobile.png" 
          alt="RiseMobile" 
          className={`${fullSizeClasses[size] || fullSizeClasses.md} w-auto object-contain transition-all duration-300 dark:brightness-110 dark:contrast-115 dark:drop-shadow-[0_4px_20px_rgba(255,255,255,0.25)]`}
        />
      ) : (
        <div className="relative flex items-center justify-center">
          <img 
            src="/logo-risemobile-icon.png" 
            alt="RiseMobile" 
            className={`${iconSizeClasses[size] || iconSizeClasses.md} object-contain rounded-xl transition-all duration-300 dark:brightness-105 dark:contrast-110 drop-shadow-[0_4px_14px_rgba(0,0,0,0.55)]`} 
          />
        </div>
      )}
    </div>
  );
};

export default RiseMobileLogo;
