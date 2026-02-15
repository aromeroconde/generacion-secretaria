'use client';

import React, { useState, useRef, useEffect } from 'react';
import SplitScreenLayout from '@/components/onboarding/SplitScreenLayout';
import ChatInterface, { Message } from '@/components/onboarding/ChatInterface';
import LiveSummary from '@/components/onboarding/LiveSummary';

import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
    const router = useRouter();
    const [summaryData, setSummaryData] = useState<{
        company_name?: string;
        industry?: string;
        tone?: string;
        rules?: string[];
        context_files?: string[];
        website_urls?: string[]; // Changed to array
    }>({
        company_name: '',
        industry: '',
        tone: '',
        rules: [],
        context_files: [],
        website_urls: []
    });

    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: '¡Hola! Soy tu arquitecto de IA. Juntos diseñaremos la secretaria virtual perfecta para tu negocio. ¿Cómo se llama tu empresa y a qué se dedica principalmente?'
        }
    ]);

    // Persistence Logic
    useEffect(() => {
        // Load state from localStorage on mount
        const savedState = localStorage.getItem('onboarding_state');
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                if (parsed.summaryData) setSummaryData(parsed.summaryData);
                if (parsed.messages && parsed.messages.length > 0) setMessages(parsed.messages);
            } catch (e) {
                console.error("Failed to load onboarding state", e);
            }
        }
    }, []);

    useEffect(() => {
        // Save state on change
        const stateToSave = {
            summaryData,
            messages
        };
        localStorage.setItem('onboarding_state', JSON.stringify(stateToSave));
    }, [summaryData, messages]);

    const handleReset = () => {
        if (confirm("¿Estás seguro de que quieres reiniciar todo el proceso? Se perderán los datos actuales.")) {
            localStorage.removeItem('onboarding_state');
            window.location.reload();
        }
    };

    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);

    const handleSendMessage = async (text: string, file?: File | null, audioBlob?: Blob | null) => {
        setIsLoading(true);

        // 0. Extract URLs from User Message (Text)
        if (text) {
            // Regex to find URLs (robust: supports https:// and www.)
            // Matches: (http(s)://...) OR (www....)
            const foundUrls = text.match(/((https?:\/\/)|(www\.))[^\s]+/gi);

            if (foundUrls) {
                setSummaryData(prev => {
                    const currentUrls = prev.website_urls || [];
                    const newUrls = [...currentUrls];
                    foundUrls.forEach(url => {
                        // Clean trailing punctuation
                        let cleanUrl = url.replace(/[.,;!?)]+$/, "");

                        // If starts with www., prepend https://
                        if (cleanUrl.match(/^www\./i)) {
                            cleanUrl = `https://${cleanUrl}`;
                        }

                        if (!newUrls.includes(cleanUrl)) {
                            newUrls.push(cleanUrl);
                        }
                    });
                    return { ...prev, website_urls: newUrls };
                });
            }
        }

        // 1. Construct User Message string for UI
        if (text) {
            // Regex to find URLs (robust)
            const foundUrls = text.match(/(https?:\/\/[^\s]+)/g);
            if (foundUrls) {
                setSummaryData(prev => {
                    const currentUrls = prev.website_urls || [];
                    const newUrls = [...currentUrls];
                    foundUrls.forEach(url => {
                        // Clean trailing punctuation which might be captured
                        const cleanUrl = url.replace(/[.,;!?)]+$/, "");
                        if (!newUrls.includes(cleanUrl)) {
                            newUrls.push(cleanUrl);
                        }
                    });
                    return { ...prev, website_urls: newUrls };
                });
            }
        }

        // 1. Construct User Message string for UI
        let userContent = text;
        const formData = new FormData();

        if (audioBlob) {
            if (audioBlob.size === 0) {
                console.error("Audio Blob is empty");
                setIsLoading(false);
                return;
            }
            userContent = "🎤 [Audio enviado]";
            formData.append('file', audioBlob, `voice_${Date.now()}.webm`);
            formData.append('type', 'audio');
            // Do not add audio to context_files (it is part of conversation, not knowledge base)
        } else if (file) {
            userContent = `📎 Archivo: ${file.name} ${text ? `\n\n${text}` : ''}`;
            formData.append('file', file);
            formData.append('type', 'file');
            // Optimistic update for file
            setSummaryData(prev => ({
                ...prev,
                context_files: [...(prev.context_files || []), file.name]
            }));
        } else {
            formData.append('type', 'text');
        }

        const userMsg: Message = { role: 'user', content: userContent };
        setMessages(prev => [...prev, userMsg]);

        // Add text message if present
        formData.append('message', text || (audioBlob ? "Mensaje de voz" : `Archivo: ${file?.name}`));

        // INJECT SYSTEM INSTRUCTION: Force bot to ask for URL and mention uploads
        // We prepend this to the history so the LLM sees it as context/instruction.
        const systemInstruction = {
            role: 'system',
            content: "IMPORTANTE: Antes de finalizar la conversación, DEBES pedir obligatoriamente la URL del sitio web de la empresa. También recuerda al usuario que puede subir archivos PDF/DOC en el panel lateral derecho si lo desea."
        };

        // Filter out system messages from previous history to avoid duplication
        const cleanHistory = messages.filter(m => (m.role as string) !== 'system');
        formData.append('history', JSON.stringify([systemInstruction, ...cleanHistory]));

        // Include updated context files in payload (optimistic)
        const currentContextFiles = summaryData.context_files || [];
        const payloadData = {
            ...summaryData,
            context_files: file ? [...currentContextFiles, file.name] : currentContextFiles
        };
        formData.append('current_data', JSON.stringify(payloadData));

        try {
            // Call n8n Webhook
            const response = await fetch('https://sswebhook.cenet.ws/webhook/onboarding-intellicore', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                let errorDetails = `HTTP Error: ${response.status}`;
                try {
                    const errorText = await response.text();
                    console.error("n8n Webhook Error Body:", errorText);
                    try {
                        const errorJson = JSON.parse(errorText);
                        if (errorJson.message) errorDetails += ` - ${errorJson.message}`;
                    } catch { }
                } catch (e) {
                    console.error("Failed to read error body", e);
                }
                throw new Error(errorDetails);
            }

            const data = await response.json();

            // Add Bot Reply
            if (data.reply) {
                let finalContent = data.reply;
                let extractedUrl = "";

                // Check if it's a file upload success message from n8n (usually contains URL)
                if (file) {
                    // Regex to capture URL, allowing spaces, until common file extensions or end of string
                    // We assume the URL starts with http and ends with the file extension if present, or just grab the whole line if it looks like a URL.
                    // n8n often returns unencoded URLs with spaces.
                    const urlMatch = data.reply.match(/(https?:\/\/[^\n\r"']+\.(?:pdf|doc|docx|txt|jpg|png|webp))/i) || data.reply.match(/(https?:\/\/[^\n\r"']+)/);

                    if (urlMatch) {
                        extractedUrl = urlMatch[0];
                        // If the URL has spaces and isn't encoded, we might want to clean it, but sending it as-is to n8n might be required if n8n generated it that way.
                        // However, for safety, let's keep it as extracted.
                        console.log("✅ Extracted File URL (Robust):", extractedUrl);

                        // Valid URL found, update summaryData to replace filename with URL
                        setSummaryData(prev => {
                            const newFiles = (prev.context_files || []).map(f => f === file.name ? extractedUrl : f);
                            // Safety: ensure it's added if not found by name
                            if (!newFiles.includes(extractedUrl)) newFiles.push(extractedUrl);
                            // Remove the original filename if it was just added
                            return {
                                ...prev,
                                context_files: newFiles.filter(f => f !== file.name || f === extractedUrl)
                            };
                        });

                        finalContent = "Archivo subido con éxito.";
                    } else if (data.reply.toLowerCase().includes("subido")) {
                        finalContent = "Archivo subido con éxito (URL no detectada).";
                    }
                }

                const botMsg: Message = { role: 'assistant', content: finalContent };
                setMessages(prev => [...prev, botMsg]);
            }

            // Update Summary Data from n8n response
            if (data.extracted_data) {
                setSummaryData(prev => ({ ...prev, ...data.extracted_data }));
            }

        } catch (error) {
            console.error('Error calling n8n:', error);
            alert(error instanceof Error ? error.message : "Error desconocido");
            const errorMsg: Message = { role: 'assistant', content: 'Lo siento, tuve un problema conectando con el servidor. Por favor intenta de nuevo.' };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = (file: File) => {
        handleSendMessage("", file, null);
    };

    const handleFileDelete = async (fileName: string) => {
        setIsLoading(true);

        const currentFiles = summaryData.context_files || [];
        const updatedFiles = currentFiles.filter(f => f !== fileName);

        setSummaryData(prev => ({
            ...prev,
            context_files: updatedFiles
        }));

        const cleanFileName = decodeURIComponent(fileName.split('?')[0].split('/').pop() || fileName);
        const userMsg: Message = { role: 'user', content: `Borrar archivo: ${cleanFileName}` };
        setMessages(prev => [...prev, userMsg]);

        const formData = new FormData();
        formData.append('type', 'delete');
        formData.append('file_name', fileName); // Send original (potentially URL) to backend so it knows what to delete
        formData.append('message', `Borrar archivo: ${fileName}`);

        const payloadData = { ...summaryData, context_files: updatedFiles };
        formData.append('current_data', JSON.stringify(payloadData));
        formData.append('history', JSON.stringify(messages)); // sending old history without the new delete msg is fine, or we could add it.

        try {
            const response = await fetch('https://sswebhook.cenet.ws/webhook/onboarding-intellicore', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }
            const data = await response.json();

            if (data.reply) {
                // For deletion, explicitly show static message
                let finalContent = data.reply;
                if (data.reply.includes("http") || data.reply.toLowerCase().includes("eliminado")) {
                    finalContent = "Archivo eliminado con éxito.";
                }

                const botMsg: Message = { role: 'assistant', content: finalContent };
                setMessages(prev => [...prev, botMsg]);
            }
        } catch (error) {
            console.error('Error deleting file:', error);
            alert("Error al borrar el archivo.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleWebsiteChange = (url: string) => {
        setSummaryData(prev => ({ ...prev, website_url: url }));
    };

    const handleCompleteOnboarding = async () => {
        setIsGeneratingPrompts(true);

        // 1. RECOVERY: Attempt to find valid URLs in chat history first
        // Update regex to handle URLs with spaces, ending in extensions
        const urlRegex = /(https?:\/\/[^\s\n"']+\.(?:pdf|doc|docx|txt))|((https?:\/\/[^\n"']+))/gi;

        // We need to carefully extract matches. match() with global flag returns array of strings.
        // But for spaces, we might need to be more careful. 
        // Let's assume the bot message contains the URL and maybe some text.
        // If the URL has spaces, a simple split or [^\s] fail.
        // We'll iterate messages and try to find the robust pattern.

        const historyUrls: string[] = [];
        messages.forEach(m => {
            if (m.role === 'assistant') { // URLs come from bot
                const matches = m.content.match(/(https?:\/\/[^\n\r"']+\.(?:pdf|doc|docx|txt))/gi);
                if (matches) historyUrls.push(...matches);
            }
        });

        const uniqueHistoryUrls = [...new Set(historyUrls)];

        // Determine the best source of files: History URLs > Current Summary (if they look like links)
        let validFileUrls: string[] = [];
        const currentFiles = summaryData.context_files || [];

        // Check if current files are already URLs
        const currentFilesAreUrls = currentFiles.some(f => f.startsWith('http'));

        if (currentFilesAreUrls) {
            validFileUrls = currentFiles;
        } else if (uniqueHistoryUrls.length > 0) {
            console.log("🔄 Recovered File URLs from History:", uniqueHistoryUrls);
            validFileUrls = uniqueHistoryUrls;
        } else {
            console.warn("⚠️ No valid URLs found. Sending filenames (n8n might fail to download).", currentFiles);
            validFileUrls = currentFiles;
        }

        const formData = new FormData();

        // Payload with all data
        const payloadData = { ...summaryData, context_files: validFileUrls }; // Use recovered URLs
        formData.append('company_name', summaryData.company_name || '');
        formData.append('industry', summaryData.industry || '');
        formData.append('tone', summaryData.tone || '');
        formData.append('rules', JSON.stringify(summaryData.rules || []));
        formData.append('context_files', JSON.stringify(validFileUrls)); // Send Correct URLs
        formData.append('history', JSON.stringify(messages));

        // Add Website URLs if present
        if (summaryData.website_urls && summaryData.website_urls.length > 0) {
            formData.append('website_urls', JSON.stringify(summaryData.website_urls));
        }

        try {
            // EXECUTE IN PARALLEL: Generate Prompts + Parse Knowledge Base
            const promptPromise = fetch('https://sswebhook.cenet.ws/webhook/generador-prompts', {
                method: 'POST',
                body: formData
            });

            // Only trigger KB parsing if there are valid URLs or a Website URL
            let kbPromise = Promise.resolve(null);

            // We need to send both fileUrls and websiteUrls to our API
            if (validFileUrls.length > 0 || (summaryData.website_urls && summaryData.website_urls.length > 0)) {
                const kbBody = {
                    fileUrls: validFileUrls,
                    websiteUrls: summaryData.website_urls || []
                };

                // Use our internal API route which now calls the n8n webhook
                kbPromise = fetch('/api/parse-files', {
                    method: 'POST',
                    body: JSON.stringify(kbBody)
                }).then(res => res.json()).catch(err => {
                    console.error("KB Parse Error:", err);
                    return { markdown: "Error al procesar base de conocimiento." };
                });
            }

            const [promptResponse, kbData] = await Promise.all([promptPromise, kbPromise]);

            if (!promptResponse.ok) {
                throw new Error(`HTTP Error: ${promptResponse.status}`);
            }

            const data = await promptResponse.json();
            console.log("🔥 Respuesta de n8n recibida (raw):", data);

            // Handle if data is array (n8n often returns an array of items)
            const payload = Array.isArray(data) ? data[0] : data;
            console.log("📦 Payload procesado:", payload);

            // Note: We already computed validFileUrls, but let's check if the prompt generator returned new ones
            const returnedUrls = payload.context_file_urls || payload.context_files;
            if (returnedUrls && Array.isArray(returnedUrls) && returnedUrls.some((u: string) => u.startsWith('http'))) {
                validFileUrls = returnedUrls;
            }

            // Save to localStorage for Lab access
            if (typeof window !== 'undefined') {
                const labData = {
                    company_name: summaryData.company_name,
                    // Map response data from n8n
                    system_prompt_chat: payload['prompt chatbot'] || payload.system_prompt_chat || "Eres una secretaria virtual útil.",
                    system_prompt_voice: payload['prompt voicebot'] || payload.system_prompt_voice || "Eres una secretaria virtual útil (voz).",
                    context_file_urls: validFileUrls,
                    // Store the KB markdown if available
                    knowledge_base_markdown: kbData ? (kbData as any).markdown : ""
                };
                localStorage.setItem('lab_data', JSON.stringify(labData));
            }

            // Success -> Redirect
            router.push('/laboratorio');

        } catch (error) {
            console.error('Error generating prompts:', error);
            alert("Hubo un error generando la configuración. Por favor intenta de nuevo.");
            setIsGeneratingPrompts(false); // Only stop loading on error, on success we redirect
        }
    };

    // Validation Logic
    const hasRules = summaryData.rules && summaryData.rules.length > 0;
    const hasContext = (summaryData.context_files && summaryData.context_files.length > 0) ||
        (summaryData.website_urls && summaryData.website_urls.length > 0);
    const isReadyToComplete = hasRules && hasContext;

    return (
        <>
            {/* Full Screen Loading Overlay */}
            {isGeneratingPrompts && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Creando tu Secretaria Virtual...</h2>
                    <p className="text-muted-foreground text-center max-w-md">Estamos analizando tu información y configurando tu asistente. Esto puede tomar unos segundos.</p>
                </div>
            )}

            <SplitScreenLayout summaryComponent={
                <LiveSummary
                    data={summaryData}
                    onFileUpload={handleFileUpload}
                    onFileDelete={handleFileDelete}
                >
                    <div className="mt-8 pt-4 border-t border-white/10">
                        <button
                            onClick={handleReset}
                            className="text-xs text-red-400 hover:text-red-300 underline opacity-60 hover:opacity-100 transition-opacity"
                        >
                            Reiniciar proceso (Borrar datos)
                        </button>
                    </div>
                </LiveSummary>
            }>
                <ChatInterface
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    isLoading={isLoading}
                    onCompleteOnboarding={handleCompleteOnboarding}
                    isReadyToComplete={isReadyToComplete}
                />
            </SplitScreenLayout>
        </>
    );
}
