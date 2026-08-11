E-Commerce Platform

I want to build an ecommerce plaftorm for my business that sells various Products (Local & Imported Products) that contains 2 sections (Client View & Dashboard Admin)

Client:

- Appealing Modern & Classy Design (UI & UX) - Responsive on different devices (Reference Image will be attached)
- Login Page / Register Page / Reset Password
- New Products Section | Featured Product | Last Chance Products | Most Searched Products
- View All Products
- Search bar to search Product By Name (Show Suggestion while typing)
- View Categories & Sub Categories
- Filter System: Filter By Price Range, Category, Sub Category, Availability
- View Cart & Add to Cart (Include Promo code) & Update Quantity If needed & Remove Item From Cart
- Checkout Section (With One Payment Option => Pay on delivery)

Admin Dashboard:

- Appealing Modern & Classy Design (UI & UX) - Responsive on different devices
- Dashboard Containing Welcoming Hero Section & Statistics & Chart (Number of clients, number of orders per day, per week, per month, per year filter) - Finances Statistics based on order, orders by status (Canceled, Pending, Confirmed), etc...
- 2 Main Actors/Roles: Admin & Sub Admins
  ** Admin can basically do anything in the dashboard
  ** Sub Admin can view anything but can only change order status, and can only change quantity on products
- Sidebar options will be divides into 2 blocks (Dashboard & Settings) - Two States (Opened & Collapsed)
  \*\* Block `Dashboard` Contains the following
- Clients: View Clients List, View Clients Account Details, Archive Client, Update Client
- Products: View Products List, Add Product ,View Products Details, Archive Product, Update Product (Sub admin can only update quantity and nothing else)
- Orders: View Orders List, Add Order Manually ,View Order Details, Change Order Status (Affect Ordered Products Quantity Automatically when Status is Confirmed, Readd Quantity when order is cancelled), Update Order, Archive Order, View Invoice and possibility to print
- Categories: Add Categories (including sub categories if exist ), View Category Details, Update Category, Archive Category
  \*\* Block `Settings` Contains the following
- Sub Admins (Can only be seen by admin): Add Sub Admins, View Sub Admin Details, Update Sub Admins, Archive Sub Admins
- Parameters: Including Global Parameters such as dynamic social media link (Facebook, Tiktok ,Instagram, etc...), Delivery Cost (numeric field), Copyright field, Website Description, Keywords, Free Delivery on Order Amount Field (Numerical Field) to make delivery free, etc...

- Product is defined by:

* Reference
* Images (Minimum one)
* Description
* Quantity
* Price
* Discount
* Category
* Sub Category (Optional means product can have only a category)

- Add Notification System & Push Notification when New order is received

- Platform should be developed using next js (Front & Backend)
- Platform should be in two languages (French (Main) & Arabic)
- Support RTL
- Support Dark Mode
- Fluid UX
- Responsive on All Devices

- Info on Discount:
  Discount can be applied per product or per mass (mean One value applied to all products and can remove discount with one click from all products)

- Delivery Cost: Will be included to the Order Amount Price when checking out and will only be free when `Free Delivery on Order Amount` Reached.
