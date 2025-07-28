// src/components/MatchSelector.tsx

import React, { useState, useEffect } from 'react';
import { useGame } from '../contexts/GameContext'; // [۱] از GameContext استفاده می‌کنیم
import { useMatch } from '../contexts/MatchContext';
import { useNavigate } from 'react-router-dom';
import './MatchSelector.css';

interface Match {
    id: number;
    name: string;
}

export const MatchSelector = () => {
    const { selectedGameId } = useGame(); // [۲] آیدی بازی فعال را می‌گیریم
    const { setSelectedMatchId } = useMatch();

    const [matches, setMatches] = useState<Match[]>([]);
    const [newMatchName, setNewMatchName] = useState('');
    const navigate = useNavigate();
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

    // [۳] این useEffect حالا به selectedGameId وابسته است
    useEffect(() => {
        // فقط زمانی که یک بازی انتخاب شده، مچ‌ها را fetch کن
        if (selectedGameId) {
            fetch(`${apiUrl}/api/games/${selectedGameId}/matches`)
                .then(res => res.json())
                .then(data => setMatches(data))
                .catch(err => console.error("Failed to fetch matches:", err));
        }
    }, [selectedGameId, apiUrl]);

    const handleMatchSelect = (id: number) => {
        setSelectedMatchId(id);
        navigate('/'); // کاربر را به صفحه اصلی (home) هدایت کن
    };

    const handleCreateMatch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMatchName.trim() || !selectedGameId) return;

        try {
            const response = await fetch(`${apiUrl}/api/games/${selectedGameId}/matches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newMatchName }),
            });
            if (!response.ok) throw new Error('Failed to create match');

            // لیست مچ‌ها را دوباره می‌گیریم تا مچ جدید نمایش داده شود
            fetch(`${apiUrl}/api/games/${selectedGameId}/matches`)
                .then(res => res.json())
                .then(data => setMatches(data));

            setNewMatchName('');
        } catch (error) {
            console.error(error);
            alert('Error creating new match');
        }
    };

    // اگر به هر دلیلی gameId وجود نداشت، چیزی نمایش نده
    if (!selectedGameId) {
        return <div>Please select a game first.</div>;
    }

    return (
        <div className="match-selector-container">
            <div className="card">
                <h2>Create New Match for Game #{selectedGameId}</h2>
                <form onSubmit={handleCreateMatch} className="create-form">
                    <input
                        type="text"
                        value={newMatchName}
                        onChange={(e) => setNewMatchName(e.target.value)}
                        placeholder="Enter new match name"
                    />
                    <button type="submit" className="create-button">
                        Create Match
                    </button>
                </form>
            </div>

            <div className="card">
                <h2>Select Existing Match</h2>
                {matches.length > 0 ? (
                    <div className="list">
                        {matches.map(match => (
                            <button key={match.id} onClick={() => handleMatchSelect(match.id)} className="select-button">
                                {match.name} (ID: {match.id})
                            </button>
                        ))}
                    </div>
                ) : (
                    <p>No existing matches for this game. Please create a new one.</p>
                )}
            </div>
        </div>
    );
};

export default MatchSelector;