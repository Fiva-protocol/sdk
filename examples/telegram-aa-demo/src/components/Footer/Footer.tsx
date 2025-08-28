import React from 'react';
import './footer.css';

const Footer: React.FC = () => {
    return (
        <footer className="footer">
            <div className="footer-content">
                <div className="footer-info">
                    <p>Powered by <strong>Fiva SDK</strong> with Account Abstraction</p>
                    <p className="footer-note">Secure transactions via Turnkey infrastructure</p>
                </div>
                <div className="footer-links">
                    <a href="https://thefiva.com" target="_blank" rel="noopener noreferrer">
                        Fiva Protocol
                    </a>
                    <a href="https://docs.thefiva.com" target="_blank" rel="noopener noreferrer">
                        Documentation
                    </a>
                    <a href="https://github.com/Fiva-protocol/sdk" target="_blank" rel="noopener noreferrer">
                        GitHub
                    </a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;