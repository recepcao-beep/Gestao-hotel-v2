
import React from 'react';
import { HotelType } from '../types';

interface LogoProps {
  className?: string;
  themeColor?: string;
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className = "h-12", themeColor = "#26A6A6", showText = true }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative flex-shrink-0">
        <svg 
          viewBox="0 0 100 100" 
          className="w-10 h-10 drop-shadow-sm"
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M20 80V30L50 15L80 30V80H20Z" 
            fill={themeColor} 
            fillOpacity="0.1"
          />
          <path 
            d="M30 80V40L50 30L70 40V80" 
            stroke={themeColor} 
            strokeWidth="6" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
          <path 
            d="M50 30V80" 
            stroke={themeColor} 
            strokeWidth="6" 
            strokeLinecap="round" 
          />
          <rect 
            x="40" y="50" width="6" height="6" 
            rx="1" 
            fill={themeColor} 
          />
          <rect 
            x="54" y="50" width="6" height="6" 
            rx="1" 
            fill={themeColor} 
          />
          <rect 
            x="40" y="62" width="6" height="6" 
            rx="1" 
            fill={themeColor} 
          />
          <rect 
            x="54" y="62" width="6" height="6" 
            rx="1" 
            fill={themeColor} 
          />
          <path 
            d="M10 80H90" 
            stroke={themeColor} 
            strokeWidth="6" 
            strokeLinecap="round" 
          />
        </svg>
        <div 
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white" 
          style={{ backgroundColor: themeColor }}
        />
      </div>
      
      {showText && (
        <div className="flex flex-col leading-none">
          <span className="text-xl font-black tracking-tighter text-slate-800">
            NACIONAL<span style={{ color: themeColor }}>INN</span>
          </span>
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Hotel Management
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;
