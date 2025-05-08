import React from 'react';
import { TonConnectButton } from '@tonconnect/ui-react';
import './header.css';

const Header: React.FC = () => {
    return (
        <header className="header">
            <span>Fiva SDK Demo</span>
            <TonConnectButton />
        </header>
    );
};

export default Header;
