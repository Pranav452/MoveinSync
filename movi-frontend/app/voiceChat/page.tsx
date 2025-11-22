'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, Loader2, Send, RotateCcw } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  audioUrl?: string;
}

const VOICE_PERSONAS = [
  { id: 'alloy', name: 'Alloy', color: '#3b82f6', description: 'Neutral and balanced' },
  { id: 'echo', name: 'Echo', color: '#8b5cf6', description: 'Warm and conversational' },
  { id: 'fable', name: 'Fable', color: '#ec4899', description: 'Expressive and dynamic' },
  { id: 'onyx', name: 'Onyx', color: '#64748b', description: 'Deep and authoritative' },
  { id: 'nova', name: 'Nova', color: '#06b6d4', description: 'Bright and energetic' },
  { id: 'shimmer', name: 'Shimmer', color: '#f59e0b', description: 'Gentle and soothing' },
];

export default function VoiceChatPage() {
  // Generate a NEW session ID on every page load/refresh
  const [threadId] = useState(() => `voice_${Date.now()}_${Math.random().toString(36).substring(7)}`);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('nova');
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('default');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Log session info
  useEffect(() => {
    console.log('🆕 New voice chat session started:', threadId);
  }, [threadId]);

  // Load available microphone devices
  useEffect(() => {
    const loadDevices = async () => {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) {
          console.warn('enumerateDevices not supported in this browser');
          return;
        }
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((d) => d.kind === 'audioinput');
        setAudioDevices(audioInputs);
      } catch (err) {
        console.error('Error listing audio devices:', err);
      }
    };

    loadDevices();
  }, []);

  const startNewChat = () => {
    if (confirm('Start a new conversation? This will clear your current chat.')) {
      window.location.reload();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startRecording = async () => {
    try {
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1,
      };

      if (selectedDeviceId !== 'default') {
        audioConstraints.deviceId = { exact: selectedDeviceId };
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: audioConstraints,
      });
      
      let options = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/mp4' };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = {};
      }
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        
        const recordingDuration = (Date.now() - recordingStartTimeRef.current) / 1000;
        const totalSize = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
        
        if (recordingDuration < 0.5) {
          alert('Recording too short! Please hold the button longer and speak your full message.');
          stream.getTracks().forEach(track => track.stop());
          setRecordingDuration(0);
          return;
        }
        
        if (totalSize === 0) {
          alert('No audio was recorded. Please check your microphone and try again.');
          stream.getTracks().forEach(track => track.stop());
          setRecordingDuration(0);
          return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType || 'audio/webm' });
        setRecordingDuration(0);
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      recordingStartTimeRef.current = Date.now();
      setRecordingDuration(0);
      
      recordingTimerRef.current = setInterval(() => {
        const duration = (Date.now() - recordingStartTimeRef.current) / 1000;
        setRecordingDuration(duration);
      }, 100);
      
    } catch (error) {
      console.error('❌ Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    }
  };

  const processAudio = async (blob: Blob) => {
    setIsProcessing(true);

    try {
      const formData = new FormData();
      const filename = blob.type.includes('mp4') ? 'recording.mp4' : 'recording.webm';
      formData.append('audio', blob, filename);
      
      const transcriptResponse = await fetch('http://localhost:8000/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!transcriptResponse.ok) throw new Error('Transcription failed');

      const transcriptData = await transcriptResponse.json();
      const userText = transcriptData.text || "I couldn't hear you clearly.";

      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        text: userText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);

      const chatResponse = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          thread_id: threadId,
          current_page: 'voiceChat',
        }),
      });

      if (!chatResponse.ok) throw new Error('Chat failed');

      const chatData = await chatResponse.json();
      const aiText = chatData.response || chatData.text || "I couldn't process that request.";

      const ttsResponse = await fetch('http://localhost:8000/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: aiText,
          voice: selectedVoice,
        }),
      });

      if (!ttsResponse.ok) throw new Error('TTS failed');

      const responseAudioBlob = await ttsResponse.blob();
      const audioUrl = URL.createObjectURL(responseAudioBlob);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        text: aiText,
        timestamp: new Date(),
        audioUrl,
      };
      setMessages(prev => [...prev, assistantMessage]);
      playAudio(audioUrl, assistantMessage.id);
    } catch (error) {
      console.error('Error processing audio:', error);
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        type: 'assistant',
        text: `Sorry, I encountered an error. Please try again.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const playAudio = (audioUrl: string, messageId: string) => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    const audio = new Audio(audioUrl);
    currentAudioRef.current = audio;
    setAudioPlaying(messageId);

    audio.onended = () => {
      setAudioPlaying(null);
      currentAudioRef.current = null;
    };

    audio.play();
  };

  const selectedVoiceData = VOICE_PERSONAS.find(v => v.id === selectedVoice) || VOICE_PERSONAS[4];

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Movi Voice Chat</h1>
            <p className="text-sm text-gray-500 mt-1">Speak naturally with your AI assistant</p>
          </div>
          
          <div className="flex items-center gap-3">
            {messages.length > 0 && (
              <button
                onClick={startNewChat}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors text-gray-600 font-medium shadow-sm"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-sm">New Chat</span>
              </button>
            )}
            
            <div className="relative">
            <button
              onClick={() => setShowVoiceSelector(!showVoiceSelector)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors shadow-sm"
            >
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: selectedVoiceData.color }}
              />
              <span className="text-gray-700 font-medium">{selectedVoiceData.name}</span>
            </button>

            {showVoiceSelector && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-10 overflow-hidden">
                <div className="p-2">
                  {VOICE_PERSONAS.map((voice) => (
                    <button
                      key={voice.id}
                      onClick={() => {
                        setSelectedVoice(voice.id);
                        setShowVoiceSelector(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        selectedVoice === voice.id
                          ? 'bg-brand-50 text-brand-700'
                          : 'hover:bg-gray-50 text-gray-600'
                      }`}
                    >
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: voice.color }}
                      />
                      <div className="text-left">
                        <div className="font-bold text-xs">{voice.name}</div>
                        <div className="text-[10px] opacity-70">{voice.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <div className="text-center py-16">
              <div 
                className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center shadow-sm border border-gray-100 bg-white"
              >
                <Mic 
                  className="w-10 h-10"
                  style={{ color: selectedVoiceData.color }}
                />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Start Talking with {selectedVoiceData.name}</h2>
              <p className="text-gray-500 mb-8 text-sm">Press and hold the microphone button below</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-4 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.type === 'assistant' && (
                  <div 
                    className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-white border border-gray-100 shadow-sm"
                  >
                    <Volume2 
                      className="w-5 h-5"
                      style={{ color: selectedVoiceData.color }}
                    />
                  </div>
                )}
                
                <div className={`max-w-[70%] ${message.type === 'user' ? 'order-first' : ''}`}>
                  <div
                    className={`rounded-2xl px-6 py-4 shadow-sm ${
                      message.type === 'user'
                        ? 'bg-brand-600 text-white rounded-br-none'
                        : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm">{message.text}</p>
                    
                    {message.audioUrl && (
                      <button
                        onClick={() => playAudio(message.audioUrl!, message.id)}
                        className="mt-3 flex items-center gap-2 text-xs font-bold opacity-70 hover:opacity-100 transition-opacity"
                      >
                        {audioPlaying === message.id ? (
                          <>
                            <Volume2 className="w-3 h-3 animate-pulse" />
                            <span>Playing...</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3" />
                            <span>Replay Audio</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <div className={`text-[10px] text-gray-400 mt-1 font-medium ${message.type === 'user' ? 'text-right' : 'text-left'}`}>
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>

                {message.type === 'user' && (
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex-shrink-0 flex items-center justify-center border border-brand-200">
                    <Mic className="w-5 h-5 text-brand-600" />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Recording Controls */}
      <div className="bg-white border-t border-gray-200 px-6 py-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
          {/* Microphone selector */}
          {audioDevices.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
              <span>Input Device:</span>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                disabled={isRecording || isProcessing}
              >
                <option value="default">System Default</option>
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId.slice(0, 6)}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {isProcessing ? (
            <div className="flex items-center gap-3 text-brand-600 bg-brand-50 px-6 py-3 rounded-full">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="font-bold text-sm">Processing...</span>
            </div>
          ) : (
            <>
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                disabled={isRecording && false}
                className={`group relative w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg ${
                  isRecording
                    ? 'bg-red-500 scale-110 shadow-red-200'
                    : 'bg-brand-600 hover:bg-brand-700 hover:scale-105 shadow-brand-200'
                }`}
              >
                {isRecording ? (
                  <MicOff className="w-8 h-8 text-white" />
                ) : (
                  <Mic className="w-8 h-8 text-white" />
                )}
                
                {isRecording && (
                  <div className="absolute -inset-2 rounded-full border-4 border-red-100 animate-ping" />
                )}
              </button>
              
              {isRecording && (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2 text-red-500">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="font-bold text-sm">{recordingDuration.toFixed(1)}s</span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium">
                    {recordingDuration < 0.5 ? 'Keep holding...' : 'Release to send'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        
        <p className="text-center text-xs text-gray-400 mt-4 font-medium">
          {isRecording ? 'Speaking...' : 'Press and hold to speak'}
        </p>
      </div>
    </div>
  );
}
