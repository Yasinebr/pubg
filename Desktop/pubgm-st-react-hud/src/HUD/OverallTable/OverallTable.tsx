import React, { useState, useEffect } from 'react';
import './OverallTable.css';
import { useGame } from '../../contexts/GameContext';

interface OverallStanding {
    name: string;
    initial: string;
    logo: string;
    total_pts: number;
    total_elms: number;
    overall_total: number;
}

const OverallTable: React.FC = () => {
    const { selectedGameId } = useGame(); // [۲] گرفتن آیدی بازی فعال
    const [standings, setStandings] = useState<OverallStanding[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

    useEffect(() => {
        // [۳] این افکت حالا به selectedGameId وابسته است
        if (selectedGameId) {
            setIsLoading(true);
            // آدرس API حالا شامل آیدی بازی فعال است
            fetch(`${apiUrl}/api/overall-standings/${selectedGameId}`)
                .then(res => res.json())
                .then(data => setStandings(Array.isArray(data) ? data : []))
                .catch(err => {
                    console.error("Failed to fetch standings:", err);
                    setStandings([]);
                })
                .finally(() => setIsLoading(false));
        } else {
            // اگر بازی انتخاب نشده، جدول را خالی کن
            setStandings([]);
            setIsLoading(false);
        }
    }, [selectedGameId, apiUrl]);

    // منطق تقسیم کردن آرایه به دو ستون
    const firstHalf = standings.slice(0, 10);
    const secondHalf = standings.slice(10, 20);

    if (isLoading) {
        return <div className="loading-message">Loading Overall Standings...</div>;
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
            {/* عنوان نام بازی در اینجا می‌تواند اضافه شود */}
            <div className="two-column-layout">
                {renderTable(firstHalf, 1)}
                {renderTable(secondHalf, 11)}
            </div>
        </div>
    );
};

export default OverallTable;