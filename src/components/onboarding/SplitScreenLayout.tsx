import React from 'react';
import { Sparkles } from 'lucide-react';

interface SplitScreenLayoutProps {
    children: React.ReactNode;
    summaryComponent: React.ReactNode;
}

export default function SplitScreenLayout({ children, summaryComponent }: SplitScreenLayoutProps) {
    return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Left Pane - Main Interaction (Chat) */}
            <div className="w-full lg:w-3/5 h-full flex flex-col relative z-10">
                <header className="p-6 flex items-center gap-3 border-b border-white/5 bg-background/50 backdrop-blur-md">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
                        <Sparkles className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold font-display text-white">Secretaria Virtual</h1>
                        <p className="text-sm text-muted-foreground">Onboarding Assistido por IA</p>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto relative custom-scrollbar">
                    {children}
                </main>
            </div>

            {/* Right Pane - Live Summary (Hidden on mobile, visible on desktop) */}
            <div className="hidden lg:flex w-2/5 h-full bg-surface-dark border-l border-white/5 flex-col relative">
                <div className="absolute inset-0 bg-grid-white/[0.02] bg-[length:20px_20px] pointer-events-none" />
                <div className="relative z-10 h-full flex flex-col">
                    <header className="p-6 border-b border-white/5 flex justify-between items-center">
                        <h2 className="text-lg font-medium font-display text-white/90">Resumen en Vivo</h2>
                        <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs border border-primary/20 animate-pulse">
                            Actualizando...
                        </span>
                    </header>
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        {summaryComponent}
                    </div>
                </div>
            </div>
        </div>
    );
}
