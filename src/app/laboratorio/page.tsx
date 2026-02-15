'use client';

import React, { useEffect, useState } from 'react';
import LabInterface from '@/components/lab/LabInterface';
import { useRouter } from 'next/navigation';

export default function LaboratorioPage() {
    const router = useRouter();
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        const stored = localStorage.getItem('lab_data');
        if (!stored) {
            // Redirect back to onboarding if no data
            router.push('/onboarding');
            return;
        }
        setData(JSON.parse(stored));
    }, [router]);

    if (!data) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Cargando Laboratorio...</div>;

    return <LabInterface initialData={data} />;
}
