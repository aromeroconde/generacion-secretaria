'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Mic, Phone, PhoneOff, Settings2, FileText, MessageSquare, RefreshCw, ArrowLeft, Globe, Link } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

// Simple Toast Component
const Toast = ({ message, onClose }: { message: string; onClose: () => void }) => (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5 fade-in duration-300">
        <div className="bg-[#1A1F26] border border-purple-500/30 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md">
            <div className="bg-purple-500/20 p-2 rounded-full">
                <Settings2 className="w-4 h-4 text-purple-400" />
            </div>
            <div>
                <h4 className="font-medium text-sm text-purple-200">¡Magia Realizada! ✨</h4>
                <p className="text-xs text-gray-400">{message}</p>
            </div>
            <button onClick={onClose} className="ml-2 hover:bg-white/10 p-1 rounded-full transition-colors">
                <span className="sr-only">Cerrar</span>
                <span className="text-gray-500 text-xs">✕</span>
            </button>
        </div>
    </div>
);

interface LabInterfaceProps {
    initialData: {
        company_name?: string;
        system_prompt_chat?: string;
        system_prompt_voice?: string;
        context_file_urls?: string[];
        website_urls?: string[];
        knowledge_base_markdown?: string;
    };
}

export default function LabInterface({ initialData }: LabInterfaceProps) {
    console.log("🧪 LabInterface cargado con datos:", initialData);
    const [activeTab, setActiveTab] = useState<'chat' | 'voice'>('chat');

    // Toast State
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Knowledge Base State
    const [knowledgeBaseText, setKnowledgeBaseText] = useState<string>('');
    const [isParsing, setIsParsing] = useState(false);

    // Config / Prompt Editor State
    const [systemPrompt, setSystemPrompt] = useState(initialData.system_prompt_chat || '');
    const [voicePrompt, setVoicePrompt] = useState(initialData.system_prompt_voice || '');

    // Feedback State
    const [feedbackTarget, setFeedbackTarget] = useState<'chat' | 'voice'>('chat');
    const [feedbackText, setFeedbackText] = useState('');

    // Chat State
    const [messages, setMessages] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [input, setInput] = useState('');

    // ===== VOICE BOT STATE (WebSocket Native Audio) =====
    const [isVoiceConnected, setIsVoiceConnected] = useState(false);
    const [isVoiceListening, setIsVoiceListening] = useState(false);
    const [voiceTranscription, setVoiceTranscription] = useState('');
    const [voiceError, setVoiceError] = useState<string | null>(null);

    // Voice Refs
    const sessionRef = useRef<any>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Reconnect state
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isManualRef = useRef(false);
    const MAX_RECONNECT = 2;
    const RECONNECT_DELAY_MS = 1000;

    // Sync feedback target with active tab
    useEffect(() => {
        setFeedbackTarget(activeTab);
    }, [activeTab]);

    // Parse files on load OR use pre-loaded data
    useEffect(() => {
        if (initialData.knowledge_base_markdown) {
            setKnowledgeBaseText(initialData.knowledge_base_markdown);
            return;
        }

        const fetchKnowledgeBase = async () => {
            if (!initialData.context_file_urls?.length) return;
            setIsParsing(true);
            try {
                const res = await fetch('/api/parse-files', {
                    method: 'POST',
                    body: JSON.stringify({ fileUrls: initialData.context_file_urls })
                });
                const data = await res.json();

                if (data.error) {
                    setKnowledgeBaseText(`ERROR API: ${data.error}`);
                } else if (data.markdown && data.markdown.trim()) {
                    setKnowledgeBaseText(data.markdown);
                } else if (data.debug_raw) {
                    setKnowledgeBaseText("DEBUG - RAW RESPONSE:\n" + JSON.stringify(data.debug_raw, null, 2));
                } else {
                    setKnowledgeBaseText('Sin contenido legible (ni datos de depuración).');
                }
            } catch (e) {
                console.error(e);
                setKnowledgeBaseText('Error al leer archivos.');
            } finally {
                setIsParsing(false);
            }
        };
        fetchKnowledgeBase();
    }, [initialData.context_file_urls, initialData.knowledge_base_markdown]);

    // ===== VOICE BOT: WebSocket Native Audio =====

    // Dynamic import helpers (client-side only)
    const audioHelpersRef = useRef<any>(null);
    const genaiRef = useRef<any>(null);

    const loadDependencies = async () => {
        if (!audioHelpersRef.current) {
            audioHelpersRef.current = await import('@/lib/audioHelpers');
        }
        if (!genaiRef.current) {
            const { GoogleGenAI, Modality } = await import('@google/genai');
            genaiRef.current = { GoogleGenAI, Modality };
        }
        return { helpers: audioHelpersRef.current, genai: genaiRef.current };
    };

    const stopVoiceCall = useCallback(() => {
        console.log("🛑 Stopping voice call...");
        isManualRef.current = true;
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (sessionRef.current) {
            try { sessionRef.current.close(); } catch (e) { }
            sessionRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        sourcesRef.current.forEach(source => {
            try { source.stop(); } catch (e) { }
        });
        sourcesRef.current.clear();
        setIsVoiceConnected(false);
        setIsVoiceListening(false);
    }, []);

    const startVoiceCall = async () => {
        try {
            setVoiceError(null);
            setIsVoiceListening(true);
            setVoiceTranscription('');
            isManualRef.current = false;
            reconnectAttemptsRef.current = 0;

            // 1. Load dependencies
            const { helpers, genai } = await loadDependencies();
            const { GoogleGenAI, Modality } = genai;
            const { decode, decodeAudioData, createBlob } = helpers;

            // 2. Get ephemeral token from proxy (never exposes real API key)
            const tokenRes = await fetch('/api/gemini-token');
            const tokenData = await tokenRes.json();
            if (!tokenData.token) throw new Error(tokenData.error || "No token from proxy");

            const isEphemeral = (tokenData.token as string).startsWith('auth_tokens/');
            const ai = new GoogleGenAI({
                apiKey: tokenData.token,
                ...(isEphemeral ? { httpOptions: { apiVersion: 'v1alpha' } } : {}),
            });

            // 3. Setup Audio Contexts
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            }
            if (!outputAudioContextRef.current) {
                outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }

            // 4. Get Microphone
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // 5. Build system instruction with knowledge base
            const fullSystemPrompt = [
                voicePrompt || "Eres un asistente virtual amable y profesional.",
                knowledgeBaseText ? `\n\nBASE DE CONOCIMIENTO:\n${knowledgeBaseText}` : '',
                messages.length > 0 ? `\n\nHISTORIAL DE CONVERSACIÓN:\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}` : ''
            ].join('');

            console.log("🎤 Connecting to Gemini Native Audio...");

            // 6. Connect via Live API
            const session = await ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: fullSystemPrompt,
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                    },
                    outputAudioTranscription: {},
                    inputAudioTranscription: {},
                },
                callbacks: {
                    onopen: () => {
                        console.log("✅ Connected to Gemini Native Audio!");
                        setIsVoiceConnected(true);

                        // Setup mic streaming
                        const source = audioContextRef.current!.createMediaStreamSource(stream);
                        const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (event) => {
                            const inputData = event.inputBuffer.getChannelData(0);
                            if (sessionRef.current) {
                                sessionRef.current.sendRealtimeInput({ media: createBlob(inputData) });
                            }
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(audioContextRef.current!.destination);

                        // Send warmup + initial nudge
                        const nudgeData = new Float32Array(4000).fill(0.001);
                        sessionRef.current?.sendRealtimeInput({ media: createBlob(nudgeData) });

                        // Send initial message to bot
                        setTimeout(() => {
                            if (sessionRef.current) {
                                sessionRef.current.sendClientContent({
                                    turns: [{ role: 'user', parts: [{ text: "SISTEMA: Inicia la conversación. Saluda cordialmente según tu rol. NO menciones botones ni interfaces." }] }],
                                    turnComplete: true
                                });
                            }
                        }, 2000);
                    },
                    onmessage: async (message: any) => {
                        const parts = message.serverContent?.modelTurn?.parts;
                        if (parts) {
                            for (const part of parts) {
                                // Play audio chunks
                                if (part.inlineData?.data) {
                                    const ctx = outputAudioContextRef.current!;
                                    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                                    const buffer = await decodeAudioData(decode(part.inlineData.data), ctx, 24000, 1);
                                    const audioSource = ctx.createBufferSource();
                                    audioSource.buffer = buffer;
                                    audioSource.connect(ctx.destination);
                                    audioSource.addEventListener('ended', () => sourcesRef.current.delete(audioSource));
                                    audioSource.start(nextStartTimeRef.current);
                                    nextStartTimeRef.current += buffer.duration;
                                    sourcesRef.current.add(audioSource);
                                }
                            }
                        }

                        // User transcription (input)
                        if (message.serverContent?.inputTranscription) {
                            const userTxt = message.serverContent.inputTranscription.text;
                            if (userTxt?.trim()) {
                                setMessages(prev => {
                                    const last = prev[prev.length - 1];
                                    if (last && last.role === 'user' && last.isPartial) {
                                        const updated = [...prev];
                                        updated[updated.length - 1] = { ...last, content: last.content + userTxt };
                                        return updated;
                                    }
                                    return [...prev, { role: 'user', content: userTxt, isPartial: true }];
                                });
                            }
                        }

                        // Bot transcription (output)
                        if (message.serverContent?.outputTranscription) {
                            const txt = message.serverContent.outputTranscription.text;
                            if (txt) {
                                setVoiceTranscription(prev => prev + txt);
                            }
                        }

                        // Turn complete: commit bot transcription to history
                        if (message.serverContent?.turnComplete) {
                            setVoiceTranscription(prev => {
                                const text = prev.trim();
                                if (text) {
                                    setMessages(msgs => {
                                        // Finalize any partial user messages
                                        const updated = msgs.map(m => m.isPartial ? { ...m, isPartial: false } : m);
                                        return [...updated, { role: 'assistant', content: text }];
                                    });
                                }
                                return '';
                            });
                        }

                        // Interruption: stop playing, save partial
                        if (message.serverContent?.interrupted) {
                            setVoiceTranscription(prev => {
                                if (prev.trim()) {
                                    setMessages(msgs => [...msgs, { role: 'assistant', content: prev.trim() + "..." }]);
                                }
                                return '';
                            });
                            sourcesRef.current.forEach(s => { try { s.stop(); } catch (e) { } });
                            sourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                        }
                    },
                    onerror: (e: any) => {
                        console.error('Gemini Voice Error:', e);
                        if (!isManualRef.current && reconnectAttemptsRef.current < MAX_RECONNECT) {
                            attemptReconnect();
                        } else {
                            setVoiceError('⚠️ Conexión perdida. Intenta reconectar.');
                            stopVoiceCall();
                        }
                    },
                    onclose: () => {
                        console.log("Conexión cerrada");
                        if (!isManualRef.current && reconnectAttemptsRef.current < MAX_RECONNECT) {
                            attemptReconnect();
                        } else {
                            stopVoiceCall();
                        }
                    }
                }
            });

            sessionRef.current = session;
        } catch (err: any) {
            console.error("Voice call error:", err);
            setVoiceError(`Error: ${err.message}`);
            setIsVoiceListening(false);
        }
    };

    const attemptReconnect = () => {
        if (isManualRef.current || reconnectTimeoutRef.current) return;

        reconnectAttemptsRef.current++;
        const delay = RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current - 1);

        console.warn(`Reconnect attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT} in ${delay}ms`);

        reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            if (isManualRef.current) return;

            // Cleanup current broken session before reconnecting
            if (sessionRef.current) {
                try { sessionRef.current.close(); } catch (e) { }
                sessionRef.current = null;
            }
            if (scriptProcessorRef.current) {
                scriptProcessorRef.current.disconnect();
                scriptProcessorRef.current = null;
            }
            sourcesRef.current.forEach(s => { try { s.stop(); } catch (e) { } });
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
            setIsVoiceConnected(false);
            setIsVoiceListening(false);

            startVoiceCall();
        }, delay);
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => { stopVoiceCall(); };
    }, [stopVoiceCall]);

    // ===== TEXT CHAT =====

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input?.trim() || isLoading) return;

        const userMsg = { role: 'user', content: input };
        const newMessages = [...messages, userMsg];

        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat-lab', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: newMessages,
                    systemPrompt: systemPrompt,
                    knowledgeBase: knowledgeBaseText
                })
            });

            if (!response.ok) throw new Error("Error en la petición: " + response.statusText);
            if (!response.body) return;

            let assistantContent = "";
            setMessages(prev => [...prev, { role: 'assistant', content: "" }]);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                assistantContent += chunk;

                setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                    return updated;
                });
            }
        } catch (error: any) {
            console.error("Error sending message:", error);
            setMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value);

    // ===== FEEDBACK / MAGIC =====

    const [isRefining, setIsRefining] = useState(false);

    const handleFeedbackSubmit = async () => {
        if (!feedbackText.trim() || isRefining) return;
        setIsRefining(true);

        try {
            const response = await fetch('/api/refine-lab', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: feedbackTarget,
                    currentPrompt: feedbackTarget === 'chat' ? systemPrompt : voicePrompt,
                    feedback: feedbackText
                })
            });

            if (!response.ok) {
                let errorMessage = "Error refinando prompt";
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.message || errorMessage;
                } catch (e) {
                    const text = await response.text();
                    if (text) errorMessage = text;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            if (data.newPrompt) {
                if (feedbackTarget === 'chat') {
                    setSystemPrompt(data.newPrompt);
                } else {
                    setVoicePrompt(data.newPrompt);
                }

                const updatedData = {
                    ...initialData,
                    system_prompt_chat: feedbackTarget === 'chat' ? data.newPrompt : systemPrompt,
                    system_prompt_voice: feedbackTarget === 'voice' ? data.newPrompt : voicePrompt,
                };
                localStorage.setItem('lab_data', JSON.stringify(updatedData));

                setToastMessage(`El prompt del ${feedbackTarget === 'chat' ? 'Chatbot' : 'Voicebot'} ha sido actualizado.`);
                setTimeout(() => setToastMessage(null), 5000);
                setFeedbackText('');
                setMessages([]);
            }
        } catch (error) {
            console.error("Error refining:", error);
            alert("Hubo un error al realizar la magia. Intenta de nuevo.");
        } finally {
            setIsRefining(false);
        }
    };

    // ===== RENDER =====

    return (
        <div className="flex h-screen bg-[#0B1015] text-white overflow-hidden relative">
            {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
            {/* Left Panel: Configuration & Files */}
            <div className="w-1/3 border-r border-white/5 flex flex-col bg-[#121820]/50 backdrop-blur-xl">
                <div className="p-4 border-b border-white/5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => window.location.href = '/onboarding'}
                            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors group"
                        >
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                            <span>Onboarding</span>
                        </button>
                        <span className="text-xs text-muted-foreground">{initialData.company_name}</span>
                    </div>
                    {/* Prompt Status Indicators */}
                    <div className="flex gap-2 text-[10px]">
                        <span className={cn("px-2 py-0.5 rounded border",
                            initialData.system_prompt_chat && initialData.system_prompt_chat.length > 50
                                ? "bg-green-500/10 border-green-500/20 text-green-400"
                                : "bg-red-500/10 border-red-500/20 text-red-400")}>
                            Chatbot: {initialData.system_prompt_chat && initialData.system_prompt_chat.length > 50 ? "✅ Cargado" : "❌ Vacío/Default"}
                        </span>
                        <span className={cn("px-2 py-0.5 rounded border",
                            initialData.system_prompt_voice && initialData.system_prompt_voice.length > 50
                                ? "bg-green-500/10 border-green-500/20 text-green-400"
                                : "bg-red-500/10 border-red-500/20 text-red-400")}>
                            Voicebot: {initialData.system_prompt_voice && initialData.system_prompt_voice.length > 50 ? "✅ Cargado" : "❌ Vacío/Default"}
                        </span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Knowledge Base Sources */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Fuentes de Conocimiento
                        </label>
                        <div className="space-y-1.5">
                            {/* Website URLs */}
                            {initialData.website_urls && initialData.website_urls.length > 0 && (
                                initialData.website_urls.map((url, idx) => (
                                    <div key={`url-${idx}`} className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs">
                                        <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 truncate transition-colors">{url}</a>
                                    </div>
                                ))
                            )}
                            {/* Uploaded File URLs */}
                            {initialData.context_file_urls && initialData.context_file_urls.length > 0 && (
                                initialData.context_file_urls.map((fileUrl, idx) => {
                                    const fileName = fileUrl.split('/').pop() || fileUrl;
                                    return (
                                        <div key={`file-${idx}`} className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs">
                                            <Link className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                            <span className="text-gray-300 truncate" title={fileUrl}>{decodeURIComponent(fileName)}</span>
                                        </div>
                                    );
                                })
                            )}
                            {/* No sources */}
                            {(!initialData.website_urls || initialData.website_urls.length === 0) &&
                                (!initialData.context_file_urls || initialData.context_file_urls.length === 0) && (
                                    <p className="text-xs text-gray-500 italic">Sin fuentes cargadas.</p>
                                )}
                        </div>
                    </div>

                    {/* Feedback / Improvement Loop */}
                    <div className="pt-6 border-t border-white/5 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                Feedback del Bot
                            </label>

                            {/* Target Selector */}
                            <div className="flex bg-black/20 p-1 rounded-lg mb-2">
                                <button
                                    onClick={() => setFeedbackTarget('chat')}
                                    className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
                                        feedbackTarget === 'chat' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300")}
                                >
                                    Chatbot ({activeTab === 'chat' ? 'Activo' : ''})
                                </button>
                                <button
                                    onClick={() => setFeedbackTarget('voice')}
                                    className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
                                        feedbackTarget === 'voice' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300")}
                                >
                                    Voicebot ({activeTab === 'voice' ? 'Activo' : ''})
                                </button>
                            </div>

                            <p className="text-xs text-gray-400">
                                ¿Qué mejorar del {feedbackTarget === 'chat' ? 'Chatbot' : 'Voicebot'}?
                            </p>
                            <textarea
                                value={feedbackText}
                                onChange={(e) => setFeedbackText(e.target.value)}
                                className="w-full h-32 bg-black/20 border border-white/10 rounded-lg p-3 text-xs text-gray-300 focus:outline-none focus:border-primary resize-none placeholder:text-gray-600"
                                placeholder={feedbackTarget === 'chat'
                                    ? "Ej: Es muy formal, necesito que sea más amable. Se inventó el horario..."
                                    : "Ej: Habla muy rápido, no entiende los números, interrumpe mucho..."}
                            />
                        </div>
                        <button
                            onClick={handleFeedbackSubmit}
                            disabled={!feedbackText.trim() || isRefining}
                            className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            {isRefining ? (
                                <>
                                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                                    Haciendo Magia...
                                </>
                            ) : (
                                <>
                                    <Settings2 className="w-4 h-4" />
                                    Realizar la Magia (Ajustar)
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Panel: Simulator */}
            <div className="w-2/3 flex flex-col relative">
                {/* Tabs */}
                <div className="flex items-center gap-4 p-4 border-b border-white/5 absolute top-0 w-full bg-[#0B1015]/80 backdrop-blur-md z-10">
                    <button
                        onClick={() => setActiveTab('chat')}
                        className={cn("px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                            activeTab === 'chat' ? "bg-primary text-white" : "bg-white/5 text-gray-400 hover:bg-white/10")}
                    >
                        <MessageSquare className="w-4 h-4" /> Chatbot
                    </button>
                    <button
                        onClick={() => setActiveTab('voice')}
                        className={cn("px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                            activeTab === 'voice' ? "bg-purple-600 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10")}
                    >
                        <Mic className="w-4 h-4" /> Voicebot
                    </button>
                    <div className="ml-auto flex items-center gap-2">
                        {isVoiceConnected && activeTab === 'voice' && (
                            <span className="flex items-center gap-1 text-[10px] text-green-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                Voz activa
                            </span>
                        )}
                        <button
                            className="p-2 hover:bg-white/10 rounded-full text-muted-foreground transition-colors"
                            onClick={() => { setMessages([]); setVoiceTranscription(''); }}
                            title="Reiniciar Chat"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 pt-20 pb-24 space-y-4">
                    {messages.length === 0 && !voiceTranscription && (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                {activeTab === 'chat' ? <MessageSquare className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                            </div>
                            <p>Inicia la prueba de tu {activeTab === 'chat' ? 'Chatbot' : 'Voicebot'}</p>
                        </div>
                    )}
                    {messages.map((msg, idx) => (
                        <div key={idx} className={cn("flex w-full", msg.role === 'user' ? "justify-end" : "justify-start")}>
                            <div className={cn("max-w-[80%] p-3 rounded-2xl text-sm whitespace-pre-wrap",
                                msg.role === 'user' ? "bg-primary text-white rounded-tr-none" : "bg-white/10 text-gray-200 rounded-tl-none")}>
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                        </div>
                    ))}
                    {/* Live bot transcription (streaming) */}
                    {voiceTranscription && (
                        <div className="flex justify-start">
                            <div className="max-w-[80%] p-3 rounded-2xl text-sm bg-white/10 text-gray-200 rounded-tl-none">
                                {voiceTranscription}
                                <span className="animate-pulse">_</span>
                            </div>
                        </div>
                    )}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white/10 p-3 rounded-2xl rounded-tl-none flex gap-1">
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="absolute bottom-0 w-full p-4 bg-gradient-to-t from-[#0B1015] to-transparent">
                    {activeTab === 'chat' ? (
                        <div className="glass-panel p-2 rounded-full flex items-center gap-2 border border-white/10 pl-4">
                            <input
                                type="text"
                                className="flex-1 bg-transparent border-none focus:outline-none text-sm text-white placeholder-gray-500"
                                placeholder="Escribe un mensaje de prueba..."
                                value={input}
                                onChange={handleInputChange}
                                disabled={isLoading}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(e); }}
                            />
                            <button
                                onClick={(e) => handleSendMessage(e)}
                                className="p-2 bg-primary hover:bg-primary/90 rounded-full text-white transition-colors disabled:opacity-50"
                                disabled={!input?.trim() || isLoading}
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3 pb-2">
                            {voiceError && (
                                <div className="bg-red-500/10 border border-red-500/30 p-2 rounded-lg text-red-400 text-xs text-center w-full max-w-sm">
                                    {voiceError}
                                </div>
                            )}
                            <button
                                onClick={isVoiceConnected ? stopVoiceCall : startVoiceCall}
                                className={cn(
                                    "w-full max-w-sm py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 transform active:scale-[0.98]",
                                    isVoiceConnected
                                        ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20"
                                        : "bg-purple-600 text-white hover:bg-purple-500 shadow-lg shadow-purple-500/30"
                                )}
                            >
                                {isVoiceConnected ? (
                                    <>
                                        <PhoneOff className="w-4 h-4" />
                                        <span>Finalizar Llamada</span>
                                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                    </>
                                ) : (
                                    <>
                                        <Phone className="w-4 h-4" />
                                        <span>{isVoiceListening ? 'Conectando...' : 'Iniciar Llamada de Voz'}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
