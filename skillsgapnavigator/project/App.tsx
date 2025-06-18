import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import SearchBar from './components/SearchBar';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorDisplay from './components/ErrorDisplay';
import Section from './components/Section';
import Card from './components/Card';
import ApiKeyManager from './components/ApiKeyManager';
import { fetchJobMarketAnalysis, fetchLearningPathways, fetchEmployerSuggestions, initializeGemini } from './services/geminiService';
import { 
  JobMarketAnalysis, 
  LearningPathways, 
  EmployerSuggestions, 
  SkillGap,
  OnlineCourse,
  MentorshipProgram,
  Apprenticeship,
  JobTrend,
  EmployerSuggestion,
  ApiError
} from './types';
import { MOCK_DELAY } from './constants';

const App: React.FC = () => {
  const [community, setCommunity] = useState<string>('');
  const [areaOfInterest, setAreaOfInterest] = useState<string>('');
  const [hasApiKey, setHasApiKey] = useState<boolean>(!!localStorage.getItem('gemini_api_key'));
  
  const [jobMarketAnalysis, setJobMarketAnalysis] = useState<JobMarketAnalysis | null>(null);
  const [learningPathways, setLearningPathways] = useState<LearningPathways | null>(null);
  const [employerSuggestions, setEmployerSuggestions] = useState<EmployerSuggestions | null>(null);
  
  const [selectedSkill, setSelectedSkill] = useState<SkillGap | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);

  const handleApiKeySet = useCallback((apiKey: string) => {
    if (initializeGemini(apiKey)) {
      setHasApiKey(true);
    }
  }, []);

  const handleAnalyze = async (comm: string, area: string) => {
    setIsLoading(true);
    setError(null);
    setJobMarketAnalysis(null);
    setLearningPathways(null);
    setEmployerSuggestions(null);
    setSelectedSkill(null);
    setCommunity(comm);
    setAreaOfInterest(area);

    if (MOCK_DELAY > 0) await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
    const analysisResult = await fetchJobMarketAnalysis(comm, area);

    if ('message' in analysisResult) {
      setError(analysisResult);
    } else {
      setJobMarketAnalysis(analysisResult);
    }
    setIsLoading(false);
  };

  const handleSelectSkillForPathways = async (skill: SkillGap) => {
    setSelectedSkill(skill);
    setIsLoading(true);
    setError(null);
    setLearningPathways(null);
    setEmployerSuggestions(null);

    if (MOCK_DELAY > 0) await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
    const pathwaysResult = await fetchLearningPathways(community, skill.skillName);
    
    if ('message' in pathwaysResult) {
      setError(pathwaysResult);
    } else {
      setLearningPathways(pathwaysResult);
    }
    setIsLoading(false);
    setTimeout(() => document.getElementById('learning-pathways-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };
  
  const handleFindEmployers = async (skill: SkillGap) => {
    setSelectedSkill(skill);
    setIsLoading(true);
    setError(null);
    setEmployerSuggestions(null);

    if (MOCK_DELAY > 0) await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
    const employersResult = await fetchEmployerSuggestions(community, skill.skillName);

    if ('message' in employersResult) {
      setError(employersResult);
    } else {
      setEmployerSuggestions(employersResult);
    }
    setIsLoading(false);
    setTimeout(() => document.getElementById('employer-suggestions-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const retryLastAction = () => {
    setError(null);
    if (selectedSkill && !learningPathways && !employerSuggestions) {
        handleSelectSkillForPathways(selectedSkill);
    } else if (selectedSkill && learningPathways && !employerSuggestions) {
        handleFindEmployers(selectedSkill);
    } else if (selectedSkill && !learningPathways && employerSuggestions) {
        handleSelectSkillForPathways(selectedSkill);
    } else if (!jobMarketAnalysis) {
        handleAnalyze(community, areaOfInterest);
    }
  };

  const renderJobTrend = (trend: JobTrend, index: number) => (
    <Card key={`trend-${index}`} title={trend.trendName} className="animate-fadeIn" icon="📈">
      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{trend.trendDescription}</p>
    </Card>
  );

  const renderSkillGap = (skill: SkillGap, index: number) => (
    <Card key={`skill-${index}`} title={skill.skillName} className="animate-fadeIn" icon="🎯">
      <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6">{skill.gapExplanation}</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => handleSelectSkillForPathways(skill)}
          disabled={isLoading}
          className="flex-1 px-6 py-3 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
          {isLoading && selectedSkill?.skillName === skill.skillName && !learningPathways ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading...
            </span>
          ) : (
            'Find Learning Pathways'
          )}
        </button>
        <button
          onClick={() => handleFindEmployers(skill)}
          disabled={isLoading}
          className="flex-1 px-6 py-3 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
          {isLoading && selectedSkill?.skillName === skill.skillName && !employerSuggestions ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading...
            </span>
          ) : (
            'Find Potential Employers'
          )}
        </button>
      </div>
    </Card>
  );
  
  const renderOnlineCourse = (course: OnlineCourse, index: number) => (
    <Card key={`course-${index}`} title={course.courseName} className="animate-fadeIn" icon="📚">
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
            {course.platform}
          </span>
        </div>
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{course.description}</p>
      </div>
    </Card>
  );

  const renderMentorshipProgram = (program: MentorshipProgram, index: number) => (
    <Card key={`mentor-${index}`} title={program.programIdea} className="animate-fadeIn" icon="🤝">
      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{program.details}</p>
    </Card>
  );

  const renderApprenticeship = (apprenticeship: Apprenticeship, index: number) => (
    <Card key={`apprentice-${index}`} title={apprenticeship.apprenticeshipType} className="animate-fadeIn" icon="🛠️">
      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{apprenticeship.howToFind}</p>
    </Card>
  );

  const renderEmployerSuggestion = (suggestion: EmployerSuggestion, index: number) => (
    <Card key={`employer-${index}`} title={suggestion.sectorOrCompanyType} className="animate-fadeIn" icon="🏢">
      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{suggestion.reasoning}</p>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-500">
      {/* Background decorative elements */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_25%_25%,_var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent dark:from-purple-500/5 pointer-events-none"></div>
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_75%_75%,_var(--tw-gradient-stops))] from-purple-500/5 via-transparent to-transparent dark:from-pink-500/5 pointer-events-none"></div>
      
      <Header />
      
      <main className="relative flex-grow">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-6xl mx-auto">
            {!hasApiKey ? (
              <Section title="Welcome to Skills Gap Navigator">
                <div className="text-center mb-16">
                  <h2 className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-gray-100 dark:to-white bg-clip-text text-transparent mb-6 leading-tight">
                    Get Started
                  </h2>
                  <p className="text-xl text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
                    Unlock personalized career insights powered by advanced AI. Configure your API key to begin your journey.
                  </p>
                </div>
                <ApiKeyManager onApiKeySet={handleApiKeySet} />
              </Section>
            ) : (
              <>
                <Section title="Discover Your Next Opportunity">
                  <div className="text-center mb-16">
                    <h2 className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-gray-100 dark:to-white bg-clip-text text-transparent mb-6 leading-tight">
                      Navigate Your Career Path
                    </h2>
                    <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
                      Harness the power of AI to uncover in-demand skills, emerging opportunities, and personalized growth strategies in your community.
                    </p>
                  </div>
                  <SearchBar onAnalyze={handleAnalyze} isLoading={isLoading && !jobMarketAnalysis} />
                </Section>

                {isLoading && (
                  <div className="my-20">
                    <LoadingSpinner text="Analyzing market trends and opportunities..." />
                  </div>
                )}
                
                <ErrorDisplay error={error} onRetry={retryLastAction} />

                {jobMarketAnalysis && !error && (
                  <Section 
                    title={`Skills Landscape: ${community}${areaOfInterest ? ` • ${areaOfInterest}` : ''}`} 
                    id="analysis-section"
                    className="mt-20"
                  >
                    <div className="mb-16">
                      <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-8 text-center">
                        Market Trends & Insights
                      </h3>
                      {jobMarketAnalysis.jobTrends.length > 0 ? (
                        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
                          {jobMarketAnalysis.jobTrends.map(renderJobTrend)}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                          </div>
                          <p className="text-gray-600 dark:text-gray-400 text-lg">No specific job trends identified for this query.</p>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-8 text-center">
                        High-Impact Skills Gaps
                      </h3>
                      {jobMarketAnalysis.skillsGaps.length > 0 ? (
                        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
                          {jobMarketAnalysis.skillsGaps.map(renderSkillGap)}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                          </div>
                          <p className="text-gray-600 dark:text-gray-400 text-lg">No specific skill gaps identified for this query.</p>
                        </div>
                      )}
                    </div>
                  </Section>
                )}

                {selectedSkill && learningPathways && !error && (
                  <Section 
                    title={`Learning Pathways: ${selectedSkill.skillName}`} 
                    id="learning-pathways-section"
                    className="mt-20"
                  >
                    <div className="mb-16">
                      <h4 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-8 text-center">
                        Online Courses & Certifications
                      </h4>
                      {learningPathways.onlineCourses.length > 0 ? (
                        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
                          {learningPathways.onlineCourses.map(renderOnlineCourse)}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <p className="text-gray-600 dark:text-gray-400 text-lg">No online courses suggested for this skill.</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="mb-16">
                      <h4 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-8 text-center">
                        Mentorship & Networking
                      </h4>
                      {learningPathways.mentorshipPrograms.length > 0 ? (
                        <div className="grid md:grid-cols-2 gap-8">
                          {learningPathways.mentorshipPrograms.map(renderMentorshipProgram)}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <p className="text-gray-600 dark:text-gray-400 text-lg">No mentorship programs suggested for this skill.</p>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <h4 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-8 text-center">
                        Apprenticeships & Hands-on Experience
                      </h4>
                      {learningPathways.apprenticeships.length > 0 ? (
                        <div className="grid md:grid-cols-2 gap-8">
                          {learningPathways.apprenticeships.map(renderApprenticeship)}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <p className="text-gray-600 dark:text-gray-400 text-lg">No apprenticeships suggested for this skill.</p>
                        </div>
                      )}
                    </div>
                  </Section>
                )}

                {selectedSkill && employerSuggestions && !error && (
                  <Section 
                    title={`Career Opportunities: ${selectedSkill.skillName} in ${community}`} 
                    id="employer-suggestions-section"
                    className="mt-20"
                  >
                    {employerSuggestions.employerSuggestions.length > 0 ? (
                      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {employerSuggestions.employerSuggestions.map(renderEmployerSuggestion)}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 text-lg">
                          No specific employer suggestions found for this skill in the specified community.
                        </p>
                      </div>
                    )}
                  </Section>
                )}
              </>
            )}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default App;