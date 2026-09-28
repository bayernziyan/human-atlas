import '../lib/i18n';
import i18n from '../lib/i18n';
import {createRoot} from 'react-dom/client';
import Home from '../app/page';
import '../app/globals.css';
document.documentElement.lang=i18n.language;
createRoot(document.getElementById('root')!).render(<Home/>);