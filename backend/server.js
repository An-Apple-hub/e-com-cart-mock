const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());


const db = new sqlite3.Database('./cart.db', (err) => {
    if (err) return console.error("DB Error:", err.message);
    console.log('Connected to the SQLite database.');

    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL
    )`, (err) => {
        if (err) return console.error("Table Creation Error:", err.message);
        console.log('Products table checked/created.');
        insertMockProducts();
    });
});

function insertMockProducts() {
    const products = [
        { id: 1, name: 'Top', price: 1000 },
        { id: 2, name: 'Jeans', price: 2000 },
        { id: 3, name: 'Jewelery', price: 500 },
        { id: 4, name: 'Shoes', price: 3000 },
        { id: 5, name: 'Bags', price: 5000 }
    ];

    db.get('SELECT COUNT(*) AS count FROM products', (err, row) => {
        if (row.count === 0) {
            const stmt = db.prepare('INSERT INTO products (id, name, price) VALUES (?, ?, ?)');
            products.forEach(p => stmt.run(p.id, p.name, p.price));
            stmt.finalize();
            console.log('Inserted mock product data.');
        }
    });
}


// THIS IS CRITICAL FOR THE LATER ROUTES TO WORK
let cartItems = [];

// --- HELPER FUNCTION:  it calculate totals (CRITICAL) ---
function calculateTotal(items) {
    return items.reduce((sum, item) => sum + (item.price * item.qty), 0).toFixed(2);
}



// 1. GET 
app.get('/api/products', (req, res) => {
    db.all('SELECT * FROM products', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. POST  Add or Update item
app.post('/api/cart', (req, res) => {
    const { productId, qty } = req.body;
    if (!productId || !qty) {
        return res.status(400).json({ message: 'productId and qty are required.' });
    }

    db.get('SELECT id, name, price FROM products WHERE id = ?', [productId], (err, product) => {
        if (err || !product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        const existingItemIndex = cartItems.findIndex(item => item.id === productId);

        if (existingItemIndex > -1) {
            cartItems[existingItemIndex].qty += qty;
        } else {
            cartItems.push({
                id: product.id,
                name: product.name,
                price: product.price,
                qty: qty
            });
        }
        res.json({ message: 'Item added/updated successfully', cart: cartItems });
    });
});

// 3. DELETE  Remove item
app.delete('/api/cart/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const initialLength = cartItems.length;
    cartItems = cartItems.filter(item => item.id !== id);

    if (cartItems.length < initialLength) {
        return res.json({ message: 'Item removed successfully', cart: cartItems });
    }
    res.status(404).json({ message: 'Item not found in cart.' });
});

// GET 
app.get('/api/cart', (req, res) => {
    const total = calculateTotal(cartItems);
    res.json({ items: cartItems, total: total });
});

// 5. POST  Mock receipt
app.post('/api/checkout', (req, res) => {
    const finalTotal = calculateTotal(cartItems);

    if (cartItems.length === 0) {
        return res.status(400).json({ message: 'Cart is empty. Cannot checkout.' });
    }

    const receipt = {
        orderId: `ORDER-${Date.now()}`,
        total: finalTotal,
        timestamp: new Date().toISOString(),
        items: cartItems.map(item => ({ name: item.name, qty: item.qty, price: item.price })),
    };

    cartItems = [];

    res.json(receipt);
});


app.listen(PORT, () => {
    console.log(`🚀 Backend Server running on http://localhost:${PORT}`);
});