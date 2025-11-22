'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, 
  StopCircle, 
  Bot, 
  User, 
  Sparkles, 
  ArrowRight, 
  Activity, 
  Cpu,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { LiveKitRoom, useVoiceAssistant, RoomAudioRenderer, useDataChannel, useRoomContext } from '@livekit/components-react';
import '@livekit/components-styles';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

const ROOM_NAME = 'movi-voice-room';

// --- Types ---
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  metadata?: {
    toolName?: string;
    status?: 'pending' | 'success' | 'error';
  };
}

interface ToolStatus {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  message: string;
}

// --- Browser Speech Recognition Polyfill ---
const useBrowserSpeech = (onTranscript: (text: string, isFinal: boolean) => void) => {
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          
          const text = finalTranscript || interimTranscript;
          if (text) {
             onTranscript(text, !!finalTranscript);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error', event.error);
        };
        
        recognitionRef.current = recognition;
      }
    }
  }, [onTranscript]);

  const start = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        // Often throws if already started
      }
    }
  }, []);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  return { isListening, start, stop };
};

export default function VoiceChatPage() {
  const [isStarted, setIsStarted] = useState(false);
  const [token, setToken] = useState<string>('');

  const connect = async () => {
    try {
      const participantName = `user_${Math.random().toString(36).substring(7)}`;
      const response = await fetch('http://localhost:8000/api/livekit-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_name: ROOM_NAME,
          participant_name: participantName,
        }),
      });
      const data = await response.json();
      setToken(data.token);
      setIsStarted(true);
    } catch (error) {
      console.error('Failed to connect:', error);
      alert('Failed to connect to voice server.');
    }
  };

  const handleEnd = () => {
    setIsStarted(false);
    setToken('');
  };

  return (
    <div className="h-full w-full bg-white overflow-hidden font-sans text-gray-900">
      <AnimatePresence mode="wait">
        {!isStarted ? (
          <StartScreen key="start" onStart={connect} />
        ) : (
          <LiveKitRoom
            key="room"
            token={token}
            serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://movi-voice-i1y8hkre.livekit.cloud'}
            connect={true}
            audio={true}
            video={false}
            className="h-full w-full"
          >
            <ChatInterface onEnd={handleEnd} />
          </LiveKitRoom>
        )}
      </AnimatePresence>
    </div>
  );
}

