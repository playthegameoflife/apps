
export interface JobTrend {
  trendName: string;
  trendDescription: string;
}

export interface SkillGap {
  skillName: string;
  gapExplanation: string;
}

export interface JobMarketAnalysis {
  jobTrends: JobTrend[];
  skillsGaps: SkillGap[];
}

export interface OnlineCourse {
  courseName: string;
  platform: string;
  description: string;
}

export interface MentorshipProgram {
  programIdea: string;
  details: string;
}

export interface Apprenticeship {
  apprenticeshipType: string;
  howToFind: string;
}

export interface LearningPathways {
  onlineCourses: OnlineCourse[];
  mentorshipPrograms: MentorshipProgram[];
  apprenticeships: Apprenticeship[];
}

export interface EmployerSuggestion {
  sectorOrCompanyType: string;
  reasoning: string;
}

export interface EmployerSuggestions {
  employerSuggestions: EmployerSuggestion[];
}

// Represents the overall state for API results and UI display
export interface AnalysisData {
  jobMarketAnalysis: JobMarketAnalysis | null;
  learningPathways: LearningPathways | null;
  employerSuggestions: EmployerSuggestions | null;
}

// Defines the possible stages of the application flow
export type AppStage = 
  | 'initial' 
  | 'loadingAnalysis' 
  | 'showingAnalysis' 
  | 'loadingPathways' 
  | 'showingPathways' 
  | 'loadingEmployers' 
  | 'showingEmployers';

export interface ApiError {
  message: string;
  details?: string;
}
