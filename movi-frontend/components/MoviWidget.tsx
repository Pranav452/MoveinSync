"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, Send, X, Image as ImageIcon, MessageSquare, Minimize2, Maximize2, Loader2, Sparkles } from "lucide-react";
import { sendChatMessage, uploadImageAnalysis } from "@/lib/api";
import { ChatMessage } from "@/types";
import ReactMarkdown from "react-markdown";

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
  
  // Image upload state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle Text Message Send (or Image + Text)
  const handleSend = async () => {
    if (!input.trim() && !selectedImage) return;

    const userContent = selectedImage 
        ? `[Uploaded Image: ${selectedImage.name}]${input.trim() ? ` ${input}` : ''}`
        : input;

    const userMsg: ChatMessage = { role: "user", content: userContent, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    
    const currentInput = input;
    setInput("");
    setIsTyping(true);

    try {
      let responseData;
      
      if (selectedImage) {
        // Use vision endpoint if image is present
        responseData = await uploadImageAnalysis(selectedImage, threadId, currentPage, currentInput);
        
        // Clear image state after sending
        setSelectedImage(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        // Regular chat
        responseData = await sendChatMessage(currentInput, threadId, currentPage);
      }

      const aiMsg: ChatMessage = { role: "assistant", content: responseData.response, timestamp: Date.now() };
      setMessages((prev) => [...prev, aiMsg]);
      
      if (responseData.awaiting_confirmation) {
        // Handle confirmation flow
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Error connecting to Movi Brain.", timestamp: Date.now() }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Handle Image Selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      
      // Create preview URL
      const objectUrl = URL.createObjectURL(file);
      setImagePreview(objectUrl);
    }
  };

  // Clear selected image
  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end font-sans">
      {/* Minimized Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-brand-600 hover:bg-brand-700 text-white p-4 rounded-full shadow-xl transition-all transform hover:scale-105 flex items-center gap-2 border-4 border-white"
        >
          <MessageSquare className="w-6 h-6" />
          <span className="font-bold">Ask Movi</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white w-[400px] h-[600px] rounded-2xl shadow-2xl flex flex-col border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-brand-600 p-4 flex justify-between items-center text-white shadow-md">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 p-1.5 rounded-lg">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                  <h3 className="font-bold text-sm leading-tight">Movi Assistant</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
                    <span className="text-[10px] font-medium text-brand-100">Online & Context Aware</span>
                  </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[90%] p-3.5 rounded-2xl text-sm shadow-sm ${
                    msg.role === "user"
                      ? "bg-brand-600 text-white rounded-br-none"
                      : "bg-white text-gray-800 border border-gray-200 rounded-bl-none"
                  }`}
                >
                  {/* Check if message starts with [Uploaded Image: ...] */}
                  {msg.content.startsWith('[Uploaded Image:') && imagePreview && idx === messages.length - 1 && msg.role === 'user' && (
                     <div className="mb-2 rounded-lg overflow-hidden border border-brand-400">
                        <img src={imagePreview} alt="Uploaded" className="w-full h-auto max-h-40 object-cover" />
                     </div>
                  )}

                  <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : ''}`}>
                    <ReactMarkdown
                      components={{
                        ul: ({node, ...props}) => <ul className="list-disc pl-4 space-y-1 my-2" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal pl-4 space-y-1 my-2" {...props} />,
                        li: ({node, ...props}) => <li className="marker:text-gray-400" {...props} />,
                        table: ({node, ...props}) => <div className="overflow-x-auto my-2 rounded-lg border border-gray-200"><table className="min-w-full divide-y divide-gray-200 text-xs" {...props} /></div>,
                        thead: ({node, ...props}) => <thead className="bg-gray-50" {...props} />,
                        th: ({node, ...props}) => <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" {...props} />,
                        td: ({node, ...props}) => <td className="px-3 py-2 whitespace-nowrap text-gray-700" {...props} />,
                        strong: ({node, ...props}) => <span className="font-bold text-brand-700" {...props} />
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl rounded-bl-none border border-gray-200 shadow-sm flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-medium">Movi is thinking</span>
                  <Loader2 className="w-3 h-3 animate-spin text-brand-600" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-100">
            
            {/* Image Preview Area */}
            {selectedImage && (
                <div className="flex items-center gap-2 mb-3 bg-gray-50 p-2 rounded-lg border border-gray-200">
                    <div className="relative w-12 h-12 rounded-md overflow-hidden border border-gray-300">
                        {imagePreview && (
                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{selectedImage.name}</p>
                        <p className="text-[10px] text-gray-400">Ready to analyze</p>
                    </div>
                    <button 
                        onClick={clearImage}
                        className="p-1 hover:bg-gray-200 rounded-full text-gray-500"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className="flex items-center gap-2 bg-gray-100 p-2 rounded-full border border-gray-200 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 transition-all">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageSelect}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className={`p-2 transition-colors ${selectedImage ? 'text-brand-600' : 'text-gray-400 hover:text-brand-600'}`}
                title="Upload Screenshot"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={selectedImage ? "Add instructions for this image..." : "Type your command..."}
                className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
              />
              
              <button
                onClick={handleSend}
                disabled={(!input.trim() && !selectedImage) || isTyping}
                className="p-2 bg-brand-600 text-white rounded-full hover:bg-brand-700 disabled:opacity-50 disabled:hover:bg-brand-600 transition-all shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[10px] text-center text-gray-400 mt-2 font-medium">
              AI can make mistakes. Check important info.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
