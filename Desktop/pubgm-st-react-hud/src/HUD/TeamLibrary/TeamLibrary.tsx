// src/components/TeamLibrary.tsx (نسخه نهایی با قابلیت ویرایش و حذف)

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TeamLibrary.css';

interface LibraryTeam {
    id: number;
    name: string;
    initial: string;
    logo_path: string;
}

const TeamLibrary: React.FC = () => {
    const [teams, setTeams] = useState<LibraryTeam[]>([]);
    const [editMode, setEditMode] = useState<number | null>(null); // برای مدیریت حالت ویرایش
    const [editedName, setEditedName] = useState('');
    const [editedInitial, setEditedInitial] = useState('');
    const [editedLogo, setEditedLogo] = useState<File | null>(null);

    // State های فرم افزودن تیم جدید
    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamInitial, setNewTeamInitial] = useState('');
    const [newTeamLogo, setNewTeamLogo] = useState<File | null>(null);

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

    const fetchTeams = () => {
        axios.get(`${apiUrl}/api/library/teams`)
            .then(response => setTeams(response.data))
            .catch(err => console.error("Failed to fetch teams:", err));
    };

    useEffect(() => {
        fetchTeams();
    }, []);

    const handleAddNewTeam = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTeamName || !newTeamInitial || !newTeamLogo) {
            setError('All fields for the new team are required.');
            return;
        }
        const formData = new FormData();
        formData.append('team_name', newTeamName);
        formData.append('team_initial', newTeamInitial);
        formData.append('logo_file', newTeamLogo);

        axios.post(`${apiUrl}/api/library/teams`, formData)
            .then(() => {
                setSuccess('Team added successfully!');
                fetchTeams();
                // Reset form
                setNewTeamName('');
                setNewTeamInitial('');
                setNewTeamLogo(null);
                (document.getElementById('new-logo-input') as HTMLInputElement).value = '';
            })
            .catch(err => setError(err.response?.data?.error || 'Failed to add team.'));
    };

    const handleDeleteTeam = (teamId: number) => {
        if (window.confirm('Are you sure you want to permanently delete this team from the library?')) {
            axios.delete(`${apiUrl}/api/library/teams/${teamId}`)
                .then(() => {
                    setSuccess('Team deleted successfully!');
                    fetchTeams();
                })
                .catch(err => setError(err.response?.data?.error || 'Failed to delete team.'));
        }
    };

    const handleSaveChanges = (teamId: number) => {
        // آپدیت نام و تگ
        axios.post(`${apiUrl}/api/library/teams/${teamId}/update-details`, {
            team_name: editedName,
            team_initial: editedInitial,
        }).then(() => {
            // اگر لوگوی جدیدی هم انتخاب شده، آن را آپدیت کن
            if (editedLogo) {
                const logoFormData = new FormData();
                logoFormData.append('logo_file', editedLogo);
                return axios.post(`${apiUrl}/api/library/teams/${teamId}/update-logo`, logoFormData);
            }
        }).then(() => {
            setSuccess('Team updated successfully!');
            setEditMode(null); // خروج از حالت ویرایش
            fetchTeams();
        }).catch(err => setError(err.response?.data?.error || 'Failed to update team.'));
    };

    const startEditMode = (team: LibraryTeam) => {
        setEditMode(team.id);
        setEditedName(team.name);
        setEditedInitial(team.initial);
        setEditedLogo(null);
    };

    return (
        <div className="library-container">
            <h1>Team Library Management</h1>

            {/* فرم اضافه کردن تیم جدید */}
            <div className="form-container">
                <h2>Add New Team to Library</h2>
                <form onSubmit={handleAddNewTeam}>
                    <input type="text" placeholder="Team Name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
                    <input type="text" placeholder="Team Initial" value={newTeamInitial} onChange={e => setNewTeamInitial(e.target.value)} />
                    <input type="file" id="new-logo-input" onChange={e => setNewTeamLogo(e.target.files ? e.target.files[0] : null)} />
                    <button type="submit">Add Team</button>
                </form>
                {error && <p className="error-message">{error}</p>}
                {success && <p className="success-message">{success}</p>}
            </div>

            {/* لیست تیم‌های موجود */}
            <div className="teams-list-container">
                <h2>Existing Teams in Library</h2>
                <div className="teams-list">
                    {teams.map(team => (
                        <div key={team.id} className="team-item-editable">
                            {editMode === team.id ? (
                                // حالت ویرایش
                                <div className="edit-form">
                                    <input type="text" value={editedName} onChange={e => setEditedName(e.target.value)} />
                                    <input type="text" value={editedInitial} onChange={e => setEditedInitial(e.target.value)} />
                                    <input type="file" onChange={e => setEditedLogo(e.target.files ? e.target.files[0] : null)} />
                                    <div className="edit-buttons">
                                        <button onClick={() => handleSaveChanges(team.id)}>Save</button>
                                        <button className="cancel-button" onClick={() => setEditMode(null)}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                // حالت نمایش
                                <div className="display-mode">
                                    <div className="team-info">
                                        <img src={`${apiUrl}/${team.logo_path}`} alt={team.name} className="team-logo-small" />
                                        <span>{team.name} ({team.initial})</span>
                                    </div>
                                    <div className="action-buttons">
                                        <button onClick={() => startEditMode(team)}>Edit</button>
                                        <button className="delete-button" onClick={() => handleDeleteTeam(team.id)}>Delete</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TeamLibrary;