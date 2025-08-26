import { useEffect, useState } from 'react';
import './App.css';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import FivaDemo from './components/FivaDemo/FivaDemo';
import { initTelegramWebApp, applyTelegramTheme, TelegramWebAppManager, TelegramAuthData } from './utils/telegramAuth';

function App() {
    const [telegramAuth, setTelegramAuth] = useState<TelegramAuthData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Initialize Telegram WebApp Manager
        const tgManager = TelegramWebAppManager.getInstance();
        tgManager.initialize();
        
        // Initialize Telegram Web App and get auth data
        const authData = initTelegramWebApp();
        setTelegramAuth(authData);
        
        // Apply Telegram theme
        applyTelegramTheme();
        
        setIsLoading(false);
        
        // Log initialization status
        console.log('Telegram WebApp Status:', {
            isInitialized: tgManager.isInitialized(),
            authData: authData ? 'Available' : 'Fallback',
            userName: authData?.user.first_name || 'Unknown'
        });
    }, []);

    if (isLoading) {
        return (
            <div className="app loading">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Initializing Telegram Web App...</p>
                </div>
            </div>
        );
    }

    if (!telegramAuth) {
        return (
            <div className="app error">
                <div className="error-message">
                    <h2>Authentication Error</h2>
                    <p>Unable to authenticate with Telegram. Please try again.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="app">
            <Header telegramAuth={telegramAuth} />
            <FivaDemo telegramAuth={telegramAuth} />
            <Footer />
        </div>
    );
}

export default App;