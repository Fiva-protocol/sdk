import React from 'react';
import { TelegramAuthData } from '../../utils/telegramAuth';
import './header.css';

interface HeaderProps {
    telegramAuth: TelegramAuthData;
}

const Header: React.FC<HeaderProps> = ({ telegramAuth }) => {
    const { user } = telegramAuth;
    const displayName = user.username ? `@${user.username}` : `${user.first_name} ${user.last_name || ''}`.trim();

    return (
        <header className="header">
            <div className="header-content">
                <div className="app-title">
                    <h1>Fiva SDK</h1>
                    <span className="subtitle">Account Abstraction Demo</span>
                </div>
                
                <div className="user-info">
                    <div className="user-avatar">
                        {user.photo_url ? (
                            <img src={user.photo_url} alt={user.first_name} />
                        ) : (
                            <div className="avatar-placeholder">
                                {user.first_name.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div className="user-details">
                        <div className="user-name">{displayName}</div>
                        <div className="user-id">ID: {user.id}</div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;