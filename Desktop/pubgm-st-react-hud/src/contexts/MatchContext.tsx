// مسیر فایل: src/contexts/MatchContext.tsx

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

interface MatchContextType {
    selectedMatchId: number | null;
    setSelectedMatchId: (id: number | null) => void;
}

const MatchContext = createContext<MatchContextType | undefined>(undefined);

export const MatchProvider = ({ children }: { children: ReactNode }) => {
    // [۱] خواندن مقدار اولیه از localStorage هنگام شروع برنامه
    const [selectedMatchId, setSelectedMatchId] = useState<number | null>(() => {
        const savedMatchId = localStorage.getItem('selectedMatchId');
        // اگر مقداری ذخیره شده بود، آن را برگردان، در غیر این صورت null
        return savedMatchId ? JSON.parse(savedMatchId) : null;
    });

    // [۲] استفاده از useEffect برای ذخیره کردن تغییرات در localStorage
    // این کد هر زمان که selectedMatchId تغییر کند، اجرا می‌شود
    useEffect(() => {
        if (selectedMatchId !== null) {
            // اگر یک مچ انتخاب شده، ID آن را ذخیره کن
            localStorage.setItem('selectedMatchId', JSON.stringify(selectedMatchId));
        } else {
            // اگر هیچ مچی انتخاب نشده (مثلاً دکمه خروج)، آن را از حافظه پاک کن
            localStorage.removeItem('selectedMatchId');
        }
    }, [selectedMatchId]);

    const value = { selectedMatchId, setSelectedMatchId };

    return (
        <MatchContext.Provider value={value}>
            {children}
        </MatchContext.Provider>
    );
};

export const useMatch = () => {
    const context = useContext(MatchContext);
    if (context === undefined) {
        throw new Error('useMatch must be used within a MatchProvider');
    }
    return context;
};