import { useState, useEffect } from 'react';
import { ConfigData, TeamPoints, TeamElims, TeamDataA } from '../Utils/interfaces';

import '../index.css';
import './styles.css';

import {
    getTeamData,
    getTeamPoints,
    knockedOneEmit,
    knockedTwoEmit,
    knockedThreeEmit,
    aliveFourPlayersEmit,
    teamEliminatedEmit,
    eliminatedOneEmit,
    eliminatedTwoEmit,
    eliminatedThreeEmit
} from '../Utils/functions';

import io from 'socket.io-client';
import {teamPoints} from "../../../interfaces";

const socket = io(process.env.REACT_APP_SOCKET_URL!, {
  // کلاینت را به همان مسیر سفارشی سرور می‌فرستیم
});

function Table() {
    const [teamData, setTeamData] = useState<ConfigData | null>(null);
    const [teamPointsM, setTeamPointsM] = useState<TeamPoints[] | null>(null);
    const [teamElimsM, setTeamElimsM] = useState<{ [key: string]: TeamElims }>({});
    const [teamColor, setTeamColor] = useState('');
    const [headerColor, setHeaderColor] = useState('');
    const [teamDatasA, setTeamDatasA] = useState<TeamDataA[] | null>(null);;
    const [eliminatedTeams, setEliminatedTeams] = useState<number[]>([]);
    const [dynamicData, setDynamicData] = useState<Record<number, teamPoints>>({});
    const [isMobile, setIsMobile] = useState(false);

    // تشخیص سایز صفحه
    useEffect(() => {
        const checkScreenSize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);

        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    useEffect(() => {
        const fetchTableData = () => {
            console.log("Fetching initial table data...");
            getTeamData().then((data) => {
                setTeamColor(data[0].team_color);
                setHeaderColor(data[0].header_color);
                setTeamData(data);
            });

            getTeamPoints().then((teamPoints) => {
                setTeamPointsM(teamPoints);
                setDynamicData(Object.fromEntries(
                    teamPoints.map((o: any) => ([
                        o.team_id - 1,
                        o
                    ]))
                ))
            });
        };

        fetchTableData();

        socket.on('teamDataUpdated', () => {
            console.log("Received 'teamDataUpdated' event. Refetching data...");
            fetchTableData();
        });

        socket.on('players_update', (data) => {
            if (data.players_knocked) {
                if (data.players_knocked === 1) knockedOneEmit(data.team_id);
                if (data.players_knocked === 2) knockedTwoEmit(data.team_id);
                if (data.players_knocked === 3) knockedThreeEmit(data.team_id);
            }
            if (data.players_alive) {
                if (data.players_alive === 4) aliveFourPlayersEmit(data.team_id)
            }
            if (data.team_eliminated && !eliminatedTeams.includes(data.team_id)) {
                teamEliminatedEmit(data.team_id)
                setEliminatedTeams((prevTeams) => [...prevTeams, data.team_id]);
            }
            if (data.players_eliminated) {
                if (data.players_eliminated === 1) eliminatedOneEmit(data.team_id)
                if (data.players_eliminated === 2) eliminatedTwoEmit(data.team_id)
                if (data.players_eliminated === 3) eliminatedThreeEmit(data.team_id)
            }
        });

        socket.on("dajjal", data => {
            setDynamicData(data);
        });

        return () => {
            socket.off('teamDataUpdated');
            socket.off('players_update');
            socket.off('points-update');
            socket.off('dajjal');
        };

    }, []);

    const teamColorStyle: React.CSSProperties = {
        backgroundColor: teamColor,
        position: 'relative'
    };
    const headerColorStyle: React.CSSProperties = {
        backgroundColor: headerColor
    }

    useEffect(() => {
        socket.on('players_update', (data) => {
            if (data.players_knocked) {
                if (data.players_knocked === 1) knockedOneEmit(data.team_id);
                if (data.players_knocked === 2) knockedTwoEmit(data.team_id);
                if (data.players_knocked === 3) knockedThreeEmit(data.team_id);
            }
            if (data.players_alive) {
                if (data.players_alive === 4) aliveFourPlayersEmit(data.team_id)
            }
            if (data.team_eliminated && !eliminatedTeams.includes(data.team_id)) {
                teamEliminatedEmit(data.team_id)
                setEliminatedTeams((prevTeams) => [...prevTeams, data.team_id]);
            }
            if (data.players_eliminated) {
                if (data.players_eliminated === 1) {
                    eliminatedOneEmit(data.team_id)
                }
                if (data.players_eliminated === 2) {
                    eliminatedTwoEmit(data.team_id)
                }
                if (data.players_eliminated === 3) {
                    eliminatedThreeEmit(data.team_id)
                }
            }
        })
    }, [])

    useEffect(() => {
        const sortedTeamInfo: TeamPoints[] = teamPointsM ? teamPointsM.slice().sort((a, b) => {
            const aElims = dynamicData[a.team_id - 1]?.team_elms || 0;
            const bElims = dynamicData[b.team_id - 1]?.team_elms || 0;

            const aTotalScore = a.team_points + aElims;
            const bTotalScore = b.team_points + bElims;

            return bTotalScore - aTotalScore;
        }) : [];

        if (sortedTeamInfo.length > 0) {
            const updatedTeamDatasA: ({
                elms: any;
                pts: any;
                id: number;
                name: string;
                initial: string;
                logo_data: string;
                team_color: string;
                header_color: string
            } | {
                team_color: string;
                header_color: string;
                initial: string;
                name: string;
                logo_data: string;
                id: number
            })[] = sortedTeamInfo.map((team) => {
                const teamDataItem = teamData?.[team.team_id - 1];
                return teamDataItem || {
                    id: 0,
                    name: '',
                    initial: '',
                    logo_data: '',
                    team_color: '',
                    header_color: ''
                };
            });

            setTeamDatasA(updatedTeamDatasA);
        }

        socket.on('points-update', (data) => {
            const spanPts = document.querySelectorAll('.team-pts');
            let prevP: number = 0;

            spanPts.forEach((span) => {
                const teamID = span.id.match(/\d+/)?.[0] || '0';
                if (data.team_id === parseInt(teamID)) {
                    const previousPoints = parseInt(span.textContent || '0');
                    prevP = previousPoints;
                }
            });

            if (data.team_points !== -2) {
                if (data.team_points === -1) {
                    if (prevP !== 0) {
                        setTeamPointsM((prevPoints) => {
                            if (!prevPoints) {
                                return null;
                            }

                            const updatedPoints = [...prevPoints];
                            updatedPoints[data.team_id-1] = {
                                ...updatedPoints[data.team_id - 1],
                                team_points: prevP + data.team_points
                            }

                            return updatedPoints;
                        })
                    } else {
                        return
                    }
                } else {
                    setTeamPointsM((prevPoints) => {
                        if (!prevPoints) {
                            return null;
                        }

                        const updatedPoints = [...prevPoints];
                        updatedPoints[data.team_id-1] = {
                            ...updatedPoints[data.team_id - 1],
                            team_points: prevP + data.team_points
                        }

                        return updatedPoints;
                    })
                }
            }

            if (data.team_points === 0) {
                setTeamPointsM((prevPoints) => {
                    if (!prevPoints) {
                        return null;
                    }

                    const updatedPoints = [...prevPoints];
                    updatedPoints[data.team_id-1] = {
                        ...updatedPoints[data.team_id - 1],
                        team_points: 0
                    }

                    return updatedPoints;
                })
            }

            const spanElims = document.querySelectorAll('.team-elims');
            let prevE: number = 0;

            spanElims.forEach((span) => {
                const teamID = span.id.match(/\d+/)?.[0] || '0';
                if (data.team_id === parseInt(teamID)) {
                    const previousElims = parseInt(span.textContent || '0');
                    prevE = previousElims;
                }
            });
        });

        socket.on("dajjal", data => {
            setDynamicData(data);
        })

    }, [teamData, teamPointsM, teamElimsM, dynamicData]);

    console.log(dynamicData)

    // فانکشن برای محاسبه مجموع points و elims
    const getTeamTotal = (teamId: number): number => {
        const points = teamPointsM?.[teamId - 1]?.team_points || 0;
        const elims = dynamicData[teamId - 1]?.team_elms || 0;
        return points + elims;
    };

    return (
        <div className="table-container">
            <div className='table-m'>
                {/* Header - مخفی می‌شه در صفحات خیلی کوچک */}
                <div className='table-header-m' style={{...headerColorStyle, display: 'flex', alignItems: 'center'}}>
                    <div className='blank-div column-rank'>#</div>
                    <div className='table-inner-element table-team-header column-team'>TEAM NAME</div>
                    <div className='table-inner-element table-stats-side column-pts'>PLC</div>
                    <div className='table-inner-element table-stats-side column-elims'>ELM</div>
                    <div className='table-inner-element table-stats-side column-total'>TOTAL</div>
                </div>

                <div className='team-m-parent'>
                {teamPointsM && teamDatasA && teamDatasA.map((team, index) => (
                    <div className='team-m' key={index} style={{...teamColorStyle, display: 'flex', alignItems: 'center'}} data-team-color={teamColor}>
                        <div className='table-inner-element team-rank-side column-rank'>{index+1}</div>

                        <div className='table-inner-element team-team-side column-team'>
                            <div className='table-inner-element team-logo-m'>
                                <img src={`data:image/png;base64, ${team.logo_data}`} alt="" className='team-logo' />
                            </div>
                            <div className='table-inner-element team-name-m'>
                                <span className='team-name-tb' title={(team.name).toUpperCase()}>
                                    {(team.name).toUpperCase()}
                                </span>
                            </div>
                        </div>
                        <div className='table-inner-element table-stats-side column-pts' data-label="PTS">
                            <div className='table-inner-element'>
                                <span className='team-pts' id={`team-pts-${team.id}`}>
                                    {teamPointsM?.[team.id-1]?.team_points || 0}
                                </span>
                            </div>
                        </div>

                        <div className='table-inner-element table-stats-side column-elims' data-label="ELIMS">
                            <div className='table-inner-element'>
                                {/*@ts-ignore*/}
                                <span className='team-elims' id={`team-elims-${team.id}`}>
                                    {dynamicData[team.id-1]?.team_elms || 0}
                                </span>
                            </div>
                        </div>

                        <div className='table-inner-element table-stats-side column-total' data-label="TOTAL">
                            <div className='table-inner-element'>
                                <span className='team-total' id={`team-total-${team.id}`}>
                                    {getTeamTotal(team.id)}
                                </span>
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