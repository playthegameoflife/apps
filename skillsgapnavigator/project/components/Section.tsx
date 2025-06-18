import React from 'react';

interface SectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

const Section: React.FC<SectionProps> = ({ title, children, className = '', id }) => {
  return (
    <section 
      id={id} 
      className={`
        relative py-16 sm:py-20
        ${className}
      `}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-50/30 to-transparent dark:via-gray-800/30 opacity-0 hover:opacity-100 transition-opacity duration-700"></div>
      
      <div className="relative container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center mb-12 sm:mb-16">
          <div className="text-center max-w-3xl">
            <div className="inline-flex items-center justify-center w-2 h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full mb-6"></div>
            <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-gray-100 dark:to-white bg-clip-text text-transparent mb-4 leading-tight">
              {title}
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full mx-auto"></div>
          </div>
        </div>
        
        <div className="relative">
          {children}
        </div>
      </div>
    </section>
  );
};

export default Section;