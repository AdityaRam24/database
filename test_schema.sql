CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Intentionally using INT for boolean-like status
CREATE TABLE user_profiles (
    user_id INT PRIMARY KEY,
    bio TEXT,
    is_active INT DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category_id INT
);

-- Intentionally using TEXT for a short string
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

-- Orders table missing index on user_id to trigger predictive indexing
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Order items missing index on order_id and product_id
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Inserting dummy data
INSERT INTO users (username, email) VALUES 
('alice', 'alice@example.com'),
('bob', 'bob@example.com');

INSERT INTO categories (name) VALUES 
('Electronics'),
('Books');

INSERT INTO products (name, description, price, category_id) VALUES 
('Laptop', 'High-end laptop', 1200.00, 1),
('Novel', 'Sci-fi novel', 15.00, 2);

INSERT INTO orders (user_id, total_amount, status) VALUES 
(1, 1200.00, 'completed'),
(2, 15.00, 'pending');

INSERT INTO order_items (order_id, product_id, quantity, price) VALUES 
(1, 1, 1, 1200.00),
(2, 2, 1, 15.00);
