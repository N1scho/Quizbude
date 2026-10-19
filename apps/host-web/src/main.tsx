import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root');
if (root === null) throw new Error('Wurzelelement fehlt');

// Bewusst ohne StrictMode: dessen doppelter Effektlauf würde in der
// Entwicklung zwei Räume anlegen.
createRoot(root).render(<App />);
