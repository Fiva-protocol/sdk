import './App.css';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import FivaDemo from './components/FivaDemo/FivaDemo';

function App() {
    return (
        <TonConnectUIProvider manifestUrl="https://raw.githubusercontent.com/Fiva-protocol/jettons-manifest/refs/heads/main/manifest/manifest.json">
            <div className="app">
                <Header />
                <FivaDemo />
                <Footer />
            </div>
        </TonConnectUIProvider>
    );
}

export default App;
