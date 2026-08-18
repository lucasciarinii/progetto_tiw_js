# 🧩 Product Configurator — TIW JavaScript Web Application

> **Information Technologies for the Web** — Politecnico di Milano  
> School of Industrial and Information Engineering  
> Bachelor's Degree in Computer Science and Engineering

**Academic Year:** 2025/2026  
**Grade:** 30/30  

---

## 📋 Overview

This project implements a **web-based product configurator** for managing hierarchical products, their components, and the Stock Keeping Units (SKUs) associated with simple products. The application supports two distinct user roles: **suppliers**, who define the product catalogue, and **customers**, who configure products by selecting one SKU for every simple component.

The published implementation is the **JavaScript version**, designed as a single-page web application with asynchronous client-server communication and partial user-interface updates. The backend is implemented in Java using Servlets and DAO classes, while the frontend uses HTML, CSS, and JavaScript to provide interactive catalogue management and product configuration workflows.

> **Note:** A separate **Pure HTML** version also exists. It is implemented with Servlets and traditional page reloads, but it is kept private because it is a simpler and less advanced implementation than the JavaScript version published in this repository.

---

## ⚙️ Supported Features

| Feature | Description |
|---------|-------------|
| **Role-Based Login** | Authenticates users with username and password and displays a role-specific interface |
| **Supplier Workspace** | Allows suppliers to create and manage SKUs, simple products, and hierarchical composite products |
| **Customer Workspace** | Allows customers to browse top-level products and create product configurations |
| **Hierarchical Product Model** | Represents composite products as nested structures containing simple or composite sub-products |
| **SKU Management** | Stores SKU codes, names, photographs, technical descriptions, and non-negative prices |
| **Asynchronous Requests** | Uses JavaScript requests to update only the portions of the page affected by an operation |
| **Inline Editing** | Makes displayed attributes editable directly from the single-page interface |
| **Product Search** | Performs case-insensitive searches across product and SKU names and descriptions |
| **Configuration Management** | Saves, displays, edits, clones, and deletes customer configurations |
| **Session Management** | Provides logout functionality and role-aware access control |

---

## 🔌 Roles and Interfaces

### Supplier Interface

After logging in, the supplier can manage the product catalogue through a single interactive interface.

#### SKU Management

The supplier can create a SKU by entering:

- Unique integer code
- Name
- Photograph
- Technical description
- Price

The new SKU is displayed after saving. In the JavaScript version, clicking an attribute allows inline editing, and the updated value is persisted when the pointer leaves the input field.

#### Simple Product Management

A simple product contains a unique code, a name, and one or more associated SKUs. The supplier can:

- Create a simple product.
- Associate one or more existing SKUs.
- Create a new SKU directly while editing a product.
- Add existing SKUs through a multiple-selection menu.
- Remove an SKU association without necessarily deleting the SKU.

#### Composite Product Management

A composite product contains:

- Unique code
- Name
- Description
- Minimum and maximum price range
- One or more simple or composite sub-products

The supplier can create and edit the hierarchy directly in the client interface. Products are displayed as a nested list, reflecting the complete structure of the composite product and its descendants.

Available controls include:

| Control | Behaviour |
|---------|-----------|
| `+` next to a composite product | Adds a composite or simple sub-product |
| `+` next to a simple product | Creates a new SKU or associates existing SKUs |
| `-` next to a nested product | Removes the relation with its parent while preserving the child product |
| `-*` next to a product | Recursively deletes the product and its sub-products |
| `-` next to an SKU | Removes the SKU-product association |
| `-*` next to an SKU | Deletes the SKU from the database |
| `SAVE PRODUCT` | Permanently persists the current client-side hierarchy |

The hierarchy is initially edited locally in the browser. The complete structure is sent to the server only when the supplier presses `SAVE PRODUCT`. If a simple product is missing an SKU, the application reports an error while preserving the data already entered on the client.

#### Product Search

The supplier can search for products and SKUs through a single input field. The search is:

- Case-insensitive.
- Applied to product names and descriptions.
- Applied to SKU names and technical descriptions.
- Rejected when the search field is empty.

Search results are displayed as clickable items. Selecting an item shows its attributes and associations, with the same nested presentation used after creation. The supplier can then edit attributes, remove relationships, or delete objects directly from the displayed result.

### Customer Interface

After logging in, the customer can browse and configure the available catalogue.

#### Product Catalogue

The customer home page lists all top-level composite products in descending, case-sensitive alphabetical order by name. When more than 10 products are available, the list is paginated in groups of 10 using `PREVIOUS` and `NEXT` controls, which appear only when the corresponding page exists.

#### SKU Selection

Selecting a top-level product opens the configuration view. The complete product hierarchy is shown recursively, and every simple product includes a drop-down menu containing its available SKUs.

The customer must select one SKU for every simple product in the hierarchy. A configuration can then be saved with:

