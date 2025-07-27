import React, { useState, useEffect } from 'react';
import './OverallTable.css';

interface OverallStanding {
    name: string;
    initial: string;
    logo: string;
    total_pts: number;
    total_elms: number;
    overall_total: number;
}

const OverallTable: React.FC = () => {
    const [standings, setStandings] = useState<OverallStanding[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

    useEffect(() => {
    console.log("۱. کامپوننت OverallTable بارگذاری شد و useEffect اجرا شد.");

    const fetchStandings = async () => {
        setIsLoading(true);
        console.log("۲. تابع fetchStandings فراخوانی شد.");
        try {
            console.log(`۳. در حال ارسال درخواست به: ${apiUrl}/api/overall-standings`);
            const response = await fetch(`${apiUrl}/api/overall-standings`);
            const data = await response.json();
            console.log("۴. پاسخ از سرور دریافت شد.");
            setStandings(data);
        } catch (error) {
            console.error("۵. خطا در هنگام دریافت داده:", error);
        } finally {
            setIsLoading(false);
        }
    };

    fetchStandings();
}, []); // آرایه خالی یعنی این افکت فقط یک بار بعد از اولین رندر اجرا می‌شود

    // [اصلاح کلیدی]: منطق تقسیم کردن آرایه تغییر کرد
    const firstHalf = standings.slice(0, 10); // ۱۰ تیم اول
    const secondHalf = standings.slice(10, 20); // تیم‌های ۱۱ تا ۲۰

    if (isLoading) {
        return <div className="loading-message">Loading Overall Standings...</div>;
    }

    const renderTable = (teams: OverallStanding[], startRank: number) => (
        <div className="table-column">
            <div className="table-header-m">
                <div className="column-rank">RANK</div>
                <div className="column-team">TEAM NAME</div>
                <div className="column-stats">PLCT</div>
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
                                <span className='team-name-tb'>{team.name.toUpperCase()}</span>
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
            <div className="two-column-layout">
                {renderTable(firstHalf, 1)}
                {renderTable(secondHalf, 11)} {/* رنک ستون دوم از ۱۱ شروع می‌شود */}
            </div>
        </div>
    );
};

export default OverallTable;