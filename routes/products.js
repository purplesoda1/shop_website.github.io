const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        console.log('Запрос товаров из БД...');
        const result = await pool.query(`
            SELECT * FROM products
            WHERE stock > 0
            ORDER BY id
        `);
        console.log(`Найдено товаров: ${result.rows.length}`);

        result.rows.forEach((product, index) => {
            console.log(`   ${index + 1}. ID: ${product.id}, Название: "${product.name}", Stock: ${product.stock}`);
        });


        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка БД:', err);
        res.status(500).json({
            error: 'Ошибка сервера',
            details: err.message
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT * FROM products
            WHERE id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({error: 'Товар не найден'});
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Ошибка:', err);
        res.status(500).json({error: err.message});
    }
});



router.delete('/:id', async (req, res) => {
    try { 
        const { id } = req.params;

        console.log(`Удаление товара ID: ${id}`);

        const orderCheck = await pool.query(
            'SELECT COUNT(*) FROM order_items WHERE product_id = $1',
            [id]
        );

        const orderCount = parseInt(orderCheck.rows[0].count);

        if (orderCount > 0 ) {
            return res.status(400).json({
                success: false,
                error: `Невозможно удалить товар, он присутствует в ${orderCount} заказах`
            });
        }

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
        
        console.log(`Товар удален: ${result.rows[0].name}`);

        res.json({
            success: true,
            message: 'Товар успешно удален',
            product: result.rows[0]
        });
    } catch (err) {
        console.error('Ошибка Удаления товара', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

module.exports = router