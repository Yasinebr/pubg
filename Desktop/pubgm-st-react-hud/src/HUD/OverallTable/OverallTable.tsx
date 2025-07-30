import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import './OverallTable.css';

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

const OverallTable: React.FC = () => {
    const { gameId } = useParams<{ gameId: string }>();
    const [standings, setStandings] = useState<OverallStanding[]>([]);
    const [gameDetails, setGameDetails] = useState<GameDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

    // [تغییر کلیدی]: بازنویسی کامل useEffect برای استفاده از سوکت
    useEffect(() => {
        if (!gameId) {
            setIsLoading(false);
            setStandings([]);
            return;
        }

        // ۱. گرفتن نام بازی (فقط یک بار در زمان بارگذاری)
        fetch(`${apiUrl}/api/games/${gameId}`)
            .then(res => res.json())
            .then(data => setGameDetails(data))
            .catch(err => console.error("Failed to fetch game details:", err));

        // ۲. اتصال به سوکت برای دریافت داده‌های زنده
        const socket: import('socket.io-client').Socket = io(apiUrl);

        socket.on('connect', () => {
            console.log(`OverallTable Socket connected, joining game: ${gameId}`);
            // به "روم" مخصوص این بازی ملحق می‌شویم
            socket.emit('joinGame', gameId);

        });

        // ۳. گوش دادن به رویداد جدید و اختصاصی
        socket.on('overallStandingsUpdated', (updatedStandings: OverallStanding[]) => {
            console.log('OverallTable received overallStandingsUpdated event.');
            setStandings(updatedStandings);
            setIsLoading(false); // بعد از دریافت اولین داده، لودینگ تمام می‌شود
        });

        return () => {
            console.log('Disconnecting OverallTable socket...');
            socket.disconnect();
        };
    }, [gameId, apiUrl]);

    // منطق تقسیم کردن آرایه به دو ستون (بدون تغییر)
    const firstHalf = standings.slice(0, 10);
    const secondHalf = standings.slice(10, 20);

    if (isLoading) {
        return <div className="loading-message">Loading Overall Standings...</div>;
    }

    if (!gameId || !gameDetails) {
        return (
            <div className="loading-message">
                Invalid Game ID. Please select a valid game.
                <br />
                <Link to="/games" className="link-button">Go to Game Selection</Link>
            </div>
        );
    }

    const renderTable = (teams: OverallStanding[], startRank: number) => (
        <div className="table-column">
            <div className="table-header-m">
                <div className="column-rank">RANK</div>
                <div className="column-team">TEAM NAME</div>
                <div className="column-stats">PLC</div>
                <div className="column-stats">ELIM</div>
                <div className="column-stats">TOTAL</div>
            </div>
            <div className="team-m-parent">
                {teams.map((team, index) => (
                    <div className="team-m" key={index}>
                        <div className="column-rank">{startRank + index}</div>
                        <div className="column-team team-team-side">
                            <div className='team-logo-m'>
                                <img src={`${apiUrl}/${team.logo}`} alt={`${team.name} logo`} className='team-logo'/>
                            </div>
                            <div className='team-name-m'>
                                <span className='team-name-tb'>{team.initial.toUpperCase()}</span>
                            </div>
                        </div>
                        <div className="column-stats">{team.total_pts}</div>
                        <div className="column-stats">{team.total_elms}</div>
                        <div className="column-stats">{team.overall_total}</div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="overall-standings-page">
            <h1 className="page-title">Overall Standings: {gameDetails.name}</h1>
            <div className="two-column-layout">
                {renderTable(firstHalf, 1)}
                {renderTable(secondHalf, 11)}
            </div>
        </div>
    );
};

export default OverallTable;
