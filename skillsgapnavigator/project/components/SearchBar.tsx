import React, { useState } from 'react';

interface SearchBarProps {
  onAnalyze: (community: string, areaOfInterest: string) => void;
  isLoading: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ onAnalyze, isLoading }) => {
  const [community, setCommunity] = useState<string>('');
  const [areaOfInterest, setAreaOfInterest] = useState<string>('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!community.trim()) {
      alert("Please enter a community or location.");
      return;
    }
    onAnalyze(community.trim(), areaOfInterest.trim());
  };

  return (
    <div className="relative max-w-2xl mx-auto">
      {/* Background decorative elements */}
      <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-3xl blur-2xl"></div>
      <div className="absolute -inset-2 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 rounded-2xl"></div>
      
      <div className="relative bg-white/90 dark:bg-gray-800/90 backdrop-blur-2xl p-8 sm:p-10 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Discover Your Career Potential
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Enter your location and area of interest to get personalized insights
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="community" className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
              Location / Community <span className="text-red-500">*</span>
            </label>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <input
                type="text"
                id="community"
                value={community}
                onChange={(e) => setCommunity(e.target.value)}
                placeholder="e.g., San Francisco, London, Remote"
                className="relative w-full px-5 py-4 bg-gray-50/80 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 dark:focus:ring-purple-500/50 dark:focus:border-purple-500 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-300 text-base font-medium"
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="areaOfInterest" className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
              Area of Interest <span className="text-gray-400">(Optional)</span>
            </label>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <input
                type="text"
                id="areaOfInterest"
                value={areaOfInterest}
                onChange={(e) => setAreaOfInterest(e.target.value)}
                placeholder="e.g., Artificial Intelligence, Sustainable Energy"
                className="relative w-full px-5 py-4 bg-gray-50/80 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 dark:focus:ring-purple-500/50 dark:focus:border-purple-500 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-300 text-base font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !community.trim()}
            className="w-full relative group flex justify-center items-center px-8 py-4 text-base font-semibold rounded-xl text-white transition-all duration-300 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 transition-all duration-300 group-hover:scale-105"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"></div>
            <div className="relative flex items-center space-x-3">
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Analyzing Market Trends...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Analyze Skills Landscape</span>
                </>
              )}
            </div>
          </button>
        </form>
      </div>
    </div>
  );
};

export default SearchBar;