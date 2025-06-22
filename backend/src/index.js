
const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io"); 
require("dotenv").config();
const mainRouter = require("./routes/route.js");
const ChatService = require("./services/ChatService.js");

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



const chatService = new ChatService();

app.use("/api",mainRouter)

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.emit("connection_success", {
    message: "Connected to chat server",
    socketId: socket.id,
  });
  socket.on("chat_message", async (data) => {
    try {
      const { message,conversationId,streamingId } = data;

      const stream = await chatService.streamResponse(message, conversationId);
      console.log(`Streaming response for conversation ${conversationId}:`, message);
      console.log(`Streaming ID: ${streamingId || "not provided"}`);

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

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
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

