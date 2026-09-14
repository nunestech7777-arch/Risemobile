import React from 'react';
import './RiseMonochromeBg.css';

/**
 * RiseMonochromeBg Component — Official RiseMobile Monochromatic 3D Atmosphere
 * 
 * Recreates the exact visual target:
 * - Deep Black & Graphite foundation (#030407 / #080A0F)
 * - Monumental 3D abstract curved light form entering from top-right / right quadrant
 * - Soft diffuse white & silver-grey illumination with smooth falloff
 * - Heavy backdrop blur & depth field
 * - Ultra-subtle editorial film grain texture
 * - Absolute pointer-events: none, zero horizontal overflow, 100% responsive
 */
export const RiseMonochromeBg = ({ className = '' }) => {
  return (
    <div 
      className={`rise-monochrome-bg fixed inset-0 pointer-events-none z-0 overflow-hidden select-none ${className}`} 
      aria-hidden="true"
    >
      {/* 1. Deep Space Black & Graphite Gradient Base */}
      <div className="absolute inset-0 bg-[#030407]" />

      {/* 2. Abstract 3D Curved Light Mesh (Monumental Arc in Top-Right) */}
      <div className="rise-ambient-arc-wrapper absolute -top-[15%] -right-[10%] w-[120vw] sm:w-[90vw] lg:w-[75vw] xl:w-[68vw] h-[130vh] sm:h-[110vh] max-w-[1400px]">
        {/* Layer A: Broad Silver/Graphite Diffuse Atmosphere */}
        <div className="rise-ambient-glow-broad absolute inset-0 rounded-full" />

        {/* Layer B: 3D High-Contrast Curved Toroidal Light Form */}
        <svg 
          viewBox="0 0 1000 1000" 
          className="w-full h-full object-cover overflow-visible"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            {/* Smooth Monochromatic Gradient along the Arc */}
            <linearGradient id="riseArcWhiteGrad" x1="100%" y1="0%" x2="0%" y2="80%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="25%" stopColor="#E2E8F0" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#94A3B8" stopOpacity="0.45" />
              <stop offset="75%" stopColor="#334155" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#0F172A" stopOpacity="0.0" />
            </linearGradient>

            <linearGradient id="riseArcInnerShade" x1="100%" y1="0%" x2="30%" y2="70%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
              <stop offset="40%" stopColor="#64748B" stopOpacity="0.15" />
              <stop offset="80%" stopColor="#030407" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#030407" stopOpacity="1.0" />
            </linearGradient>

            <filter id="riseDeepBlur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="55" />
            </filter>

            <filter id="riseCrestBlur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="30" />
            </filter>

            <filter id="riseCoreGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="15" />
            </filter>
          </defs>

          {/* Background Ambient Graphite Cloud */}
          <ellipse 
            cx="650" 
            cy="380" 
            rx="380" 
            ry="460" 
            fill="#1E293B" 
            opacity="0.25" 
            filter="url(#riseDeepBlur)" 
          />

          {/* Broad Diffuse Arc Body */}
          <path
            d="M 980 120 C 720 180, 480 380, 430 680 C 400 840, 480 980, 560 1000 C 440 920, 360 760, 390 560 C 440 280, 680 80, 980 120 Z"
            fill="url(#riseArcWhiteGrad)"
            opacity="0.65"
            filter="url(#riseDeepBlur)"
          />

          {/* Sharp & Luminous White Crest (The focal bright light edge from reference) */}
          <path
            d="M 990 140 C 760 190, 530 390, 490 660 C 465 790, 520 920, 580 980 C 510 880, 450 740, 475 580 C 510 330, 720 150, 990 140 Z"
            fill="url(#riseArcWhiteGrad)"
            opacity="0.85"
            filter="url(#riseCrestBlur)"
          />

          {/* Intense Pure White Center Streak */}
          <path
            d="M 990 155 C 790 200, 580 390, 535 630 C 510 750, 560 870, 600 930 C 545 840, 500 720, 520 580 C 550 360, 740 200, 990 155 Z"
            fill="#FFFFFF"
            opacity="0.75"
            filter="url(#riseCoreGlow)"
          />

          {/* Deep Inner Negative Shadow (Carves out the crescent/torus volume) */}
          <ellipse 
            cx="760" 
            cy="520" 
            rx="280" 
            ry="360" 
            fill="#030407" 
            opacity="0.92" 
            filter="url(#riseDeepBlur)" 
          />
        </svg>
      </div>

      {/* 3. Negative Space Falloff (Keeps Left & Center ultra-clean and dark) */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#030407] via-[#030407]/75 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#030407] via-transparent to-transparent pointer-events-none" />

      {/* 4. Tangible Editorial Film Grain Overlay (Photographic Matte Noise Texture) */}
      <div className="rise-grain-overlay absolute inset-0 pointer-events-none" />
    </div>
  );
};

export default RiseMonochromeBg;
