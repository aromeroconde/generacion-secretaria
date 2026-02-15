import React from 'react';
import { Building2, UserCircle, ShieldCheck, FileText, Link } from 'lucide-react';

interface LiveSummaryProps {
    data: {
        company_name?: string;
        industry?: string;
        tone?: string;
        rules?: string[];
        context_files?: string[];
        website_urls?: string[]; // Changed to array
    };
    onFileUpload?: (file: File) => void;
    onFileDelete?: (fileName: string) => void;
    // onWebsiteChange removed as it is read-only
    children?: React.ReactNode;
}

export default function LiveSummary({ data, onFileUpload, onFileDelete, children }: LiveSummaryProps) {
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && onFileUpload) {
            onFileUpload(e.target.files[0]);
            // Reset input
            e.target.value = '';
        }
    };
    return (
        <div className="space-y-6">
            {/* Company Info Section */}
            <section className="space-y-3">
                <div className="flex items-center gap-2 text-primary/80">
                    <Building2 className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wider font-semibold">Información de Empresa</span>
                </div>
                <div className="glass-panel p-4 rounded-xl space-y-2 border-l-4 border-l-primary/50">
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Nombre</label>
                        <div className="text-sm font-medium text-white">{data.company_name || "---"}</div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Industria</label>
                        <div className="text-sm text-gray-300">{data.industry || "---"}</div>
                    </div>
                </div>
            </section>

            {/* Persona/Tone Section */}
            <section className="space-y-3">
                <div className="flex items-center gap-2 text-purple-400">
                    <UserCircle className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wider font-semibold">Personalidad</span>
                </div>
                <div className="glass-panel p-4 rounded-xl space-y-3 border-l-4 border-l-purple-500/50">
                    <div className="flex flex-wrap gap-2">
                        {data.tone ? (
                            <span className="px-2 py-1 bg-white/5 rounded-md text-xs border border-white/10 capitalize">{data.tone}</span>
                        ) : (
                            <span className="text-xs text-muted-foreground italic">Por definir...</span>
                        )}
                    </div>
                </div>
            </section>

            {/* Rules Section */}
            <section className="space-y-3">
                <div className="flex items-center gap-2 text-green-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wider font-semibold">Reglas de Negocio</span>
                </div>
                <div className="glass-panel p-4 rounded-xl space-y-2 border-l-4 border-l-green-500/50">
                    {data.rules && data.rules.length > 0 ? (
                        <ul className="space-y-2">
                            {data.rules.map((rule, idx) => (
                                <li key={idx} className="text-xs text-gray-300 flex gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                                    {rule}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-xs text-muted-foreground italic">Sin reglas registradas.</p>
                    )}
                </div>
            </section>

            {/* Context/Files Section */}
            <section className="space-y-3">
                <div className="flex items-center justify-between text-orange-400">
                    <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider font-semibold">Contexto (Archivos)</span>
                    </div>
                    <div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            accept=".pdf,.doc,.docx,.txt"
                        />
                        <button
                            className="text-xs bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 border border-orange-500/20 px-2 py-1 rounded transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                            title="Subir archivo de contexto"
                        >
                            + Subir
                        </button>
                    </div>
                </div>
                <div className="glass-panel p-4 rounded-xl space-y-2 border-l-4 border-l-orange-500/50">
                    {data.context_files && data.context_files.length > 0 ? (
                        <div className="space-y-2">
                            {data.context_files.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="w-6 h-6 rounded bg-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
                                            <FileText className="w-3 h-3" />
                                        </div>
                                        <span className="text-xs text-gray-200 truncate max-w-[150px]" title={file}>
                                            {decodeURIComponent(file.split('?')[0].split('/').pop() || file)}
                                        </span>
                                    </div>
                                    <button
                                        className="text-muted-foreground hover:text-red-400 transition-colors p-1"
                                        title="Borrar archivo"
                                        onClick={() => onFileDelete?.(file)}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground italic">Sin archivos de contexto.</p>
                    )}
                </div>
            </section>

            {/* Website URL Section */}
            <section className="space-y-3">
                <div className="flex items-center gap-2 text-blue-400">
                    <Link className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wider font-semibold">Sitio Web (KB)</span>
                </div>
                <div className="glass-panel p-4 rounded-xl space-y-2 border-l-4 border-l-blue-500/50">
                    {data.website_urls && data.website_urls.length > 0 ? (
                        <div className="space-y-2">
                            {data.website_urls.map((url, idx) => (
                                <div key={idx} className="flex items-center gap-2 overflow-hidden p-2 rounded bg-white/5 border border-white/5">
                                    <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                                        <Link className="w-3 h-3" />
                                    </div>
                                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-300 hover:text-blue-200 truncate underline" title={url}>
                                        {url}
                                    </a>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[10px] text-muted-foreground italic">
                            Menciona la URL de tu empresa en el chat para agregarla.
                        </p>
                    )}
                </div>
            </section>

            {children}
        </div>
    );
}
