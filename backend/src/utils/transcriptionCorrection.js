/**
 * Transcription Correction Utility
 * Fixes ASR errors for NUST-specific terms
 */

const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// NUST-specific term corrections
const NUST_TERM_CORRECTIONS = {
  // Schools/Colleges
  'six': 'SEECS',
  'seeks': 'SEECS',
  'six school': 'SEECS',
  'seex': 'SEECS',
  'sikhs': 'SEECS',
  'seeks': 'SEECS',
  'siks': 'SEECS',
  'sex': 'SEECS',
  'a sub': 'ASAB',
  'a sab': 'ASAB',
  'asub': 'ASAB',
  'essay bee': 'ASAB',
  'ace up': 'ASAB',
  'asap': 'ASAB',
  'a sap': 'ASAB',
  'n b c': 'NBC',
  'envy see': 'NBC',
  'enby see': 'NBC',
  'p neck': 'PNEC',
  'pee neck': 'PNEC',
  'peak': 'PNEC',
  's triple e': 'SCEE',
  'sce': 'SCEE',
  'smee': 'SMME',
  's m m e': 'SMME',
  'essay me': 'SMME',
  's c m e': 'SCME',
  'sad a': 'SADA',
  'sada': 'SADA',
  'n b s': 'NBS',
  'envy s': 'NBS',
  'cae': 'CAE',
  'kay ee': 'CAE',
  'sea': 'CAE',
  'mcs': 'MCS',
  'em see ess': 'MCS',
  'co eme': 'CoEME',
  'co ee me': 'CoEME',
  's three h': 'S3H',
  'essay three h': 'S3H',
  's n s': 'SNS',
  'essay n s': 'SNS',
  'i g i s': 'IGIS',
  'i c e': 'IESE',
  'i see': 'IESE',
  's i n e s': 'SINES',
  'signs': 'SINES',
  
  // Programs (common mishearings)
  'b s c s': 'BSCS',
  'bee ess see ess': 'BSCS',
  'b s software': 'BS Software Engineering',
  'b s ai': 'BS AI',
  'bs a i': 'BS AI',
  'bee bee a': 'BBA',
  'b b a': 'BBA',
  'llb': 'LLB',
  'l l b': 'LLB',
  
  // Test names
  'net': 'NET',
  'net test': 'NET',
  'n e t': 'NET',
  'sat': 'SAT',
  's a t': 'SAT',
  'act': 'ACT',
  'a c t': 'ACT',
  
  // Common terms
  'nust': 'NUST',
  'n u s t': 'NUST',
  'must': 'NUST',
  'i b c c': 'IBCC',
  'ibcc': 'IBCC',
  'f s c': 'FSc',
  'fsc': 'FSc',
  'o level': 'O Level',
  'a level': 'A Level',
  'pre engineering': 'Pre-Engineering',
  'pre medical': 'Pre-Medical',
};

/**
 * Apply dictionary-based corrections to transcript
 * @param {string} transcript - Raw transcript from ASR
 * @returns {string} - Corrected transcript
 */
function correctNUSTTerms(transcript) {
  if (!transcript || typeof transcript !== 'string') {
    return transcript;
  }

  let corrected = transcript;
  
  // Sort by length (longer phrases first to avoid partial replacements)
  const sortedCorrections = Object.entries(NUST_TERM_CORRECTIONS)
    .sort((a, b) => b[0].length - a[0].length);
  
  for (const [wrong, right] of sortedCorrections) {
    // Case-insensitive word boundary replacement
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    corrected = corrected.replace(regex, right);
  }
  
  return corrected;
}

/**
 * LLM-based intelligent correction for context-aware fixes
 * Handles phonetic errors and context that dictionary misses
 * @param {string} transcript - Transcript after dictionary correction
 * @returns {Promise<string>} - AI-corrected transcript
 */
async function intelligentCorrection(transcript) {
  try {
    const prompt = `You are a transcription correction expert for NUST (National University of Sciences and Technology) queries.

Fix ASR transcription errors for NUST-specific terms. Common phonetic errors:

SCHOOLS/COLLEGES:
- "seats", "six", "seeks", "Sikhs", "siks" → "SEECS" (School of Electrical Engineering and Computer Science)
- "ASAP", "a sub", "a sab", "ace up" → "ASAB" (Atta-ur-Rahman School of Applied Biosciences)
- "NBC", "envy see" → "NBC" (NUST Business School satellite campus)
- "peak", "p neck" → "PNEC" (Pakistan Navy Engineering College)
- "smee", "essay me" → "SMME" (School of Mechanical & Manufacturing Engineering)
- "sce", "essay see" → "SCEE" (School of Civil & Environmental Engineering)
- "sad a", "sada" → "SADA" (School of Art, Design and Architecture)
- "cae", "sea", "kay" → "CAE" (College of Aeronautical Engineering)
- "mcs", "em see ess" → "MCS" (Military College of Signals)
- "co ee me" → "CoEME" (College of Electrical & Mechanical Engineering)

PROGRAMS:
- "bee ess see ess", "b s c s" → "BSCS" (Computer Science)
- "bee bee a" → "BBA" (Business Administration)
- "l l b", "el el bee" → "LLB" (Law)
- "ai", "a i" → "AI" (Artificial Intelligence)

TESTS:
- "net", "n e t" → "NET" (NUST Entry Test)
- "sat", "s a t" → "SAT" (Scholastic Aptitude Test)
- "act", "a c t" → "ACT" (American College Test)

OTHER:
- "must", "newest" → "NUST"
- "fsc", "f s c" → "FSc" (Faculty of Science)

RULES:
1. Only fix NUST-specific terms - leave other words unchanged
2. Use context to disambiguate:
   - "Which school has higher merit, Sikhs or ASAP?" → "Which school has higher merit, SEECS or ASAB?"
   - "What is fee for seats school?" → "What is fee for SEECS?"
   - "Tell me about six at NUST" → "Tell me about SEECS at NUST"
3. Preserve capitalization patterns from the list above
4. Keep question structure and grammar intact
5. If unsure, don't change it

Original transcript: "${transcript}"

Corrected transcript (only fix NUST terms, output ONLY the corrected text):`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 150,
    });

    const corrected = response.choices[0].message.content.trim();
    
    // Remove any quotes or extra formatting
    return corrected.replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error('LLM correction error:', error.message);
    // Fallback to original transcript if LLM fails
    return transcript;
  }
}

/**
 * Apply full correction pipeline: dictionary + LLM
 * @param {string} transcript - Raw transcript from ASR
 * @returns {Promise<string>} - Fully corrected transcript
 */
async function correctTranscript(transcript) {
  if (!transcript || typeof transcript !== 'string') {
    return transcript;
  }

  // Step 1: Fast dictionary-based corrections
  const dictionaryCorrected = correctNUSTTerms(transcript);
  
  // Step 2: Intelligent LLM-based correction for missed errors
  const fullyCorrected = await intelligentCorrection(dictionaryCorrected);
  
  return fullyCorrected;
}

/**
 * Log transcription corrections for monitoring
 * @param {string} original - Original transcript
 * @param {string} corrected - Corrected transcript
 */
function logCorrection(original, corrected) {
  if (original !== corrected) {
    console.log('🔧 Transcription corrected:');
    console.log('  Before:', original);
    console.log('  After:', corrected);
  }
}

module.exports = {
  correctNUSTTerms,
  intelligentCorrection,
  correctTranscript,
  logCorrection,
  NUST_TERM_CORRECTIONS
};
