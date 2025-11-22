"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, Send, X, Image as ImageIcon, MessageSquare, Minimize2, Maximize2, Loader2 } from "lucide-react";
import { sendChatMessage, uploadImageAnalysis } from "@/lib/api";
import { ChatMessage } from "@/types";

interface MoviWidgetProps {
  currentPage: string; // 'busDashboard' or 'manageRoute'
}

export default function MoviWidget({ currentPage }: MoviWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi! I'm Movi. How can I help you manage transport today?", timestamp: Date.now() }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [threadId] = useState(() => `session_${Math.random().toString(36).substring(7)}`);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle Text Message
  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = { role: "user", content: input, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const data = await sendChatMessage(input, threadId, currentPage);
      const aiMsg: ChatMessage = { role: "assistant", content: data.response, timestamp: Date.now() };
      setMessages((prev) => [...prev, aiMsg]);
      
      // If confirmation is needed, we could trigger a UI modal here
      if (data.awaiting_confirmation) {
        // For now, the chat handles the "Yes/No" flow naturally
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Error connecting to Movi Brain.", timestamp: Date.now() }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Handle Image Upload (Vision)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];

    const userMsg: ChatMessage = { role: "user", content: `[Uploaded Image: ${file.name}]`, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const data = await uploadImageAnalysis(file, threadId, currentPage);
      
      // Show the AI's interpretation first (Optional, good for debugging)
      // const intentMsg: ChatMessage = { role: 'assistant', content: `👁️ I see: ${data.interpreted_intent}`, timestamp: Date.now() };
      
      const responseMsg: ChatMessage = { role: "assistant", content: data.response, timestamp: Date.now() };
      setMessages((prev) => [...prev, responseMsg]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: "assistant", content: "❌ Failed to analyze image.", timestamp: Date.now() }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Minimized Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white p-4 rounded-full shadow-xl transition-all transform hover:scale-105 flex items-center gap-2"
        >
          <MessageSquare className="w-6 h-6" />
          <span className="font-semibold">Ask Movi</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="bg-[#1a1625] w-[380px] h-[600px] rounded-2xl shadow-2xl flex flex-col border border-[#2d2a3a] overflow-hidden">
          {/* Header */}
          <div className="bg-[#7c3aed] p-4 flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <h3 className="font-bold text-lg">Movi Assistant</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/20 rounded-full">
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0f0f1a]">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
                    msg.role === "user"
                      ? "bg-[#7c3aed] text-white rounded-tr-none"
                      : "bg-[#1a1625] text-white border border-[#2d2a3a] rounded-tl-none"
                  }`}
                >
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-[#1a1625] p-3 rounded-2xl rounded-tl-none border border-[#2d2a3a] shadow-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-[#7c3aed]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-[#1a1625] border-t border-[#2d2a3a]">
            <div className="flex items-center gap-2 bg-[#2d2a3a] p-2 rounded-full">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-[#a78bfa] hover:text-[#7c3aed] transition-colors"
                title="Upload Screenshot"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type or ask to remove vehicles..."
                className="flex-1 bg-transparent outline-none text-sm text-white placeholder-[#6b7280]"
              />
              
              <button
                onClick={handleSend}
                disabled={!input.trim() && !isTyping}
                className="p-2 bg-[#7c3aed] text-white rounded-full hover:bg-[#6d28d9] disabled:opacity-50 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[10px] text-center text-[#6b7280] mt-2">
              Movi can make mistakes. Review generated actions.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}