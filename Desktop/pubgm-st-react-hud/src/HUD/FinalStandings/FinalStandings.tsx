// FinalStandingsPage.tsx (نسخه نهایی و کامل)

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import '../Table/styles.css';

// اینترفیس برای داده‌های رده‌بندی
interface FinalStanding {
    name: string;
    initial: string;
    logo: string;
    total_pts: number;
    total_elms: number;
    is_eliminated: number;
}

// [جدید]: اینترفیس برای اطلاعات بازی
interface GameDetails {
    id: number;
    name: string;
}

const FinalStandingsPage: React.FC = () => {
    const { gameId } = useParams<{ gameId: string }>();
    const [standings, setStandings] = useState<FinalStanding[]>([]);

    // [جدید]: استیت برای نگهداری اطلاعات بازی
    const [gameDetails, setGameDetails] = useState<GameDetails | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

    useEffect(() => {
        if (!gameId) {
            setIsLoading(false);
            return;
        }

        // [جدید]: ارسال درخواست برای گرفتن نام بازی
        fetch(`${apiUrl}/api/games/${gameId}`)
            .then(res => res.json())
            .then(data => setGameDetails(data))
            .catch(err => console.error("Failed to fetch game details:", err));

        const socket = io(apiUrl);
        socket.on('connect', () => {
            socket.emit('joinGame', gameId);
        });
        socket.on('overallStandingsUpdated', (updatedStandings: FinalStanding[]) => {
            setStandings(updatedStandings);
            setIsLoading(false);
        });

        return () => {
            socket.disconnect();
        };
    }, [gameId, apiUrl]);


    if (isLoading) return <div style={{ color: 'white', textAlign: 'center', paddingTop: '50px', fontSize: '1.5rem' }}>Loading Final Standings...</div>;

    return (
        <div className="table-container-m">
            {/* حالا این بخش به درستی کار می‌کند */}
            <h1 className="main-title">
                {gameDetails ? `${gameDetails.name.toUpperCase()} - FINAL STANDINGS` : 'FINAL STANDINGS'}
            </h1>
            <div className='table-m'>
                <div className='table-header-m'>
                    <div className='blank-div column-rank'>#</div>
                    <div className='table-inner-element table-team-header column-team'>TEAM NAME</div>
                    <div className='table-inner-element table-stats-side column-pts'>PLC</div>
                    <div className='table-inner-element table-stats-side column-elims'>ELM</div>
                    <div className='table-inner-element table-stats-side column-total'>TOTAL</div>
                </div>
                <div className='team-m-parent'>
                    {standings.map((team, index) => (
                        <div className={`team-m ${team.is_eliminated === 1 ? 'eliminated' : ''}`} key={team.name}>
                            <div className='table-inner-element team-rank-side column-rank'>{index + 1}</div>
                            <div className='table-inner-element team-team-side column-team'>
                                <div className='table-inner-element team-logo-m'>
                                    <img src={`${apiUrl}/${team.logo}`} alt={`${team.name} logo`}
                                         className='team-logo'/>
                                </div>
                                <div className='table-inner-element team-name-m'>
                                <span className='team-name-tb' title={team.name.toUpperCase()}>
                                    {team.initial.toUpperCase()}
                                </span>
                                </div>
                            </div>
                            <div className='table-inner-element table-stats-side column-pts' data-label="PTS">
                                <span className='team-pts'>{team.total_pts}</span>
                            </div>
                            <div className='table-inner-element table-stats-side column-elims' data-label="ELIMS">
                                <span className='team-elims'>{team.total_elms}</span>
                            </div>
                            <div className='table-inner-element table-stats-side column-total' data-label="TOTAL">
                                <span className='team-total'>{team.total_pts + team.total_elms}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default FinalStandingsPage;