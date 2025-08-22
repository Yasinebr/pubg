import React, { useState, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import { useMatch } from '../contexts/MatchContext';
import { useNavigate, Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import './MatchSelector.css';

interface Match {
  id: number;
  name: string;
}

/** Modal: Copy Teams */
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

  const sourceOptions = matches.filter((m) => m.id !== destinationMatch.id);

  const handleConfirm = () => {
    if (sourceMatchId) onConfirm(sourceMatchId);
    else alert('Please select a source match.');
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
          <option value="" disabled>
            -- Select a source match --
          </option>
          {sourceOptions.map((match) => (
            <option key={match.id} value={match.id}>
              {match.name}
            </option>
          ))}
        </select>
        <div className="modal-actions">
          <button onClick={handleConfirm} className="modal-button confirm">
            Confirm Copy
          </button>
          <button onClick={onClose} className="modal-button cancel">
            Cancel
          </button>
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [destinationMatch, setDestinationMatch] = useState<Match | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const navigate = useNavigate();
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

  /** Load matches + live updates */
  useEffect(() => {
    if (!selectedGameId) return;

    const fetchMatches = () => {
      fetch(`${apiUrl}/api/games/${selectedGameId}/matches`)
        .then((res) => res.json())
        .then((data) => setMatches(data))
        .catch((err) => console.error('Failed to fetch matches:', err));
    };

    fetchMatches();

    const socket: Socket = io(socketUrl);
    socket.on('matchesUpdated', fetchMatches);

    return () => {
      socket.off('matchesUpdated', fetchMatches);
      socket.disconnect();
    };
  }, [selectedGameId, apiUrl, socketUrl]);

  /** Select a match */
  const handleMatchSelect = (id: number) => {
    setSelectedMatchId(id);
    navigate('/');
  };

  /** Create new match */
  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatchName.trim() || !selectedGameId) return;
    try {
      await fetch(`${apiUrl}/api/games/${selectedGameId}/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newMatchName }),
      });
      setNewMatchName('');
      // سرور از طریق socket لیست را به‌روزرسانی می‌کند؛ اگر لازم بود می‌توانی اینجا هم fetch مجدد بزنی.
    } catch (err) {
      console.error(err);
    }
  };

  /** Open copy modal */
  const handleOpenCopyModal = (match: Match) => {
    setDestinationMatch(match);
    setIsModalOpen(true);
  };

  /** Confirm copy */
  const handleConfirmCopy = async (sourceMatchId: number) => {
    if (!destinationMatch) return;
    try {
      const response = await fetch(`${apiUrl}/api/matches/copy-teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceMatchId,
          destinationMatchId: destinationMatch.id,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to copy teams.');
      alert(result.message);
      setIsModalOpen(false);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  /** 🔴 Delete single match */
  const handleDeleteMatch = async (matchId: number) => {
    if (!window.confirm('This match will be deleted. Are you sure?')) return;
    try {
      setDeletingId(matchId);
      const res = await fetch(`${apiUrl}/api/matches/${matchId}`, {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to delete match');
      }
      // Optimistic update – remove from local state
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
    } catch (err) {
      console.error(err);
      alert('The deletion was unsuccessful.');
    } finally {
      setDeletingId(null);
    }
  };

  if (!selectedGameId) {
    return (
      <div style={{ color: 'white', textAlign: 'center', padding: '40px' }}>
        Please select a game first.
      </div>
    );
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
          <button type="submit" className="create-button">
            Create
          </button>
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
            {matches.map((match) => (
              <div key={match.id} className="match-item-row">
                <button
                  onClick={() => handleMatchSelect(match.id)}
                  className="select-button"
                >
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

                  {/* 🔴 Delete button */}
                  <button
                    onClick={() => handleDeleteMatch(match.id)}
                    className="action-button delete-button"
                    disabled={deletingId === match.id}
                    style={{ backgroundColor: '#e53935', color: '#fff' }}
                    title="Delete this match"
                  >
                    {deletingId === match.id ? 'Deleting…' : 'Delete'}
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
