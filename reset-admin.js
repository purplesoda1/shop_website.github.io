const bcrypt = require('bcrypt');

async function resetAdmin() {
    const password = 'purplesoda1';
    const hash = await bcrypt.hash(password, 10);

    console.log('🔐 НОВЫЙ АДМИН:');
    console.log('Логин: admin');
    console.log('Пароль:', password);
    console.log('');
    console.log('📋 SQL ДЛЯ БАЗЫ:');
    console.log(`DELETE FROM admins;`);
    console.log(`INSERT INTO admins (username, password_hash) VALUES ('admin', '${hash}');`);
}

resetAdmin();