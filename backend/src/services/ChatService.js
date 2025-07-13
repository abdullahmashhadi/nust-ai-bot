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
    if(isVoice){
      const voicePrompt = `You are a helpful AI assistant for NUST. Keep responses SHORT and conversational for voice interaction.

Use the following context to answer questions:

CONTEXT:
${context}

VOICE RESPONSE GUIDELINES:
- Keep answers under 50 words when possible
- Use simple, conversational language
- No bullet points or special formatting
- Give direct answers without extra explanations
- If information is complex, give the key point and offer to explain more
- Use "you can" instead of "students can"
- End with "Need more details?" if there's more to explain

Example: "NUST admission requires 60% in intermediate and entry test. Applications open in March. Need more details?"`;

      return voicePrompt;
    }
    
    const basePrompt = `You are a helpful AI assistant for NUST website. You have access to NUST documentation and website content.

Use the following context to answer questions accurately and helpfully:

CONTEXT:
${context}

RESPONSE FORMATTING GUIDELINES:
- Use **bold text** for important information and headings
- Use *italic text* for emphasis
- Create bulleted lists using • for better readability
- Include relevant links in format: [Link Text](URL) when applicable
- Use numbered lists for step-by-step instructions
- Structure your response with clear sections when answering complex questions
- For contact information, format as: **Phone:** +92-xxx-xxx-xxxx or **Email:** example@nust.edu.pk
- For important dates/deadlines, format as: **Deadline:** Date
- Use line breaks to separate different topics or sections

CONTENT GUIDELINES:
- Answer based on the provided context when possible
- If you don't have specific information, say so clearly
- Be concise but comprehensive
- Maintain a professional, friendly tone
- Students should get all required information
- If asked about something not in the context, provide general helpful information
- Always try to include relevant NUST website links when mentioning specific programs, departments, or services

Example formatting:
**Admission Requirements:**
• Minimum 60% marks in intermediate
• Valid entry test score
• [Apply online here](https://nust.edu.pk/admissions)

For more information, visit [NUST Official Website](https://nust.edu.pk)`;

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