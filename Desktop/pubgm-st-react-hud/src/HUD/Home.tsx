import { Link } from 'react-router-dom';
import './index.css';

function Home() {
    return (
        <div>
            <div className='home-container'>
                <Link to="/control" className='home-button'>Control Panel</Link>
                <Link to="/table" className='home-button'>Table</Link>
                <Link to="/matches" className='home-button'>Matches</Link>
                <Link to="/admin" className='home-button'>Admin Panel</Link>
                <Link to="/overall" className='home-button'>Standings</Link>
            </div>
        </div>
    );
}

export default Home;