const { OpenAI } = require("openai");
const { VectorStore } = require("./vectoreStore");

class ChatService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.vectorStore = VectorStore;
    this.conversations = new Map();
  }

  async streamResponse(message, conversationId = "default") {
    try {
      let conversation = this.conversations.get(conversationId);
      if (!conversation) {
        conversation = [];
        this.conversations.set(conversationId, conversation);
      }
      const context = await this.vectorStore.retrieveContext(message);
      const systemPrompt = this.buildSystemPrompt(context);
      conversation.push({ role: "user", content: message });
      const messages = [
        { role: "system", content: systemPrompt },
        ...conversation.slice(-10), // Keep last 10 messages for context
      ];
      const stream = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
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

  async *wrapGeneratorWithSave(
    generator,
    conversation,
    conversationId
  ) {
    let fullResponse = "";

    for await (const chunk of generator) {
      fullResponse += chunk;
      yield chunk;
    }

    conversation.push({ role: "assistant", content: fullResponse });
    this.conversations.set(conversationId, conversation);
    console.log(`Conversation updated for ID ${conversationId}:`, conversation);

  }
  buildSystemPrompt(context) {
    const basePrompt = `You are a helpful AI assistant for NUST website. You have access to NUST documentation and website content.

Use the following context to answer questions accurately and helpfully:

CONTEXT:
${context}

Guidelines:
- Answer based on the provided context when possible
- If you don't have specific information, say so clearly
- Be concise but comprehensive
- Maintain a professional, friendly tone
- Students should get all required information
- If asked about something not in the context, provide general helpful information`;

    return basePrompt;
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
