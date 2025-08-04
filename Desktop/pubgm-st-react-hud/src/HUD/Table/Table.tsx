import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMatch } from '../../contexts/MatchContext';
import { io, Socket } from 'socket.io-client';

import '../index.css';
import './styles.css';

// [تغییر ۱]: اینترفیس جدید که دقیقاً با داده‌های ارسالی از بک‌اند مطابقت دارد
interface Standing {
  id: number;
  name: string;
  initial: string;
  logo: string;
  team_points: number;
  team_elms: number;
  is_eliminated: number;
}

function Table() {
    const { matchId: paramMatchId } = useParams<{ matchId: string }>();
    const { selectedMatchId: contextMatchId } = useMatch();
    const activeMatchId = paramMatchId || contextMatchId;

    // [تغییر ۲]: استفاده از یک state واحد برای نگهداری داده‌های مرتب‌شده
    const [standings, setStandings] = useState<Standing[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!activeMatchId) {
            setIsLoading(false);
            setStandings([]);
            return;
        }

        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const socket: Socket = io(apiUrl);

        // [تغییر ۳]: به محض اتصال، به روم مربوط به این مچ جوین می‌شویم
        socket.on('connect', () => {
            console.log(`Table Socket connected, joining match: ${activeMatchId}`);
            socket.emit('joinMatch', activeMatchId);
        });

        // [تغییر ۴]: به رویداد جدید و بهینه شده گوش می‌دهیم
        socket.on('matchDataUpdated', (updatedData: Standing[]) => {
            console.log('Table received matchDataUpdated event.');
            setStandings(prevStandings => {
                console.log("TABLE - PREVIOUS state length:", prevStandings.length);
                console.log("TABLE - INCOMING data length:", updatedData.length);
                const newState = updatedData; // منطق صحیح جایگزینی است
                console.log("TABLE - NEW state length:", newState.length);
                return newState;
            });
            setIsLoading(false);
        });

        // [حذف شده]: دیگر نیازی به تابع fetchData و ارسال درخواست‌های fetch مجزا نیست

        return () => {
            console.log('Disconnecting Table socket...');
            socket.disconnect();
        };
    }, [activeMatchId]);

    if (isLoading) {
        return <div style={{ color: 'white', textAlign: 'center', paddingTop: '50px', fontSize: '1.5rem' }}>Loading Leaderboard...</div>;
    }

    if (!activeMatchId) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: 'white' }}>
                <h2>No Match Selected</h2>
                <p>Please select a match first to view the leaderboard.</p>
                <Link to="/matches">
                    <button className="link-button">Go to Match Selection</button>
                </Link>
            </div>
        );
    }

    // [حذف شده]: تابع getCombinedAndSortedData دیگر مورد نیاز نیست چون سرور داده‌ها را مرتب‌شده ارسال می‌کند

    return (
        <div className="table-container">
            <div className='table-m'>
                <div className='table-header-m'>
                    <div className='blank-div column-rank'>#</div>
                    <div className='table-inner-element table-team-header column-team'>TEAM NAME</div>
                    <div className='table-inner-element table-stats-side column-pts'>PLC</div>
                    <div className='table-inner-element table-stats-side column-elims'>ELM</div>
                    <div className='table-inner-element table-stats-side column-total'>TOTAL</div>
                </div>
                <div className='team-m-parent'>
                {/* [تغییر ۵]: مستقیماً از state جدید برای رندر کردن استفاده می‌کنیم */}
                {standings.map((team, index) => (
                    <div className={`team-m ${team.is_eliminated === 1 ? 'eliminated' : ''}`} key={team.id}>
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
                            <span className='team-pts'>{team.team_points}</span>
                        </div>
                        <div className='table-inner-element table-stats-side column-elims' data-label="ELIMS">
                            <span className='team-elims'>{team.team_elms}</span>
                        </div>
                        <div className='table-inner-element table-stats-side column-total' data-label="TOTAL">
                            <span className='team-total'>{team.team_points + team.team_elms}</span>
                        </div>
                    </div>
                ))}
                </div>
            </div>
        </div>
    );
}

export default Table;
