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
    // Comprehensive Tailwind CSS for the chat widget
    return `
      *, ::before, ::after {
        box-sizing: border-box;
        border-width: 0;
        border-style: solid;
        border-color: #e5e7eb;
      }
      
      ::before, ::after {
        --tw-content: '';
      }
      
      .font-sans {
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
      }
      
      .fixed { position: fixed; }
      .relative { position: relative; }
      .bottom-4 { bottom: 1rem; }
      .left-4 { left: 1rem; }
      .right-4 { right: 1rem; }
      .z-50 { z-index: 50; }
      
      .w-14 { width: 3.5rem; }
      .h-14 { height: 3.5rem; }
      .w-80 { width: 20rem; }
      .h-96 { height: 24rem; }
      .w-6 { width: 1.5rem; }
      .h-6 { height: 1.5rem; }
      .w-4 { width: 1rem; }
      .h-4 { height: 1rem; }
      .w-1 { width: 0.25rem; }
      .h-1 { height: 0.25rem; }
      
      .max-w-xs { max-width: 20rem; }
      .max-w-md { max-width: 28rem; }
      .flex { display: flex; }
      .flex-1 { flex: 1 1 0%; }
      .flex-col { flex-direction: column; }
      .items-center { align-items: center; }
      .justify-start { justify-content: flex-start; }
      .justify-end { justify-content: flex-end; }
      .justify-between { justify-content: space-between; }
      .space-x-1 > :not([hidden]) ~ :not([hidden]) { margin-left: 0.25rem; }
      .space-x-2 > :not([hidden]) ~ :not([hidden]) { margin-left: 0.5rem; }
      .space-y-3 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.75rem; }
      
      .overflow-hidden { overflow: hidden; }
      .overflow-y-auto { overflow-y: auto; }
      .resize-none { resize: none; }
      
      .rounded-full { border-radius: 9999px; }
      .rounded-lg { border-radius: 0.5rem; }
      .border { border-width: 1px; }
      .border-t { border-top-width: 1px; }
      .border-b { border-bottom-width: 1px; }
      .border-gray-200 { border-color: #e5e7eb; }
      .border-gray-600 { border-color: #4b5563; }
      
      .bg-white { background-color: #ffffff; }
      .bg-gray-100 { background-color: #f3f4f6; }
      .bg-gray-700 { background-color: #374151; }
      .bg-gray-800 { background-color: #1f2937; }
      .bg-blue-500 { background-color: #3b82f6; }
      .bg-blue-600 { background-color: #2563eb; }
      
      .hover\\:bg-white:hover { background-color: #ffffff; }
      .hover\\:bg-opacity-20:hover { background-color: rgba(255, 255, 255, 0.2); }
      .hover\\:scale-110:hover { transform: scale(1.1); }
      .hover\\:opacity-90:hover { opacity: 0.9; }
      
      .p-1 { padding: 0.25rem; }
      .p-4 { padding: 1rem; }
      .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
      .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
      .px-4 { padding-left: 1rem; padding-right: 1rem; }
      .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
      .mt-1 { margin-top: 0.25rem; }
      .mx-auto { margin-left: auto; margin-right: auto; }
      
      .text-xs { font-size: 0.75rem; line-height: 1rem; }
      .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
      .font-medium { font-weight: 500; }
      .font-semibold { font-weight: 600; }
      
      .text-white { color: #ffffff; }
      .text-gray-900 { color: #111827; }
      .opacity-50 { opacity: 0.5; }
      .opacity-70 { opacity: 0.7; }
      
      .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
      .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
      
      .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
      .transition-colors { transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
      .duration-300 { transition-duration: 300ms; }
      
      .focus\\:outline-none:focus { outline: 2px solid transparent; outline-offset: 2px; }
      .focus\\:ring-2:focus { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5); }
      .focus\\:ring-4:focus { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3); }
      .focus\\:ring-blue-200:focus { box-shadow: 0 0 0 4px rgba(147, 197, 253, 0.5); }
      .focus\\:ring-blue-500:focus { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5); }
      
      .disabled\\:opacity-50:disabled { opacity: 0.5; }
      
      .whitespace-pre-wrap { white-space: pre-wrap; }
      
      .animate-pulse {
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: .5; }
      }
      
      .animate-in {
        animation-name: enter;
        animation-duration: 150ms;
        animation-fill-mode: both;
      }
      
      .slide-in-from-bottom-5 {
        animation-name: slide-in-from-bottom-5;
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
      
      /* Custom scrollbar */
      ::-webkit-scrollbar {
        width: 6px;
      }
      
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      
      ::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
      }
      
      ::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
      
      /* Dark theme scrollbar */
      .bg-gray-800 ::-webkit-scrollbar-thumb {
        background: #4b5563;
      }
      
      .bg-gray-800 ::-webkit-scrollbar-thumb:hover {
        background: #6b7280;
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
