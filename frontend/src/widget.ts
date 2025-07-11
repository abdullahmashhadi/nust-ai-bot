import { createRoot } from "react-dom/client";
import type { ChatWidgetOptions } from "./types/type";
import React from "react";
import ChatWidget from "./components/ChatWidget";

class ChatWidgetManager {
  private shadowRoot: ShadowRoot | null = null;
  private container: HTMLDivElement | null = null;
  private reactRoot: any = null;
  private options: ChatWidgetOptions;
  constructor(options: ChatWidgetOptions = {}) {
    this.options = {
      serverUrl: "http://localhost:3001",
      position: "bottom-left",
      theme: "light",
      title: "Chat Assistant",
      primaryColor: "#3B82F6",
      ...options,
    };
    this.init();
  }

  private init() {
    if (document.readyState == "loading") {
      document.addEventListener("DOMContentLoaded", () => this.createWidget());
    } else {
      this.createWidget();
    }
  }

  private createWidget() {
    this.container = document.createElement("div");
    this.container.id = "chat-widget-container";
    this.container.style.position = "fixed";
    this.container.style.zIndex = "99999999";
    this.container.style.pointerEvents = "auto"; // allow pointer events
    this.container.style.bottom = "1rem"; // or dynamically based on position
    this.container.style.left = "1rem"; // for bottom-left
    this.container.style.width = "auto";
    this.container.style.height = "auto";

    this.shadowRoot = this.container.attachShadow({ mode: "open" });

    const reactContainer = document.createElement("div");
    reactContainer.style.pointerEvents = "auto";
    reactContainer.style.position = "relative";
    reactContainer.style.width = "100%";
    reactContainer.style.height = "100%";

    const style = document.createElement("style");
    style.textContent = this.getTailwindCSS();
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(reactContainer);

    this.reactRoot = createRoot(reactContainer);
    this.reactRoot.render(React.createElement(ChatWidget, this.options));

    // Append to body
    document.body.appendChild(this.container);
  }
  private getTailwindCSS(): string {
    return `
    *, ::before, ::after {
      box-sizing: border-box;
      border-width: 0;
      border-style: solid;
      border-color: #e5e7eb;
    }
      .bg-red-50 { background-color: #fef2f2; }
.bg-red-100 { background-color: #fee2e2; }
.bg-red-500 { background-color: #ef4444; }
.bg-red-600 { background-color: #dc2626; }
.text-red-200 { color: #fecaca; }
.text-red-400 { color: #f87171; }
.text-red-600 { color: #dc2626; }
.text-red-800 { color: #991b1b; }
.border-red-200 { border-color: #fecaca; }
.border-red-300 { border-color: #fca5a5; }
.border-red-800 { border-color: #991b1b; }

.hover\\:bg-red-100:hover { background-color: #fee2e2; }
.hover\\:bg-red-600:hover { background-color: #dc2626; }

.focus\\:ring-red-500:focus { box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.5); }

/* Dark theme red backgrounds */
.dark\\:bg-red-900\\/20 { background-color: rgba(127, 29, 29, 0.2); }
.dark\\:border-red-800 { border-color: #991b1b; }
.dark\\:text-red-200 { color: #fecaca; }
.dark\\:text-red-400 { color: #f87171; }
.dark\\:hover\\:bg-red-800\\/30:hover { background-color: rgba(153, 27, 27, 0.3); }

/* Wave animation keyframes */
@keyframes audioWave {
  0%, 100% {
    transform: scaleY(1);
  }
  50% {
    transform: scaleY(1.5);
  }
}

.audio-wave-bar {
  animation: audioWave 0.5s ease-in-out infinite;
}

.audio-wave-bar:nth-child(2n) {
  animation-delay: 0.1s;
}

.audio-wave-bar:nth-child(3n) {
  animation-delay: 0.2s;
}

.audio-wave-bar:nth-child(4n) {
  animation-delay: 0.3s;
}

.audio-wave-bar:nth-child(5n) {
  animation-delay: 0.4s;
}

/* Error message styles */
.error-message {
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  border-left: 4px solid #ef4444;
}

.dark .error-message {
  background: linear-gradient(135deg, rgba(127, 29, 29, 0.2) 0%, rgba(153, 27, 27, 0.3) 100%);
  border-left-color: #f87171;
}
    
    ::before, ::after {
      --tw-content: '';
    }
    
    .font-sans {
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
    }
    
    /* Layout Classes */
    .fixed { position: fixed; }
    .relative { position: relative; }
    .absolute { position: absolute; }
    .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
    .bottom-4 { bottom: 1rem; }
    .left-4 { left: 1rem; }
    .right-4 { right: 1rem; }
    .z-50 { z-index: 50; }
    .z-10 { z-index: 10; }
    
    /* Sizing */
    .w-3 { width: 0.75rem; }
    .h-3 { height: 0.75rem; }
    .w-5 { width: 1.25rem; }
    .h-5 { height: 1.25rem; }
    .w-7 { width: 1.75rem; }
    .h-7 { height: 1.75rem; }
    .w-16 { width: 4rem; }
    .h-16 { height: 4rem; }
    .w-96 { width: 24rem; }
    .w-100 {width: 25rem;}
    .h-100 {height: 600px;}
    .w-full { width: 100%; }
    
    /* Max width */
    .max-w-xs { max-width: 20rem; }
    .max-w-\\[85\\%\\] { max-width: 85%; }
    
    /* Display */
    .flex { display: flex; }
    .block { display: block; }
    .flex-1 { flex: 1 1 0%; }
    .flex-col { flex-direction: column; }
    .items-center { align-items: center; }
    .items-start { align-items: flex-start; }
    .items-end { align-items: flex-end; }
    .justify-start { justify-content: flex-start; }
    .justify-end { justify-content: flex-end; }
    .justify-between { justify-content: space-between; }
    
    /* Spacing */
    .space-x-1 > :not([hidden]) ~ :not([hidden]) { margin-left: 0.25rem; }
    .space-x-2 > :not([hidden]) ~ :not([hidden]) { margin-left: 0.5rem; }
    .space-x-3 > :not([hidden]) ~ :not([hidden]) { margin-left: 0.75rem; }
    .space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 1rem; }
    
    /* Overflow */
    .overflow-hidden { overflow: hidden; }
    .overflow-y-auto { overflow-y: auto; }
    
    /* Border radius */
    .rounded-full { border-radius: 9999px; }
    .rounded-lg { border-radius: 0.5rem; }
    .rounded-xl { border-radius: 0.75rem; }
    .rounded-2xl { border-radius: 1rem; }
    .rounded-bl-md { border-bottom-left-radius: 0.375rem; }
    .rounded-br-md { border-bottom-right-radius: 0.375rem; }
    
    /* Borders */
    .border { border-width: 1px; }
    .border-2 { border-width: 2px; }
    .border-t { border-top-width: 1px; }
    .border-b { border-bottom-width: 1px; }
    .border-gray-200 { border-color: #e5e7eb; }
    .border-gray-300 { border-color: #d1d5db; }
    .border-gray-600 { border-color: #4b5563; }
    
    /* Backgrounds */
    .bg-white { background-color: #ffffff; }
    .bg-gray-50 { background-color: #f9fafb; }
    .bg-gray-400 { background-color: #9ca3af; }
    .bg-gray-700 { background-color: #374151; }
    .bg-gray-800 { background-color: #1f2937; }
    .bg-green-400 { background-color: #34d399; }
    .bg-gradient-to-r { background-image: linear-gradient(to right, var(--tw-gradient-stops)); }
    .from-blue-500 { --tw-gradient-from: #3b82f6; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(59, 130, 246, 0)); }
    .to-blue-600 { --tw-gradient-to: #2563eb; }
    .from-blue-600 { --tw-gradient-from: #2563eb; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(37, 99, 235, 0)); }
    .to-blue-700 { --tw-gradient-to: #1d4ed8; }
    .from-transparent { --tw-gradient-from: transparent; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(0, 0, 0, 0)); }
    .via-white\\/10 { --tw-gradient-stops: var(--tw-gradient-from), rgba(255, 255, 255, 0.1), var(--tw-gradient-to, rgba(255, 255, 255, 0)); }
    .to-transparent { --tw-gradient-to: transparent; }
    
    /* Hover states */
    .hover\\:bg-white:hover { background-color: #ffffff; }
    .hover\\:bg-opacity-10:hover { background-color: rgba(255, 255, 255, 0.1); }
    .hover\\:bg-opacity-20:hover { background-color: rgba(255, 255, 255, 0.2); }
    .hover\\:scale-105:hover { transform: scale(1.05); }
    .hover\\:scale-110:hover { transform: scale(1.1); }
    .hover\\:opacity-90:hover { opacity: 0.9; }
    .hover\\:shadow-xl:hover { box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); }
    .hover\\:text-blue-700:hover { color: #1d4ed8; }
    
    /* Group hover */
    .group:hover .group-hover\\:opacity-10 { opacity: 0.1; }
    .group:hover .group-hover\\:scale-110 { transform: scale(1.1); }
    
    /* Padding and margin */
    .p-2 { padding: 0.5rem; }
    .p-4 { padding: 1rem; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
    .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
    .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
    .mt-2 { margin-top: 0.5rem; }
    .mt-3 { margin-top: 0.75rem; }
    .mb-1 { margin-bottom: 0.25rem; }
    .mb-3 { margin-bottom: 0.75rem; }
    .mr-2 { margin-right: 0.5rem; }
    .ml-2 { margin-left: 0.5rem; }
    .mx-auto { margin-left: auto; margin-right: auto; }
    
    /* Typography */
    .text-xs { font-size: 0.75rem; line-height: 1rem; }
    .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
    .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
    .font-medium { font-weight: 500; }
    .font-semibold { font-weight: 600; }
    .font-bold { font-weight: 700; }
    .italic { font-style: italic; }
    
    /* Text colors */
    .text-white { color: #ffffff; }
    .text-gray-400 { color: #9ca3af; }
    .text-gray-500 { color: #6b7280; }
    .text-gray-900 { color: #111827; }
    .text-blue-500 { color: #3b82f6; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .underline { text-decoration: underline; }
    
    /* Opacity */
    .opacity-0 { opacity: 0; }
    .opacity-50 { opacity: 0.5; }
    .opacity-70 { opacity: 0.7; }
    
    /* Shadows */
    .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
    .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); }
    .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
    
    /* Transitions */
    .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    .transition-colors { transition-property: color, background-color, border-color; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    .transition-opacity { transition-property: opacity; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    .transition-transform { transition-property: transform; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
    .duration-200 { transition-duration: 200ms; }
    .duration-300 { transition-duration: 300ms; }
    
    /* Transform */
    .transform { transform: translate(var(--tw-translate-x, 0), var(--tw-translate-y, 0)) rotate(var(--tw-rotate, 0)) skewX(var(--tw-skew-x, 0)) skewY(var(--tw-skew-y, 0)) scaleX(var(--tw-scale-x, 1)) scaleY(var(--tw-scale-y, 1)); }
    .-skew-x-12 { --tw-skew-x: -12deg; }
    
    /* Focus states */
    .focus\\:outline-none:focus { outline: 2px solid transparent; outline-offset: 2px; }
    .focus\\:ring-2:focus { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5); }
    .focus\\:ring-blue-500:focus { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5); }
    .focus\\:ring-offset-2:focus { box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px rgba(59, 130, 246, 0.5); }
    .focus\\:border-transparent:focus { border-color: transparent; }
    
    /* Disabled states */
    .disabled\\:opacity-50:disabled { opacity: 0.5; }
    .disabled\\:transform-none:disabled { transform: none; }
    
    /* Resize */
    .resize-none { resize: none; }
    
    /* Animations */
    .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    .animate-in { animation-name: enter; animation-duration: 150ms; animation-fill-mode: both; }
    .slide-in-from-bottom-5 { animation-name: slide-in-from-bottom-5; }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: .5; }
    }
    
    @keyframes slide-in-from-bottom-5 {
      from {
        transform: translateY(1.25rem);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    
    /* Typing indicator animations */
    .typing-indicator {
      display: flex;
      align-items: center;
      space-x: 2px;
    }
    
    .typing-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: currentColor;
      opacity: 0.4;
      animation: typing 1.4s infinite ease-in-out;
    }
    
    .typing-dot:nth-child(1) { animation-delay: 0s; }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
    
    .typing-indicator-small {
      display: flex;
      align-items: center;
    }
    
    .typing-dot-small {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background-color: currentColor;
      opacity: 0.4;
      animation: typing 1.4s infinite ease-in-out;
      margin-right: 2px;
    }
    
    .typing-dot-small:nth-child(1) { animation-delay: 0s; }
    .typing-dot-small:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot-small:nth-child(3) { animation-delay: 0.4s; }
    
    @keyframes typing {
      0%, 60%, 100% {
        transform: translateY(0);
        opacity: 0.4;
      }
      30% {
        transform: translateY(-10px);
        opacity: 1;
      }
    }
    
    /* Custom scrollbar styles */
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 3px;
    }
    
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }
    
    /* Dark theme scrollbar */
    .bg-gray-800 .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #4b5563;
    }
    
    .bg-gray-800 .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #6b7280;
    }
    
    /* Placeholder styles */
    .placeholder-gray-400::placeholder {
      color: #9ca3af;
    }
    
    /* Additional utility classes for message formatting */
    .formatted-message strong {
      font-weight: 600;
      color: inherit;
    }
    
    .formatted-message a {
      color: #3b82f6;
      text-decoration: underline;
      font-weight: 500;
    }
    
    .formatted-message a:hover {
      color: #1d4ed8;
    }
    
    /* Dark theme link colors */
    .bg-gray-700 .formatted-message a,
    .bg-gray-800 .formatted-message a {
      color: #60a5fa;
    }
    
    .bg-gray-700 .formatted-message a:hover,
    .bg-gray-800 .formatted-message a:hover {
      color: #93c5fd;
    }
  `;
  }

  public destroy() {
    if (this.reactRoot) {
      this.reactRoot.unmount();
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
  public updateOptions(newOptions: Partial<ChatWidgetOptions>) {
    this.options = { ...this.options, ...newOptions };
    if (this.reactRoot) {
      this.reactRoot.render(React.createElement(ChatWidget, this.options));
    }
  }
}

declare global {
  interface Window {
    ChatWidget: typeof ChatWidgetManager;
    initChatWidget: (options?: ChatWidgetOptions) => ChatWidgetManager;
  }
}

// Export for global use
window.ChatWidget = ChatWidgetManager;
window.initChatWidget = (options?: ChatWidgetOptions) => {
  return new ChatWidgetManager(options);
};

// Auto-initialize if options are provided globally
if (typeof window !== "undefined" && (window as any).chatWidgetConfig) {
  new ChatWidgetManager((window as any).chatWidgetConfig);
}

export default ChatWidgetManager;
