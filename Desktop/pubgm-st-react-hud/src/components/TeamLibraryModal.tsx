// TeamLibraryModal.tsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface LibraryTeam {
    id: number;
    name: string;
    initial: string;
    logo_path: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSelectTeam: (libraryTeamId: number) => void;
}

const TeamLibraryModal: React.FC<Props> = ({ isOpen, onClose, onSelectTeam }) => {
    const [teams, setTeams] = useState<LibraryTeam[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

    useEffect(() => {
        if (isOpen) {
            // هر بار که مودال باز می‌شود یا کاربر جستجو می‌کند، لیست تیم‌ها را می‌گیرد
            axios.get(`${apiUrl}/api/library/teams?search=${searchTerm}`)
                .then(response => setTeams(response.data))
                .catch(err => console.error("Failed to search teams:", err));
        }
    }, [isOpen, searchTerm, apiUrl]);

    if (!isOpen) return null;

    const handleSelect = (teamId: number) => {
        onSelectTeam(teamId);
        onClose(); // بستن مودال بعد از انتخاب
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Add Team from Library</h2>
                <input
                    type="text"
                    placeholder="Search teams..."
                    className="modal-search-input"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <div className="modal-teams-list">
                    {teams.map(team => (
                        <div key={team.id} className="modal-team-item" onClick={() => handleSelect(team.id)}>
                            <img src={`${apiUrl}/${team.logo_path}`} alt={team.name} className="modal-team-logo" />
                            <span>{team.name} ({team.initial})</span>
                        </div>
                    ))}
                </div>
                <button onClick={onClose} className="modal-close-button">Close</button>
            </div>
        </div>
    );
};

export default TeamLibraryModal;