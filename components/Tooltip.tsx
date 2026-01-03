import React, { useState, useRef, useId } from 'react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top', className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();

  return (
    <div 
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      <span
        aria-describedby={isVisible ? tooltipId : undefined}
        tabIndex={0}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded"
      >
        {children}
      </span>
      <div 
        id={tooltipId}
        role="tooltip"
        aria-hidden={!isVisible}
        className={`absolute z-50 transition-all duration-200 ease-out-expo bg-slate-900 text-white text-xs font-medium py-2 px-3 rounded-xl shadow-xl max-w-xs text-center leading-relaxed pointer-events-none left-1/2 -translate-x-1/2
        ${isVisible ? 'visible opacity-100 scale-100' : 'invisible opacity-0 scale-95'}
        ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}
        `}
      >
        {content}
        {/* Seta do tooltip */}
        <div 
          className={`absolute left-1/2 -translate-x-1/2 border-[6px] border-transparent
          ${position === 'top' ? 'top-full border-t-slate-900' : 'bottom-full border-b-slate-900'}
          `}
          aria-hidden="true"
        ></div>
      </div>
    </div>
  );
};

export default Tooltip;