import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root');
if (root === null) throw new Error('Wurzelelement fehlt');

createRoot(root).render(<App />);
