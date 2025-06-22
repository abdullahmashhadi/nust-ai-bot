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

    this.shadowRoot.appendChild(reactContainer);

    this.reactRoot = createRoot(reactContainer);
    this.reactRoot.render(React.createElement(ChatWidget, this.options));

    // Append to body
    document.body.appendChild(this.container);
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
