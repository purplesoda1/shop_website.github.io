let authToken = null;

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const loginData = {
        username: formData.get('username'),
        password: formData.get('password')
    };

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(loginData)
        });

        if (response.ok) {
            const data = await response.json();
            authToken = data.token;
            localStorage.setItem('adminToken', authToken);
            showAdminPanel();
        } else {
            const error = await response.json();
            showError(error.error);
        }
    } catch (error) {
        showError('Ошибка сети');
    }
});

document.getElementById('addProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🔄 1. Форма добавления товара отправлена');

    if (!authToken) {
        showError('Сначала войдите в систему!');
        return;
    }

    const formData = new FormData(e.target);
    const price = parseFloat(formData.get('price'));
    const stock = parseInt(formData.get('stock'));

    if (price <= 0) {
        alert('❌ Цена должна быть больше 0!');
        return;
    }

    if (stock < 0) {
        alert('❌ Количество не может быть отрицательным!');
        return;
    }


    const productData = {
        name: formData.get('name'),
        price: parseFloat(formData.get('price')),
        stock: parseInt(formData.get('stock')),
        description: formData.get('description'),
        image_url: formData.get('image_url')
    };

    if (!productData.name) {
        alert('❌ Введите название товара!');
        return;
    }

    try {
        const response = await fetch('/api/admin/products', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(productData)
        });

        if (response.ok) {
            alert('✅ Товар добавлен!');
            e.target.reset();
            loadProducts();
        } else {
            showError('Ошибка добавление товара');
        }
    } catch (error) {
        showError('Ошибка сети');
    }
});

async function loadProducts() {
    if (!authToken) return;

    try {
        const response = await fetch('/api/admin/products', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const products = await response.json();
            displayProducts(products);
        }
    } catch (error) {
        console.error('Ошибка загрузки товаров', error);
    }
}

function displayProducts(products) {
    const container = document.getElementById('productsContainer');
    const sortedProducts = products.sort((a,b) => a.id - b.id);

    container.innerHTML = products.map(product => `
        <div class="product-card">
            <h4>${product.name}</h4>
            <p>💰 Цена: ${product.price} ₽</p>
            
            <p>📦 В наличии: ${product.stock} шт.</p>
            <p>${product.description || 'Нет описания'}</p>
            <small>ID: ${product.id}</small>
            <div class="product-actions">
                <button class="edit-btn" onclick="openEditModal(${product.id})">
                    ✏️ Редактировать
                </button>
                <button class="delete-btn" onclick="deleteProduct(${product.id}, '${product.name.replace(/'/g, "\\'")}')">
                    🗑️ Удалить
                </button>
            </div>
        </div>`
    ).join('');
}

async function deleteProduct(productId, productName) {
    if (!authToken) {
        alert('Сначала войдите в систему!');
        return;
    }

    if (!confirm(`Вы уверены, что хотите удалить товар "${productName}"?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/products/${productId}`, {
            method: 'DELETE',
            headers:{
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (response.ok && result.success) {
            alert(`Товар "${productName}" успешно удален!`);
            loadProducts();
        } else {
            alert(`Ошибка: ${result.error || 'Неизвестная ошибка'}`);
        }
    } catch (error) {
        console.error('Ошибка удаления товара:', error);
        alert('Ошибка сети при удалении товара');
    }
}

async function updateProductStock(productId, currentStock) {
    const newStock = prompt(`Введите новое количество для товара ID: ${productId}`, currentStock);
    
    if (newStock === null) return; // Отмена
    
    const stock = parseInt(newStock);
    if (isNaN(stock) || stock < 0) {
        alert('Введите корректное число!');
        return;
    }

    try {
        const response = await fetch(`/api/admin/products/${productId}/stock`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ stock: stock })
        });

        if (response.ok) {
            const result = await response.json();
            alert(`✅ Остатки обновлены: ${result.product.stock} шт.`);
            loadProducts(); // Перезагружаем список
        } else {
            const error = await response.json();
            alert(`❌ Ошибка: ${error.error}`);
        }
    } catch (error) {
        alert('❌ Ошибка сети');
    }
}

