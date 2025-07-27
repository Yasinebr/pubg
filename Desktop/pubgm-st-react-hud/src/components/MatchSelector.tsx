// مسیر فایل: src/components/MatchSelector.tsx

import React, { useState, useEffect } from 'react';
import { useMatch } from '../contexts/MatchContext';
import { useNavigate } from 'react-router-dom';
import './MatchSelector.css';

interface Match {
    id: number;
    name: string;
}

export const MatchSelector = () => {
    const [matches, setMatches] = useState<Match[]>([]);
    const [newMatchName, setNewMatchName] = useState('');
    const { setSelectedMatchId } = useMatch();
    const navigate = useNavigate();
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

    // تابع برای گرفتن لیست مچ‌ها از سرور
    const fetchMatches = () => {
        fetch(`${apiUrl}/api/matches`)
            .then(res => res.json())
            .then(data => setMatches(data))
            .catch(err => console.error("Failed to fetch matches:", err));
    };

    // در اولین بارگذاری، لیست مچ‌ها را می‌گیریم
    useEffect(() => {
        fetchMatches();
    }, []);

    // تابع برای انتخاب یک مچ و رفتن به صفحه اصلی
    const handleMatchSelect = (id: number) => {
    // [خط جدید]: این پیغام را برای تست اضافه می‌کنیم
    console.log(`Match ID Selected: ${id}`);

    setSelectedMatchId(id);
    navigate('/');
};


    // تابع برای ارسال درخواست ساخت مچ به بک‌اند
    const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatchName.trim()) {
        alert("Please enter the name of the match.");
        return;
    }
    try {
        const response = await fetch(`${apiUrl}/api/matches`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newMatchName }),
        });

        // [۱] گرفتن اطلاعات مچ جدید از پاسخ سرور
        const newMatch = await response.json();

        if (!response.ok) {
            throw new Error(newMatch.error || 'Failed to create match');
        }

        // [۲] انتخاب خودکار مچ جدید و هدایت کاربر
        setSelectedMatchId(newMatch.id);
        navigate('/'); // کاربر را مستقیماً به صفحه اصلی می‌بریم

    } catch (error) {
        console.error(error);
        alert('خطا در ساخت مچ جدید');
    }
};

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            {/* بخش مهم ۱: فرم ساخت مچ جدید */}
            <div className="create-match-form">
                <h2>Making a new wrist</h2>
                <form onSubmit={handleCreateMatch}>
                    <input
                        type="text"
                        value={newMatchName}
                        onChange={(e) => setNewMatchName(e.target.value)}
                        placeholder="Enter the name of the new match."
                        style={{ padding: '8px', marginRight: '10px', fontSize: '1rem' }}
                    />
                    <button type="submit" style={{ padding: '8px 12px', fontSize: '1rem' }}>
                        Build
                    </button>
                </form>
            </div>

            <hr style={{ margin: '40px 0' }} />

            {/* بخش مهم ۲: لیست مچ‌های موجود */}
            <h2>Select the available wristband</h2>
            {matches.length > 0 ? (
                <div>
                    {matches.map(match => (
                        <button key={match.id} onClick={() => handleMatchSelect(match.id)} style={{ display: 'block', margin: '10px 0', padding: '10px', fontSize: '1rem', cursor: 'pointer' }}>
                            {match.name} (ID: {match.id})
                        </button>
                    ))}
                </div>
            ) : (
                <p>There are no matches to display. Please create a new one.</p>
            )}
        </div>
    );
};