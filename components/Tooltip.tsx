import React from 'react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top', className = '' }) => {
  return (
    <div className={`group relative inline-flex items-center ${className}`}>
      {children}
      <div 
        className={`absolute z-50 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200 bg-slate-800 text-white text-[11px] font-medium py-1.5 px-3 rounded-lg shadow-xl w-48 text-center leading-relaxed pointer-events-none left-1/2 -translate-x-1/2
        ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}
        `}
      >
        {content}
        {/* Seta do tooltip */}
        <div 
          className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent
          ${position === 'top' ? 'top-full border-t-slate-800' : 'bottom-full border-b-slate-800'}
          `}
        ></div>
      </div>
    </div>
  );
};

export default Tooltip;