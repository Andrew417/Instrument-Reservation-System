import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import {
  MessageSquare,
  Sparkles,
  X,
  Send,
  RotateCcw,
  Minimize2,
  Maximize2,
  Bot,
  User,
  Calendar,
  BookmarkCheck,
  Award,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  Info,
  Clock,
  ShieldAlert,
} from "lucide-react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ChatAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateView?: (view: "calendar" | "my_reservations") => void;
  onOpenMinistryProfile?: () => void;
}

const STORAGE_KEY = "church_chat_assistant_messages_v1";

export const ChatAssistantModal: React.FC<ChatAssistantModalProps> = ({
  isOpen,
  onClose,
  onNavigateView,
  onOpenMinistryProfile,
}) => {
  const { t, i18n } = useTranslation();
  const { sessionToken, profile } = useAuth();
  const isRTL = i18n.language === "ar";

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {
        // Fall back to greeting
      }
    }
    return [
      {
        id: "initial-greeting",
        role: "assistant",
        content: t(
          "chatAssistant.greeting",
          "Hello! I am your AI Reservation Assistant for St. Mark Church. How can I help you today? You can ask me how to book an instrument, check church rules, or explore equipment.",
        ),
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ];
  });

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastAttemptedQueryRef = useRef<string>("");

  // Sync initial greeting if language changes and only greeting is present
  useEffect(() => {
    if (messages.length === 1 && messages[0].id === "initial-greeting") {
      setMessages([
        {
          id: "initial-greeting",
          role: "assistant",
          content: t("chatAssistant.greeting"),
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    }
  }, [i18n.language]);

  // Save messages to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch {
        // Ignore storage quotas
      }
    }
  }, [messages]);

  // Scroll to bottom when messages change or modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, messages, isLoading]);

  const handleClearChat = () => {
    const greeting: ChatMessage = {
      id: "greeting-" + Date.now(),
      role: "assistant",
      content: t("chatAssistant.greeting"),
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages([greeting]);
    setErrorMsg(null);
    lastAttemptedQueryRef.current = "";
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  };

  const handleSendMessage = async (textToSend?: string, isRetry = false) => {
    const messageContent = (textToSend || input).trim();
    if (!messageContent || isLoading) return;

    lastAttemptedQueryRef.current = messageContent;
    setErrorMsg(null);
    if (!isRetry) {
      setInput("");
    }

    let updatedMessages = [...messages];

    // If not a retry, or if the last message is not already this user message, append it
    const lastMsg = updatedMessages[updatedMessages.length - 1];
    if (!isRetry || !lastMsg || lastMsg.role !== "user" || lastMsg.content !== messageContent) {
      const userMessage: ChatMessage = {
        id: "user-" + Date.now(),
        role: "user",
        content: messageContent,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      updatedMessages = [...updatedMessages, userMessage];
      setMessages(updatedMessages);
    }

    setIsLoading(true);

    try {
      // Build conversation turns for backend
      const payloadMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken || ""}`,
        },
        body: JSON.stringify({
          messages: payloadMessages,
          userLanguage: i18n.language,
          clientContext: {
            userName: profile?.name,
            userRole: profile?.role,
            isTrusted: profile?.isTrusted,
          },
        }),
      });

      const data = await res.json();

      if (data.success && data.message) {
        const assistantMessage: ChatMessage = {
          id: "assistant-" + Date.now(),
          role: "assistant",
          content: data.message.content,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const fallbackText =
          data.fallbackReply ||
          data.error ||
          t("chatAssistant.errorOccurred", "Could not get a response. Please try again.");
        setErrorMsg(fallbackText);
      }
    } catch (err: any) {
      console.error("[Chat Modal Error]", err);
      setErrorMsg(
        t(
          "chatAssistant.errorOccurred",
          "Could not get a response. Please try again.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    if (lastAttemptedQueryRef.current) {
      handleSendMessage(lastAttemptedQueryRef.current, true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Quick suggestion prompts
  const quickPrompts = [
    { label: t("chatAssistant.q1", "How do I book an instrument?"), query: t("chatAssistant.q1", "How do I book an instrument?") },
    { label: t("chatAssistant.q2", "Working hours & rules?"), query: t("chatAssistant.q2", "What are the church working hours and reservation rules?") },
    { label: t("chatAssistant.q3", "In-Church vs Outside-Church?"), query: t("chatAssistant.q3", "What is the difference between In-Church and Outside-Church bookings and fees?") },
    { label: t("chatAssistant.q4", "How do recurring series work?"), query: t("chatAssistant.q4", "How do recurring series work and what is the limit?") },
    { label: t("chatAssistant.q5", "Condition Check sheet?"), query: t("chatAssistant.q5", "What is the Condition Check / Handover sheet and how do I use it?") },
  ];

  if (!isOpen) return null;

  return (
    <div
      className={`fixed z-50 flex flex-col shadow-2xl transition-all duration-200 border border-slate-700/60 bg-slate-900/95 backdrop-blur-xl text-slate-100 ${
        isExpanded
          ? "inset-2 md:inset-10 rounded-2xl"
          : "bottom-0 right-0 sm:bottom-4 sm:right-4 w-full sm:w-[440px] md:w-[480px] h-[92vh] sm:h-[620px] max-h-[85vh] rounded-t-2xl sm:rounded-2xl"
      }`}
      style={{ direction: isRTL ? "rtl" : "ltr" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-900/80 via-purple-900/70 to-slate-900 border-b border-indigo-500/20 rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-cyan-400 p-[1.5px] shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-slate-900" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-sm text-white">
                {t("chatAssistant.title", "Reservation Assistant")}
              </h3>
              <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                Gemini 3.8
              </span>
            </div>
            <p className="text-[11px] text-slate-300/80 line-clamp-1">
              {t("chatAssistant.subtitle", "AI Guide for Church Instruments & Booking")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Clear history */}
          <button
            onClick={handleClearChat}
            title={t("chatAssistant.clearChat", "Clear Chat")}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Expand / Minimize size */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? t("chatAssistant.minimize", "Minimize") : t("chatAssistant.maximize", "Expand")}
            className="hidden sm:inline-flex p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            title={t("chatAssistant.close", "Close")}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick App Navigation Shortcuts Bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/60 border-b border-slate-800 text-xs overflow-x-auto scrollbar-thin">
        <span className="text-[10px] uppercase font-semibold text-slate-400 shrink-0">
          {t("chatAssistant.shortcutActions", "Quick Shortcuts")}:
        </span>
        {onNavigateView && (
          <>
            <button
              onClick={() => {
                onNavigateView("calendar");
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-indigo-600/40 text-slate-300 hover:text-indigo-200 border border-slate-700/60 transition-colors text-[11px] shrink-0"
            >
              <Calendar className="w-3 h-3 text-indigo-400" />
              {t("chatAssistant.goToCalendar", "Go to Calendar")}
            </button>
            <button
              onClick={() => {
                onNavigateView("my_reservations");
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-indigo-600/40 text-slate-300 hover:text-indigo-200 border border-slate-700/60 transition-colors text-[11px] shrink-0"
            >
              <BookmarkCheck className="w-3 h-3 text-emerald-400" />
              {t("chatAssistant.goToMyReservations", "My Reservations")}
            </button>
          </>
        )}
        {onOpenMinistryProfile && (
          <button
            onClick={onOpenMinistryProfile}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-indigo-600/40 text-slate-300 hover:text-indigo-200 border border-slate-700/60 transition-colors text-[11px] shrink-0"
          >
            <Award className="w-3 h-3 text-amber-400" />
            {t("chatAssistant.openProfile", "Ministry Profile")}
          </button>
        )}
      </div>

      {/* Message Thread (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${
                isUser ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold ${
                  isUser
                    ? "bg-indigo-600 text-white"
                    : "bg-gradient-to-br from-indigo-700 to-purple-800 text-amber-300 border border-indigo-400/40"
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm ${
                  isUser
                    ? "bg-indigo-600 text-white rounded-tr-none"
                    : "bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-tl-none whitespace-pre-wrap"
                }`}
              >
                <div className="break-words">{renderFormattedText(msg.content)}</div>
                <div
                  className={`text-[10px] mt-1.5 opacity-60 text-right ${
                    isUser ? "text-indigo-200" : "text-slate-400"
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-700 to-purple-800 text-amber-300 flex items-center justify-center shrink-0 border border-indigo-400/40">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
            </div>
            <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl rounded-tl-none px-4 py-3 text-slate-300 text-xs flex items-center gap-2">
              <span className="inline-flex gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
              <span className="text-slate-400 font-medium">
                {t("chatAssistant.thinking", "Thinking...")}
              </span>
            </div>
          </div>
        )}

        {/* Error message with retry */}
        {errorMsg && (
          <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center justify-between gap-2">
            <span>{errorMsg}</span>
            <button
              onClick={handleRetry}
              className="px-2.5 py-1 rounded bg-rose-800 hover:bg-rose-700 text-white text-[11px] font-semibold shrink-0 cursor-pointer transition-colors"
            >
              {t("chatAssistant.retry", "Retry")}
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="px-3 pt-2 pb-1 border-t border-slate-800/80 bg-slate-950/40">
        <div className="text-[10px] text-slate-400 font-medium mb-1.5 flex items-center gap-1">
          <HelpCircle className="w-3 h-3 text-indigo-400" />
          <span>{t("chatAssistant.quickQuestionsTitle", "Suggested questions")}:</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {quickPrompts.map((q, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(q.query)}
              disabled={isLoading}
              className="px-2.5 py-1 rounded-full text-[11px] bg-slate-800/80 hover:bg-indigo-600/30 hover:border-indigo-500/50 text-slate-300 hover:text-white border border-slate-700/60 whitespace-nowrap transition-colors shrink-0 disabled:opacity-50"
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <div className="p-3 bg-slate-900 border-t border-slate-800/90 rounded-b-2xl">
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t(
              "chatAssistant.placeholder",
              "Ask anything about instruments, reservations, or rules...",
            )}
            disabled={isLoading}
            className="w-full pl-3 pr-10 py-2.5 bg-slate-800/90 text-slate-100 placeholder-slate-400 text-xs sm:text-sm rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || isLoading}
            className="absolute right-1.5 p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:hover:bg-indigo-600 transition-colors"
            title={t("chatAssistant.send", "Send")}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Format markdown bullet points and bolding cleanly
 */
function renderFormattedText(text: string): React.ReactNode {
  if (!text) return null;

  // Split lines to detect lists and paragraphs
  const lines = text.split("\n");

  return lines.map((line, idx) => {
    const trimmed = line.trim();

    // Line starting with bullet or dash
    const isBullet = trimmed.startsWith("•") || trimmed.startsWith("- ") || trimmed.startsWith("* ");
    const bulletContent = isBullet ? trimmed.replace(/^([•\-\*]\s*)/, "") : line;

    // Parse simple bold tags **text**
    const parts = bulletContent.split(/(\*\*[^*]+\*\*)/g);

    const formattedParts = parts.map((part, pIdx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={pIdx} className="font-semibold text-indigo-300">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });

    if (isBullet) {
      return (
        <div key={idx} className="flex items-start gap-1.5 my-0.5">
          <span className="text-indigo-400 font-bold leading-relaxed shrink-0">•</span>
          <span className="flex-1">{formattedParts}</span>
        </div>
      );
    }

    if (trimmed === "") {
      return <div key={idx} className="h-1.5" />;
    }

    return (
      <div key={idx} className="my-0.5">
        {formattedParts}
      </div>
    );
  });
}

/**
 * Floating Launcher Button for the Chatbot
 */
export const ChatAssistantFloatingButton: React.FC<{
  onClick: () => void;
  isOpen: boolean;
}> = ({ onClick, isOpen }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  if (isOpen) return null;

  return (
    <div
      className={`fixed z-40 ${
        isRTL ? "left-4 sm:left-6" : "right-4 sm:right-6"
      } bottom-20 sm:bottom-6`}
    >
      <button
        onClick={onClick}
        className="group relative flex items-center gap-2.5 px-3.5 py-3 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-105 active:scale-95 transition-all duration-200 border border-indigo-400/40"
        title={t("chatAssistant.title", "Reservation Assistant")}
      >
        <div className="relative">
          <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-indigo-900 animate-ping opacity-75" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-indigo-900" />
        </div>
        <span className="hidden sm:inline font-semibold text-xs text-white tracking-wide">
          {t("chatAssistant.title", "Reservation Assistant")}
        </span>
        <span className="sm:hidden text-xs font-semibold">
          AI
        </span>
      </button>
    </div>
  );
};
