import type { Metadata } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-body' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' })

export const metadata: Metadata = {
    title: 'Secretaria Virtual Lab',
    description: 'Onboarding y Laboratorio de Pruebas para Secretaria Virtual con IA',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="es" className="dark">
            <body className={`${inter.variable} ${spaceGrotesk.variable} bg-background text-foreground font-body antialiased selection:bg-primary/30 selection:text-white`}>
                {children}
            </body>
        </html>
    )
}
