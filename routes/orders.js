const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const express = require('express');
const pool = require('../db/pool');
const router = express.Router();
const nodemailer = require('nodemailer');



// Функция для нормализации номера телефона
function normalizePhone(phone) {
    // Убираем все нецифровые символы кроме плюса
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // Если номер начинается с +7, заменяем на 8
    if (cleaned.startsWith('+7')) {
        cleaned = '8' + cleaned.substring(2);
    }
    // Если номер начинается с 7 (без плюса), заменяем на 8
    else if (cleaned.startsWith('7') && !cleaned.startsWith('+')) {
        cleaned = '8' + cleaned.substring(1);
    }
    
    return cleaned;
}

async function sendOrderNotification(orderData, customer, items) {
    try {
        console.log('📧 Начинаем отправку уведомления о заказе...');
        
        // Проверяем наличие переменных окружения
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.error('❌ EMAIL_USER или EMAIL_PASS не установлены в .env');
            return false;
        }

        console.log('🔐 Настройка SMTP транспорта...');
        const transporter = nodemailer.createTransport({
            host: 'smtp.mail.ru',
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            connectionTimeout: 10000, // 10 секунд
            greetingTimeout: 10000,
            socketTimeout: 10000
        });

        console.log('🔍 Проверяем SMTP подключение...');
        await transporter.verify();
        console.log('✅ SMTP подключение успешно');

        // Формируем детали товаров
        let itemsHTML = '';
        let totalAmount = 0;

        for (let item of items) {
            const productResult = await pool.query(
                'SELECT name, price FROM products WHERE id = $1',
                [item.product_id]
            );
            const product = productResult.rows[0];
            const itemTotal = item.quantity * (product?.price || 0);
            totalAmount += itemTotal;

            itemsHTML += `
                <tr>
                    <td>${product?.name || `Товар #${item.product_id}`}</td>
                    <td>${item.quantity} шт.</td>
                    <td>${product?.price || 0} ₽</td>
                    <td>${itemTotal} ₽</td>
                </tr>
            `;
        }

        const mailOptions = {
            from: `"Магазин сувениров" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER, // Отправляем самому себе
            subject: `🛍️ Новый заказ #${orderData.order_id}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #F5691E;">Новый заказ #${orderData.order_id}</h1>
                    
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <h3>Информация о клиенте:</h3>
                        <p><strong>Имя:</strong> ${customer.name}</p>
                        <p><strong>Телефон:</strong> ${customer.phone}</p>
                        <p><strong>Email:</strong> ${customer.email}</p>
                        ${customer.comment ? `<p><strong>Комментарий:</strong> ${customer.comment}</p>` : ''}
                    </div>

                    <h3>Состав заказа:</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #e0e0e0;">
                                <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Товар</th>
                                <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">Кол-во</th>
                                <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Цена</th>
                                <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Сумма</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHTML}
                        </tbody>
                        <tfoot>
                            <tr style="background: #f0f0f0;">
                                <td colspan="3" style="padding: 10px; text-align: right; border: 1px solid #ddd; font-weight: bold;">Итого:</td>
                                <td style="padding: 10px; text-align: right; border: 1px solid #ddd; font-weight: bold;">${totalAmount} ₽</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div style="margin-top: 20px; padding: 15px; background: #e8f5e8; border-radius: 5px;">
                        <p><strong>Дата заказа:</strong> ${new Date().toLocaleString('ru-RU')}</p>
                        <p><em>Заказ создан автоматически</em></p>
                    </div>
                </div>
            `
        };

        console.log('📤 Отправляем письмо...');
        const result = await transporter.sendMail(mailOptions);
        console.log('✅ Письмо успешно отправлено! ID:', result.messageId);
        return true;
        
    } catch (error) {
        console.error('❌ Ошибка отправки email:', error.message);
        console.error('Детали ошибки:', error);
        return false;
    }
}




