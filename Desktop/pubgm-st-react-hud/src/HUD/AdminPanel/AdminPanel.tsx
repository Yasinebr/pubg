import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from "socket.io-client";
import { useMatch } from '../../contexts/MatchContext';
import { useNavigate } from 'react-router-dom'; // [۱] ایمپورت کردن useNavigate

import './AdminPanel.css';

interface Team {
  id: number;
  name: string;
  initial: string;
  logo: string;
}

export const AdminPanel: React.FC = () => {
    // [۲] گرفتن هر دو مقدار مورد نیاز از هوک‌ها
    const { selectedMatchId, setSelectedMatchId } = useMatch();
    const navigate = useNavigate();

    const [teams, setTeams] = useState<Team[]>([]);
    const [teamNameInputs, setTeamNameInputs] = useState<{ [key: number]: string }>({});
    const [teamLogoFiles, setTeamLogoFiles] = useState<{ [key: number]: File | null }>({});
    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamInitial, setNewTeamInitial] = useState('');
    const [newTeamLogo, setNewTeamLogo] = useState<File | null>(null);


    useEffect(() => {
        if (!selectedMatchId) {
            setTeams([]);
            return;
        }

        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

        const fetchTeams = () => {
            axios.get(`${apiUrl}/api/teams/${selectedMatchId!}`)
              .then(response => setTeams(response.data))
              .catch(console.error);
        };

        fetchTeams();

        const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001');
        socket.emit('joinMatch', selectedMatchId);

        // [اصلاح نهایی]: مقایسه با == برای آپدیت لحظه‌ای صحیح
        const handleDataUpdate = (data: { match_id: any }) => {
            if (data.match_id == selectedMatchId) {
                fetchTeams();
            }
        };

        socket.on('dataUpdated', handleDataUpdate);
        socket.on('teamDataUpdated', handleDataUpdate);

        return () => {
            socket.off('dataUpdated', handleDataUpdate);
            socket.off('teamDataUpdated', handleDataUpdate);
            socket.disconnect();
        };
    }, [selectedMatchId]);

    const handleAddTeam = async () => {
        if (!selectedMatchId) return alert('Please select a match first.');
        if (!newTeamName || !newTeamInitial || !newTeamLogo) return alert('Please fill all fields.');

        const formData = new FormData();
        formData.append('team_name', newTeamName);
        formData.append('team_initial', newTeamInitial);
        formData.append('logo_file', newTeamLogo);

        try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
            await axios.post(`${apiUrl}/api/admin/add-team/${selectedMatchId}`, formData);
            alert('Team added successfully!');
            setNewTeamName('');
            setNewTeamInitial('');
            setNewTeamLogo(null);
            const fileInput = document.getElementById('new-team-logo-input') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
        } catch (error) {
            console.error(error);
            alert('Failed to add team.');
        }
    };

    const handleDeleteAllMatches = async () => {
        if (window.confirm("Are you sure you want to delete ALL matches? This action is irreversible!")) {
            try {
                const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
                await axios.post(`${apiUrl}/api/matches/delete-all`);

                alert('All matches were successfully deleted!');

                // مچ فعلی را از حافظه پاک می‌کنیم
                setSelectedMatchId(null);
                // کاربر را به صفحه انتخاب مچ (که حالا خالی است) هدایت می‌کنیم
                navigate('/matches');

            } catch (error) {
                alert('Error deleting all matches.');
                console.error(error);
            }
        }
    };

    if (!selectedMatchId) {
        return <div style={{ padding: '20px', textAlign: 'center' }}>Please select a match to manage teams.</div>;
    }

    const handleDeleteTeam = async (teamId: number) => {
        if (!selectedMatchId) return alert('Please select a match first.');
        if (window.confirm(`Are you sure you want to delete team with ID ${teamId}?`)) {
            try {
                const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
                await axios.post(`${apiUrl}/api/admin/delete-team/${selectedMatchId}`, {
                    data: { team_id: teamId }
                });
                alert('Team deleted successfully!');
            } catch (error) {
                console.error(error);
                alert('Failed to delete team.');
            }
        }
    };

    // ... توابع handleUpdateName و handleUpdateLogo نیز بدون تغییر باقی می‌مانند ...
    const handleUpdateName = async (teamId: number) => {
        if (!selectedMatchId) return alert('Please select a match first.');
        const newName = teamNameInputs[teamId];
        if (!newName) return alert('Please enter a new name.');

        try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
            await axios.post(`${apiUrl}/api/admin/update-name/${selectedMatchId}`, {
                data: { team_id: teamId, new_name: newName }
            });
            alert('Team name updated successfully!');
        } catch (error) {
            console.error(error);
            alert('Failed to update name.');
        }
    };

    const handleUpdateLogo = async (teamId: number) => {
        if (!selectedMatchId) return alert('Please select a match first.');
        const logoFile = teamLogoFiles[teamId];
        if (!logoFile) return alert('Please select a logo file.');

        const formData = new FormData();
        formData.append('team_id', teamId.toString());
        formData.append('logo_file', logoFile);

        try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
            await axios.post(`${apiUrl}/api/admin/update-logo/${selectedMatchId}`, formData);
            alert('Logo updated successfully!');
        } catch (error) {
            console.error(error);
            alert('Failed to update logo.');
        }
    };

    if (!selectedMatchId) {
        return <div style={{ padding: '20px', textAlign: 'center' }}>Please select a match to manage teams.</div>;
    }

     return (
        <div className="admin-panel">
            <h1>Team Admin Panel (Match ID: {selectedMatchId})</h1>
            <div className="grid-container">
                <div className="team-edit-card add-team-card">
                    <h4>Add New Team</h4>
                    <div className="form-group">
                        <input type="text" placeholder="New Team Name" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
                        <input type="text" placeholder="Initial (e.g., TSM)" value={newTeamInitial} onChange={(e) => setNewTeamInitial(e.target.value)} style={{maxWidth: '150px'}} />
                    </div>
                    <div className="form-group">
                        <input type="file" id="new-team-logo-input" onChange={(e) => setNewTeamLogo(e.target.files ? e.target.files[0] : null)} />
                        <button onClick={handleAddTeam} style={{backgroundColor: '#2ecc71'}}>Create Team</button>
                    </div>
                </div>

                <div className="team-edit-card danger-zone">
                    <h4>Danger Zone</h4>
                    <button onClick={handleDeleteAllMatches} className="delete-all-button">
                        Delete All Matches
                    </button>
                </div>
            </div>
            <hr style={{margin: '40px 0', borderColor: '#34495e'}} />
            <h2>Edit Existing Teams</h2>
            {teams.map((team) => (
                <div key={team.id} className="team-edit-card">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <h4>{team.name} (ID: {team.id})</h4>
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