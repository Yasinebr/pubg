// FinalStandings.tsx

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import './FinalStandings.css'; // فایل استایل جدید

// اینترفیس‌ها را می‌توان از یک فایل مشترک وارد کرد
interface OverallStanding {
    name: string;
    initial: string;
    logo: string;
    total_pts: number;
    total_elms: number;
    overall_total: number;
}

interface GameDetails {
    id: number;
    name: string;
}

const FinalStandings: React.FC = () => {
    const { gameId } = useParams<{ gameId: string }>();
    const [standings, setStandings] = useState<OverallStanding[]>([]);
    const [gameDetails, setGameDetails] = useState<GameDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

    useEffect(() => {
        if (!gameId) {
            setIsLoading(false);
            return;
        }

        // ۱. گرفتن نام بازی
        fetch(`${apiUrl}/api/games/${gameId}`)
            .then(res => res.json())
            .then(data => setGameDetails(data))
            .catch(err => console.error("Failed to fetch game details:", err));

        // ۲. اتصال به سوکت برای داده‌های زنده
        const socket = io(apiUrl);
        socket.on('connect', () => {
            socket.emit('joinGame', gameId);
        });
        socket.on('overallStandingsUpdated', (updatedStandings: OverallStanding[]) => {
            setStandings(updatedStandings);
            setIsLoading(false);
        });

        return () => {
            socket.disconnect();
        };
    }, [gameId, apiUrl]);

    // ** بخش کلیدی: تقسیم داده‌ها به دو نیمه **
    const firstHalf = standings.slice(0, 10);
    const secondHalf = standings.slice(10, 20);

    // تابع کمکی برای رندر کردن یک ستون از جدول
    const renderTableColumn = (teams: OverallStanding[], startRank: number) => (
        <div className="table-column">
            <div className="table-header-final">
                <div className="col-rank">RANK</div>
                <div className="col-team">TEAM</div>
                <div className="col-pts">PLC</div>
                <div className="col-pts">ELM</div>
                <div className="col-pts">TOTAL</div>
            </div>
            {teams.map((team, index) => (
                <div className="team-row-final" key={startRank + index}>
                    <div className="col-rank">{startRank + index}</div>
                    <div className="col-team">
                        <img src={`${apiUrl}/${team.logo}`} alt={team.name} className='team-logo-final'/>
                        <span>{team.initial.toUpperCase()}</span>
                    </div>
                    <div className="col-pts">{team.total_pts}</div>
                    <div className="col-pts">{team.total_elms}</div>
                    <div className="col-pts">{team.overall_total}</div>
                </div>
            ))}
        </div>
    );

    if (isLoading) return <div className="loading-final">Loading Final Standings...</div>;
    if (!gameDetails) return <div className="loading-final">Game not found. <Link to="/games">Go back</Link></div>;

    return (
        <div className="final-standings-page">
            <h1 className="final-title">{gameDetails.name} - FINAL STANDINGS</h1>
            {/* کانتینر اصلی برای طرح دو ستونه */}
            <div className="two-column-layout">
                {renderTableColumn(firstHalf, 1)}
                {renderTableColumn(secondHalf, 11)}
            </div>
        </div>
    );
};

export default FinalStandings;