import React, { useState, useEffect, useRef, useCallback } from "react";
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
  const [isAudioRecording, setIsAudioRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceRecordingTime, setVoiceRecordingTime] = useState(0);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const conversationId = useRef(generateId());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const addMessage = (
    text: string,
    sender: "user" | "bot",
    isStreaming = false,
    isError = false,
  ): string => {
    const id = generateId();
    const newMessage: Message = {
      id,
      text,
      sender,
      timestamp: new Date(),
      isStreaming,
      isError,
    };

    setMessages((prev) => [...prev, newMessage]);
    return id;
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const resetInput = () => {
    setInputValue("");
    setIsDisabled(false);
    setIsTyping(false);
  };

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || isDisabled) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setIsDisabled(true);
    setIsTyping(true);

    // Add user message
    addMessage(userMessage, "user");

    // Add streaming placeholder for bot response
    const streamingId = addMessage("", "bot", true);

    // Send message via socket
    socketRef.current?.emit("chat_message", {
      message: userMessage,
      conversationId: conversationId.current,
      streamingId,
    });
  }, [inputValue, isDisabled, conversationId]);

  const addErrorMessage = useCallback((text: string) => {
    addMessage(text, "bot", false, true);
  }, []);

  const handleStreamChunk = useCallback((data: StreamData) => {
    console.log(`Received stream data:`, data);
    if (data.type == "chunk" && data.streamingId) {
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
  }, []);

  // Voice-to-voice communication functions
  const updateVoiceAudioLevel = useCallback(() => {
    if (analyserRef.current && isVoiceRecording) {
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
      setAudioLevel(average);
      
      animationFrameRef.current = requestAnimationFrame(updateVoiceAudioLevel);
    }
  }, [isVoiceRecording]);

  const startVoiceMode = useCallback(async () => {
    try {
      console.log("Starting voice mode...");
      
      // Stop any currently playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current = null;
      }
      
      // Get user media with specific constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        }
      });
      
      voiceStreamRef.current = stream;
      
      // Set up audio context for visualization
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      setIsVoiceMode(true);
      setIsVoiceRecording(false);
      setIsVoiceProcessing(false);
      setVoiceRecordingTime(0);
      setAudioLevel(0);
      
      console.log("Voice mode started successfully");
    } catch (error) {
      console.error("Error starting voice mode:", error);
      addErrorMessage("Could not access microphone for voice mode. Please check permissions.");
    }
  }, [addErrorMessage]);

  const startVoiceRecording = useCallback(async () => {
    if (!voiceStreamRef.current) return;
    
    try {
      console.log("Starting voice recording...");
      
      // Configure MediaRecorder with specific options
      const options: MediaRecorderOptions = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 64000,
      };

      // Fallback to other formats if webm is not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
        options.mimeType = 'audio/webm';
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
        options.mimeType = 'audio/mp4';
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
        delete options.mimeType;
      }

      console.log("MediaRecorder options:", options);

      voiceRecorderRef.current = new MediaRecorder(voiceStreamRef.current, options);
      audioChunksRef.current = [];
      
      voiceRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log("Voice audio chunk:", event.data.size, "bytes");
          audioChunksRef.current.push(event.data);
        }
      };

      voiceRecorderRef.current.onstop = () => {
        console.log("Voice recording stopped");
      };

      voiceRecorderRef.current.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        addErrorMessage("Voice recording error occurred");
      };

      voiceRecorderRef.current.start();
      
      setIsVoiceRecording(true);
      setVoiceRecordingTime(0);
      
      voiceTimerRef.current = setInterval(() => {
        setVoiceRecordingTime((prev) => prev + 1);
      }, 1000);

      updateVoiceAudioLevel();
      
      console.log("Voice recording started successfully");
    } catch (error) {
      console.error("Error starting voice recording:", error);
      addErrorMessage("Could not start voice recording. Please try again.");
    }
  }, [addErrorMessage, updateVoiceAudioLevel]);

  const sendVoiceMessage = useCallback(async () => {
    console.log("Sending voice message...", audioChunksRef.current.length);
    if (audioChunksRef.current.length === 0) return;
    
    try {
      setIsVoiceProcessing(true);
      
      // Create audio blob from chunks
      const audioBlob = new Blob(audioChunksRef.current, {
        type: voiceRecorderRef.current?.mimeType || 'audio/webm',
      });
      
      console.log("Voice message blob size:", audioBlob.size);
      
      // Add user message indicator
      addMessage("🎤 Voice message", "user");
      
      // Send the complete audio message
      socketRef.current?.emit("voice_message", audioBlob);
      
      // Reset for next recording
      audioChunksRef.current = [];
      setVoiceRecordingTime(0);
      
    } catch (error) {
      console.error("Error sending voice message:", error);
      addErrorMessage("Failed to send voice message. Please try again.");
      setIsVoiceProcessing(false);
    }
  }, [addMessage, addErrorMessage]);

  const stopVoiceRecording = useCallback(() => {
    console.log("Stopping voice recording...");
    
    if (voiceRecorderRef.current && voiceRecorderRef.current.state !== 'inactive') {
      voiceRecorderRef.current.stop();
    }
    
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    setIsVoiceRecording(false);
    setAudioLevel(0);
    
    // Automatically send the voice message when recording stops
    setTimeout(() => {
      sendVoiceMessage();
    }, 100); // Small delay to ensure recording is properly stopped
    
    console.log("Voice recording stopped successfully");
  }, [sendVoiceMessage]);

  const stopVoiceMode = useCallback(() => {
    console.log("Stopping voice mode...");
    
    try {
      if (voiceRecorderRef.current && voiceRecorderRef.current.state !== 'inactive') {
        voiceRecorderRef.current.stop();
      }
      
      if (voiceStreamRef.current) {
        voiceStreamRef.current.getTracks().forEach(track => track.stop());
        voiceStreamRef.current = null;
      }
      
      if (voiceTimerRef.current) {
        clearInterval(voiceTimerRef.current);
        voiceTimerRef.current = null;
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      setIsVoiceMode(false);
      setIsVoiceRecording(false);
      setIsVoiceProcessing(false);
      setVoiceRecordingTime(0);
      setAudioLevel(0);
      
      console.log("Voice mode stopped successfully");
    } catch (error) {
      console.error("Error stopping voice mode:", error);
    }
  }, []);

  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);
      
      const response = await fetch(`${serverUrl}/api/transcribe`, {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const { text } = await response.json();
        setInputValue(text);
      } else {
        addErrorMessage("Failed to transcribe audio. Please try again.");
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      addErrorMessage("Error transcribing audio. Please try again.");
    } finally {
      setIsTranscribing(false);
    }
  }, [serverUrl, addErrorMessage]);

  const updateAudioLevel = useCallback(() => {
    if (analyserRef.current && isAudioRecording) {
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
      setAudioLevel(average);
      
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [isAudioRecording]);

  const startAudioRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      const options = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000,
      };
  
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/webm';
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/mp4';
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = '';
      }
  
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];
  
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = async() => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorderRef.current?.mimeType || 'audio/webm',
        });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
        audioContextRef.current?.close();
      };
      mediaRecorderRef.current.start();
      setIsAudioRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
      updateAudioLevel();
    } catch (error) {
      console.error("Error starting audio recording:", error);
      addErrorMessage("Could not access microphone. Please check permissions.");
    }
  }, [addErrorMessage, transcribeAudio, updateAudioLevel]);

  const stopAudioRecording = useCallback(() => {
    if (mediaRecorderRef.current && isAudioRecording) {
      mediaRecorderRef.current.stop();
      setIsAudioRecording(false);
      setIsTranscribing(true);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  }, [isAudioRecording]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (voiceTimerRef.current) {
        clearInterval(voiceTimerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (voiceStreamRef.current) {
        voiceStreamRef.current.getTracks().forEach(track => track.stop());
      }
      audioContextRef.current?.close();
    };
  }, []);

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

    socketRef.current.on("audio_reply", (data) => {
      console.log("Received audio reply:", data.length, "bytes");
      setIsVoiceProcessing(false);
      
      try {
        const blob = new Blob([data], { type: "audio/mp3" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        
        // Track the currently playing audio
        currentAudioRef.current = audio;
        
        audio.onloadeddata = () => {
          console.log("Audio loaded, duration:", audio.duration);
        };
        
        audio.onplay = () => {
          console.log("Audio playback started");
        };
        
        audio.onended = () => {
          console.log("Audio playback ended");
          URL.revokeObjectURL(url);
          currentAudioRef.current = null;
        };
        
        audio.onerror = (e) => {
          console.error("Audio playback error:", e);
          URL.revokeObjectURL(url);
          currentAudioRef.current = null;
        };
        
        audio.play().catch(error => {
          console.error("Failed to play audio:", error);
          URL.revokeObjectURL(url);
          currentAudioRef.current = null;
        });
      } catch (error) {
        console.error("Error processing audio reply:", error);
      }
    });

    socketRef.current.on("disconnect", () => {
      console.log("Disconnected from chat server");
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [serverUrl, addErrorMessage, handleStreamChunk]);

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
          className={`w-100 h-100  rounded-lg shadow-2xl border ${currentTheme.border} ${currentTheme.bg} flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300`}
        >
          {/* Header */}
          <div
            className={`px-6 py-4 border-b ${currentTheme.border} flex items-center justify-between relative overflow-hidden`}
            style={{ backgroundColor: primaryColor }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12"></div>
            <div className="flex items-center space-x-3 relative z-10">
              <div className={`w-3 h-3 rounded-full animate-pulse ${isVoiceMode ? 'bg-red-400' : 'bg-green-400'}`}></div>
              <h3 className="font-bold text-white text-lg">{title}</h3>
              {isVoiceMode && <span className="text-white text-sm">(Voice Mode)</span>}
            </div>
            <div className="flex items-center space-x-2 relative z-10">
              <button
                onClick={isVoiceMode ? stopVoiceMode : startVoiceMode}
                className={`text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-all duration-200 ${
                  isVoiceMode ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                }`}
                aria-label={isVoiceMode ? "Exit voice mode" : "Start voice mode"}
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
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
              </button>
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
          </div>

          {/* Voice Mode Interface */}
          {isVoiceMode ? (
            <div className={`flex-1 ${currentTheme.chatBg} flex flex-col`}>
              {/* Voice Mode Content */}
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center">
                  {/* Animated Radio Wave Circle */}
                  <div className="relative mb-8">
                    <div className="w-40 h-40 rounded-full border-4 border-blue-500 mx-auto relative overflow-hidden">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 opacity-20"></div>
                      {/* Animated radio waves */}
                      {isVoiceRecording && (
                        <>
                          <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-75"></div>
                          <div className="absolute inset-2 rounded-full border-2 border-blue-400 animate-ping opacity-50" style={{animationDelay: '0.5s'}}></div>
                          <div className="absolute inset-4 rounded-full border-2 border-blue-400 animate-ping opacity-25" style={{animationDelay: '1s'}}></div>
                        </>
                      )}
                      
                      {/* Microphone Icon */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        {isVoiceRecording ? (
                          <div className="flex items-center space-x-1">
                            {Array.from({ length: 5 }, (_, i) => {
                              const height = 8 + (audioLevel / 255) * 24 * Math.sin((Date.now() / 200) + i);
                              return (
                                <div
                                  key={i}
                                  className="bg-blue-500 rounded-full transition-all duration-100 ease-out"
                                  style={{
                                    width: '4px',
                                    height: `${Math.max(8, height)}px`,
                                    opacity: 0.6 + (audioLevel / 255) * 0.4,
                                  }}
                                />
                              );
                            })}
                          </div>
                        ) : (
                          <svg className="w-16 h-16 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V5a3 3 0 0 1 3-3m7 9c0 3.53-2.61 6.44-6 6.93V21h-2v-3.07c-3.39-.49-6-3.4-6-6.93h2a5 5 0 0 0 5 5 5 5 0 0 0 5-5h2z"/>
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Voice Mode Status */}
                  <div className={`${currentTheme.text} mb-6`}>
                    <h3 className="text-xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      Voice Chat Mode
                    </h3>
                    <div className="flex items-center justify-center space-x-2 mb-3">
                      {isVoiceRecording && (
                        <>
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                          <span className="text-sm font-medium text-red-600">Recording...</span>
                        </>
                      )}
                      {isVoiceProcessing && (
                        <>
                          <div className="typing-indicator-small">
                            <div className="typing-dot-small bg-blue-500"></div>
                            <div className="typing-dot-small bg-blue-500"></div>
                            <div className="typing-dot-small bg-blue-500"></div>
                          </div>
                          <span className="text-sm font-medium text-blue-600">Processing...</span>
                        </>
                      )}
                      {!isVoiceRecording && !isVoiceProcessing && (
                        <span className="text-sm text-gray-500">Ready to record</span>
                      )}
                    </div>
                    {voiceRecordingTime > 0 && (
                      <div className="text-lg font-mono text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full inline-block">
                        {formatRecordingTime(voiceRecordingTime)}
                      </div>
                    )}
                  </div>

                  {/* Voice Mode Instructions */}
                  <div className={`${currentTheme.text} opacity-70 text-sm max-w-sm mx-auto mb-6`}>
                    <p className="mb-2">
                      {isVoiceRecording 
                        ? "Speak your message now. Click stop when finished."
                        : "Click the record button to start speaking, then send your message."
                      }
                    </p>
                    <p>I'll respond with voice automatically.</p>
                  </div>
                </div>
              </div>

              {/* Voice Mode Controls */}
              <div className={`p-6 border-t ${currentTheme.border} ${currentTheme.bg}`}>
                <div className="flex items-center justify-center space-x-4">
                  {/* Record Button */}
                  <button
                    onClick={isVoiceRecording ? stopVoiceRecording : startVoiceRecording}
                    disabled={isVoiceProcessing}
                    className={`relative group w-16 h-16 rounded-full transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                      isVoiceRecording 
                        ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/25' 
                        : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/25'
                    } transform hover:scale-105 active:scale-95`}
                    aria-label={isVoiceRecording ? "Stop recording" : "Start recording"}
                  >
                    <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                    {isVoiceRecording ? (
                      <div className="w-6 h-6 bg-white rounded-sm mx-auto"></div>
                    ) : (
                      <svg className="w-8 h-8 text-white mx-auto" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V5a3 3 0 0 1 3-3m7 9c0 3.53-2.61 6.44-6 6.93V21h-2v-3.07c-3.39-.49-6-3.4-6-6.93h2a5 5 0 0 0 5 5 5 5 0 0 0 5-5h2z"/>
                      </svg>
                    )}
                    {isVoiceRecording && (
                      <div className="absolute inset-0 rounded-full border-2 border-red-300 animate-ping"></div>
                    )}
                  </button>
                </div>

                {/* Button Labels */}
                <div className="flex items-center justify-center space-x-20 mt-3">
                  <span className={`text-xs ${currentTheme.text} opacity-70`}>
                    {isVoiceRecording ? "Stop" : "Record"}
                  </span>
                </div>

                {/* Voice Mode Instructions */}
                <div className="mt-4 text-xs text-gray-400 text-center">
                  Record your message • Click send • Get voice reply • Phone icon to exit
                </div>
              </div>
            </div>
          ) : (
            <>
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
                      className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm shadow-lg transition-all duration-200 hover:shadow-xl ${
                        message.isError
                          ? "bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800 rounded-bl-md"
                          : message.sender === "user"
                          ? currentTheme.userMsg + " rounded-br-md"
                          : currentTheme.botMsg + " rounded-bl-md"
                      }`}
                    >
                       {message.isError && (
                        <div className="flex items-center space-x-2 mb-2">
                          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                          <span className="font-medium text-xs">Error</span>
                        </div>
                      )}
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

                {isTranscribing && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center space-x-3">
                      <div className="typing-indicator-small">
                        <div className="typing-dot-small bg-blue-500"></div>
                        <div className="typing-dot-small bg-blue-500"></div>
                        <div className="typing-dot-small bg-blue-500"></div>
                      </div>
                      <span className="text-blue-600 dark:text-blue-400 text-sm">
                        Converting speech to text...
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex space-x-3 items-end">
                  <div className="flex-1 relative">
                  {isAudioRecording ? (
                      <div className={`w-full rounded-xl border-2 border-red-300 px-4 py-3 transition-all duration-200 bg-red-50 dark:bg-red-900/20`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="relative">
                              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                              <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"></div>
                            </div>
                            <span className="text-red-600 dark:text-red-400 font-medium text-sm">
                              Recording
                            </span>
                            <span className="text-red-600 dark:text-red-400 text-xs">
                              {formatRecordingTime(recordingTime)}
                            </span>
                          </div>
                          <button
                            onClick={stopAudioRecording}
                            className="text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-800/30 rounded-lg p-1 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6 6h12v12H6z"/>
                            </svg>
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-center space-x-1 h-12">
                          {Array.from({ length: 30 }, (_, i) => {
                            const baseHeight = 8;
                            const maxHeight = 40;
                            const normalizedLevel = audioLevel / 255;
                            const randomFactor = Math.sin((Date.now() / 100) + i) * 0.5 + 0.5;
                            const height = baseHeight + (normalizedLevel * maxHeight * randomFactor);
                            
                            return (
                              <div
                                key={i}
                                className="bg-red-500 rounded-full transition-all duration-100 ease-out"
                                style={{
                                  width: '3px',
                                  height: `${Math.max(baseHeight, height)}px`,
                                  opacity: 0.6 + (normalizedLevel * 0.4),
                                  animationDelay: `${i * 50}ms`,
                                }}
                              />
                            );
                          })}
                        </div>
                        
                        <div className="text-center mt-2">
                          <span className="text-red-600 dark:text-red-400 text-xs">
                            Speak now... Click stop when finished
                          </span>
                        </div>
                      </div>
                    ) : (
                      <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask me anything about NUST..."
                        disabled={isDisabled || isTranscribing}
                        rows={1}
                        className={`w-full resize-none rounded-xl border-2 ${currentTheme.inputBorder} px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 transition-all duration-200 ${currentTheme.inputBg} ${currentTheme.inputText} placeholder-gray-400`}
                        style={{
                          maxHeight: "120px",
                          minHeight: "48px",
                        }}
                      />
                    )}
                  </div>
                  <button
                    onClick={isAudioRecording ? stopAudioRecording : startAudioRecording}
                    disabled={isDisabled || isTranscribing}
                    className={`px-4 py-3 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none ${
                      isAudioRecording ?
                        'bg-red-500 text-white shadow-red-500/25' :
                        'bg-blue-500 text-white shadow-blue-500/25'
                    }`}
                    aria-label={isAudioRecording ? "Stop audio recording" : "Start audio recording"}
                  >
                    {isAudioRecording ? (
                      <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatWidget;