import {useState, useEffect} from 'react';
import { io } from 'socket.io-client';

import '../index.css';
import './styles.css';

import {ConfigData} from '../Utils/interfaces';
import {
    makeEditable,
    updateTablePreviewHeight,
    handleBlur,
    handleInput,
    handleKeyDown,
    getTeamData,
    addPoints,
    remPoints,
    resetPoints,
    resetElims,
    teamEliminated,
    playersAlive4,
    knockedPlayer,
    eliminatedPlayer,
    teamEliminatedHidden,
    eliminatedPlayerHidden,
    playersAlive4Hidden,
    knockedPlayerHidden
} from '../Utils/functions';
import axios from "axios";

function Control() {
    const [teamData, setTeamData] = useState<ConfigData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // بارگذاری مقادیر اولیه از localStorage
    const [teamElims, setTeamElims] = useState<{[key: string]: number}>(() => {
        const saved = localStorage.getItem('teamElims');
        return saved ? JSON.parse(saved) : {};
    });

    const [teamPoints, setTeamPoints] = useState<{ [key: string]: number }>(() => {
        const saved = localStorage.getItem('teamPoints');
        return saved ? JSON.parse(saved) : {};
    });

    // ذخیره در localStorage هر بار که state تغییر کند
    useEffect(() => {
        localStorage.setItem('teamElims', JSON.stringify(teamElims));
    }, [teamElims]);

    useEffect(() => {
        localStorage.setItem('teamPoints', JSON.stringify(teamPoints));
    }, [teamPoints]);

    useEffect(() => {
        // یک تابع داخلی می‌سازیم که مسئول گرفتن داده‌ها باشد
        const fetchDataForControlPanel = () => {
            console.log("ControlPanel is fetching data...");
            setIsLoading(true);

            getTeamData().then((data) => {
                setTeamData(data);

                // فقط اگر localStorage خالی باشد، از سرور بگیریم
                const savedPoints = localStorage.getItem('teamPoints');
                const savedElims = localStorage.getItem('teamElims');

                if (!savedPoints) {
                    // اولین بار - از سرور بگیر
                    const initialPoints: { [key: string]: number } = {};
                    Object.keys(data).forEach(key => {
                        initialPoints[key] = data[key].pts || 0;
                    });
                    setTeamPoints(initialPoints);
                }

                if (!savedElims) {
                    // اولین بار - از سرور بگیر
                    const initialElims: { [key: string]: number } = {};
                    Object.keys(data).forEach(key => {
                        initialElims[key] = data[key].elms || 0;
                    });
                    setTeamElims(initialElims);
                }

                setIsLoading(false);
            }).catch(error => {
                console.error("Error fetching team data:", error);
                setIsLoading(false);
            });
            updateTablePreviewHeight();
        };

        // ۱. در اولین بار که صفحه لود می‌شود، داده‌ها را می‌گیریم
        fetchDataForControlPanel();

        // ۲. به سرور سوکت متصل می‌شویم تا به آپدیت‌ها گوش دهیم
        const socket = io(process.env.REACT_APP_SOCKET_URL!);

        // ۳. به پیام 'teamDataUpdated' که از سرور می‌آید، گوش می‌دهیم
        socket.on('teamDataUpdated', () => {
            console.log('ControlPanel received teamDataUpdated event. Refetching...');
            // وقتی خبری از سرور رسید، دوباره داده‌ها را می‌گیریم
            fetchDataForControlPanel();
        });

        // گوش دادن به تغییرات elims از سرور
        socket.on('dajjal', (data) => {
            // فقط در صورتی که localStorage خالی باشد یا تغییرات از سرور بیاد
            const savedElims = localStorage.getItem('teamElims');
            if (!savedElims) {
                const updatedElims: { [key: string]: number } = {};
                Object.keys(data).forEach(key => {
                    updatedElims[key] = data[key]?.team_elms || 0;
                });
                setTeamElims(updatedElims);
            }
        });

        // ۴. تابع پاک‌سازی برای جلوگیری از مشکل حافظه
        return () => {
            socket.disconnect();
        };
    }, []);

    const elms = (teamId: number, side: "increase" | "decrease" | number) => {
        const teamKey = (teamId - 1).toString();
        const changeValue = typeof side === 'number' ? side : side === "increase" ? 1 : -1;

        axios.post(`${process.env.REACT_APP_API_URL}/api/elms`, {
            data: {
                team_id: teamId,
                points: changeValue
            }
        }).then(() => {
            // بعد از موفقیت، state محلی را به‌روزرسانی می‌کنیم
            setTeamElims(prev => {
                const newElims = {
                    ...prev,
                    [teamKey]: Math.max(0, (prev[teamKey] || 0) + changeValue) // جلوگیری از منفی شدن
                };
                return newElims;
            });
        }).catch(error => {
            console.error("Failed to update elims:", error);
        });
    }

    const addPointsLocal = (teamKey: string) => {
        const teamId = parseInt(teamKey) + 1;
        // ارسال درخواست به بک‌اند برای اضافه کردن ۱ امتیاز
        axios.post(`${process.env.REACT_APP_API_URL}/api/update_points`, {
            data: { team_id: teamId, team_points: 1 }
        }).then(() => {
            // بعد از موفقیت، state محلی را هم آپدیت می‌کنیم تا تغییر فوری نمایش داده شود
            setTeamPoints(prev => ({
                ...prev,
                [teamKey]: (prev[teamKey] || 0) + 1
            }));
        }).catch(error => console.error("Failed to add points:", error));
    };

    const remPointsLocal = (teamKey: string) => {
        const teamId = parseInt(teamKey) + 1;
        // ارسال درخواست به بک‌اند برای کم کردن ۱ امتیاز
        axios.post(`${process.env.REACT_APP_API_URL}/api/update_points`, {
            data: { team_id: teamId, team_points: -1 }
        }).then(() => {
            // بعد از موفقیت، state محلی را هم آپدیت می‌کنیم
            setTeamPoints(prev => ({
                ...prev,
                [teamKey]: Math.max(0, (prev[teamKey] || 0) - 1) // جلوگیری از منفی شدن
            }));
        }).catch(error => console.error("Failed to remove points:", error));
    };

    // تابع پاک کردن localStorage (اختیاری)
    const clearLocalStorage = async () => {
    localStorage.removeItem('teamPoints');
    localStorage.removeItem('teamElims');

    try {
        // گرفتن داده‌ها از API
        const pointsResponse = await axios.get(`${process.env.REACT_APP_API_URL}/api/team_points`);
        const elimsResponse = await axios.get(`${process.env.REACT_APP_API_URL}/api/team_elims`);

        const pointsData = pointsResponse.data.data;
        const elimsData = elimsResponse.data.data;

        const initialPoints: { [key: string]: number } = {};
        const initialElims: { [key: string]: number } = {};

        pointsData.forEach((item: any) => {
            initialPoints[(item.team_id - 1).toString()] = item.team_points || 0;
        });

        elimsData.forEach((item: any) => {
            initialElims[(item.team_id - 1).toString()] = item.team_elms || 0;
        });

        setTeamPoints(initialPoints);
        setTeamElims(initialElims);

    } catch (error) {
        console.error("Error fetching data:", error);
    }
};

    return (
        <div>
            <div className='nav-bar'>
                <div className='container'>
                    {/* دکمه پاک کردن localStorage برای تست */}
                    <button onClick={clearLocalStorage} style={{padding: '5px 10px', marginLeft: '10px'}}>
                        Clear Cache
                    </button>
                </div>
            </div>
            <div className='container margin-top-15 control-container-m'>
                <div className='control-container'>
                    <div className='control-header'>
                        <div className='control-div-upper'>
                            <div className='control-header-inn-m control-header-team'>Team</div>
                            <div className='control-header-inn-m control-header-players'>Players</div>
                            <div className='control-header-inn-m control-header-points'>PLCE</div>
                            <div className='control-header-inn-m control-header-points'>Elms</div>
                        </div>
                        <div className='control-div-down'>
                            <div className='control-header-inn-m control-header-players-down'>Players</div>
                        </div>
                    </div>

                    {isLoading ? (
                        <div style={{textAlign: 'center', padding: '20px'}}>
                            Loading...
                        </div>
                    ) : (
                        teamData && Object.keys(teamData).map((key) => (
                            <div className='control-div-m' key={key}>
                                <div className='control-div-upper'>
                                    <div className='control-div control-place'>{parseInt(key) + 1}</div>
                                    <div className='control-div control-team-name'>
                                        <p className='team-name'
                                           id={`team-name-${parseInt(key) + 1}`}>{teamData[key].name}</p>
                                    </div>
                                    <div className='control-div control-team-players' id={`team-id-${parseInt(key) + 1}`}>
                                        <span className='team-eliminated'>Team Eliminated</span>
                                        <button className='control-button eliminate-button' onClick={teamEliminated}>0
                                        </button>
                                        <button className='control-button player-eliminate-button' id='eliminated-3'
                                                onClick={eliminatedPlayer}>1
                                        </button>
                                        <button className='control-button player-eliminate-button' id='eliminated-2'
                                                onClick={eliminatedPlayer}>2
                                        </button>
                                        <button className='control-button player-eliminate-button' id='eliminated-1'
                                                onClick={eliminatedPlayer}>3
                                        </button>
                                        <button className='control-button player-eliminate-button'
                                                id={`team-${parseInt(key) + 1}-4`} onClick={playersAlive4}>4
                                        </button>
                                        <button className='control-button player-knocked-button' id='knocked-1'
                                                onClick={knockedPlayer}>-1
                                        </button>
                                        <button className='control-button player-knocked-button' id='knocked-2'
                                                onClick={knockedPlayer}>-2
                                        </button>
                                        <button className='control-button player-knocked-button' id='knocked-3'
                                                onClick={knockedPlayer}>-3
                                        </button>
                                    </div>
                                    <div className='control-div control-team-points'>
                                        <div className='flex-div'>
                                            <div className='control-m-p-div'>
                                                <button className='control-button player-knocked-button'
                                                        onClick={() => remPointsLocal(key)}>-
                                                </button>
                                            </div>
                                            <div className='control-points-div'>
                                                <span
                                                    className='auto-points'
                                                    contentEditable
                                                    onClick={makeEditable}
                                                    onBlur={handleBlur}
                                                    onInput={handleInput}
                                                    onKeyDown={handleKeyDown}
                                                    suppressContentEditableWarning={true}
                                                >
                                                    {teamPoints[key] || 0}
                                                </span>
                                            </div>
                                            <div className='control-m-p-div'>
                                                <button className='control-button player-knocked-button'
                                                        onClick={() => addPointsLocal(key)}>+
                                                </button>
                                            </div>
                                        </div>
                                        <div className='control-reset-div'>
                                            <button className='control-button eliminate-button' onClick={resetPoints}>R
                                            </button>
                                            <button className='control-button elims-rs-button' onClick={resetElims}>E
                                            </button>
                                        </div>
                                    </div>
                                    <div className='control-div control-team-points'>
                                        <div className='flex-div'>
                                            <div className='control-m-p-div'>
                                                <button className='control-button player-knocked-button'
                                                        onClick={() => elms(parseInt(key) + 1, "decrease")}>-
                                                </button>
                                            </div>
                                            <div className='control-points-div'>
                                                <span
                                                    className='auto-points'
                                                    suppressContentEditableWarning={true}
                                                >
                                                    {teamElims[key] || 0}
                                                </span>
                                            </div>
                                            <div className='control-m-p-div'>
                                                <button className='control-button player-knocked-button'
                                                        onClick={() => elms(parseInt(key) + 1, "increase")}>+
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/* بخش پایینی که دکمه‌های آن کامل شد */}
                                <div className='control-div-down'>
                                    <div className='control-div control-team-players-down'
                                         id={`team-id-${parseInt(key) + 1}`}>
                                        <span className='team-eliminated'>Team Eliminated</span>
                                        <button className='control-button eliminate-button'
                                                onClick={teamEliminatedHidden}>0
                                        </button>
                                        <button className='control-button player-eliminate-button' id='eliminated-3'
                                                onClick={eliminatedPlayerHidden}>1
                                        </button>
                                        <button className='control-button player-eliminate-button' id='eliminated-2'
                                                onClick={eliminatedPlayerHidden}>2
                                        </button>
                                        <button className='control-button player-eliminate-button' id='eliminated-1'
                                                onClick={eliminatedPlayerHidden}>3
                                        </button>
                                        <button className='control-button player-eliminate-button'
                                                id={`team-${parseInt(key) + 1}-4`} onClick={playersAlive4Hidden}>4
                                        </button>
                                        <button className='control-button player-knocked-button' id='knocked-1'
                                                onClick={knockedPlayerHidden}>-1
                                        </button>
                                        <button className='control-button player-knocked-button' id='knocked-2'
                                                onClick={knockedPlayerHidden}>-2
                                        </button>
                                        <button className='control-button player-knocked-button' id='knocked-3'
                                                onClick={knockedPlayerHidden}>-3
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                <div className='table-container'>
                    <iframe title='table' src='/table' frameBorder='0' className='iframe'></iframe>
                </div>
            </div>
        </div>
    );
}

export default Control;