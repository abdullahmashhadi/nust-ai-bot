const { OpenAI } = require("openai");
const { VectorStore } = require("./vectoreStore");
const { AdvancedRAG } = require("./AdvancedRAG");
const axios = require("axios");
const FormData = require("form-data");

class ChatService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.vectorStore = VectorStore;
    this.advancedRAG = new AdvancedRAG();
    this.conversations = new Map();

    // Toggle between naive and advanced RAG
    this.useAdvancedRAG = process.env.USE_ADVANCED_RAG !== "false"; // Default to true

    // RAG mode: 'fast', 'balanced', 'quality'
    this.ragMode = process.env.RAG_MODE || "balanced"; // Default to balanced
  }
  isFeeRelatedQuery(message) {
    const feeKeywords = [
      "fee",
      "fees",
      "cost",
      "costs",
      "tuition",
      "charges",
      "charge",
      "payment",
      "pay",
      "price",
      "pricing",
      "amount",
      "money",
      "semester fee",
      "annual fee",
      "admission fee",
      "how much",
      "expense",
      "expenses",
      "financial",
      "scholarship",
    ];

    const messageLower = message.toLowerCase();
    return feeKeywords.some((keyword) => messageLower.includes(keyword));
  }
  async streamResponse(message, conversationId = "default", isVoice = false) {
    try {
      let conversation = this.conversations.get(conversationId);
      if (!conversation) {
        conversation = [];
        this.conversations.set(conversationId, conversation);
      }

      // Use Advanced RAG or fallback to naive RAG
      let context;
      if (this.useAdvancedRAG) {
        console.log(`🚀 Using Advanced RAG (${this.ragMode} mode)`);

        // Select retrieval mode based on config
        switch (this.ragMode) {
          case "fast":
            // Fast mode: No re-ranking, no compression (2-3x faster)
            context = await this.advancedRAG.fastRetrieve(message);
            break;
          case "balanced":
            // Balanced mode: Smart routing with automatic strategy selection
            context = await this.advancedRAG.smartRetrieve(message);
            break;
          case "quality":
          default:
            // Quality mode: Full advanced RAG with smart routing (best quality)
            context = await this.advancedRAG.smartRetrieve(message);
            break;
        }
      } else {
        console.log("📌 Using Naive RAG");
        context = await this.vectorStore.retrieveContext(message);
      }

      console.log("Retrieved Context Length:", context.length);

      // Debug: Log context snippet for table-related queries
      if (
        message.toLowerCase().includes("series") ||
        message.toLowerCase().includes("schedule")
      ) {
        const contextSnippet = context.substring(0, 500);
        console.log("📄 Context snippet:", contextSnippet);
        console.log("📄 Full context for debugging:\n", context);
        if (context.includes("Series - 4")) {
          console.log("✅ Context contains Series - 4 data");
          if (context.includes("Karachi: Jul 2026")) {
            console.log('✅ Context contains "Karachi: Jul 2026"');
          }
        } else {
          console.log("❌ Context does NOT contain Series - 4 data");
        }
      }

      const systemPrompt = this.buildSystemPrompt(
        context,
        isVoice,
        this.isFeeRelatedQuery(message),
      );
      conversation.push({ role: "user", content: message });
      const messages = [
        { role: "system", content: systemPrompt },
        ...conversation.slice(-10), // Keep last 10 messages for context
      ];
      const stream = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        temperature: 0.2, // Low temperature for consistent, factual responses
        max_tokens: 1000,
        stream: true,
      });
      let assistantResponse = "";

      const streamGenerator = async function* () {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            assistantResponse += content;
            yield content;
          }
        }
      };
      const generator = streamGenerator();

      return this.wrapGeneratorWithSave(
        generator,
        conversation,
        conversationId,
      );
    } catch (error) {
      console.error("Streaming error:", error);
      throw error;
    }
  }

  async *wrapGeneratorWithSave(generator, conversation, conversationId) {
    let fullResponse = "";

    for await (const chunk of generator) {
      fullResponse += chunk;
      yield chunk;
    }

    conversation.push({ role: "assistant", content: fullResponse });
    this.conversations.set(conversationId, conversation);
  }

  buildSystemPrompt(context, isVoice, isFeeQuery = false) {
    const meritData = `
      NUST Closing Merit Explanations
At NUST, admissions are decided based on two factors: the closing merit position
(the last student admitted in order of merit list) and the closing merit percentage
(aggregate). A student is eligible for admission if their aggregate percentage is
higher than the closing percentage or if their merit position is less than or equal to
the closing position. If their aggregate is lower, or merit position is greater, then they
fall short of selection.
BE Electrical Engineering
The highest competition is at SEECS, where the closing merit position was 2449, with
a closing aggregate of 67.45%. This means only students above 67.45% or ranked
2449 or better got admission. At EME, the merit closed at 6139 with a percentage of
59.26%, while at PNEC it dropped further to 7788 with 56.45%. At MCS, the closing
position was 7703 with 56.89%.
BE Mechanical Engineering
For Mechanical Engineering, SMME remained the most competitive with a closing
merit position of 3083 and an aggregate of 65.27%. EME admitted students up to
position 6204 with 57.59%, while PNEC closed at 7416 with 54.77%.
BE Civil Engineering
Civil Engineering at NICE closed at 5637 with an aggregate of 60.03%, while MCE
went as far as 9204 with 53.41%. The NBC campus admitted students up to 14714,
closing at 49.92%, one of the lowest merit aggregates among engineering programs.
BS Software Engineering
SEECS remains highly competitive, with Software Engineering closing at only 378th
merit position with 78.42%. MCS offered more room, closing at 1262 with 72.09%.
BS Data Science
At SEECS, Data Science closed at 652 with an aggregate of 77.08%, showing high
demand and limited intake.
BE Avionics Engineering
CAE offered Avionics with the merit closing at 4954 and an aggregate of 61.91%.
BE Chemical Engineering
SCME closed admissions for Chemical Engineering at 6155 with 58.37%.BE Material Engineering
At SCME, Materials Engineering closed at 8419 with a relatively low 53.49%.
BE Environmental Engineering
IESE admitted students up to position 8199, closing at 53.99%.
BE Mechatronics Engineering
Mechatronics at EME remained fairly competitive, closing at 4830 with 62.12%.
BS Computer Engineering
At EME, Computer Engineering closed at 2746 with 66.81%.
BS Computer Science (BSCS)
SEECS had one of the highest merit thresholds in all programs, closing at 447th
position with an impressive 79.11%. NBC also offered BSCS, closing at 5360 with
64.69%.
BE Aerospace Engineering
SMME closed Aerospace at 3292 with 64.98%, while CAE was stricter with 1567
and 69.93%.
BS Artificial Intelligence (BS AI)
At SEECS, AI closed at 566th position with 77.89% — reflecting huge demand. At
NBC, however, the merit extended to 12369 with 54.16%, showing variation across
campuses.
BS Bioinformatics
SINES closed at 1554 with an aggregate of 72.92%.
BS Information Security
MCS offered BSIS with the closing merit at 2988 and 65.94%.
BS Architecture & Industrial Design
SADA had Architecture closing very early at 163rd position with 65.09%, while
Industrial Design closed at 333 with 57.99%.
BE GeoinformaticsIGIS closed Geoinformatics at 5975 with 58.86%.
BS Environmental Sciences
At SCEE, Environmental Sciences closed at 1786, with percentages ranging between
61–64%.
BS Biotechnology
ASAB closed Biotechnology at 704 with an aggregate between 68–70%, reflecting its
competitiveness.
BS Agriculture
At ASAB, Agriculture closed at 2779, with merit ranging 54–56%.
BS Food Science and Technology
ASAB’s Food Science program closed at 1432, with a merit range of 64–66%.
BE Naval Architecture
At PNEC, Naval Architecture closed at 13757 with a low aggregate of 50.07%.
Business Programs (NBS)
For BBA, the merit closed at 770 with 73.71%. Accounting & Finance closed at 1089
with 70.92%. Tourism and Hospitality extended to 2757 with 60.01%.
Law and Social Sciences
LLB closed at 282nd position with 66.01%, while Economics closed at 1469 with
69.03%. Mass Communication closed at 2775 with 59.97%, Public Administration at
2645 with 61.11%, and Psychology at 2071 with 64.21%.
Natural Sciences (SNS)
Mathematics closed at 1814 with 54–56%, Physics at 1778 with 54–55%, and
Chemistry at 2240 with 53–56%.
    `;

    const baseFeeInstructions = isFeeQuery
      ? `
🔸 FEE QUERY DETECTED - SPECIAL INSTRUCTIONS:

1. **ALWAYS provide fee information if available in context**
2. **Be specific about program names** - don't mix up BEEE, BSCS, BBA, etc.
3. **Use exact fee amounts** from context 
4. **Include all fee components**: Admission Processing Fee, Security Deposit, Tuition Fee, Miscellaneous Charges
5. **Specify the academic year**
6. **Distinguish between National (PKR) and International (USD) students**
`
      : "";
    const basePrompt = `You are a NUST (National University of Sciences and Technology) AI assistant. Your role is to provide accurate, consistent information about NUST using the provided context.

**CURRENT DATE AWARENESS:**
Today's date is: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
When answering date/schedule queries, consider if the dates in context are past or future.
If all dates in context have passed, acknowledge this and suggest checking NUST website for updated schedules.

${baseFeeInstructions}
\n\n\n\n\n
${meritData}
\n\n\n\n
CRITICAL RESPONSE RULES:

1. GENERIC GREETINGS (hi, hello, hey, etc.):
   - Respond warmly and mention you're here to help with NUST information
   - Ask what specific information they need about NUST
   - Keep it brief and friendly

2. EXACT ANSWERS (when context contains full information):
   - When not provided with undergraduate or postgraduate context, assume undergraduate
   - For fee queries: Always specify program category (Engineering/Computing vs Business/Social Sciences)
   - Provide precise, factual answer directly from context
   - Use specific numbers, dates, requirements
   - Maximum 2-3 sentences (40-60 words) except for fee breakdowns which can be longer
   - Be consistent - same question = same answer

3. ELIGIBILITY QUERIES (who can apply, FSc Arts, ICS, Pre-Med, etc.):
   - If context lists eligible backgrounds (Pre-Engineering, Pre-Medical, ICS) for a program
   - And the query asks about a background NOT in that list (e.g., FSc Arts)
   - CLEARLY STATE: "No, [background] is not eligible because the program requires [list of eligible backgrounds]"
   - Example: "No, FSc Arts students cannot apply for NET-Engineering. The test is for candidates with Pre-Engineering, Pre-Medical (with additional math), or ICS backgrounds, as these include the required Mathematics, Physics, and science subjects that FSc Arts does not cover."

4. PARTIAL ANSWERS (when context has some but not complete information):
   - Share what you know from contextwhat is fee
   - Then provide helpful official NUST links for complete details
   - Format: "Based on available information: [partial answer]. For complete details: [relevant links]"

5. NO INFORMATION AVAILABLE:
   - State clearly: "I don't have that specific information"
   - Provide relevant NUST official links where they can find the answer
   - Suggest contacting NUST directly if needed

CONTEXT:
${context}

HELPFUL NUST LINKS (use when needed):
- General Info: https://nust.edu.pk
- Admissions: https://nust.edu.pk/admissions
- Programs: https://nust.edu.pk/academics/schools-colleges
- Contact: https://nust.edu.pk/contact-us
- Student Portal: https://student.nust.edu.pk

RESPONSE FORMAT:
${
  isVoice
    ? `VOICE MODE:
- Natural conversational tone
- NO links or URLs (mention "check NUST website" instead)
- Keep responses under 30 words for quick listening
- Use simple, clear language`
    : `TEXT MODE:
- Use **bold** for key numbers/requirements
- Include clickable links: [Text](URL)
- Bullet points for multiple items
- Proper formatting for readability`
}

CONSISTENCY FRAMEWORK:
- Identical questions → Identical answers
- Use exact terminology from source documents
- Prioritize official deadlines and requirements
- Maintain professional yet helpful tone

QUALITY ASSURANCE:
✓ Is this the most direct answer possible?
✓ Is all information from the provided context?
✓ Would this response be consistent if asked differently?
✓ Does this genuinely help the user?

EXAMPLE RESPONSES:

Generic: "Hi" → "Hello! I'm here to help with NUST information. What would you like to know about admissions, programs, or campus life?"

Exact: "NUST admission requirements" → "NUST requires minimum 60% in intermediate and valid NET entry test score. **Deadline:** March 15th. Apply online: [NUST Admissions](https://nust.edu.pk/admissions)"

Fee Query: "BSCS fee" → "**BSCS (Computer Science) Fee 2025-26:**
- **Tuition:** ₹197,050/semester (Engineering category)
- **Admission Processing:** ₹35,000 (non-refundable)  
- **Security Deposit:** ₹10,000 (refundable)
- **Miscellaneous:** ₹5,000/semester"

Partial: "Hostel facilities" → "NUST provides on-campus accommodation with modern facilities. For detailed room types, fees, and booking: [Student Services](https://nust.edu.pk/student-life)"

No Info: "Swimming pool timings" → "I don't have specific pool timings. Check [NUST Sports](https://nust.edu.pk/student-life/sports) or contact campus directly at +92-51-9085-6000."`;

    return basePrompt;
  }

  async transcribeAudio(buffer) {
    try {
      console.log("Transcribing audio buffer of size:", buffer.length);

      // Create form da
      const form = new FormData();
      form.append("file", buffer, {
        filename: "audio.webm",
        contentType: "audio/webm",
      });
      form.append("model", "whisper-1");

      console.log("Sending transcription request to OpenAI...");

      const response = await axios.post(
        "https://api.openai.com/v1/audio/transcriptions",
        form,
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            ...form.getHeaders(),
          },
          timeout: 30000,
        },
      );

      console.log("Transcription response:", response.data);
      return response.data.text;
    } catch (error) {
      console.error("Transcription error details:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });

      // Return a fallback message instead of throwing
      return "Sorry, I couldn't understand the audio. Please try speaking again.";
    }
  }

  async synthesizeAudio(text) {
    try {
      console.log(
        "Synthesizing audio for text:",
        text.substring(0, 100) + "...",
      );

      const response = await axios.post(
        "https://api.openai.com/v1/audio/speech",
        {
          model: "tts-1",
          voice: "nova",
          input: text,
          response_format: "mp3", // Specify format explicitly
        },
        {
          responseType: "arraybuffer",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 30000, // 30 second timeout
        },
      );

      console.log(
        "Audio synthesis successful, buffer size:",
        response.data.byteLength,
      );
      return Buffer.from(response.data);
    } catch (error) {
      console.error("Audio synthesis error:", error.message);
      throw error;
    }
  }

  clearConversation(conversationId) {
    this.conversations.delete(conversationId);
  }

  // Get conversation history
  getConversation(conversationId) {
    return this.conversations.get(conversationId) || [];
  }
}

module.exports = ChatService;
