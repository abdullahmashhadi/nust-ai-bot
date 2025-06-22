import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type { ChatWidgetOptions, Message, StreamData } from "../types/type";
import MessageRenderer from "./MessageRenderer";

const generateId = () => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

const ChatWidget: React.FC<ChatWidgetOptions> = ({
  serverUrl = "http://localhost:3001",
  position = "bottom-left",
  theme = "light",
  title = "Chat Assistant",
  primaryColor = "#3B82F6",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Hello! I'm your AI assistant. How can I help you today?",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isDisabled, setIsDisabled] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const conversationId = useRef(generateId());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const addMessage = (
    text: string,
    sender: "user" | "bot",
    isStreaming = false
  ): string => {
    const id = generateId();
    const newMessage: Message = {
      id,
      text,
      sender,
      timestamp: new Date(),
      isStreaming,
    };

    setMessages((prev) => [...prev, newMessage]);
    return id;
  };

  const addErrorMessage = (text: string) => {
    const errorMessage: Message = {
      id: generateId(),
      text,
      sender: "bot",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, errorMessage]);
  };

  const sendMessage = () => {
    const message = inputValue.trim();
    if (!message || !socketRef.current || isDisabled) return;

    addMessage(message, "user");

    setInputValue("");
    setIsDisabled(true);
    setIsTyping(true);

    const streamingId = addMessage("", "bot", true);
    console.log(`Sending message with ID: ${streamingId}`);

    socketRef.current.emit("chat_message", {
      message,
      conversationId: conversationId.current,
      streamingId,
    });
  };

  const resetInput = () => {
    setIsDisabled(false);
    setIsTyping(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleStreamChunk = (data: StreamData) => {
    console.log(`Received stream data:`, data);
    if (data.type == "chunk" && data.streamingId) {
      console.log(`Received chunk for ID: ${data.streamingId}`);
      console.log(`Chunk content: ${data.content}`);
      console.log(`Current messages:`, messages);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.streamingId
            ? { ...msg, text: msg.text + (data.content || "") }
            : msg
        )
      );
    } else if (data.type === "end") {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.streamingId ? { ...msg, isStreaming: false } : msg
        )
      );
      resetInput();
    }
  };

  useEffect(() => {
    socketRef.current = io(serverUrl);

    socketRef.current.on("connect", () => {
      console.log("Connected to chat server");
    });

    socketRef.current.on("chat_stream", handleStreamChunk);

    socketRef.current.on("chat_error", () => {
      addErrorMessage("Sorry, something went wrong. Please try again.");
      resetInput();
    });

    socketRef.current.on("disconnect", () => {
      console.log("Disconnected from chat server");
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [serverUrl]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const positionClasses = {
    "bottom-left": "bottom-4 left-4",
    "bottom-right": "bottom-4 right-4",
  };

  const themeClasses = {
    light: {
      bg: "bg-white",
      text: "text-gray-900",
      border: "border-gray-200",
      inputBg: "bg-gray-50",
      inputBorder: "border-gray-300",
      inputText: "text-gray-900",
      userMsg: "bg-gradient-to-r from-blue-500 to-blue-600 text-white",
      botMsg: "bg-gray-50 text-gray-900 border border-gray-200",
      chatBg: "bg-gray-50",
    },
    dark: {
      bg: "bg-gray-800",
      text: "text-white",
      border: "border-gray-600",
      inputBg: "bg-gray-700",
      inputBorder: "border-gray-600",
      inputText: "text-white",
      userMsg: "bg-gradient-to-r from-blue-600 to-blue-700 text-white",
      botMsg: "bg-gray-700 text-white border border-gray-600",
      chatBg: "bg-gray-800",
    },
  };
  const currentTheme = themeClasses[theme];
  return (
    <div className={`fixed ${positionClasses[position]} z-50 font-sans`}>
      {/* Chat Toggle Button */}
      {!isOpen && (
        <button
          onClick={toggleChat}
          className={`group w-16 h-16 rounded-full shadow-xl transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-200 ${currentTheme.bg} ${currentTheme.text} border-2 ${currentTheme.border} relative overflow-hidden`}
          style={{ backgroundColor: primaryColor }}
          aria-label="Open chat"
        >
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
          <svg
            className="w-7 h-7 mx-auto text-white transition-transform duration-300 group-hover:scale-110"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`w-80 h-[32rem] rounded-lg shadow-2xl border ${currentTheme.border} ${currentTheme.bg} flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300`}
        >
          {/* Header */}
          <div
            className={`px-6 py-4 border-b ${currentTheme.border} flex items-center justify-between relative overflow-hidden`}
            style={{ backgroundColor: primaryColor }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12"></div>
            <div className="flex items-center space-x-3 relative z-10">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <h3 className="font-bold text-white text-lg">{title}</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-all duration-200 relative z-10"
              aria-label="Close chat"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div
            className={`flex-1 overflow-y-auto p-4 space-y-4 ${currentTheme.chatBg} custom-scrollbar`}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm shadow-lg ${
                    message.sender === "user"
                      ? currentTheme.userMsg + " rounded-br-md"
                      : currentTheme.botMsg + " rounded-bl-md"
                  } transition-all duration-200 hover:shadow-xl`}
                >
                  <MessageRenderer
                    content={message.text}
                    isUser={message.sender === "user"}
                  />

                  {message.isStreaming && (
                    <div className="mt-3 flex items-center space-x-1">
                      <div className="typing-indicator">
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                      </div>
                      <span className="text-xs opacity-70 ml-2">
                        AI is typing...
                      </span>
                    </div>
                  )}

                  <div
                    className={`text-xs mt-2 opacity-70 ${
                      message.sender === "user" ? "text-right" : "text-left"
                    }`}
                  >
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            className={`p-4 border-t ${currentTheme.border} ${currentTheme.bg}`}
          >
            {isTyping && (
              <div className="mb-3 flex items-center text-sm text-gray-500">
                <div className="typing-indicator-small mr-2">
                  <div className="typing-dot-small"></div>
                  <div className="typing-dot-small"></div>
                  <div className="typing-dot-small"></div>
                </div>
                AI is thinking...
              </div>
            )}

            <div className="flex space-x-3 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything about NUST..."
                  disabled={isDisabled}
                  rows={1}
                  className={`w-full resize-none rounded-xl border-2 ${currentTheme.inputBorder} px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 transition-all duration-200 ${currentTheme.inputBg} ${currentTheme.inputText} placeholder-gray-400`}
                  style={{
                    maxHeight: "120px",
                    minHeight: "48px",
                  }}
                />
              </div>

              <button
                onClick={sendMessage}
                disabled={isDisabled || !inputValue.trim()}
                className={`px-4 py-3 rounded-xl text-white font-medium transition-all duration-200 disabled:opacity-50 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none`}
                style={{ backgroundColor: primaryColor }}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>

            <div className="mt-2 text-xs text-gray-400 text-center">
              Press Enter to send • Shift+Enter for new line
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
