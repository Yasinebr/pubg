import { Link } from 'react-router-dom';
import { useMatch } from '../contexts/MatchContext';
import './index.css';

function Home() {
    const { selectedMatchId } = useMatch(); // [۲] گرفتن آیدی مچ فعال از کانتکست

    // اگر هیچ مچی انتخاب نشده باشد، یک راهنما نمایش می‌دهیم
    if (!selectedMatchId) {
        return (
            <div>
                <div className='home-container'>
                    <p style={{ color: 'white', fontSize: '1.2rem', textAlign: 'center' }}>
                        Please select a match to continue.
                    </p>
                    <Link to="/matches" className='home-button'>Manage Matches</Link>
                </div>
            </div>
        );
    }

    // اگر مچ انتخاب شده باشد، لینک‌ها را با آیدی همان مچ می‌سازیم
    return (
        <div>
            <div className='home-container'>
                {/* [۳] تمام لینک‌ها حالا داینامیک هستند */}
                <Link to={`/control`} className='home-button'>Control Panel</Link>
                <Link to={`/table/${selectedMatchId}`} className='home-button'>Table</Link>
                <Link to="/matches" className='home-button'>Matches</Link>
                <Link to={`/admin`} className='home-button'>Admin Panel</Link>
                <Link to="/overall" className='home-button'>Standings</Link>
            </div>
        </div>
    );
}

export default Home;