function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="h-full w-full flex flex-col items-center justify-center p-6 relative bg-neutral-50 overflow-hidden"
    >
      {/* Background Decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-green-50/50 to-transparent" />
      </div>

      {/* Content */}
      <div className="z-10 w-full max-w-4xl flex flex-col items-center">
        
        {/* Hero Section */}
        <div className="text-center mb-12">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="w-20 h-20 bg-green-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-xl shadow-green-200 rotate-3 hover:rotate-6 transition-transform duration-500"
          >
            <Sparkles className="w-10 h-10 text-white" />
          </motion.div>
          
          <h1 className="text-5xl font-bold text-gray-900 mb-4 tracking-tight">
            Movi Voice Command
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
            Natural language fleet management. Speak naturally to manage routes, trips, and vehicles.
          </p>
        </div>

        {/* Suggestion Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-16 px-4">
          {[
            { icon: Clock, label: "Today's Schedule", text: "Show me all trips scheduled for today" },
            { icon: Activity, label: "Live Status", text: "How many vehicles are currently active?" },
            { icon: CheckCircle2, label: "Assign Vehicle", text: "Assign a bus to the 8 AM Tech Park route" }
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + (i * 0.1) }}
              className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-default group"
            >
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-green-100 transition-colors">
                <item.icon className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{item.label}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">"{item.text}"</p>
            </motion.div>
          ))}
        </div>

        {/* Action Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onStart}
          className="group relative flex items-center gap-4 bg-gray-900 text-white px-10 py-5 rounded-full text-lg font-medium shadow-2xl hover:bg-gray-800 transition-all overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <Mic className="w-6 h-6 text-green-400 group-hover:animate-bounce" />
          <span className="relative z-10">Start Listening</span>
          <ArrowRight className="w-5 h-5 opacity-50 group-hover:translate-x-1 transition-transform relative z-10" />
        </motion.button>

        <p className="mt-6 text-xs text-gray-400 font-medium tracking-wide uppercase">
          Powered by LiveKit & OpenAI
        </p>
      </div>
    </motion.div>
  );
}

function ChatInterface({ onEnd }: { onEnd: () => void }) {
  const { state, audioTrack } = useVoiceAssistant();
  const [messages, setMessages] = useState<Message[]>([]);
  const [liveUserText, setLiveUserText] = useState('');
  const [activeTools, setActiveTools] = useState<ToolStatus[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Browser STT for immediate feedback ---
  const { start: startBrowserSTT, stop: stopBrowserSTT } = useBrowserSpeech((text, isFinal) => {
    // Only update if we are in listening state to match visual expectations
    if (state === 'listening' || state === 'thinking') {
      setLiveUserText(text);
    }
  });

  useEffect(() => {
    if (state === 'listening') {
      startBrowserSTT();
    } else {
      stopBrowserSTT();
      if (state === 'thinking' && liveUserText) {
        // Keep the text visible while thinking
      } else {
        // Clear live text after a delay or when speaking starts
        if (state === 'speaking') {
             setLiveUserText(''); 
        }
      }
    }
  }, [state, startBrowserSTT, stopBrowserSTT, liveUserText]);

  // --- LiveKit Data Channels ---
  useDataChannel('agent.thoughts', (msg) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      
      // --- Handle Transcription (Agent/User) ---
      if (data.type === 'transcription') {
        const role = data.toolName === 'agent' ? 'assistant' : 'user';
        setMessages(prev => {
           // If user just spoke, replace the "liveUserText" or avoid dupes
           if (role === 'user') {
             setLiveUserText(''); // Clear live text
           }
           return [...prev, {
             id: Date.now().toString(),
             role: role,
             content: data.content,
             timestamp: new Date(),
             isStreaming: false // Completed text
           }];
        });
      }
      // --- Handle Tool Calls ---
      else if (data.type === 'tool_call') {
        const newTool: ToolStatus = {
          id: Date.now().toString(),
          name: data.toolName || 'Unknown Tool',
          status: 'running',
          message: data.content
        };
        setActiveTools(prev => [...prev, newTool]);
        
        // Also add a system message for the log history
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: data.content,
          timestamp: new Date(),
          metadata: { toolName: data.toolName, status: 'pending' }
        }]);
      } 
      else if (data.type === 'tool_result') {
        setActiveTools(prev => prev.filter(t => t.name !== data.toolName)); // Remove active tool
        
        setMessages(prev => {
          // Find the pending system message and update it
          const idx = prev.findLastIndex(m => m.role === 'system' && m.metadata?.toolName === data.toolName);
          if (idx !== -1) {
            const newMsgs = [...prev];
            newMsgs[idx] = {
              ...newMsgs[idx],
              content: data.content, // Or keep original "Calling..." and add "Done"
              metadata: { ...newMsgs[idx].metadata, status: 'success' }
            };
            return newMsgs;
          }
          return prev;
        });
      }
    } catch(e) { console.error(e); }
  });

  // Commit user message when backend acknowledges or state changes (simplified)
  // We actually rely on the browser STT for "preview" and could commit it as a message
  // when the state switches to "thinking".
  useEffect(() => {
    if (state === 'thinking' && liveUserText) {
      setMessages(prev => {
        // Avoid duplicate if the last message was the same
        const last = prev[prev.length - 1];
        if (last?.role === 'user' && last.content === liveUserText) return prev;
        
        return [...prev, {
          id: Date.now().toString(),
          role: 'user',
          content: liveUserText,
          timestamp: new Date()
        }];
      });
      // We don't clear liveUserText yet, wait for speaking
    }
  }, [state, liveUserText]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveUserText, activeTools]);

  return (
    <div className="flex flex-col h-full w-full bg-white relative">
       <RoomAudioRenderer />
       
       {/* Header */}
       <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white z-10">
         <div className="flex items-center gap-3">
           <div className="relative">
             <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center shadow-sm">
               <Bot className="w-5 h-5 text-white" />
             </div>
             <div className={cn(
               "absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white",
               state === 'listening' ? "bg-green-500 animate-pulse" :
               state === 'speaking' ? "bg-emerald-400" :
               state === 'thinking' ? "bg-amber-400 animate-bounce" : "bg-gray-300"
             )} />
           </div>
           <div>
             <h2 className="font-semibold text-gray-900">Movi Assistant</h2>
             <p className="text-xs text-gray-500">
               {state === 'listening' ? 'Listening...' :
                state === 'thinking' ? 'Processing...' :
                state === 'speaking' ? 'Speaking...' : 'Ready'}
             </p>
           </div>
         </div>
         <button 
           onClick={onEnd}
           className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-colors"
         >
           <StopCircle className="w-6 h-6" />
         </button>
       </div>

       {/* Messages Area */}
       <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-gradient-to-b from-white to-gray-50">
         {messages.length === 0 && !liveUserText && (
           <div className="h-full flex flex-col items-center justify-center opacity-40">
             <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-4">
               <Mic className="w-8 h-8 text-green-600" />
             </div>
             <p className="text-gray-500 font-medium">Start speaking naturally...</p>
           </div>
         )}

         {messages.map((msg, i) => (
           <motion.div 
             key={msg.id}
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             className={cn(
               "flex w-full",
               msg.role === 'user' ? "justify-end" : "justify-start"
             )}
           >
             {/* System / Tool Message */}
             {msg.role === 'system' ? (
               <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full text-xs text-gray-500 border border-gray-100 shadow-sm mx-auto">
                 {msg.metadata?.status === 'success' ? (
                   <CheckCircle2 className="w-3 h-3 text-green-500" />
                 ) : (
                   <Cpu className="w-3 h-3 text-blue-500 animate-spin" />
                 )}
                 <span className="font-medium uppercase tracking-wider text-[10px] mr-1 text-gray-400">{msg.metadata?.toolName}</span>
                 <span className="text-gray-600">{msg.content}</span>
               </div>
             ) : (
               /* Chat Message */
               <div className={cn(
                 "max-w-[80%] rounded-2xl p-5 shadow-sm prose prose-sm",
                 msg.role === 'user' 
                   ? "bg-green-600 text-white rounded-br-none shadow-green-100 prose-invert" 
                   : "bg-white border border-gray-100 text-gray-800 rounded-bl-none shadow-sm"
               )}>
                  <ReactMarkdown 
                    components={{
                      p: ({children}) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                      ul: ({children}) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                      ol: ({children}) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                      li: ({children}) => <li className="ml-2">{children}</li>,
                      table: ({children}) => <div className="overflow-x-auto my-2"><table className="min-w-full divide-y divide-gray-200 text-xs">{children}</table></div>,
                      thead: ({children}) => <thead className="bg-gray-50">{children}</thead>,
                      th: ({children}) => <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{children}</th>,
                      td: ({children}) => <td className="px-3 py-2 whitespace-nowrap text-gray-500">{children}</td>,
                      strong: ({children}) => <span className="font-bold">{children}</span>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                 {msg.role === 'assistant' && msg.isStreaming && (
                   <span className="inline-block w-1.5 h-4 bg-green-400 ml-1 animate-pulse align-middle" />
                 )}
               </div>
             )}
           </motion.div>
         ))}

         {/* Live User Preview */}
         {liveUserText && (
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             className="flex justify-end"
           >
             <div className="max-w-[80%] rounded-2xl p-5 bg-green-50 text-green-700 rounded-br-none italic border border-green-100/50">
               <p className="text-sm">{liveUserText}...</p>
             </div>
           </motion.div>
         )}
         
         {/* Active Tools Floating Indicator */}
         <AnimatePresence>
            {activeTools.map(tool => (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="mx-auto flex items-center gap-2 px-4 py-2 bg-white text-green-700 rounded-full text-xs border border-green-100 shadow-md shadow-green-100/50 z-20"
              >
                 <Activity className="w-3 h-3 animate-spin text-green-500" />
                 <span className="font-medium">{tool.message}</span>
              </motion.div>
            ))}
         </AnimatePresence>

         <div ref={messagesEndRef} />
       </div>

       {/* Bottom Visualizer */}
       <div className="px-6 py-8 bg-white border-t border-gray-50">
         <div className="flex items-center justify-center gap-1 h-8">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  height: state === 'listening' ? [8, 32, 8] : state === 'speaking' ? [8, 24, 8] : 8,
                  opacity: state === 'listening' ? 1 : state === 'speaking' ? 0.8 : 0.2
                }}
                transition={{
                  repeat: Infinity,
                  duration: 0.5,
                  delay: i * 0.1,
                  ease: "easeInOut"
                }}
                className={cn(
                  "w-2 rounded-full",
                  state === 'listening' ? "bg-green-600" : 
                  state === 'speaking' ? "bg-emerald-400" : "bg-gray-300"
                )}
              />
            ))}
         </div>
       </div>
    </div>
  );
}