- A user-defined configuration name.
- The customer who created it.
- The creation date.
- The total price, calculated as the sum of the selected SKU prices.

If one or more SKU selections are missing, the application reports an error and preserves the selections already made. When the operation succeeds, a configuration detail view displays the selected SKUs and the total price.

#### Saved Configurations

The `MY CONFIGURATIONS` area lists the customer's saved configurations in descending order of creation date. Each configuration can be:

- Viewed with its selected SKUs and total price.
- Edited by reopening the SKU selection interface.
- Cloned to create a new configuration.
- Deleted.

Editing a configuration updates its selected SKUs and records the latest modification date.

---

## 🧠 Domain Constraints

The application enforces the following business rules:

1. All products belong to a single company.
2. Every simple product must be associated with at least one SKU.
3. Every saved configuration must select one SKU for every simple product.
4. Product and SKU prices must be greater than or equal to zero.
5. Composite product structures must be acyclic.
6. The product hierarchy can reach a maximum of four levels, including the top-level product.
7. A simple or composite product can belong to only one parent composite product.
8. A SKU can be associated with one or more simple products.
9. Every product, whether simple or composite, must have a unique code.
10. Deleting a product component also deletes customer configurations containing that component.

Validation is performed both on the **client side** for immediate feedback and on the **server side** to protect the application from invalid or malicious requests.

---

## 🏗️ Architecture

The application follows a layered web architecture based on asynchronous JavaScript communication with a Java Servlet backend.

### Main Flow

```text
        ┌──────────────────────┐
        │   Browser Client     │
        │ HTML + CSS + JS      │
        └──────────┬───────────┘
                   │ asynchronous requests
                   ▼
        ┌──────────────────────┐
        │    API Servlets      │
        │ Login / Supplier /   │
        │ Customer endpoints   │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │       DAO Layer      │
        │ Products / SKUs /    │
        │ Users / Configs      │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │      Database        │
        │ Persistent catalogue │
        │ and user data        │
        └──────────────────────┘
```

### Backend Modules

| Module | Responsibility |
|--------|----------------|
| `api` | Servlet endpoints for authentication, logout, supplier operations, and customer operations |
| `beans` | Java domain objects representing users, products, SKUs, and configurations |
| `dao` | Database access and persistence operations for each main entity |
| `webapp` | HTML entry points, JavaScript controllers, stylesheets, and static assets |
| `utilities` | Project utilities and supporting resources |

### Request Lifecycle

1. The user performs an action in the browser.
2. JavaScript validates the input and builds an asynchronous request.
3. The corresponding Servlet verifies the session, role, and parameters.
4. The relevant DAO executes the database operation.
5. The server returns the operation result.
6. JavaScript updates only the affected portion of the page.

---

## 🏗️ Implementation Details

### JavaScript Frontend

The JavaScript implementation is organized around role-specific modules:

- `login.js` manages authentication requests and login feedback.
- `js/fornitore/` contains supplier-side catalogue and hierarchy management logic.
- `js/cliente/` contains customer-side product browsing, SKU selection, and configuration management logic.
- `cliente.html` and `fornitore.html` provide the main role-specific application containers.
- `index.html` provides the initial entry point.

The interface is designed as a single-page application for each role. Operations such as editing attributes, inserting relationships, searching, and saving configurations are handled asynchronously without requiring a complete page reload.

### Servlet API

The backend exposes Servlet-based endpoints divided into common, supplier, and customer operations:

- `Login` authenticates users and establishes the session.
- `CheckLogin` verifies session validity and access permissions.
- `Logout` invalidates the current session.
- `api/fornitore/` handles SKU creation, product hierarchy management, search, updates, relationship removal, and deletion.
- `api/cliente/` handles catalogue browsing, SKU selection, configuration creation, cloning, editing, and deletion.
- `BaseApiServlet` provides shared support for API Servlet implementations.

Every protected endpoint checks the authenticated user and prevents access to operations that do not belong to the current role.

### Domain Model

The Java beans reflect the main entities of the application:

- `Utente` — authenticated application user and role information.
- `SKU` — purchasable stock keeping unit with descriptive data and price.
- `Prodotto` — simple or composite product with hierarchical relationships.
- `Configurazione` — customer-owned selection of SKUs for a composite product.

### DAO Layer

The DAO layer isolates persistence logic from the Servlet and frontend layers:

- `UtenteDAO` manages user retrieval and authentication data.
- `SKUDAO` manages SKU creation, updates, associations, and deletion.
- `ProdottoDAO` manages simple/composite products and hierarchical relationships.
- `ConfigurazioneDAO` manages customer configurations, cloning, editing, and deletion.

This separation keeps request handling focused on application flow while centralizing database operations in dedicated classes.

---

## 🧪 Validation and Security

The application follows the project requirements by validating data at multiple levels:

