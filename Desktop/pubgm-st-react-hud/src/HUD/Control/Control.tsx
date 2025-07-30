import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { io, Socket } from "socket.io-client";
import Table from '../Table/Table';

import '../index.css';
import './styles.css';

// [تغییر ۱]: اینترفیس جدید که دقیقاً با داده‌های ارسالی از بک‌اند مطابقت دارد
interface CombinedData {
  id: number;
  name: string;
  initial: string;
  logo: string;
  team_points: number;
  team_elms: number;
  is_eliminated: number;
}

function Control() {
    const { matchId } = useParams<{ matchId: string }>();

    const [combinedData, setCombinedData] = useState<CombinedData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!matchId) {
            setIsLoading(false);
            setCombinedData([]);
            return;
        }

        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const socket: Socket = io(apiUrl);

        // [تغییر ۲]: به محض اتصال، به روم مربوط به این مچ جوین می‌شویم
        socket.on('connect', () => {
            console.log('Socket connected, joining match:', matchId);
            socket.emit('joinMatch', matchId);
        });

        // [تغییر ۳]: به رویداد جدید گوش می‌دهیم
        // این رویداد داده‌های کامل و به‌روز شده را به همراه خود دارد
        socket.on('matchDataUpdated', (updatedData: CombinedData[]) => {
            console.log('Received matchDataUpdated event with', updatedData.length, 'teams.');
            setCombinedData(updatedData);
            setIsLoading(false); // بعد از دریافت اولین داده، لودینگ تمام می‌شود
        });

        // [حذف شده]: دیگر نیازی به تابع fetchData و ارسال درخواست‌های fetch مجزا نیست

        // در زمان خروج از کامپوننت، اتصال سوکت را قطع می‌کنیم
        return () => {
            console.log('Disconnecting socket...');
            socket.disconnect();
        };
    }, [matchId]);

    // توابع ارسال‌کننده تغییرات بدون تغییر باقی می‌مانند
    const handlePointsChange = (teamId: number, amount: number) => {
        if (!matchId) return;
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        axios.post(`${apiUrl}/api/update_points/${matchId}`, {
            data: { team_id: teamId, team_points: amount }
        }).catch(error => console.error("Failed to update points:", error));
    };

    const handleElimsChange = (teamId: number, amount: number) => {
        if (!matchId) return;
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        axios.post(`${apiUrl}/api/elms/${matchId}`, {
            data: { team_id: teamId, points: amount }
        }).catch(error => console.error("Failed to update elims:", error));
    };

    const handleEliminateTeam = (teamId: number) => {
        if (!matchId) return;
        // از window.confirm استفاده نکنید چون در برخی محیط‌ها کار نمی‌کند.
        // در آینده می‌توانید از یک Modal سفارشی استفاده کنید.
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        axios.post(`${apiUrl}/api/teams/eliminate`, {
            data: { match_id: matchId, team_id: teamId }
        }).catch(error => console.error("Failed to eliminate team:", error));
    };

    if (!matchId) {
        return (
             <div style={{ padding: '20px', textAlign: 'center', color: 'white' }}>
                <h2>No Match Selected</h2>
                <p>Please select a match first.</p>
                <Link to="/matches">
                    <button>Go to Match Selection</button>
                </Link>
            </div>
        );
    }

    return (
    <div>
        <div className='nav-bar'>
            {/* دکمه رفرش دستی دیگر ضروری نیست اما می‌تواند برای تست باقی بماند */}
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
                    <div style={{textAlign: 'center', padding: '20px', color: 'white'}}>Loading initial data...</div>
                ) : (
                    combinedData.map((team, index) => (
                        <div className='control-div-m' key={team.id}>
                            <div className='control-div-upper'>
                                <div className='control-div control-place'>{index + 1}</div>
                                <div className='control-div control-team-name'>
                                    <p className='team-name' id={`team-name-${team.id}`}>{team.name}</p>
                                </div>

                                {/* ستون PLC */}
                                <div className='control-div control-team-points'>
                                    <div className='flex-div'>
                                        <div className='control-m-p-div'>
                                            <button className='control-button player-knocked-button' onClick={() => handlePointsChange(team.id, -1)}>-</button>
                                        </div>
                                        <div className='control-points-div'>
                                            <span className='auto-points'>{team.team_points}</span>
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
                                            <span className='auto-points'>{team.team_elms}</span>
                                        </div>
                                        <div className='control-m-p-div'>
                                            <button className='control-button player-knocked-button' onClick={() => handleElimsChange(team.id, 1)}>+</button>
                                        </div>
                                    </div>
                                </div>

                                <div className='control-div control-team-points'>
                                    <button className='control-button eliminate-button' onClick={() => handleEliminateTeam(team.id)} disabled={team.is_eliminated === 1}>
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
