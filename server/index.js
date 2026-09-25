const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

const { authenticateJWT, authorizeRole } = require('./authManager');
const { getBots, saveBots, startBot, stopBot, restartBot, createBot, updateBot, deleteBot } = require('./botManager');
const { auditLog, getAuditLogs } = require('./auditLogger');
const { sendEmail } = require('./mailer');

const app = express();
const port = process.env.PORT || 3000;

// 定義 READ_ONLY 環境變數開關
const READ_ONLY = process.env.READ_ONLY === 'true';

app.use(cors());
app.use(express.json());

// Read-Only 模式中間件：攔截所有寫入請求
app.use((req, res, next) => {
    const isRegisterPost = req.path === '/api/auth/register' && req.method === 'POST';
    const isLoginPost = req.path === '/api/auth/login' && req.method === 'POST';

    if (READ_ONLY && ['POST', 'PUT', 'DELETE'].includes(req.method) && !isLoginPost) {
        if (isRegisterPost) {
            auditLog('WARN', 'Attempted to register user in Read-Only mode', req.ip);
            return res.status(403).json({ message: 'Operation not allowed in read-only mode: User registration is disabled.' });
        }
        auditLog('WARN', `Attempted ${req.method} on ${req.path} in Read-Only mode`, req.ip);
        return res.status(403).json({ message: 'Operation not allowed in read-only mode.' });
    }
    next();
});

// 前端查詢 Read-Only 狀態的 API
app.get('/api/status/read-only', (req, res) => {
    res.json({ readOnly: READ_ONLY });
});

// 靜態檔案與 SPA 路由
app.use(express.static(path.join(__dirname, '..', 'dist')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// 錯誤處理
app.use((err, req, res, next) => {
    console.error(err.stack);
    auditLog('ERROR', `Server error: ${err.message}`, req.ip);
    res.status(500).send('Something broke!');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    if (READ_ONLY) {
        console.warn('--- Server is running in READ-ONLY mode ---');
    }
});