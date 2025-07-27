// src/App.tsx - نسخه جدید با جریان متفاوت

import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { MatchProvider } from './contexts/MatchContext';
import { MatchSelector } from './components/MatchSelector';
import OverallTable from './HUD/OverallTable/OverallTable';

// ایمپورت کامپوننت‌های شما
import Home from './HUD/Home';
import Control from './HUD/Control/Control';
import Table from './HUD/Table/Table';
import { AdminPanel } from './HUD/AdminPanel/AdminPanel';

function App() {
  return (
    // MatchProvider همچنان کل برنامه را پوشش می‌دهد
    <MatchProvider>
      <Router>
        <div>
          <Routes>
            {/* صفحه اصلی شما همیشه در آدرس ریشه در دسترس است */}
            <Route path='/' element={<Home />} />

            {/* یک صفحه جدید برای انتخاب و ساخت مچ‌ها */}
            <Route path='/matches' element={<MatchSelector />} />
            <Route path="/overall" element={<OverallTable />} />

            {/* بقیه روت‌های شما */}
            <Route path='/table' element={<Table />} />
            <Route path='/control' element={<Control />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </div>
      </Router>
    </MatchProvider>
  );
}

export default App;