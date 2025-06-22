import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type { ChatWidgetOptions, Message, StreamData } from "../types/type";

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

  const handleStreamChunk =(data: StreamData) => {
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
    }

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
      userMsg: "bg-blue-500 text-white",
      botMsg: "bg-gray-100 text-gray-900",
    },
    dark: {
      bg: "bg-gray-800",
      text: "text-white",
      border: "border-gray-600",
      userMsg: "bg-blue-600 text-white",
      botMsg: "bg-gray-700 text-white",
    },
  };
  const currentTheme = themeClasses[theme];
  return (
    <div className={`fixed ${positionClasses[position]} z-50 font-sans`}>
      {/* Chat Toggle Button */}
      {!isOpen && (
        <button
          onClick={toggleChat}
          className={`w-14 h-14 rounded-full shadow-lg transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-200 ${currentTheme.bg} ${currentTheme.text} border ${currentTheme.border}`}
          style={{ backgroundColor: primaryColor }}
          aria-label="Open chat"
        >
          <svg
            className="w-6 h-6 mx-auto text-white"
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
          className={`w-80 h-96 rounded-lg shadow-2xl border ${currentTheme.border} ${currentTheme.bg} flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300`}
        >
          {/* Header */}
          <div
            className={`px-4 py-3 border-b ${currentTheme.border} flex items-center justify-between`}
            style={{ backgroundColor: primaryColor }}
          >
            <h3 className="font-semibold text-white">{title}</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded p-1 transition-colors"
              aria-label="Close chat"
            >
              <svg
                className="w-4 h-4"
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
            className={`flex-1 overflow-y-auto p-4 space-y-3 ${currentTheme.bg}`}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg text-sm ${
                    message.sender === "user"
                      ? currentTheme.userMsg
                      : currentTheme.botMsg
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.text}</div>
                  {message.isStreaming && (
                    <div className="mt-1">
                      <div className="flex space-x-1">
                        <div className="w-1 h-1 bg-current rounded-full animate-pulse"></div>
                        <div
                          className="w-1 h-1 bg-current rounded-full animate-pulse"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                        <div
                          className="w-1 h-1 bg-current rounded-full animate-pulse"
                          style={{ animationDelay: "0.4s" }}
                        ></div>
                      </div>
                    </div>
                  )}
                  <div className={`text-xs mt-1 opacity-70`}>
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className={`p-4 border-t ${currentTheme.border}`}>
            <div className="flex space-x-2">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                disabled={isDisabled}
                rows={1}
                className={`flex-1 resize-none rounded-lg border ${currentTheme.border} px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${currentTheme.bg} ${currentTheme.text}`}
                style={{ maxHeight: "100px" }}
              />
              <button
                onClick={sendMessage}
                disabled={isDisabled || !inputValue.trim()}
                className={`px-3 py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                style={{ backgroundColor: primaryColor }}
              >
                <svg
                  className="w-4 h-4"
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
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;