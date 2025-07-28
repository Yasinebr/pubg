// src/contexts/GameContext.tsx

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useMatch } from './MatchContext'; // [۱] ایمپورت کردن هوک MatchContext

interface GameContextType {
    selectedGameId: number | null;
    selectGame: (id: number | null) => void; // [۲] تغییر نام تابع
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider = ({ children }: { children: ReactNode }) => {
    const [selectedGameId, setSelectedGameId] = useState<number | null>(() => {
        const savedGameId = localStorage.getItem('selectedGameId');
        return savedGameId ? JSON.parse(savedGameId) : null;
    });

    // [۳] دسترسی به تابع setSelectedMatchId از MatchContext
    const { setSelectedMatchId } = useMatch();

    useEffect(() => {
        if (selectedGameId !== null) {
            localStorage.setItem('selectedGameId', JSON.stringify(selectedGameId));
        } else {
            localStorage.removeItem('selectedGameId');
        }
    }, [selectedGameId]);

    // [۴] تابع جدید که هم بازی را انتخاب و هم مچ را ریست می‌کند
    const selectGame = (id: number | null) => {
        setSelectedGameId(id);
        setSelectedMatchId(null); // <<-- مهم: مچ قبلی همیشه پاک می‌شود
    };

    return (
        <GameContext.Provider value={{ selectedGameId, selectGame }}>
            {children}
        </GameContext.Provider>
    );
};

export const useGame = () => {
    const context = useContext(GameContext);
    if (context === undefined) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
};