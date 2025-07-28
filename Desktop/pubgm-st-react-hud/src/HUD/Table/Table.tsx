import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useGame } from '../../contexts/GameContext';
import { useMatch } from '../../contexts/MatchContext';
import io from 'socket.io-client';

import '../index.css';
import './styles.css';

// اینترفیس‌ها
interface Team {
  id: number;
  name: string;
  initial: string;
  logo: string;
}

interface TeamPoints {
  team_id: number;
  team_points: number;
  team_elms: number;
  is_eliminated: number;
}

// کامپوننت اصلی
function Table() {
    // گرفتن ID از هر دو منبع: URL و Context
    const { matchId: paramMatchId } = useParams<{ matchId: string }>();
    const { selectedMatchId: contextMatchId } = useMatch();
    const { selectedGameId } = useGame();

    // اولویت با ID موجود در URL است، در غیر این صورت از Context استفاده کن
    const activeMatchId = paramMatchId || contextMatchId;

    const [teams, setTeams] = useState<Team[]>([]);
    const [points, setPoints] = useState<TeamPoints[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [gameName, setGameName] = useState('');

    useEffect(() => {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

        // تابع برای گرفتن نام بازی
        //const fetchGameName = async () => {
          //  if (selectedGameId) {
            //    try {
              //      const response = await fetch(`${apiUrl}/api/games/${selectedGameId}`);
                ///    if (!response.ok) return;
                   // const data = await response.json();
                   // setGameName(data.name);
              //  } catch (error) {
                ///    console.error("Failed to fetch game name:", error);
                //}
        ///    }
       // };

        // تابع برای گرفتن داده‌های مچ
        const fetchMatchData = async () => {
            if (!activeMatchId) {
                setIsLoading(false);
                setTeams([]);
                setPoints([]);
                return;
            }
            // setIsLoading(true); // این خط برای جلوگیری از چشمک زدن کامنت شد
            try {
                const [teamsRes, pointsRes] = await Promise.all([
                    fetch(`${apiUrl}/api/teams/${activeMatchId}`),
                    fetch(`${apiUrl}/api/points/${activeMatchId}`)
                ]);
                const teamsData = await teamsRes.json();
                const pointsData = await pointsRes.json();
                setTeams(teamsData);
                setPoints(pointsData.data);
            } catch (error) {
                console.error("Failed to fetch match data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        //fetchGameName();
        fetchMatchData();

        const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001');
        if (activeMatchId) {
            socket.emit('joinMatch', activeMatchId);
            const handleDataUpdate = (data: { match_id: any }) => {
                if (data.match_id == activeMatchId) fetchMatchData();
            };
            socket.on('dataUpdated', handleDataUpdate);
            socket.on('teamDataUpdated', handleDataUpdate);
        }

        return () => {
            socket.disconnect();
        };
    }, [activeMatchId, selectedGameId]);

    if (isLoading) {
        return <div style={{ color: 'white', textAlign: 'center', paddingTop: '20px' }}>Loading Data...</div>;
    }

    if (!activeMatchId) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: 'white' }}>
                <h2>No Match Selected</h2>
                <p>Please select a match first to view the leaderboard.</p>
                <Link to="/matches">
                    <button>Go to Match Selection</button>
                </Link>
            </div>
        );
    }

    const getCombinedAndSortedData = () => {
        if (!teams.length) return [];
        const combined = teams.map(team => {
            const teamPoints = points.find(p => p.team_id === team.id) || { team_points: 0, team_elms: 0, is_eliminated: 0 };
            return {
                ...team,
                pts: teamPoints.team_points,
                elms: teamPoints.team_elms,
                total: teamPoints.team_points + teamPoints.team_elms,
                is_eliminated: teamPoints.is_eliminated
            };
        });
        return combined.sort((a, b) => (b.total - a.total) || (b.pts - a.pts));
    };

    const sortedTeamsData = getCombinedAndSortedData();

    return (
        <div className="table-container">
            <div className='table-m'>
                <div className='table-header-m' style={{ display: 'flex', alignItems: 'center'}}>
                    <div className='blank-div column-rank'>#</div>
                    <div className='table-inner-element table-team-header column-team'>TEAM NAME</div>
                    <div className='table-inner-element table-stats-side column-pts'>PLC</div>
                    <div className='table-inner-element table-stats-side column-elims'>ELM</div>
                    <div className='table-inner-element table-stats-side column-total'>TOTAL</div>
                </div>
                <div className='team-m-parent'>
                {sortedTeamsData.map((team, index) => (
                    <div className={`team-m ${team.is_eliminated === 1 ? 'eliminated' : ''}`} key={team.id} style={{ display: 'flex', alignItems: 'center'}}>
                        <div className='table-inner-element team-rank-side column-rank'>{index + 1}</div>
                        <div className='table-inner-element team-team-side column-team'>
                            <div className='table-inner-element team-logo-m'>
                                <img src={`${process.env.REACT_APP_API_URL}/${team.logo}`} alt={`${team.name} logo`}
                                     className='team-logo'/>
                            </div>
                            <div className='table-inner-element team-name-m'>
                                <span className='team-name-tb' title={team.name.toUpperCase()}>
                                    {team.initial.toUpperCase()}
                                </span>
                            </div>
                        </div>
                        <div className='table-inner-element table-stats-side column-pts' data-label="PTS">
                            <div className='table-inner-element'>
                                <span className='team-pts' id={`team-pts-${team.id}`}>{team.pts}</span>
                            </div>
                        </div>
                        <div className='table-inner-element table-stats-side column-elims' data-label="ELIMS">
                            <div className='table-inner-element'>
                                <span className='team-elims' id={`team-elims-${team.id}`}>{team.elms}</span>
                            </div>
                        </div>
                        <div className='table-inner-element table-stats-side column-total' data-label="TOTAL">
                            <div className='table-inner-element'>
                                <span className='team-total' id={`team-total-${team.id}`}>{team.total}</span>
                            </div>
                        </div>
                    </div>
                ))}
                </div>
            </div>
        </div>
    );
}

export default Table;