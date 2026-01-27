const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io"); 
require("dotenv").config();
const mainRouter = require("./routes/route.js");
const ChatService = require("./services/ChatService.js");
const Vad = require('node-vad');

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const vad = new Vad(Vad.Mode.NORMAL);
const chatService = new ChatService();

app.use("/api", mainRouter);

const audioBuffers = new Map();
const silenceCounters = new Map();

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  
  audioBuffers.set(socket.id, Buffer.alloc(0));
  silenceCounters.set(socket.id, 0);
  
  socket.emit("connection_success", {
    message: "Connected to chat server",
    socketId: socket.id,
  });

  socket.on("chat_message", async (data) => {
    try {
      const { message, conversationId, streamingId } = data;
      
      // Check if message contains "IS VOICE" to determine voice mode
      const isVoice = message.includes("IS VOICE");
      
      const stream = await chatService.streamResponse(message, conversationId, isVoice);

      for await (const chunk of stream) {
        socket.emit("chat_stream", {
          type: "chunk",
          content: chunk,
          conversationId,
          streamingId: streamingId || null,
        });
      }

      socket.emit("chat_stream", {
        type: "end",
        conversationId,
        streamingId: streamingId || null,
      });
    } catch (error) {
      console.error("Chat error:", error);
      socket.emit("chat_error", {
        error: "Failed to process message",
        conversationId: data.conversationId,
      });
    }
  });

  socket.on("voice_message", async (data) => {
    try {
      console.log("Received audio chunk:", data.byteLength || data.length, "bytes");
      
      let audioData;
      if (data instanceof ArrayBuffer) {
        audioData = Buffer.from(data);
      } else if (Buffer.isBuffer(data)) {
        audioData = data;
      } else {
        console.warn("Invalid audio data type received");
        return;
      }

      if (audioData.length === 0) {
        console.warn("Empty audio chunk received");
        return;
      }

      let currentBuffer = audioBuffers.get(socket.id) || Buffer.alloc(0);

      currentBuffer = Buffer.concat([currentBuffer, audioData]);
      audioBuffers.set(socket.id, currentBuffer);

      console.log("Total accumulated audio:", currentBuffer.length, "bytes");

        console.log("🎤 Processing accumulated audio...");
        
        try {
          const transcription = await chatService.transcribeAudio(currentBuffer);
          console.log("Transcription:", transcription);
          
          if (transcription && transcription.trim()) {
            // Voice messages are always voice interactions
            const stream = await chatService.streamResponse(transcription, data.conversationId || 'voice-chat', true);
            let fullResponse = "";
            
            for await (const chunk of stream) {
              fullResponse += chunk;
            }
            
            console.log("AI Response:", fullResponse);
            
            const audioReply = await chatService.synthesizeAudio(fullResponse);
            console.log("Audio reply generated:", audioReply.length, "bytes");
            
            socket.emit("audio_reply", audioReply);
          }
        } catch (transcriptionError) {
          console.error("Transcription/TTS error:", transcriptionError);
        }
        
        // Reset buffer
        audioBuffers.set(socket.id, Buffer.alloc(0));
        silenceCounters.set(socket.id, 0);
      
    } catch (error) {
      console.error("Audio processing error:", error);
      // Reset on error
      audioBuffers.set(socket.id, Buffer.alloc(0));
      silenceCounters.set(socket.id, 0);
    }
  });

  socket.on("voice_mode_start", () => {
    console.log("Voice mode started for", socket.id);
    audioBuffers.set(socket.id, Buffer.alloc(0));
    silenceCounters.set(socket.id, 0);
  });

  socket.on("voice_mode_stop", () => {
    console.log("Voice mode stopped for", socket.id);
    audioBuffers.delete(socket.id);
    silenceCounters.delete(socket.id);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    // Cleanup
    audioBuffers.delete(socket.id);
    silenceCounters.delete(socket.id);
  });
});



app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).json({ error: "Internal Server Error", message: err.message });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});