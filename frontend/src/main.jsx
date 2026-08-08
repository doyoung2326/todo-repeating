import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import UpdatePrompt from './components/UpdatePrompt';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    {/* 로그인 화면에서도 떠야 하므로 App 밖에 둔다 */}
    <UpdatePrompt />
  </React.StrictMode>
);
