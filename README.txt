# Coffee Clean Project

A web-based digital menu and order management system.

## 📁 Project Structure
Main files included in this project:
- `index.html` - Customer-facing interface.
- `dashboard.html` - Cashier/Admin dashboard.
- `css/` - Stylesheets (`style.css`, `dashboard.css`).
- `js/` - Core logic (`config.js`, `products.js`, `orders.js`, `menu.js`, `dashboard.js`).
- `images/` - Directory for all product and UI images.

## ⚙️ Configuration & Maintenance
- **Products Management:** Add or edit products exclusively in `js/products.js`.
- **Order Reset:** Business day order numbers automatically reset at **2:00 AM (Turkey Time)** via `js/orders.js`.
