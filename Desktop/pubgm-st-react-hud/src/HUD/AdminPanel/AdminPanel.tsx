import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io, Socket } from "socket.io-client";
import { useGame } from '../../contexts/GameContext';
import { useMatch } from '../../contexts/MatchContext';
import { useParams, Link, useNavigate } from 'react-router-dom';
import TeamLibraryModal from '../../components/TeamLibraryModal';

import './AdminPanel.css';

interface TeamData {
  id: number;
  name: string;
  initial: string;
  logo: string;
}

export const AdminPanel: React.FC = () => {
    const { matchId } = useParams<{ matchId: string }>();
    const { selectedGameId } = useGame();
    const { setSelectedMatchId } = useMatch();
    const navigate = useNavigate();

    const [teams, setTeams] = useState<TeamData[]>([]);
    const [teamNameInputs, setTeamNameInputs] = useState<{ [key: number]: string }>({});

    // [جدید]: State برای نگهداری ورودی تگ‌ها
    const [teamInitialInputs, setTeamInitialInputs] = useState<{ [key: number]: string }>({});

    const [teamLogoFiles, setTeamLogoFiles] = useState<{ [key: number]: File | null }>({});
    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamInitial, setNewTeamInitial] = useState('');
    const [newTeamLogo, setNewTeamLogo] = useState<File | null>(null);
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

    const [addMode, setAddMode] = useState<'none' | 'new' | 'library'>('none');
    const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);


    useEffect(() => {
        if (!matchId) {
            setTeams([]);
            return;
        }

        const socket: Socket = io(apiUrl);
        socket.on('connect', () => socket.emit('joinMatch', matchId));
        socket.on('matchDataUpdated', (updatedData: TeamData[]) => {
            const sortedData = [...updatedData].sort((a, b) => a.id - b.id);
            setTeams(sortedData);
        });
        return () => {
            socket.disconnect();
        };
    }, [matchId, apiUrl]);

    const handleAddTeamFromLibrary = (libraryTeamId: number) => {
        if (!matchId) return;
        axios.post(`${apiUrl}/api/admin/add-team-from-library/${matchId}`, {
            library_team_id: libraryTeamId
        }).catch(err => {
            console.error("Failed to add team from library:", err);
            alert(err.response?.data?.error || 'Failed to add team.');
        });
    };

    const handleAddTeam = async () => {
        if (!matchId) return alert('No match selected.');
        if (!newTeamName || !newTeamInitial || !newTeamLogo) return alert('Please fill all fields.');

        const formData = new FormData();
        formData.append('team_name', newTeamName);
        formData.append('team_initial', newTeamInitial);
        formData.append('logo_file', newTeamLogo);

        try {
            await axios.post(`${apiUrl}/api/admin/add-team/${matchId}`, formData);
            alert('Team added successfully!');
            setNewTeamName('');
            setNewTeamInitial('');
            setNewTeamLogo(null);
            const fileInput = document.getElementById('new-team-logo-input') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
            setAddMode('none');
        } catch (error) {
            console.error(error);
            alert('Failed to add team.');
        }
    };

    const handleDeleteTeam = async (teamId: number) => {
        if (!matchId) return alert('No match selected.');
        if (window.confirm(`Are you sure you want to delete team with ID ${teamId}?`)) {
            try {
                await axios.post(`${apiUrl}/api/admin/delete-team/${matchId}`, {
                    data: { team_id: teamId }
                });
                alert('Team deleted successfully!');
            } catch (error) {
                console.error(error);
                alert('Failed to delete team.');
            }
        }
    };

    const handleUpdateName = async (teamId: number) => {
        if (!matchId) return alert('No match selected.');
        const newName = teamNameInputs[teamId];
        if (!newName) return alert('Please enter a new name.');

        try {
            await axios.post(`${apiUrl}/api/admin/update-name/${matchId}`, {
                data: { team_id: teamId, new_name: newName }
            });
            alert('Team name updated successfully!');
        } catch (error) {
            console.error(error);
            alert('Failed to update name.');
        }
    };

    // [جدید]: تابع برای آپدیت کردن تگ تیم
    const handleUpdateInitial = async (teamId: number) => {
        if (!matchId) return alert('No match selected.');
        const newInitial = teamInitialInputs[teamId];
        if (!newInitial) return alert('Please enter a new initial.');

        try {
            await axios.post(`${apiUrl}/api/admin/update-initial/${matchId}`, {
                data: { team_id: teamId, new_initial: newInitial }
            });
            alert('Team initial updated successfully!');
        } catch (error) {
            console.error(error);
            alert('Failed to update initial.');
        }
    };

    const handleUpdateLogo = async (teamId: number) => {
        if (!matchId) return alert('No match selected.');
        const logoFile = teamLogoFiles[teamId];
        if (!logoFile) return alert('Please select a logo file.');

        const formData = new FormData();
        formData.append('team_id', teamId.toString());
        formData.append('logo_file', logoFile);

        try {
            await axios.post(`${apiUrl}/api/admin/update-logo/${matchId}`, formData);
            alert('Logo updated successfully!');
        } catch (error) {
            console.error(error);
            alert('Failed to update logo.');
        }
    };

    const handleDeleteAllMatches = async () => {
        if (!selectedGameId) return alert("No game selected.");
        const confirmText = "Are you sure you want to delete ALL matches for the CURRENT game? This is irreversible!";
        if (window.confirm(confirmText)) {
            try {
                await axios.delete(`${apiUrl}/api/games/${selectedGameId}/matches`);
                alert('All matches for this game were successfully deleted!');
                setSelectedMatchId(null);
                navigate('/matches');
            } catch (error) {
                alert('Error deleting matches.');
                console.error(error);
            }
        }
    };

    if (!matchId) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: 'white' }}>
                <h2>No Match ID Provided in URL</h2>
                <Link to="/matches"><button>Go to Match Selection</button></Link>
            </div>
        );
    }

     return (
        <div className="admin-panel">
            <TeamLibraryModal
                isOpen={isLibraryModalOpen}
                onClose={() => setIsLibraryModalOpen(false)}
                onSelectTeam={handleAddTeamFromLibrary}
            />

            <h1>Team Admin Panel (Match ID: {matchId})</h1>
            <div className="grid-container">
                <div className="team-edit-card add-team-card">
                    <h4>Add a Team to this Match</h4>
                    <div className="add-team-options">
                        <button onClick={() => setAddMode('new')}>Create New Team</button>
                        <button onClick={() => setIsLibraryModalOpen(true)}>Add from Library</button>
                    </div>

                    {addMode === 'new' && (
                        <div className="new-team-form">
                             <div className="form-group">
                                <input type="text" placeholder="New Team Name" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
                                <input type="text" placeholder="Initial (e.g., TSM)" value={newTeamInitial} onChange={(e) => setNewTeamInitial(e.target.value)} style={{maxWidth: '150px'}} />
                            </div>
                            <div className="form-group">
                                <input type="file" id="new-team-logo-input" onChange={(e) => setNewTeamLogo(e.target.files ? e.target.files[0] : null)} />
                                <button onClick={handleAddTeam} style={{backgroundColor: '#2ecc71'}}>Create Team</button>
                            </div>
                             <button className="cancel-button" onClick={() => setAddMode('none')}>Cancel</button>
                        </div>
                    )}
                </div>

                <div className="team-edit-card danger-zone">
                    <h4>Danger Zone</h4>
                    <button onClick={handleDeleteAllMatches} className="delete-all-button">
                        Delete All Matches (for this Game)
                    </button>
                </div>
            </div>
            <hr style={{margin: '40px 0', borderColor: '#34495e'}} />
            <h2>Edit Existing Teams</h2>
            {teams.map((team) => (
                <div key={team.id} className="team-edit-card">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <h4>{team.name} ({team.initial}) (ID: {team.id})</h4>
                        <button onClick={() => handleDeleteTeam(team.id)} style={{backgroundColor: '#e74c3c'}}>Delete Team</button>
                    </div>
                    <div className="form-group">
                        <input
                            type="text"
                            placeholder="Enter new name..."
                            onChange={(e) => setTeamNameInputs(prev => ({...prev, [team.id]: e.target.value}))}
                        />
                        <button onClick={() => handleUpdateName(team.id)}>Update Name</button>
                    </div>

                    {/* [جدید]: فرم آپدیت تگ */}
                    <div className="form-group">
                        <input
                            type="text"
                            placeholder="Enter new initial..."
                            onChange={(e) => setTeamInitialInputs(prev => ({...prev, [team.id]: e.target.value}))}
                        />
                        <button onClick={() => handleUpdateInitial(team.id)}>Update Initial</button>
                    </div>

                    <div className="form-group">
                        <input
                            type="file"
                            onChange={(e) => setTeamLogoFiles(prev => ({
                                ...prev,
                                [team.id]: e.target.files ? e.target.files[0] : null
                            }))}
                        />
                        <button onClick={() => handleUpdateLogo(team.id)}>Update Logo</button>
                    </div>
                </div>
            ))}
        </div>
    );
};