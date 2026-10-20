import type { VercelRequest, VercelResponse } from '@vercel/node'

const MINIMAX_BASE_URL = 'https://api.minimax.io/v1'
const MODEL = 'MiniMax-Text-01'
const SUPABASE_URL = 'https://dygmisaatzihbckfdywo.supabase.co'

const STYLE_MAP: Record<string, string> = {
  creative: 'creative, imaginative, and thought-provoking',
  precise: 'precise, specific, and detailed',
  concise: 'concise and to the point while maintaining clarity',
  formal: 'formal, professional, and structured',
  default: '',
}

const MODE_PROMPTS: Record<string, string> = {
  video: `You are an expert prompt engineer specializing in video generation models. Your task is to rewrite the user's text into a hyper-detailed, descriptive video brief. Focus on defining motion and temporal pacing, camera work and cinematography, video quality and production value, and audio integration. Use commas as separators for a strong descriptor list. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
  image: `You are an expert prompt engineer specializing in image generation models. Your task is to rewrite the user's text into a hyper-detailed, descriptive visual brief. Focus on defining the artistic style (e.g., photorealistic, cinematic, oil painting), composition, perspective, lighting, and emotional mood. Use commas as separators for a strong descriptor list. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
  text: `You are an expert prompt engineer for large language models. Your task is to rewrite the user's text into a clearer, more effective prompt: add specificity, structure, and useful context so another AI can answer well. Crucially, your output MUST contain ONLY the improved prompt text itself. Do not include any introduction, explanation, or conversational filler.`,
}

function buildEnhancementPrompt(
  originalPrompt: string,
  mode: string,
  style: string,
  customInstructions: string,
): string {
  const base = MODE_PROMPTS[mode] || MODE_PROMPTS.text
  const styleInstruction = STYLE_MAP[style] || ''
  const styleLine = styleInstruction
    ? `\nMake the enhancement more ${styleInstruction} while keeping ALL of the original intent and requirements intact.`
    : ''
  const customLine = customInstructions
    ? `\nAdditional instructions: ${customInstructions}`
    : ''

  return `${base}${styleLine}${customLine}\n\nUSER_PROMPT: "${originalPrompt.replace(/"/g, '\\"')}"\n\nReturn ONLY the enhanced prompt without any explanations, additional text, formatting, or commentary.`
}

async function getUserSubscriptionTier(
  userId: string,
  accessToken: string,
): Promise<string> {
  // Call the check-subscription edge function
  const response = await fetch(`${SUPABASE_URL}/functions/v1/check-subscription`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    console.error('[enhance] check-subscription failed:', await response.text())
    return 'free'
  }

  const data = await response.json()
  return data.tier ?? 'free'
}

async function verifyJwtAndGetUser(token: string): Promise<{ userId: string; email: string } | null> {
  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/user`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.SUPABASE_ANON_KEY!,
      },
    },
  )
  if (!response.ok) return null
  const user = await response.json()
  return { userId: user.id, email: user.email }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization ?? ''
  const accessToken = authHeader.replace('Bearer ', '').trim()

  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated — please sign in' })
  }

  // Verify the JWT and get user info
  const user = await verifyJwtAndGetUser(accessToken)
  if (!user) {
    return res.status(401).json({ error: 'Invalid session — please sign in again' })
  }

  // Check subscription tier
  const tier = await getUserSubscriptionTier(user.userId, accessToken)
  if (tier === 'free') {
    // Free users get 10 generations per day via the landing page
    // (the extension has its own usage tracking via Supabase auth)
    // We count against the user's row in user_prompt_usage
    // For now, let them through — usage enforcement happens in the DB
    // via the incrementUserPromptUsage call in prompt-usage tracking
  }

  const { originalPrompt, mode = 'text', style = 'default', customInstructions = '' } = req.body

  if (!originalPrompt?.trim()) {
    return res.status(400).json({ error: 'originalPrompt is required' })
  }

  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' })
  }

  const enhancementPrompt = buildEnhancementPrompt(
    originalPrompt.trim(),
    mode,
    style,
    customInstructions,
  )

  try {
    const minimaxRes = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: enhancementPrompt }],
        max_tokens: 1024,
        stream: false,
      }),
    })

    if (!minimaxRes.ok) {
      const errorText = await minimaxRes.text()
      return res.status(502).json({ error: 'Enhancement service error', detail: errorText })
    }

    const data = await minimaxRes.json()
    const enhanced = data.choices?.[0]?.message?.content ?? ''

    return res.status(200).json({
      enhanced,
      tier,
      userId: user.userId,
    })
  } catch (err: any) {
    return res.status(500).json({ error: 'Request failed', detail: err.message })
  }
}
