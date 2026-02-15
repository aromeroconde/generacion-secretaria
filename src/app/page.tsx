import Link from 'next/link'

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-background relative overflow-hidden">
            {/* Background Blobs */}
            <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-blob mix-blend-screen opacity-70"></div>
            <div className="absolute top-20 right-20 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-blob animation-delay-2000 mix-blend-screen opacity-70"></div>
            <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-pink-500/20 rounded-full blur-3xl animate-blob animation-delay-4000 mix-blend-screen opacity-70"></div>

            <div className="z-10 text-center space-y-8 glass-panel p-12 rounded-3xl border border-white/10 shadow-2xl">
                <h1 className="text-6xl font-bold font-display bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200">
                    Secretaria Virtual
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                    Diseña, entrena y prueba tu asistente de IA perfecta.
                    Combina la potencia de LLMs con una voz ultra-realista.
                </p>

                <div className="flex gap-4 justify-center mt-8">
                    <Link
                        href="/onboarding"
                        className="px-8 py-4 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-all hover:scale-105 shadow-lg shadow-primary/25"
                    >
                        Iniciar Onboarding
                    </Link>
                    <button className="px-8 py-4 glass-panel hover:bg-white/5 text-white rounded-xl font-medium transition-all">
                        Ir al Lab (Demo)
                    </button>
                </div>
            </div>
        </main>
    )
}
