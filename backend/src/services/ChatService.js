const { OpenAI } = require("openai");
const { VectorStore } = require("./vectoreStore");
const axios = require("axios");
const FormData = require("form-data");

class ChatService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.vectorStore = VectorStore;
    this.conversations = new Map();
  }

  async streamResponse(message, conversationId = "default",isVoice=false) {
    try {
      let conversation = this.conversations.get(conversationId);
      if (!conversation) {
        conversation = [];
        this.conversations.set(conversationId, conversation);
      }
      const context = await this.vectorStore.retrieveContext(message);
      
      const systemPrompt = this.buildSystemPrompt(context,isVoice);
      conversation.push({ role: "user", content: message });
      const messages = [
        { role: "system", content: systemPrompt },
        ...conversation.slice(-10), // Keep last 10 messages for context
      ];
      const stream = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        temperature: 0.7,
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
        conversationId
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
    console.log(`Conversation updated for ID ${conversationId}:`, conversation);
  }

  buildSystemPrompt(context, isVoice) {    
    const basePrompt = `You are a helpful AI assistant for NUST website. You have access to NUST documentation and website content.

Use the following context to answer questions accurately and helpfully:

CONTEXT:
${context}

RESPONSE GUIDELINES:
- Keep responses VERY concise: 2-3 lines maximum
- Provide only essential information directly related to the question
- Be precise and to the point
- No extra details or elaboration unless specifically asked
${isVoice ? 
`- This is a VOICE interaction: DO NOT include any links or URLs in your response
- Use simple, spoken language without formatting
- Focus only on the core answer` : 
`- Include relevant links when applicable: [Link Text](URL)
- Use **bold** for key information when needed`}

Example responses:
Question: "What are NUST admission requirements?"
Answer: "Minimum 60% in intermediate and valid entry test score required.${isVoice ? '' : ' Apply at [NUST Admissions](https://nust.edu.pk/admissions)'}"`;

    return basePrompt;
  }

  async transcribeAudio(buffer) {
    try {
      console.log("Transcribing audio buffer of size:", buffer.length);
      
      // Create form data
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
        }
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
      console.log("Synthesizing audio for text:", text.substring(0, 100) + "...");
      
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
        }
      );

      console.log("Audio synthesis successful, buffer size:", response.data.byteLength);
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