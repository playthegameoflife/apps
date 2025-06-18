import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ title, children, className = '', actions, icon }) => {
  return (
    <div 
      className={`
        relative group
        bg-white/95 dark:bg-gray-800/95
        backdrop-blur-xl
        p-6 sm:p-8
        rounded-2xl
        shadow-[0_8px_30px_rgb(0,0,0,0.08)]
        dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]
        hover:shadow-[0_12px_40px_rgb(0,0,0,0.12)]
        dark:hover:shadow-[0_12px_40px_rgb(0,0,0,0.35)]
        transition-all duration-500 ease-out
        border border-gray-200/60 dark:border-gray-700/60
        hover:border-gray-300/80 dark:hover:border-gray-600/80
        hover:-translate-y-1
        ${className}
      `}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-gray-50/30 dark:from-gray-700/40 dark:via-transparent dark:to-gray-800/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Accent border */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />
      
      {title && (
        <div className="flex items-start mb-6 relative">
          {icon && (
            <div className="mr-4 p-3 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border border-indigo-100 dark:border-indigo-800/50 shadow-sm">
              <span className="text-2xl transform transition-transform duration-300 group-hover:scale-110 block">
                {icon}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent leading-tight">
              {title}
            </h3>
          </div>
        </div>
      )}
      
      <div className="relative text-gray-700 dark:text-gray-300 space-y-4 text-base leading-relaxed">
        {children}
      </div>
      
      {actions && (
        <div className="relative mt-8 pt-6 border-t border-gray-200/60 dark:border-gray-700/60 flex flex-wrap gap-3">
          {actions}
        </div>
      )}
    </div>
  );
};

export default Card;