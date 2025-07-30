import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import './MatchStandings.css';

interface Standing {
    id: number;
    name: string;
    initial: string;
    logo: string;
    team_points: number;
    team_elms: number;
    is_eliminated: number;
}

const MatchStandings: React.FC = () => {
    const { matchId } = useParams<{ matchId: string }>();
    const [standings, setStandings] = useState<Standing[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

    useEffect(() => {
        // حذف کامل هر نوع بک‌گراند
        const styleId = 'force-transparent-style';
        const existingStyle = document.getElementById(styleId);
        if (existingStyle) {
            document.head.removeChild(existingStyle);
        }

        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          /* حذف بک‌گراند از کل صفحه */
          html, body, #root {
            background: transparent !important;
            background-color: transparent !important;
            background-image: none !important;
          }
          
          /* حذف بک‌گراند از همه عناصر این صفحه */
          .match-standings-page,
          .match-standings-page *,
          .match-standings-page .table-column,
          .match-standings-page .team-m,
          .match-standings-page .team-m:hover,
          .match-standings-page .team-m:focus,
          .match-standings-page .team-m.eliminated,
          .match-standings-page .table-header-m,
          .match-standings-page .team-m-parent,
          .match-standings-page .two-column-layout {
            background: transparent !important;
            background-color: transparent !important;
            background-image: none !important;
            border: none !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
          }
          
          /* فقط border-bottom برای team-m حفظ شود */
          .match-standings-page .team-m {
            border-bottom: 1px solid #34495e !important;
            border-top: none !important;
            border-left: none !important;
            border-right: none !important;
          }
          
          /* فقط border-bottom برای header حفظ شود */
          .match-standings-page .table-header-m {
            border-bottom: 2px solid #3498db !important;
            border-top: none !important;
            border-left: none !important;
            border-right: none !important;
          }
          
          .match-standings-page .team-m:last-child {
            border-bottom: none !important;
          }
        `;
        document.head.appendChild(style);

        if (!matchId) {
            setIsLoading(false);
            return;
        }

        const socket: Socket = io(apiUrl);
        socket.on('connect', () => socket.emit('joinMatch', matchId));
        socket.on('matchDataUpdated', (data: Standing[]) => {
            setStandings(data);
            setIsLoading(false);
        });

        return () => {
            socket.disconnect();
            const styleElement = document.getElementById(styleId);
            if (styleElement) {
                document.head.removeChild(styleElement);
            }
        };
    }, [matchId, apiUrl]);

    const midPoint = Math.ceil(standings.length / 2);
    const firstHalf = standings.slice(0, midPoint);
    const secondHalf = standings.slice(midPoint);

    if (isLoading) {
        return <div className="loading-message">Loading Match Standings...</div>;
    }

    const renderTableColumn = (teams: Standing[], startRank: number) => (
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
                    <div className={`team-m ${team.is_eliminated ? 'eliminated' : ''}`} key={team.id}>
                        <div className="column-rank">{startRank + index}</div>
                        <div className="column-team team-team-side">
                            <div className='team-logo-m'>
                                <img src={`${apiUrl}/${team.logo}`} alt={`${team.name} logo`} className='team-logo'/>
                            </div>
                            <div className='team-name-m'>
                                <span className='team-name-tb'>{team.name.toUpperCase()}</span>
                            </div>
                        </div>
                        <div className="column-stats">{team.team_points}</div>
                        <div className="column-stats">{team.team_elms}</div>
                        <div className="column-stats">{team.team_points + team.team_elms}</div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="match-standings-page">
            <h1 className="page-title">Match Standings</h1>
            <div className="two-column-layout">
                {renderTableColumn(firstHalf, 1)}
                {renderTableColumn(secondHalf, midPoint + 1)}
            </div>
        </div>
    );
};

export default MatchStandings;