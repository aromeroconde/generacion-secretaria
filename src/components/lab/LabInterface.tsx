'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, Play, Square, Settings2, FileText, MessageSquare, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
// import { useChat } from '@ai-sdk/react'; // No longer used due to runtime errors
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
        knowledge_base_markdown?: string;
    };
}

export default function LabInterface({ initialData }: LabInterfaceProps) {
    console.log("🧪 LabInterface cargado con datos:", initialData); // DEBUG: Verificar qué llegó al Lab
    const [activeTab, setActiveTab] = useState<'chat' | 'voice'>('chat');

    // Toast State
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Knowledge Base State
    const [knowledgeBaseText, setKnowledgeBaseText] = useState<string>('');
    const [isParsing, setIsParsing] = useState(false);

    // Config / Prompt Editor State (Hidden from UI but needed for logic)
    const [systemPrompt, setSystemPrompt] = useState(initialData.system_prompt_chat || '');
    const [voicePrompt, setVoicePrompt] = useState(initialData.system_prompt_voice || '');

    // Feedback State
    const [feedbackTarget, setFeedbackTarget] = useState<'chat' | 'voice'>('chat');
    const [feedbackText, setFeedbackText] = useState('');

    // Sync feedback target with active tab when tab changes
    useEffect(() => {
        setFeedbackTarget(activeTab);
    }, [activeTab]);

    // Parse files on load OR use pre-loaded data
    useEffect(() => {
        // If we already have the parsed text from onboarding, use it!
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

                // If markdown is found, use it.
                if (data.error) {
                    setKnowledgeBaseText(`ERROR API: ${data.error}`);
                } else if (data.markdown && data.markdown.trim()) {
                    setKnowledgeBaseText(data.markdown);
                } else if (data.debug_raw) {
                    // Start of Debugging: If no markdown, show the raw structure so we can fix it
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

    const [messages, setMessages] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [input, setInput] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const audioChunksRef = useRef<Blob[]>([]);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                handleSendAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error("Error accessing microphone:", error);
            alert("No se pudo acceder al micrófono.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleSendAudio = async (audioBlob: Blob) => {
        setIsLoading(true);
        try {
            // Convert Blob to Base64
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64Audio = (reader.result as string).split(',')[1];

                const userMsg = { role: 'user', content: '🎤 [Audio Message]' };
                const newMessages = [...messages, userMsg];
                setMessages(newMessages);

                // Send to API
                console.log("🎤 Sending Audio to API...", { size: base64Audio.length });
                const response = await fetch('/api/chat-lab', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: newMessages,
                        systemPrompt: voicePrompt,
                        knowledgeBase: knowledgeBaseText,
                        audioData: base64Audio // Sending Base64 audio
                    })
                });

                if (!response.ok) {
                    const errText = await response.text();
                    console.error("API Error Response:", errText);
                    throw new Error(`API Error ${response.status}: ${errText}`);
                }

                if (!response.body) return;

                // Stream response (Assistant Text)
                // NOTE: For Native Audio generic response, we might receive text or audio back.
                // For now, assuming the model returns TEXT as per standard chat implementation.
                // If the user wants AUDIO back, we need TTS. The prompt implied "Voice Bot" uses Native Audio *Input*.

                let assistantContent = "";
                setMessages(prev => [...prev, { role: 'assistant', content: "" }]);

                const streamReader = response.body.getReader();
                const decoder = new TextDecoder();

                while (true) {
                    const { done, value } = await streamReader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    assistantContent += chunk;
                    setMessages(prev => {
                        const updated = [...prev];
                        updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                        return updated;
                    });
                }
            };
        } catch (error: any) {
            console.error("Error sending audio:", error);
            setMessages(prev => [...prev, { role: 'assistant', content: `❌ Error de Audio: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

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
                    systemPrompt: activeTab === 'chat' ? systemPrompt : voicePrompt,
                    knowledgeBase: knowledgeBaseText // Pass the parsed text directly
                })
            });

            if (!response.ok) throw new Error("Error en la petición: " + response.statusText);

            if (!response.body) return;

            // Initialize assistant message
            let assistantContent = "";
            setMessages(prev => [...prev, { role: 'assistant', content: "" }]);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                assistantContent += chunk;

                // Update last message
                setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                    return updated;
                });
            }
        } catch (error: any) {
            console.error("Error sending message:", error);
            // alert("Error: " + error.message); // Don't use alert, show in chat
            setMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${error.message}. Verifica la consola o intenta de nuevo.` }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Helper for input binding
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value);
    const safeHandleSubmit = handleSendMessage; // Alias for compatibility with previous form code

    const [isRefining, setIsRefining] = useState(false);

    const handleFeedbackSubmit = async () => {
        if (!feedbackText.trim() || isRefining) return;
        setIsRefining(true);

        // Optimistic UI update? No, wait for result.
        try {
            const response = await fetch('/api/refine-lab', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: feedbackTarget,
                    currentPrompt: feedbackTarget === 'chat' ? systemPrompt : voicePrompt,
                    feedback: feedbackText
                    // fileUrls: initialData.context_file_urls // REMOVED
                    // knowledgeBase: knowledgeBaseText // REMOVED: User requested independent prompt refinement
                })
            });

            if (!response.ok) {
                let errorMessage = "Error refinando prompt";
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.message || errorMessage;
                    if (errorData.stack) console.error("Server Stack:", errorData.stack);
                } catch (e) {
                    const text = await response.text();
                    if (text) errorMessage = text;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            if (data.newPrompt) {
                // Update State
                if (feedbackTarget === 'chat') {
                    setSystemPrompt(data.newPrompt);
                } else {
                    setVoicePrompt(data.newPrompt);
                }

                // Persist to localStorage for reload safety
                const updatedData = {
                    ...initialData,
                    system_prompt_chat: feedbackTarget === 'chat' ? data.newPrompt : systemPrompt,
                    system_prompt_voice: feedbackTarget === 'voice' ? data.newPrompt : voicePrompt,
                };
                localStorage.setItem('lab_data', JSON.stringify(updatedData));

                setToastMessage(`El prompt del ${feedbackTarget === 'chat' ? 'Chatbot' : 'Voicebot'} ha sido actualizado.`);
                setTimeout(() => setToastMessage(null), 5000);
                setFeedbackText('');
                setMessages([]); // Start fresh interaction

            }
        } catch (error) {
            console.error("Error refining:", error);
            alert("Hubo un error al realizar la magia. Intenta de nuevo.");
        } finally {
            setIsRefining(false);
        }
    };

    return (
        <div className="flex h-screen bg-[#0B1015] text-white overflow-hidden relative">
            {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
            {/* Left Panel: Configuration & Files */}
            <div className="w-1/3 border-r border-white/5 flex flex-col bg-[#121820]/50 backdrop-blur-xl">
                <div className="p-4 border-b border-white/5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <h2 className="font-space font-bold text-lg flex items-center gap-2">
                            <Settings2 className="w-5 h-5 text-purple-400" />
                            Configuración
                        </h2>
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
                    {/* Knowledge Base Content */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Base de Conocimiento (Markdown)
                        </label>
                        <textarea
                            className="w-full h-40 bg-black/20 border border-white/10 rounded-lg p-3 text-[10px] font-mono text-gray-400 focus:outline-none resize-none"
                            value={isParsing ? "Leyendo archivos..." : knowledgeBaseText}
                            readOnly
                        />
                    </div>

                    {/* Current System Prompt */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                            <Settings2 className="w-4 h-4" />
                            Prompt del Sistema (Actual)
                        </label>
                        <textarea
                            className="w-full h-40 bg-black/20 border border-white/10 rounded-lg p-3 text-[10px] font-mono text-green-400/80 focus:outline-none resize-none"
                            value={activeTab === 'chat' ? systemPrompt : voicePrompt}
                            readOnly
                        />
                        <p className="text-[10px] text-gray-500">
                            *Este prompt se optimiza automáticamente con "Realizar Magia".
                        </p>
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
                    <div className="ml-auto">
                        <button
                            className="p-2 hover:bg-white/10 rounded-full text-muted-foreground transition-colors"
                            onClick={() => { setMessages([]); }}
                            title="Reiniciar Chat"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 pt-20 pb-24 space-y-4">
                    {messages.length === 0 && (
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
                            />
                            <button
                                onClick={(e) => safeHandleSubmit(e)}
                                className="p-2 bg-primary hover:bg-primary/90 rounded-full text-white transition-colors disabled:opacity-50"
                                disabled={!input?.trim() || isLoading}
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex justify-center pb-4">
                            <button
                                onClick={isRecording ? stopRecording : startRecording}
                                disabled={isLoading}
                                className={cn(
                                    "w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-2xl border-4",
                                    isRecording
                                        ? "bg-red-500 border-red-400 scale-110 animate-pulse shadow-red-500/50"
                                        : "bg-purple-600 border-purple-400 hover:bg-purple-500 hover:scale-105 shadow-purple-500/30",
                                    isLoading && "opacity-50 cursor-not-allowed bg-gray-600 border-gray-500"
                                )}
                            >
                                <Mic className={cn("w-8 h-8 text-white", isRecording && "animate-bounce")} />
                            </button>
                            <p className="absolute bottom-2 text-[10px] text-gray-500 pointer-events-none">
                                {isRecording ? "Click para enviar" : "Click para hablar"}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
