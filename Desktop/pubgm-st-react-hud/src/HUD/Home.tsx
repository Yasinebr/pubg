import { Link, useNavigate } from 'react-router-dom';
import { useGame } from '../contexts/GameContext';
import { useMatch } from '../contexts/MatchContext';
import './index.css';

function Home() {
    const { selectedGameId, selectGame } = useGame();
    const { selectedMatchId } = useMatch();
    const navigate = useNavigate();

    const handleManageGames = () => {
        // این تابع حالا فقط کاربر را به صفحه مدیریت بازی‌ها می‌برد
        navigate('/games');
    };

    // اگر هیچ بازی انتخاب نشده باشد، یک صفحه راهنما نمایش می‌دهیم
    if (!selectedGameId) {
        return (
            <div>
                <div className='home-container'>
                    <p style={{ color: 'white', fontSize: '1.2rem', textAlign: 'center' }}>
                        Please select or create a game to continue.
                    </p>
                    <button onClick={handleManageGames} className='home-button'>
                        Go to Game Management
                    </button>
                </div>
            </div>
        );
    }

    // اگر بازی انتخاب شده باشد، منوی اصلی را نمایش می‌دهیم
    return (
        <div>
            <div className='home-container'>
                {selectedMatchId ? (
                    <>
                        <Link to={`/control/${selectedMatchId}`} className='home-button'>ControlPanel</Link>
                        <Link to={`/table/${selectedMatchId}`} className='home-button'>Table</Link>
                        <Link to={`/admin/${selectedMatchId}`} className='home-button'>AdminPanel</Link>
                    </>
                ) : (
                    <p style={{ color: 'white', textAlign: 'center', width: '100%' }}>
                        Please select a match from the 'Manage Matches' page.
                    </p>
                )}

                <Link to="/matches" className='home-button'>Matches</Link>
                <Link to="/overall" className='home-button'>Overall</Link>

                <button onClick={handleManageGames} className='home-button switch-game-button'>
                    Switch Game
                </button>
            </div>
        </div>
    );
}

export default Home;