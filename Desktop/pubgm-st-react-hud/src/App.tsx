import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './HUD/Home';
import Control from './HUD/Control/Control';
import Table from './HUD/Table/Table';
import ElimBroadcast from './HUD/ElimBroadcast/ElimBroacast';
import { AdminPanel } from './HUD/AdminPanel/AdminPanel';

function App() {
    return (
        <Router>
            <div>
                <Routes>
                    <Route path='/' element={<Home />} />
                    <Route path='/table' element={<Table />} />
                    <Route path='/control' element={<Control />} />
                    <Route path='/broadcast' element={<ElimBroadcast />} />
                    <Route path="/admin" element={<AdminPanel />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;