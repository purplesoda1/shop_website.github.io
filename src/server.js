require('dotenv').config();

const express = require('express');
const productsRouter = require('../routes/products');
const ordersRouter = require('../routes/orders');
const cors = require('cors');
const { authenticateToken, JWT_SECRET, bcrypt } = require('./middleware/auth');

const path = require('path');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const app = express();

app.use(express.static('src'));
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, '../..')));
app.use(express.static(path.join(__dirname, '..')));


app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../Beta1.1.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin/admin.html'));
});

app.post('/api/admin/login', async (req, res) => {
    try {
        const {username, password} =req.body;

        const result = await pool.query(
            'SELECT * FROM admins WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({error: 'Неверные учетные данные'});
        }

        const admin = result.rows[0];
        const validPassword = await bcrypt.compare(password, admin.password_hash);

        if (!validPassword) {
            return res.status(401).json({error: 'Неверные учетные данные'});
        }

        const token = jwt.sign(
            { id: admin.id, username: admin.username},
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({token, username: admin.username});
    } catch (error) {
        res.status(500).json({ error: error.message});
    }
});


app.post('/api/admin/products', authenticateToken, async (req, res) => {
    try {
        const { name, price, stock, description, image_url } = req.body;

        if (!name || !price || !stock) {
            console.log('❌ Неполные данные:', { name, price, stock });
            return res.status(400).json({ error: 'Неполные данные товара' });
        }

        console.log('📦 Вставляем в БД...');
        const result = await pool.query(
            `INSERT INTO products (name, price, stock, description, image_url)
            VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [name, price, stock, description, image_url]
        );

        console.log('✅ Товар добавлен, ID:', result.rows[0].id);
        res.json(result.rows[0]);

    } catch (error) {
        console.error('❌ Ошибка добавления товара:', error);
        res.status(500).json({error: error.message});
    }
});

app.get('/api/admin/products', authenticateToken, async(req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products ORDER BY id');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

app.delete('/api/admin/products/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`Запрос на удаление товара ID: ${id}`);

        const result = await pool.query(
            'DELETE FROM products WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Товар не найден'
            });
        }

        console.log('Товар удален:', result.rows[0].name);
        
        res.json({
            success: true,
            message: 'Товар успешно удален',
            product: result.rows[0]
        });
    } catch (error) {
        console.error('Ошибка удаления товара', error);

        if (error.code === '23503') {
            return res.status(400).json({
                success: false,
                error: 'Невозможно удалить товар, он присутствует в заказах'
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Эндпоинт для обновления остатков товара
app.patch('/api/admin/products/:id/stock', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { stock } = req.body;

        console.log(`📦 Обновление остатков товара ID: ${id}, новое количество: ${stock}`);

        if (stock === undefined || stock < 0) {
            return res.status(400).json({ error: 'Некорректное количество' });
        }

        const result = await pool.query(
            'UPDATE products SET stock = $1 WHERE id = $2 RETURNING *',
            [stock, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        console.log(`✅ Остатки обновлены: ${result.rows[0].name} - ${stock} шт.`);
        
        res.json({
            success: true,
            message: 'Остатки обновлены',
            product: result.rows[0]
        });

    } catch (error) {
        console.error('❌ Ошибка обновления остатков:', error);
        res.status(500).json({ error: error.message });
    }
});

// Эндпоинт для получения товара по ID
app.get('/api/admin/products/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            'SELECT * FROM products WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('❌ Ошибка получения товара:', error);
        res.status(500).json({ error: error.message });
    }
});

// Эндпоинт для обновления товара
app.put('/api/admin/products/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, stock, description, image_url } = req.body;

        if (!name || !price || !stock) {
            return res.status(400).json({ error: 'Неполные данные товара' });
        }

        console.log(`✏️ Обновление товара ID: ${id}`);

        const result = await pool.query(
            `UPDATE products 
            SET name = $1, price = $2, stock = $3, description = $4, image_url = $5
            WHERE id = $6 RETURNING *`,
            [name, price, stock, description, image_url, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        console.log(`✅ Товар обновлен: ${result.rows[0].name}`);
        res.json(result.rows[0]);

    } catch (error) {
        console.error('❌ Ошибка обновления товара:', error);
        res.status(500).json({ error: error.message });
    }
});



app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);

app.get('/api/test', (req, res) => {
    res.json({message: 'API Работает!'});
});

app.listen(3000, () => {
    console.log('Сервер запущен на http://localhost:3000')
})

