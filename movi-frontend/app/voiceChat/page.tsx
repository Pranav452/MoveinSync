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
        console.log('🎧 Available audio inputs:', audioInputs.map(d => d.label || d.deviceId));
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
      console.log('🎤 Requesting microphone access...');
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: false,  // Disable noise suppression - can remove voice
        autoGainControl: true,
        sampleRate: 48000,  // Higher sample rate for better quality
        channelCount: 1,  // Mono audio
      };

      if (selectedDeviceId !== 'default') {
        audioConstraints.deviceId = { exact: selectedDeviceId };
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: audioConstraints,
      });
      
      console.log('✅ Microphone access granted');
      
      // Try to use a compatible format
      let options = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        console.warn('audio/webm not supported, trying audio/mp4');
        options = { mimeType: 'audio/mp4' };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.warn('Trying default mime type');
        options = {};
      }
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log('📊 Data chunk received:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Clear timer
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        
        const recordingDuration = (Date.now() - recordingStartTimeRef.current) / 1000;
        console.log('⏹️ Recording stopped, duration:', recordingDuration.toFixed(2), 'seconds');
        console.log('📊 Total chunks:', audioChunksRef.current.length);
        
        const totalSize = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
        console.log('📦 Total audio size:', totalSize, 'bytes');
        
        // Check minimum duration
        if (recordingDuration < 0.5) {
          console.error('❌ Recording too short!');
          alert('Recording too short! Please hold the button longer and speak your full message.');
          stream.getTracks().forEach(track => track.stop());
          setRecordingDuration(0);
          return;
        }
        
        if (totalSize === 0) {
          console.error('❌ No audio data recorded!');
          alert('No audio was recorded. Please check your microphone and try again.');
          stream.getTracks().forEach(track => track.stop());
          setRecordingDuration(0);
          return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType || 'audio/webm' });
        console.log('🎵 Created audio blob:', audioBlob.size, 'bytes, type:', audioBlob.type);
        setRecordingDuration(0);
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event);
      };

      // Start recording with timeslice to get data chunks
      mediaRecorder.start(100); // Get data every 100ms
      setIsRecording(true);
      recordingStartTimeRef.current = Date.now();
      setRecordingDuration(0);
      
      // Update duration display
      recordingTimerRef.current = setInterval(() => {
        const duration = (Date.now() - recordingStartTimeRef.current) / 1000;
        setRecordingDuration(duration);
      }, 100);
      
      console.log('🔴 Recording started...');
    } catch (error) {
      console.error('❌ Error accessing microphone:', error);
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          alert('Microphone permission denied. Please allow microphone access in your browser settings and refresh the page.');
        } else if (error.name === 'NotFoundError') {
          alert('No microphone found. Please connect a microphone and try again.');
        } else {
          alert(`Microphone error: ${error.message}`);
        }
      } else {
        alert('Could not access microphone. Please check your permissions and try again.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('⏸️ Stopping recording...');
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    }
  };

  const processAudio = async (blob: Blob) => {
    setIsProcessing(true);
    console.log('🔄 Processing audio blob:', blob.size, 'bytes, type:', blob.type);

    try {
      // Step 1: Transcribe audio using Whisper
      const formData = new FormData();
      const filename = blob.type.includes('mp4') ? 'recording.mp4' : 'recording.webm';
      formData.append('audio', blob, filename);
      
      console.log('📤 Sending to transcription API...');

      const transcriptResponse = await fetch('http://localhost:8000/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!transcriptResponse.ok) {
        const errorText = await transcriptResponse.text();
        console.error('Transcription error:', errorText);
        throw new Error(`Transcription failed: ${transcriptResponse.status}`);
      }

      const transcriptData = await transcriptResponse.json();
      const userText = transcriptData.text || "I couldn't hear you clearly.";

      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        text: userText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);

      // Step 2: Get AI response
      console.log('💬 Sending to chat API with thread:', threadId);
      const chatResponse = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          thread_id: threadId,
          current_page: 'voiceChat',
        }),
      });

      if (!chatResponse.ok) {
        const errorText = await chatResponse.text();
        console.error('Chat error:', errorText);
        throw new Error(`Chat failed: ${chatResponse.status} - ${errorText}`);
      }

      const chatData = await chatResponse.json();
      const aiText = chatData.response || chatData.text || "I couldn't process that request.";

      // Step 3: Generate speech
      const ttsResponse = await fetch('http://localhost:8000/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: aiText,
          voice: selectedVoice,
        }),
      });

      if (!ttsResponse.ok) {
        const errorText = await ttsResponse.text();
        console.error('TTS error:', errorText);
        throw new Error(`TTS failed: ${ttsResponse.status}`);
      }

      const responseAudioBlob = await ttsResponse.blob();
      const audioUrl = URL.createObjectURL(responseAudioBlob);

      // Add assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        text: aiText,
        timestamp: new Date(),
        audioUrl,
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Auto-play the response
      playAudio(audioUrl, assistantMessage.id);
    } catch (error) {
      console.error('Error processing audio:', error);
      
      // Add error message to chat
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        type: 'assistant',
        text: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please make sure the backend is running and try again.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const playAudio = (audioUrl: string, messageId: string) => {
    // Stop any currently playing audio
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
    <div className="min-h-screen bg-[#0f0f1a] flex flex-col">
      {/* Header */}
      <div className="bg-[#1a1625] border-b border-[#2d2a3a] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Movi Voice Chat</h1>
            <p className="text-sm text-gray-400 mt-1">Speak naturally with your AI assistant</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* New Chat Button */}
            {messages.length > 0 && (
              <button
                onClick={startNewChat}
                className="flex items-center gap-2 px-3 py-2 bg-[#2d2a3a] hover:bg-[#3d3a4a] rounded-lg transition-colors text-gray-300 hover:text-white"
                title="Start new conversation"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-sm">New Chat</span>
              </button>
            )}
            
            {/* Voice Selector */}
            <div className="relative">
            <button
              onClick={() => setShowVoiceSelector(!showVoiceSelector)}
              className="flex items-center gap-2 px-4 py-2 bg-[#2d2a3a] hover:bg-[#3d3a4a] rounded-lg transition-colors"
            >
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: selectedVoiceData.color }}
              />
              <span className="text-white font-medium">{selectedVoiceData.name}</span>
            </button>

            {showVoiceSelector && (
              <div className="absolute right-0 mt-2 w-64 bg-[#1a1625] border border-[#2d2a3a] rounded-lg shadow-xl z-10">
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
                          ? 'bg-[#7c3aed] text-white'
                          : 'hover:bg-[#2d2a3a] text-gray-300'
                      }`}
                    >
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: voice.color }}
                      />
                      <div className="text-left">
                        <div className="font-medium">{voice.name}</div>
                        <div className="text-xs opacity-70">{voice.description}</div>
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
                className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center"
                style={{ backgroundColor: selectedVoiceData.color + '20' }}
              >
                <Mic 
                  className="w-12 h-12"
                  style={{ color: selectedVoiceData.color }}
                />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">{selectedVoiceData.name}</h2>
              <p className="text-gray-400 mb-8">{selectedVoiceData.description}</p>
              <p className="text-sm text-gray-500">Press and hold the microphone to start talking</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-4 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.type === 'assistant' && (
                  <div 
                    className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: selectedVoiceData.color + '20' }}
                  >
                    <Volume2 
                      className="w-5 h-5"
                      style={{ color: selectedVoiceData.color }}
                    />
                  </div>
                )}
                
                <div className={`max-w-[70%] ${message.type === 'user' ? 'order-first' : ''}`}>
                  <div
                    className={`rounded-2xl px-6 py-4 ${
                      message.type === 'user'
                        ? 'bg-[#7c3aed] text-white'
                        : 'bg-[#1a1625] text-white border border-[#2d2a3a]'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.text}</p>
                    
                    {message.audioUrl && (
                      <button
                        onClick={() => playAudio(message.audioUrl!, message.id)}
                        className="mt-3 flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition-opacity"
                      >
                        {audioPlaying === message.id ? (
                          <>
                            <Volume2 className="w-4 h-4 animate-pulse" />
                            <span>Playing...</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-4 h-4" />
                            <span>Play audio</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <div className={`text-xs text-gray-500 mt-1 ${message.type === 'user' ? 'text-right' : 'text-left'}`}>
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>

                {message.type === 'user' && (
                  <div className="w-10 h-10 rounded-full bg-[#7c3aed] flex-shrink-0 flex items-center justify-center">
                    <Mic className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Recording Controls */}
      <div className="bg-[#1a1625] border-t border-[#2d2a3a] px-6 py-6">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
          {/* Microphone selector */}
          {audioDevices.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
              <span className="text-gray-400">Microphone:</span>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="bg-[#2d2a3a] border border-[#3d3a4a] rounded-md px-2 py-1 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
                disabled={isRecording || isProcessing}
              >
                <option value="default">System default</option>
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId.slice(0, 6)}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          {isProcessing ? (
            <div className="flex items-center gap-3 text-[#c4b5fd]">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="font-medium">Processing your message...</span>
            </div>
          ) : (
            <>
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                disabled={isRecording && false}
                className={`group relative w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  isRecording
                    ? 'bg-red-500 scale-110 shadow-lg shadow-red-500/50'
                    : 'bg-[#7c3aed] hover:bg-[#6d28d9] hover:scale-105 shadow-lg shadow-[#7c3aed]/30'
                }`}
              >
                {isRecording ? (
                  <MicOff className="w-10 h-10 text-white" />
                ) : (
                  <Mic className="w-10 h-10 text-white" />
                )}
                
                {isRecording && (
                  <div className="absolute -inset-2 rounded-full border-4 border-red-500 animate-ping" />
                )}
              </button>
              
              {isRecording && (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2 text-red-400">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="font-medium">Recording... {recordingDuration.toFixed(1)}s</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {recordingDuration < 0.5 ? 'Keep holding and speak...' : 'Release when done speaking'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        
        <p className="text-center text-sm text-gray-500 mt-4">
          {isRecording ? 'Keep holding and speak clearly, then release to send' : 'Press and hold the button, speak your message, then release'}
        </p>
      </div>
    </div>
  );
}

