const bcrypt = require('bcrypt');
const jwt  = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ed8bc1edd1aa779522dfe3aae2ca1c0191c1dd41f78984392149784e8d74e7b31b5516177a0164f052b66edd2a2040e0f4cc6e18cd8e2a12159319daed478e95'


const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({error: 'Токен отсутсвует!'});
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({error: 'Неверный токен!'});
        }
        req.user = user;
        next();
    });
};

module.exports = {authenticateToken, JWT_SECRET, bcrypt};