| Validation Area | Implementation |
|-----------------|----------------|
| **Client-side validation** | Immediate checks performed by JavaScript before sending requests |
| **Server-side validation** | Servlet-level verification of parameters, sessions, roles, and business rules |
| **Role protection** | Supplier and customer endpoints reject unauthorized operations |
| **Hierarchy validation** | Prevents cycles, invalid parent relationships, and excessive depth |
| **Configuration validation** | Ensures that every simple product has a selected SKU before saving |
| **Price validation** | Rejects negative prices for products and SKUs |
| **Session management** | Login creates a session, protected calls verify it, and logout invalidates it |

The server-side checks are essential because client-side validation alone cannot prevent manipulated requests or malicious parameter values.

---

## 🧪 Testing and Edge Cases

The main scenarios covered by the application include:

| Test | Scenario | Expected Result |
|------|----------|-----------------|
| **T1** | Login with valid credentials | ✅ User is authenticated and redirected to the correct role interface |
| **T2** | Login with invalid credentials | ✅ Authentication fails with an error message |
| **T3** | Supplier creates a SKU with valid data | ✅ SKU is stored and displayed in the interface |
| **T4** | Supplier creates a simple product without SKUs | ✅ Operation is rejected because at least one SKU is required |
| **T5** | Supplier creates a composite product | ✅ Product hierarchy is displayed as a nested structure |
| **T6** | Supplier attempts to create a cyclic hierarchy | ✅ Operation is rejected by validation rules |
| **T7** | Supplier searches for a product or SKU | ✅ Case-insensitive matching returns clickable results |
| **T8** | Supplier removes a relationship | ✅ Association is removed while the object remains available when applicable |
| **T9** | Customer browses top-level products | ✅ Products are sorted and paginated in groups of 10 |
| **T10** | Customer saves an incomplete configuration | ✅ Error is shown and previous selections are preserved |
| **T11** | Customer saves a complete configuration | ✅ Configuration is stored with date, owner, selected SKUs, and total price |
| **T12** | Customer edits, clones, or deletes a configuration | ✅ The corresponding operation updates the customer's saved configurations |
| **T13** | Unauthorized role calls a protected endpoint | ✅ Server rejects the operation |
| **T14** | User logs out | ✅ Session is invalidated and the user returns to the login page |

---

## 📁 Repository Structure

```text
├── src/
│   └── main/
│       ├── java/it/polimi/progetto_tiw_js/
│       │   ├── api/                    # Servlet API endpoints
│       │   │   ├── BaseApiServlet.java
│       │   │   ├── CheckLogin.java
│       │   │   ├── Login.java
│       │   │   ├── Logout.java
│       │   │   ├── cliente/             # Customer endpoints
│       │   │   └── fornitore/           # Supplier endpoints
│       │   ├── beans/                   # Domain entities
│       │   │   ├── Configurazione.java
│       │   │   ├── Prodotto.java
│       │   │   ├── SKU.java
│       │   │   └── Utente.java
│       │   └── dao/                     # Database access objects
│       │       ├── ConfigurazioneDAO.java
│       │       ├── ProdottoDAO.java
│       │       ├── SKUDAO.java
│       │       └── UtenteDAO.java
│       └── webapp/
│           ├── index.html               # Login / entry page
│           ├── cliente.html             # Customer single-page interface
│           ├── fornitore.html           # Supplier single-page interface
│           ├── js/
│           │   ├── login.js             # Authentication logic
│           │   ├── cliente/             # Customer-side JavaScript
│           │   └── fornitore/           # Supplier-side JavaScript
│           ├── assets/                   # CSS and static assets
│           └── WEB-INF/                 # Web application configuration
├── utilities/                            # Supporting utilities
├── .mvn/                                 # Maven Wrapper configuration
├── mvnw                                  # Maven Wrapper for Unix systems
├── mvnw.cmd                              # Maven Wrapper for Windows
├── pom.xml                               # Maven project configuration
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Java 25+**.
- **Maven**, or the included Maven Wrapper.
- A Servlet-compatible application server, such as **Apache Tomcat**.
- A relational database configured according to the application's DAO layer.
- A modern web browser with JavaScript enabled.

### Build Instructions

```bash
# Clone the repository
git clone https://github.com/lucasciarinii/progetto_tiw_js.git
cd progetto_tiw_js

# Build the project with Maven
./mvnw clean package

# On Windows, use:
# mvnw.cmd clean package
```

Deploy the generated web application artifact to a compatible Servlet container, configure the database connection, start the server, and open the application entry point in a browser.

### Application Flow

1. Open the login page.
2. Sign in with a supplier or customer account.
3. Use the role-specific single-page interface.
4. Log out through the `LOGOUT` control to invalidate the session.

---

## 📄 License

This project was developed as a final exam assignment for the **Tecnologie Informatiche per il Web (TIW)** course at **Politecnico di Milano** (A.Y. 2025/2026).  
**Final grade:** 30/30.  

Authors:
- Luca Sciarini
- Leonardo Taccari
  
All rights reserved.
