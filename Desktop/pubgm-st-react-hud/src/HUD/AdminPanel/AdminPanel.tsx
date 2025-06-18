import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminPanel.css';

// این interface را کمی کامل‌تر کردم تا با داده‌های شما هماهنگ باشد
interface Team {
  id: number;
  name: string;
  initial: string;
  logo_data: string;
}

export const AdminPanel: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);

  // State برای فرم ویرایش تیم‌های موجود
  const [teamNameInputs, setTeamNameInputs] = useState<{ [key: number]: string }>({});
  const [teamLogoFiles, setTeamLogoFiles] = useState<{ [key: number]: File | null }>({});

  // --- شروع بخش جدید: State برای فرم افزودن تیم ---
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamInitial, setNewTeamInitial] = useState('');
  const [newTeamLogo, setNewTeamLogo] = useState<File | null>(null);
  // --- پایان بخش جدید ---

  // این تابع مسئول گرفتن لیست جدید تیم‌ها از سرور است
  const fetchTeams = () => {
    axios.get(`${process.env.REACT_APP_API_URL}/api/team_data`)
      .then(response => {
        setTeams(response.data);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchTeams(); // در اولین بار داده‌ها را می‌گیریم
  }, []);

  // --- شروع توابع جدید برای افزودن و حذف ---

  const handleAddTeam = async () => {
    if (!newTeamName || !newTeamInitial || !newTeamLogo) {
      return alert('Please fill all fields for the new team.');
    }
    const formData = new FormData();
    formData.append('team_name', newTeamName);
    formData.append('team_initial', newTeamInitial);
    formData.append('logo_file', newTeamLogo);

    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/admin/add-team`, formData);
      alert('Team added successfully!');
      fetchTeams(); // لیست تیم‌ها را دوباره می‌گیریم تا تیم جدید نمایش داده شود
      // فرم را خالی می‌کنیم
      setNewTeamName('');
      setNewTeamInitial('');
      setNewTeamLogo(null);
      // برای خالی کردن input file
      const fileInput = document.getElementById('new-team-logo-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error) {
      alert('Failed to add team.');
      console.error(error);
    }
  };

  const handleDeleteTeam = async (teamId: number) => {
    // از کاربر تایید می‌گیریم
    if (window.confirm(`Are you sure you want to delete team with ID ${teamId}? This action cannot be undone.`)) {
      try {
        await axios.post(`${process.env.REACT_APP_API_URL}/api/admin/delete-team`, {
          data: { team_id: teamId }
        });
        alert('Team deleted successfully!');
        fetchTeams(); // لیست تیم‌ها را دوباره می‌گیریم
      } catch (error) {
        alert('Failed to delete team.');
        console.error(error);
      }
    }
  };

  // --- توابع قبلی شما برای ویرایش بدون تغییر باقی مانده‌اند ---
  const handleUpdateName = async (teamId: number) => {
    const newName = teamNameInputs[teamId];
    if (!newName) {
      alert('Please enter a new name.');
      return;
    }
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/admin/update-name`, {
        data: { team_id: teamId, new_name: newName }
      });
      alert('Team name updated successfully!');
      fetchTeams(); // لیست تیم‌ها را دوباره می‌گیریم
    } catch (error) {
      alert('Failed to update name.');
      console.error(error);
    }
  };

  const handleUpdateLogo = async (teamId: number) => {
    const logoFile = teamLogoFiles[teamId];
    if (!logoFile) {
      alert('Please select a logo file.');
      return;
    }
    const formData = new FormData();
    formData.append('team_id', teamId.toString());
    formData.append('logo_file', logoFile);

    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/admin/update-logo`, formData);
      alert('Logo updated successfully!');
      fetchTeams(); // لیست تیم‌ها را دوباره می‌گیریم
    } catch (error) {
      alert('Failed to update logo.');
      console.error(error);
    }
  };


  return (
    <div className="admin-panel">
      <h1>Team Admin Panel</h1>

      {/* بخش افزودن تیم جدید */}
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

      <hr style={{margin: '40px 0', borderColor: '#34495e'}} />

      <h2>Edit Existing Teams</h2>
      {/* لیست تیم‌های موجود */}
      {teams.map((team, index) => (
        <div key={team.id} className="team-edit-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4>{team.name} (ID: {team.id})</h4>
            <button onClick={() => handleDeleteTeam(team.id)} style={{backgroundColor: '#e74c3c'}}>Delete Team</button>
          </div>

          <div className="form-group">
            <input
              type="text"
              placeholder="Enter new name..."
              onChange={(e) => setTeamNameInputs(prev => ({ ...prev, [team.id]: e.target.value }))}
            />
            <button onClick={() => handleUpdateName(team.id)}>Update Name</button>
          </div>

          <div className="form-group">
            <input
              type="file"
              onChange={(e) => setTeamLogoFiles(prev => ({ ...prev, [team.id]: e.target.files ? e.target.files[0] : null }))}
            />
            <button onClick={() => handleUpdateLogo(team.id)}>Update Logo</button>
          </div>
        </div>
      ))}
    </div>
  );
};