// GET /api/orders?phone=... - заказы по телефону (для клиентов)
router.get('/', async (req, res) => {
    try {
        const { phone } = req.query;

        // Если передан телефон - ищем заказы пользователя
        if (phone) {
            const normalizedPhone = normalizePhone(phone);
            
            console.log('🔍 Поиск заказов по телефону:', {
                исходный: phone,
                Нормализованный: normalizedPhone
            });
            
            // Более строгий поиск - ищем точное совпадение цифр телефона
            const result = await pool.query(`
                SELECT 
                    o.*,
                    u.email,
                    u.full_name,
                    u.phone
                FROM orders o
                LEFT JOIN users u ON o.user_id = u.id
                WHERE u.normalized_phone = $1
                ORDER BY o.created_at DESC
            `, [normalizedPhone]);

            console.log(`📦 Найдено заказов: ${result.rows.length}`);
            return res.json(result.rows);
        }

        // Иначе возвращаем все заказы (для админа)
        console.log('👨‍💼 Запрос всех заказов (админ)');
        const result = await pool.query(`
            SELECT 
                o.*,
                u.email,
                u.full_name,
                u.phone
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            ORDER BY o.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Ошибка получения заказов:', err);
        res.status(500).json({ 
            success: false,
            error: err.message 
        });
    }
});

// POST /api/orders - создание заказа
router.post('/', async (req, res) => {
    const { 
        customer_name, 
        customer_email, 
        customer_phone, 
        comment, 
        items 
    } = req.body;

    console.log('📦 Создание заказа:', { 
        customer_name, 
        customer_email,
        customer_phone,
        items: items?.length 
    });
    
    // Валидация
    if (!items || items.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Корзина пуста'
        });
    }

    if (!customer_name || !customer_email || !customer_phone) {
        return res.status(400).json({
            success: false,
            error: 'Заполните обязательные поля'
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        
        const normalizedPhone = normalizePhone(customer_phone);
        console.log('Нормализованный Телефон:', normalizedPhone);

        let userId = null;

        // Ищем или создаём пользователя
        const userResult = await client.query(
            `SELECT id FROM users
            WHERE normalized_phone = $1 OR email = $2`,
            [normalizedPhone, customer_email]
        );

        if (userResult.rows.length > 0) {
            // Пользователь существует
            userId = userResult.rows[0].id;
            // Обновляем данные пользователя
            await client.query(
                'UPDATE users SET full_name = $1, phone = $2, normalized_phone = $3 WHERE id = $4',
                [customer_name, customer_phone, normalizedPhone, userId]
            );
        } else {
            // Создаём нового пользователя
            const newUserResult = await client.query(
                'INSERT INTO users (email, full_name, phone, normalized_phone) VALUES ($1, $2, $3, $4) RETURNING id',
                [customer_email, customer_name, customer_phone, normalizedPhone]
            );
            userId = newUserResult.rows[0].id;
        }

        // Создаём заказ
        const orderResult = await client.query(
            `INSERT INTO orders (user_id, total_amount, status) 
            VALUES ($1, $2, $3) RETURNING id`,
            [userId, 0, 'new']
        );  
        
        const orderId = orderResult.rows[0].id;

        // Добавляем товары в заказ и считаем общую сумму
        let totalAmount = 0;
        for (let item of items) {
            // Получаем актуальную цену товара
            const productResult = await client.query(
                'SELECT price, stock, name FROM products WHERE id = $1',
                [item.product_id]
            );

            if (productResult.rows.length === 0) {
                throw new Error(`Товар с ID ${item.product_id} не найден`);
            }

            const product = productResult.rows[0];
            const productPrice = product.price;
            const itemTotal = productPrice * item.quantity;
            totalAmount += itemTotal;

            // Проверяем остатки
            if (product.stock < item.quantity) {
                throw new Error(`Недостаточно товара "${product.name}" на складе. Доступно: ${product.stock}`);
            }

            // Добавляем в order_items
            await client.query(
                `INSERT INTO order_items (order_id, product_id, quantity, price) 
                VALUES ($1, $2, $3, $4)`,
                [orderId, item.product_id, item.quantity, productPrice]
            );

            // Обновляем остатки
            await client.query(
                'UPDATE products SET stock = stock - $1 WHERE id = $2',
                [item.quantity, item.product_id]
            );
        }

        // Обновляем общую сумму заказа
        await client.query(
            'UPDATE orders SET total_amount = $1 WHERE id = $2',
            [totalAmount, orderId]
        );

        await client.query('COMMIT');
        
        console.log('✅ Заказ создан:', orderId);
        
        try {
            const emailSent = await sendOrderNotification(
                {
                    order_id: orderId,
                    total_amount: totalAmount
                },
                {
                    name: customer_name,
                    phone: customer_phone,
                    email: customer_email,
                    comment: comment
                },items
            );

            if (!emailSent) {
                console.warn(`Заказ создан но email не отправлен`);
            }
        } catch (emailError) {
            console.warn(`Ошибка отправки email`, emailError.message);
        }
    
        
        res.json({ 
            success: true,
            order_id: orderId, 
            total_amount: totalAmount,
            status: 'created'
        });
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Ошибка создания заказа:', err);
        res.status(500).json({ 
            success: false,
            error: err.message 
        });
    } finally {
        client.release();
    }
});

// GET /api/orders/:id - детали заказа
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
    
        // Получаем заказ
        const orderResult = await pool.query(`
            SELECT 
                o.*,
                u.email,
                u.full_name,
                u.phone
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            WHERE o.id = $1
        `, [id]);
    
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'Заказ не найден' 
            });
        }

        // Получаем товары заказа
        const itemsResult = await pool.query(`
            SELECT 
                oi.*,
                p.name as product_name,
                p.image_url
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = $1
        `, [id]);

        res.json({
            success: true,
            order: orderResult.rows[0],
            items: itemsResult.rows
        });
    
    } catch (err) {
        console.error('❌ Ошибка получения заказа:', err);
        res.status(500).json({ 
            success: false,
            error: err.message 
        });
    }
});

// PATCH /api/orders/:id - обновление статуса заказа
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                error: 'Статус не указан'
            });
        }

        const result = await pool.query(
            'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Заказ не найден'
            });
        }

        res.json({
            success: true,
            order: result.rows[0]
        });

    } catch (err) {
        console.error('❌ Ошибка обновления заказа:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

module.exports = router;