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

    useEffect(() => {
    // یک تابع داخلی می‌سازیم که مسئول گرفتن داده‌ها باشد
    const fetchDataForControlPanel = () => {
        console.log("ControlPanel is fetching data...");
        getTeamData().then((data) => {
            setTeamData(data);
        });
        updateTablePreviewHeight();
    };

    // ۱. در اولین بار که صفحه لود می‌شود، داده‌ها را می‌گیریم
    fetchDataForControlPanel();

    // ۲. به سرور سوکت متصل می‌شویم تا به آپدیت‌ها گوش دهیم
    // (مطمئن شوید io در بالای فایل ایمپورت شده است)
    const socket = io(process.env.REACT_APP_SOCKET_URL!, {
  // کلاینت را به همان مسیر سفارشی سرور می‌فرستیم
});
    // ۳. به پیام 'teamDataUpdated' که از سرور می‌آید، گوش می‌دهیم
    socket.on('teamDataUpdated', () => {
        console.log('ControlPanel received teamDataUpdated event. Refetching...');
        // وقتی خبری از سرور رسید، دوباره داده‌ها را می‌گیریم
        fetchDataForControlPanel();
    });

    // ۴. تابع پاک‌سازی برای جلوگیری از مشکل حافظه
    // این تابع وقتی اجرا می‌شود که از این صفحه خارج شوید
    return () => {
        socket.disconnect();
    };
}, []); // [] یعنی این افکت فقط یک بار در زمان لود اولیه اجرا می‌شود

    const elms = (teamId: number,  side: "increase" | "decrease" | number)=>{
        axios.post(`${process.env.REACT_APP_API_URL}/api/elms`, {
            data: {
                team_id: teamId,
                points: typeof side === 'number' ? side:side === "increase" ? 1:-1
            }
        })
    }

    return (
        <div>
            <div className='nav-bar'>
                <div className='container'></div>
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
                    {teamData && Object.keys(teamData).map((key) => (
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
                                                    onClick={remPoints}>-
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
                                            0
                                        </span>
                                        </div>
                                        <div className='control-m-p-div'>
                                            <button className='control-button player-knocked-button'
                                                    onClick={addPoints}>+
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
                                                    onClick={()=>elms(Number(key), "decrease")}>-
                                            </button>
                                        </div>
                                        <div className='control-points-div'>
                                        <span
                                            className='auto-points'
                                            suppressContentEditableWarning={true}
                                        >
                                            0
                                        </span>
                                        </div>
                                        <div className='control-m-p-div'>
                                            <button className='control-button player-knocked-button'
                                                    onClick={()=>elms(Number(key),"increase")}>+
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
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
                    ))}
                </div>
                <div className='table-container'>
                    <iframe title='table' src='/table' frameBorder='0' className='iframe'></iframe>
                </div>
            </div>
        </div>
    );
}

export default Control;