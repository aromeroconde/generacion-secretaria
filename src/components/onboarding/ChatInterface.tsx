"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Mic, StopCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

export interface Message {
    role: "user" | "assistant";
    content: string;
}

interface ChatInterfaceProps {
    messages: Message[];
    onSendMessage: (text: string, file?: File | null, audioBlob?: Blob | null) => void;
    isLoading: boolean;
    onCompleteOnboarding?: () => void;
    isReadyToComplete?: boolean;
}

export default function ChatInterface({ messages, onSendMessage, isLoading, onCompleteOnboarding, isReadyToComplete = true }: ChatInterfaceProps) {
    const [input, setInput] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

    // Refs for safe access inside closures/callbacks
    const audioChunksRef = useRef<Blob[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            setMediaRecorder(recorder);
            audioChunksRef.current = []; // Reset chunks

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());
                onSendMessage("", null, audioBlob);
            };

            recorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("No se pudo acceder al micrófono.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop(); // Triggers onstop -> onSendMessage
            setIsRecording(false);
        }
    };

    const handleSendClick = () => {
        if (!input.trim() || isLoading) return;
        onSendMessage(input, null, null);
        setInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isRecording) {
            e.preventDefault();
            handleSendClick();
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    return (
        <div className="flex flex-col h-full relative">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-32">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={cn(
                            "flex w-full mb-4",
                            msg.role === 'user' ? "justify-end" : "justify-start"
                        )}
                    >
                        <div
                            className={cn(
                                "max-w-[80%] p-4 rounded-2xl backdrop-blur-md shadow-lg border border-white/5",
                                msg.role === 'user'
                                    ? "bg-primary/20 text-white rounded-br-none"
                                    : "bg-surface-dark border border-white/10 text-gray-100 rounded-bl-none"
                            )}
                        >
                            <div className="prose prose-invert prose-sm max-w-none">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start w-full mb-4">
                        <div className="bg-surface-dark border border-white/10 p-4 rounded-2xl rounded-bl-none flex items-center gap-2">
                            <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} id="messages-end" />
            </div>

            <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-background to-transparent z-10">
                <div className="glass-panel p-2 rounded-full flex items-center gap-2 border border-white/10 shadow-2xl relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isRecording ? "Escuchando..." : "Escribe tu respuesta..."}
                        className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-muted-foreground text-sm px-4"
                        disabled={isLoading || isRecording}
                    />

                    <div className="flex items-center gap-1 pr-1">
                        <button
                            className={cn(
                                "p-3 transition-all duration-300 rounded-full",
                                isRecording ? "text-red-500 bg-red-500/10 animate-pulse" : "text-muted-foreground hover:text-white hover:bg-white/5"
                            )}
                            onClick={toggleRecording}
                        >
                            {isRecording ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>

                        <button
                            className="p-3 bg-primary hover:bg-primary/90 text-white rounded-full transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={handleSendClick}
                            disabled={!input.trim() || isLoading || isRecording}
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="text-center mt-3 flex flex-col items-center gap-2">
                    {onCompleteOnboarding && messages.length > 2 && (
                        <div className="flex flex-col items-center gap-2">
                            <button
                                onClick={onCompleteOnboarding}
                                disabled={isLoading || !isReadyToComplete}
                                className={cn(
                                    "text-xs px-4 py-2 rounded-full transition-all flex items-center gap-2 mt-1 border",
                                    isReadyToComplete
                                        ? "bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20 cursor-pointer"
                                        : "bg-gray-500/10 text-gray-500 border-gray-500/20 cursor-not-allowed opacity-50"
                                )}
                            >
                                <span className={cn("w-2 h-2 rounded-full", isReadyToComplete ? "bg-green-500 animate-pulse" : "bg-gray-500")} />
                                Completar Onboarding y Generar Secretaria
                            </button>
                            {!isReadyToComplete && (
                                <p className="text-[10px] text-red-400/80">
                                    Falta: {!isReadyToComplete && "Reglas de Negocio + (URL o Archivos)"}
                                </p>
                            )}
                        </div>
                    )}
                    <p className="text-[10px] text-muted-foreground/60">
                        IA Architect v1.0 • Powered by n8n
                    </p>
                </div>
            </div>
        </div>
    );
}