async function updateStock() {
    const productId = document.getElementById('stockProductId').value;
    const quantity = document.getElementById('stockQuantity').value;
    const messageEl = document.getElementById('stockMessage');

    if (!productId || !quantity) {
        showStockMessage('Заполните все поля!', 'error');
        return;
    }

    if (isNaN(quantity) || quantity < 0) {
        showStockMessage('Введите корректное количество (0 или больше)!', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/admin/products/${productId}/stock`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ stock: parseInt(quantity) })
        });

        if (response.ok) {
            const result = await response.json();
            showStockMessage(`✅ Остатки обновлены: ${result.product.name} - ${result.product.stock} шт.`, 'success');
            document.getElementById('stockProductId').value = '';
            document.getElementById('stockQuantity').value = '';
            loadProducts(); // Перезагружаем список товаров
        } else {
            const error = await response.json();
            showStockMessage(`❌ Ошибка: ${error.error}`, 'error');
        }
    } catch (error) {
        showStockMessage('❌ Ошибка сети', 'error');
    }
}

async function openEditModal(productId) {
    try {
        // Загружаем данные товара
        const response = await fetch(`/api/admin/products/${productId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка загрузки товара');
        }

        const product = await response.json();

        // Заполняем форму данными
        document.getElementById('editProductId').value = product.id;
        document.getElementById('editName').value = product.name;
        document.getElementById('editPrice').value = product.price;
        document.getElementById('editStock').value = product.stock;
        document.getElementById('editImageUrl').value = product.image_url || '';
        document.getElementById('editDescription').value = product.description || '';

        // Показываем модалку
        document.getElementById('editModalOverlay').style.display = 'flex';

    } catch (error) {
        alert('Ошибка загрузки товара: ' + error.message);
    }
}

function closeEditModal() {
    document.getElementById('editModalOverlay').style.display = 'none';
}

// Обработчики закрытия модалки
document.getElementById('closeEditModal').addEventListener('click', closeEditModal);
document.getElementById('cancelEdit').addEventListener('click', closeEditModal);

// Закрытие по клику вне модалки
document.getElementById('editModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'editModalOverlay') {
        closeEditModal();
    }
});

function showStockMessage(message, type) {
    const messageEl = document.getElementById('stockMessage');
    messageEl.textContent = message;
    messageEl.style.display = 'block';
    messageEl.style.color = type === 'success' ? '#4CAF50' : '#ff4444';
    
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 5000);
}


function showAdminPanel() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadProducts();
}

function logout() {
    authToken = null;
    localStorage.removeItem('adminToken');
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('loginPage').style.display = 'block';
}

function showError(message) {
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

document.getElementById('editProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const productId = document.getElementById('editProductId').value;
    const price = parseFloat(document.getElementById('editPrice').value);
    const stock = parseInt(document.getElementById('editStock').value);

    if (price <= 0) {
        alert('Цена должна быть больше 0!');
        document.getElementById('editPrice').focus();
        return;
    }

    if (stock < 0) {
        alert('Количество не может быть отрицательным!');
        document.getElementById('editStock').focus();
        return;
    }

    const productData = {
        name: document.getElementById('editName').value,
        price: parseFloat(document.getElementById('editPrice').value),
        stock: parseInt(document.getElementById('editStock').value),
        image_url: document.getElementById('editImageUrl').value,
        description: document.getElementById('editDescription').value
    };

    if (!productData.name) {
        alert('❌ Введите название товара!');
        document.getElementById('editName').focus();
        return;
    }

    try {
        const response = await fetch(`/api/admin/products/${productId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(productData)
        });

        if (response.ok) {
            alert('✅ Товар успешно обновлен!');
            closeEditModal();
            loadProducts(); // Перезагружаем список
        } else {
            const error = await response.json();
            alert('❌ Ошибка: ' + error.error);
        }
    } catch (error) {
        alert('❌ Ошибка сети');
    }
});


document.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('adminToken');
    if (savedToken) {
        authToken = savedToken;
        showAdminPanel();
    }
});

console.log('✅ admin.js загружен, версия 3');