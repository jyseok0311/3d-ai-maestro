import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// No StrictMode: drei's <Html> portals warn about synchronous unmounts under
// React 19's double-mount in development.
createRoot(document.getElementById('root')!).render(<App />);
