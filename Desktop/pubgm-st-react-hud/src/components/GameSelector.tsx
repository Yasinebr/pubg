import React, { useState, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client'; // [۱] ایمپورت کردن io
import './GameSelector.css';
import { Link } from 'react-router-dom';

interface Game {
    id: number;
    name: string;
}

const GameSelector: React.FC = () => {
    const [games, setGames] = useState<Game[]>([]);
    const [newGameName, setNewGameName] = useState('');
    const { selectedGameId, selectGame } = useGame();
    const navigate = useNavigate();
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

    const fetchGames = () => {
        fetch(`${apiUrl}/api/games`)
            .then(res => res.json())
            .then(data => setGames(data))
            .catch(err => console.error("Failed to fetch games:", err));
    };

    useEffect(() => {
        fetchGames(); // گرفتن لیست در اولین بارگذاری

        // [۲] اتصال به سوکت و گوش دادن به رویدادها
        const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001');

        // هر زمان که پیامی با نام 'gamesUpdated' از سرور آمد، لیست را دوباره بگیر
        socket.on('gamesUpdated', () => {
            fetchGames();
        });

        // قطع اتصال در زمان خروج از کامپوننت
        return () => {
            socket.disconnect();
        };
    }, []);

    const handleCreateGame = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGameName.trim()) {
            alert("Please enter a game name.");
            return;
        }
        try {
            const response = await fetch(`${apiUrl}/api/games`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newGameName }),
            });
            if (!response.ok) throw new Error('Failed to create game');
            setNewGameName('');
            fetchGames();
        } catch (error) {
            console.error(error);
            alert('Error creating new game');
        }
    };

    const handleDeleteGame = async (gameId: number) => {
        if (window.confirm(`Are you sure you want to delete game ID ${gameId}? This will delete all its matches and teams.`)) {
            try {
                const response = await fetch(`${apiUrl}/api/games/${gameId}`, {
                    method: 'DELETE',
                });
                if (!response.ok) throw new Error('Failed to delete game');

                alert('Game deleted successfully.');
                fetchGames();
            } catch (error) {
                console.error(error);
                alert('Failed to delete game.');
            }
        }
    };

    const handleGameSelect = (id: number) => {
        selectGame(id);
        // [۳] اضافه کردن دستور navigate بعد از انتخاب بازی
        navigate('/');
    };

    return (
    <div className="game-selector-container">
        {/* کارت بازگشت به خانه */}
        <div className="card">
            <button
                onClick={() => navigate('/')}
                className="select-button"
            >
                Back to Home
            </button>
        </div>

        {/* کارت ساخت بازی جدید */}
        <div className="card">
            <h2>Create New Game (Tournament)</h2>
            <form onSubmit={handleCreateGame} className="create-form">
                <input
                    type="text"
                    value={newGameName}
                    onChange={(e) => setNewGameName(e.target.value)}
                    placeholder="Enter new game name"
                />
                <button type="submit" className="create-button">
                    Create
                </button>
            </form>
        </div>

        {/* کارت انتخاب بازی موجود */}
        <div className="card">
            <h2>Select Existing Game</h2>
            {games.length > 0 ? (
                <div className="list">
                    {games.map(game => (
                        <div className="list-item" key={game.id}>
                            <button onClick={() => handleGameSelect(game.id)} className="select-button">
                                {game.name} (ID: {game.id})
                            </button>
                            <button onClick={() => handleDeleteGame(game.id)} className="delete-button">
                                Delete
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <p>No existing games. Please create a new one.</p>
            )}
        </div>

        {/* [کد جدید]: کارت جدید برای لینک به بانک تیم‌ها */}
        <div className="card">
            <h2>Manage Team Library</h2>
            <Link to="/library" className="select-button">
                Open Library
            </Link>
        </div>
    </div>
);
};

export default GameSelector;