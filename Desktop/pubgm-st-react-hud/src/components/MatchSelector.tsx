import React, { useState, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import { useMatch } from '../contexts/MatchContext';
// [تغییر ۱]: Link را برای ساخت لینک‌های جدید ایمپورت می‌کنیم
import { useNavigate, Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import './MatchSelector.css';

interface Match {
    id: number;
    name: string;
}

// کامپوننت Modal برای کپی کردن تیم‌ها (این بخش به طور کامل حفظ شده است)
const CopyTeamsModal = ({
    isOpen,
    onClose,
    onConfirm,
    matches,
    destinationMatch,
}: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (sourceMatchId: number) => void;
    matches: Match[];
    destinationMatch: Match | null;
}) => {
    const [sourceMatchId, setSourceMatchId] = useState<number | ''>('');
    if (!isOpen || !destinationMatch) return null;

    const sourceOptions = matches.filter(m => m.id !== destinationMatch.id);

    const handleConfirm = () => {
        if (sourceMatchId) {
            onConfirm(sourceMatchId);
        } else {
            alert('Please select a source match.');
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h3>Copy Teams to "{destinationMatch.name}"</h3>
                <p>Select a match to copy teams from:</p>
                <select
                    value={sourceMatchId}
                    onChange={(e) => setSourceMatchId(Number(e.target.value))}
                    className="modal-select"
                >
                    <option value="" disabled>-- Select a source match --</option>
                    {sourceOptions.map(match => (
                        <option key={match.id} value={match.id}>{match.name}</option>
                    ))}
                </select>
                <div className="modal-actions">
                    <button onClick={handleConfirm} className="modal-button confirm">Confirm Copy</button>
                    <button onClick={onClose} className="modal-button cancel">Cancel</button>
                </div>
            </div>
        </div>
    );
};


export const MatchSelector = () => {
    const { selectedGameId } = useGame();
    const { setSelectedMatchId } = useMatch();
    const [matches, setMatches] = useState<Match[]>([]);
    const [newMatchName, setNewMatchName] = useState('');
    const navigate = useNavigate();
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [destinationMatch, setDestinationMatch] = useState<Match | null>(null);

    // تمام منطق fetch و socket شما حفظ شده است
    useEffect(() => {
        if (!selectedGameId) return;

        const fetchMatches = () => {
            fetch(`${apiUrl}/api/games/${selectedGameId}/matches`)
                .then(res => res.json())
                .then(data => setMatches(data))
                .catch(err => console.error("Failed to fetch matches:", err));
        };

        fetchMatches();
        const socket: Socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001');
        socket.on('matchesUpdated', fetchMatches);

        return () => {
            socket.off('matchesUpdated', fetchMatches);
            socket.disconnect();
        };
    }, [selectedGameId, apiUrl]);

    const handleMatchSelect = (id: number) => {
        setSelectedMatchId(id);
        navigate('/');
    };

    const handleCreateMatch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMatchName.trim() || !selectedGameId) return;
        await fetch(`${apiUrl}/api/games/${selectedGameId}/matches`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newMatchName }),
        });
        setNewMatchName('');
    };

    // تمام منطق مربوط به Modal کپی کردن تیم‌ها نیز حفظ شده است
    const handleOpenCopyModal = (match: Match) => {
        setDestinationMatch(match);
        setIsModalOpen(true);
    };

    const handleConfirmCopy = async (sourceMatchId: number) => {
        if (!destinationMatch) return;
        try {
            const response = await fetch(`${apiUrl}/api/matches/copy-teams`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceMatchId, destinationMatchId: destinationMatch.id }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to copy teams.');
            alert(result.message);
            setIsModalOpen(false);
        } catch (error: any) {
            alert(`Error: ${error.message}`);
        }
    };

    if (!selectedGameId) {
        return <div style={{color: 'white', textAlign: 'center', padding: '40px'}}>Please select a game first.</div>;
    }

    return (
        <div className="match-selector-container">
            <CopyTeamsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleConfirmCopy}
                matches={matches}
                destinationMatch={destinationMatch}
            />
            <div className="card">
                <h2>Create New Match</h2>
                <form onSubmit={handleCreateMatch} className="create-form">
                    <input
                        type="text"
                        value={newMatchName}
                        onChange={(e) => setNewMatchName(e.target.value)}
                        placeholder="Enter new match name"
                    />
                    <button type="submit" className="create-button">Create</button>
                </form>
            </div>

            <div className="select-match-container">
                <h2>Final Standings</h2>
                <p>View the final combined standings for this game.</p>
                <Link to={`/games/${selectedGameId}/final-standings`} className="action-button">
                    View Final Standings
                </Link>
            </div>

            <div className="card">
                <h2>Select Existing Match</h2>
                {matches.length > 0 ? (
                    <div className="list">
                        {/* [تغییر کلیدی]: ساختار نمایش لیست برای اضافه کردن دکمه‌های جدید */}
                        {matches.map(match => (
                            <div key={match.id} className="match-item-row">
                                <button onClick={() => handleMatchSelect(match.id)} className="select-button">
                                    {match.name} (ID: {match.id})
                                </button>
                                <div className="match-actions">
                                    <button
                                        onClick={() => handleOpenCopyModal(match)}
                                        className="action-button copy-button"
                                        disabled={matches.length < 2}
                                    >
                                        Copy Teams
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p>No existing matches for this game. Please create a new one.</p>
                )}
            </div>
        </div>
    );
};

export default MatchSelector;
