import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GEMINI_MODEL_TEXT } from '../constants';
import { JobMarketAnalysis, LearningPathways, EmployerSuggestions, ApiError } from '../types';

let ai: GoogleGenAI | null = null;

export const initializeGemini = (apiKey: string) => {
  if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
    return true;
  }
  return false;
};

// Initialize with saved API key if available
const savedApiKey = localStorage.getItem('gemini_api_key');
if (savedApiKey) {
  initializeGemini(savedApiKey);
}

const parseGeminiJsonResponse = <T extends object,>(responseText: string): T | { error: string } => {
  let jsonStr = responseText.trim();
  const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[2]) {
    jsonStr = match[2].trim();
  }
  try {
    // Attempt to parse, assuming the structure matches T.
    // For robustness, consider schema validation here if complex objects are expected.
    return JSON.parse(jsonStr) as T;
  } catch (e: any) {
    console.error("Failed to parse JSON response:", e, "Raw response:", responseText);
    return { error: `Failed to parse JSON: ${e.message}. Response was: ${responseText.substring(0,100)}...` };
  }
};

const generateContent = async <T extends object,>(prompt: string): Promise<T | ApiError> => {
  if (!ai) {
    return { message: "Gemini API client is not initialized. Please set your API key." };
  }

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_TEXT,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    
    const parsedData = parseGeminiJsonResponse<T>(response.text);

    if ('error' in parsedData) { // Check if parseGeminiJsonResponse returned an error object
        return { message: "Failed to parse response from AI.", details: (parsedData as {error: string}).error };
    }
    // At this point, parsedData should be of type T.
    // The assertion 'as T' is used because TypeScript might not fully narrow it down
    // after the 'in' check if T itself could theoretically have an 'error' property.
    // Given our specific types (JobMarketAnalysis etc.), this is safe.
    return parsedData as T;

  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    // Handle cases where the error might be a GoogleGenAIError or other types
    let errorMessage = "An error occurred while contacting the AI service.";
    let errorDetails: string | undefined = undefined;

    if (error instanceof Error) {
        errorMessage = error.message;
        // Potentially inspect error.name or other properties for more specific Gemini errors
        if ( (error as any).details) { // Check if there are more details, e.g. from GoogleGenAIError
          errorDetails = (error as any).details;
        } else {
           errorDetails = String(error); // Fallback to stringifying the error if no details field
        }
    } else {
       errorDetails = String(error);
    }
    
    return { message: errorMessage, details: errorDetails };
  }
};


export const fetchJobMarketAnalysis = async (community: string, areaOfInterest?: string): Promise<JobMarketAnalysis | ApiError> => {
  const prompt = `Analyze the current job market trends and identify emerging skills gaps in ${community}${areaOfInterest ? ` focusing on ${areaOfInterest}` : ''}.
  Provide deep, actionable insights.
  Please structure your response as a JSON object with two keys: "jobTrends" and "skillsGaps".
  For "jobTrends", provide an array of 3-5 objects, each with "trendName" (string) and "trendDescription" (string, detailed 2-3 sentences).
  For "skillsGaps", provide an array of 3-5 objects, each with "skillName" (string) and "gapExplanation" (string, detailed 2-3 sentences explaining why it's a gap and its importance).
  Example for "jobTrends": [{"trendName": "Advanced AI & ML Specialization", "trendDescription": "Businesses are moving beyond basic AI applications to specialized machine learning models for predictive analytics, natural language processing, and computer vision. This requires a deeper understanding of algorithms and model deployment."}]
  Example for "skillsGaps": [{"skillName": "Cybersecurity for IoT and Edge Computing", "gapExplanation": "As IoT devices and edge computing proliferate, securing these distributed systems becomes critical. There's a growing gap for professionals who can design and implement robust security protocols for these new architectures."}]
  Ensure the language is professional, insightful, and suitable for career planning.`;
  
  const result = await generateContent<JobMarketAnalysis>(prompt);
  // Check if the result is an ApiError first
  if ('message' in result && 'details' in result) { // This is an ApiError
    return result;
  }
  // If not an ApiError, it should be JobMarketAnalysis. Perform structural validation.
  const data = result as JobMarketAnalysis; // Cast for easier access
  if (!data.jobTrends || !data.skillsGaps || !Array.isArray(data.jobTrends) || !Array.isArray(data.skillsGaps)) {
      return { message: "Received invalid data structure for job market analysis.", details: "Expected 'jobTrends' and 'skillsGaps' arrays." };
  }
  return data;
};

export const fetchLearningPathways = async (community: string, skill: string): Promise<LearningPathways | ApiError> => {
  const prompt = `For an individual in ${community} looking to acquire skills in "${skill}", provide personalized and practical learning pathway suggestions.
  Structure your response as a JSON object with three keys: "onlineCourses", "mentorshipPrograms", and "apprenticeships".
  For "onlineCourses", provide an array of 2-3 objects, each with "courseName" (string), "platform" (string, e.g., Coursera, edX, Udemy, Pluralsight, or "Specialized Provider"), and "description" (string, 2-3 sentences highlighting key learnings and benefits).
  For "mentorshipPrograms", provide an array of 1-2 objects, each with "programIdea" (string, e.g., "Engage with local tech meetups for mentorship opportunities") and "details" (string, 2-3 sentences on how to approach this and what to expect).
  For "apprenticeships", provide an array of 1-2 objects, each with "apprenticeshipType" (string, e.g., "Structured Corporate Apprenticeships in ${skill}") and "howToFind" (string, 2-3 sentences on specific search strategies or platforms).
  Example for "onlineCourses": [{"courseName": "Advanced ${skill} Bootcamp", "platform": "Udemy", "description": "A hands-on bootcamp covering advanced techniques in ${skill}, project-based learning, and real-world case studies. Ideal for skill specialization."}]
  Keep suggestions highly actionable and relevant to current industry standards.`;
  
  const result = await generateContent<LearningPathways>(prompt);
  if ('message' in result && 'details' in result) {
    return result;
  }
  const data = result as LearningPathways;
  if (!data.onlineCourses || !data.mentorshipPrograms || !data.apprenticeships || !Array.isArray(data.onlineCourses) || !Array.isArray(data.mentorshipPrograms) || !Array.isArray(data.apprenticeships)) {
       return { message: "Received invalid data structure for learning pathways.", details: "Expected 'onlineCourses', 'mentorshipPrograms', and 'apprenticeships' arrays." };
  }
  return data;
};

export const fetchEmployerSuggestions = async (community: string, skill: string): Promise<EmployerSuggestions | ApiError> => {
  const prompt = `For someone in ${community} with demonstrated skills in "${skill}", identify 2-3 types of local or relevant remote employers and industries that are likely hiring.
  Structure your response as a JSON object with a key "employerSuggestions".
  "employerSuggestions" should be an array of objects, each with "sectorOrCompanyType" (string) and "reasoning" (string, 2-3 sentences detailing why they hire for this skill and potentially what roles to look for).
  Example: [{"sectorOrCompanyType": "Emerging FinTech Companies in ${community}", "reasoning": "FinTech startups are rapidly adopting ${skill} for fraud detection and personalized financial services. They often seek ${skill} analysts and engineers."}]
  Focus on providing specific and actionable insights for job seekers.`;
  
  const result = await generateContent<EmployerSuggestions>(prompt);
  if ('message' in result && 'details' in result) {
      return result;
  }
  const data = result as EmployerSuggestions;
  if (!data.employerSuggestions || !Array.isArray(data.employerSuggestions)) {
      return { message: "Received invalid data structure for employer suggestions.", details: "Expected 'employerSuggestions' array." };
  }
  return data;
};
