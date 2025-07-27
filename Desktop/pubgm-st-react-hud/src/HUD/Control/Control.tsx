import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from "socket.io-client";
import { useMatch } from '../../contexts/MatchContext';
import Table from '../Table/Table';
import { useNavigate } from 'react-router-dom';
import '../index.css';
import './styles.css';

// اینترفیس‌ها
interface Team {
  id: number;
  name: string;
}
interface TeamPoints {
  team_id: number;
  team_points: number;
  team_elms: number;
}
interface CombinedData extends Team {
    pts: number;
    elms: number;
}

function Control() {
    const { selectedMatchId } = useMatch();
    const [combinedData, setCombinedData] = useState<CombinedData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!selectedMatchId) {
            setIsLoading(false);
            setCombinedData([]);
            return;
        }

        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        setIsLoading(true);

        const fetchData = async () => {
            try {
                const [teamsRes, pointsRes] = await Promise.all([
                    fetch(`${apiUrl}/api/teams/${selectedMatchId!}`),
                    fetch(`${apiUrl}/api/points/${selectedMatchId!}`)
                ]);
                const teamsData = await teamsRes.json();
                const pointsData = await pointsRes.json();

                const combined = teamsData.map((team: Team) => {
                    const teamPoints = pointsData.data.find((p: TeamPoints) => p.team_id === team.id) || { team_points: 0, team_elms: 0 };
                    return { ...team, pts: teamPoints.team_points, elms: teamPoints.team_elms };
                });
                setCombinedData(combined);

            } catch (error) {
                console.error("Failed to fetch match data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

        const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001');
        socket.emit('joinMatch', selectedMatchId);

        // [اصلاح نهایی]: در اینجا === با == جایگزین شد
        socket.on('dataUpdated', (data: { match_id: any }) => {
            if (data.match_id == selectedMatchId) fetchData();
        });
        socket.on('teamDataUpdated', (data: { match_id: any }) => {
            if (data.match_id == selectedMatchId) fetchData();
        });

        return () => {
            socket.off('dataUpdated');
            socket.off('teamDataUpdated');
            socket.disconnect();
        };
    }, [selectedMatchId]);

    const handlePointsChange = (teamId: number, amount: number) => {
        if (!selectedMatchId) return;
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        axios.post(`${apiUrl}/api/update_points/${selectedMatchId}`, {
            data: { team_id: teamId, team_points: amount }
        }).catch(error => console.error("Failed to update points:", error));
    };

    const handleElimsChange = (teamId: number, amount: number) => {
        if (!selectedMatchId) return;
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        axios.post(`${apiUrl}/api/elms/${selectedMatchId}`, {
            data: { team_id: teamId, points: amount }
        }).catch(error => console.error("Failed to update elims:", error));
    };

    // این تابع را داخل کامپوننت Control.tsx اضافه کنید
    const handleEliminateTeam = (teamId: number) => {
        if (!selectedMatchId) return;
        if (window.confirm(`Are you sure you want to eliminate team ID ${teamId}?`)) {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        axios.post(`${apiUrl}/api/teams/eliminate`, {
            data: {
                match_id: selectedMatchId,
                team_id: teamId
            }
        }).catch(error => console.error("Failed to eliminate team:", error));
    }
};

    return (
    <div>
        <div className='nav-bar'>
            <div className='container'>
                <button onClick={() => {}} style={{padding: '5px 10px', marginLeft: '10px'}}>
                    Refresh Data (No Cache)
                </button>
            </div>
        </div>
        <div className='container margin-top-15 control-container-m'>
            <div className='control-container'>
                <div className='control-header'>
                    <div className='control-div-upper'>
                        <div className='control-header-inn-m control-header-team'>Team</div>
                        <div className='control-header-inn-m control-header-points'>PLC</div>
                        <div className='control-header-inn-m control-header-points'>ELM</div>
                        <div className='control-header-inn-m control-header-points'>ELIMINATE</div>
                    </div>
                </div>

                {isLoading ? (
                    <div style={{textAlign: 'center', padding: '20px'}}>Loading...</div>
                ) : (
                    combinedData.map((team, index) => (
                        <div className='control-div-m' key={team.id}>
                            <div className='control-div-upper'>
                                <div className='control-div control-place'>{index + 1}</div>
                                <div className='control-div control-team-name'>
                                    <p className='team-name' id={`team-name-${team.id}`}>{team.name}</p>
                                </div>

                                {/* ستون PLCE */}
                                <div className='control-div control-team-points'>
                                    <div className='flex-div'>
                                        <div className='control-m-p-div'>
                                            <button className='control-button player-knocked-button' onClick={() => handlePointsChange(team.id, -1)}>-</button>
                                        </div>
                                        <div className='control-points-div'>
                                            <span className='auto-points'>{team.pts}</span>
                                        </div>
                                        <div className='control-m-p-div'>
                                            <button className='control-button player-knocked-button' onClick={() => handlePointsChange(team.id, 1)}>+</button>
                                        </div>
                                    </div>
                                </div>

                                {/* ستون ELM */}
                                <div className='control-div control-team-points'>
                                    <div className='flex-div'>
                                        <div className='control-m-p-div'>
                                            <button className='control-button player-knocked-button' onClick={() => handleElimsChange(team.id, -1)}>-</button>
                                        </div>
                                        <div className='control-points-div'>
                                            <span className='auto-points'>{team.elms}</span>
                                        </div>
                                        <div className='control-m-p-div'>
                                            <button className='control-button player-knocked-button' onClick={() => handleElimsChange(team.id, 1)}>+</button>
                                        </div>
                                    </div>
                                </div>

                                {/* [اصلاح شده]: ستون ELIMINATE به جایگاه صحیح خود (کنار ستون ELM) منتقل شد */}
                                <div className='control-div control-team-points'>
                                    <button className='control-button eliminate-button' onClick={() => handleEliminateTeam(team.id)}>
                                        E
                                    </button>
                                </div>

                            </div>
                        </div>
                    ))
                )}
            </div>
            <div className='table-container'>
                <Table/>
            </div>
        </div>
    </div>
);
}

export default Control;