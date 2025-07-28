import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider } from './contexts/GameContext';
import { MatchProvider } from './contexts/MatchContext';

import GameSelector from './components/GameSelector';
import { MatchSelector } from './components/MatchSelector';
import Home from './HUD/Home';
import Table from './HUD/Table/Table';
import Control from './HUD/Control/Control';
import { AdminPanel } from './HUD/AdminPanel/AdminPanel';
import OverallTable from './HUD/OverallTable/OverallTable';

function App() {
    return (
        <MatchProvider>
            <GameProvider>
                <Router>
                    <Routes>
                        {/* تمام مسیرها حالا عمومی هستند */}
                        <Route path="/games" element={<GameSelector />} />
                        <Route path="/" element={<Home />} />
                        <Route path="/matches" element={<MatchSelector />} />
                        <Route path="/table/:matchId" element={<Table />} />
                        <Route path="/control/:matchId" element={<Control />} />
                        <Route path="/admin/:matchId" element={<AdminPanel />} />
                        <Route path="/overall" element={<OverallTable />} />

                        {/* اگر کاربر آدرس اشتباهی وارد کرد، او را به مسیر اصلی هدایت کن */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Router>
            </GameProvider>
        </MatchProvider>
    );
}

export default App;