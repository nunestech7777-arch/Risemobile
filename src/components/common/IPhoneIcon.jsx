import React from 'react';

/**
 * Modern iPhone Notch Icon matching Apple hardware aesthetic.
 * Replaces the legacy Smartphone icon with home button.
 */
export const IPhoneIcon = ({ 
  className = 'w-5 h-5', 
  size,
  strokeWidth = 1.8, 
  ...props 
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="5.5" y="2" width="13" height="20" rx="3.5" />
      <path 
        d="M9 2h6v1.4a1.1 1.1 0 0 1-1.1 1.1h-3.8A1.1 1.1 0 0 1 9 3.4V2z" 
        fill="currentColor" 
        stroke="currentColor"
        strokeWidth="0.5"
      />
    </svg>
  );
};

export default IPhoneIcon;
