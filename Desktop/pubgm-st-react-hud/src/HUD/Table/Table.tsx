import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import io from 'socket.io-client';
import { useMatch } from '../../contexts/MatchContext';

import '../index.css';
import './styles.css';

// اینترفیس‌ها
interface Team {
  id: number;
  name: string;
  initial: string;
  logo: string;
}

// [۱. اصلاح اینترفیس]: پراپرتی is_eliminated اضافه شد
interface TeamPoints {
  team_id: number;
  team_points: number;
  team_elms: number;
  is_eliminated: number; // 0 for false, 1 for true
}

// کامپوننت اصلی
function Table() {
    const { selectedMatchId } = useMatch();
    const [teams, setTeams] = useState<Team[]>([]);
    const [points, setPoints] = useState<TeamPoints[]>([]);

    useEffect(() => {
        if (!selectedMatchId) {
            setTeams([]);
            setPoints([]);
            return;
        }

        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const fetchMatchData = async () => {
            try {
                const [teamsRes, pointsRes] = await Promise.all([
                    fetch(`${apiUrl}/api/teams/${selectedMatchId!}`),
                    fetch(`${apiUrl}/api/points/${selectedMatchId!}`)
                ]);
                const teamsData = await teamsRes.json();
                const pointsData = await pointsRes.json();
                setTeams(teamsData);
                setPoints(pointsData.data);
            } catch (error) {
                console.error("Failed to fetch match data:", error);
            }
        };

        fetchMatchData();

        const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001');
        socket.emit('joinMatch', selectedMatchId);

        const handleDataUpdate = (data: { match_id: any }) => {
            if (data.match_id == selectedMatchId) fetchMatchData();
        };

        socket.on('dataUpdated', handleDataUpdate);
        socket.on('teamDataUpdated', handleDataUpdate);

        return () => {
            socket.off('dataUpdated', handleDataUpdate);
            socket.off('teamDataUpdated', handleDataUpdate);
            socket.disconnect();
        };
    }, [selectedMatchId]);

    if (!selectedMatchId) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <h2>No location selected.</h2>
                <p>To view the leaderboard, please select a match first.</p>
                <Link to="/matches">
                    <button>Go to the wrist selection page</button>
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
                    // [۲. اضافه کردن کلاس شرطی]: اگر تیم حذف شده بود، کلاس 'eliminated' اضافه می‌شود
                    <div className={`team-m ${team.is_eliminated === 1 ? 'eliminated' : ''}`} key={team.id} style={{ display: 'flex', alignItems: 'center'}}>
                        <div className='table-inner-element team-rank-side column-rank'>{index + 1}</div>
                        <div className='table-inner-element team-team-side column-team'>
                            <div className='table-inner-element team-logo-m'>
                                <img src={`${process.env.REACT_APP_API_URL}/${team.logo}`} alt={`${team.name} logo`}
                                     className='team-logo'/>
                            </div>
                            <div className='table-inner-element team-name-m'>
                                <span className='team-name-tb' title={team.name.toUpperCase()}>
                                    {/* [اصلاح]: حالا نام مخفف (تگ) تیم نمایش داده می‌شود */}
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