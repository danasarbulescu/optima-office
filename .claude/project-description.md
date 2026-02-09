# Project Description

We are a fractional accounting firm with 500 clients and we want to offer customized reporting to our clients. We want to create an application where we can manage the clients, their data sources, and create custom reports.

We will normalize the data from all the data sources into an internal warehouse, which will be the single source of truth for all our reporting. The clients will have multiple roles and each role can be authorized to see different reports.

The reports are made of widgets (UI units). Widgets are organized in Dashboards, which in turn are organized in Packages. A client can have multiple packages, that can have multiple dashboards, that can have multiple widgets.

The application will have an admin area and a client area. The admin should be able to impersonate the client so they can see what the client sees, for debugging and support.

## Admin Area

### Data Sources

Manage different data sources. A data source has:
- Name
- Data source connection (URL/API)

### Widgets

Widgets are created via code, explaining the formula and the data that is used. Only the name of the widget can be changed via UI.

### Clients

Clients have first and last name, email, and status (Active, Archived).

#### Entities

A client has multiple Entities, which are the businesses they own and are managed by our company. The Entity's data is obtained via a data source that was already defined, using entity-specific credentials.

#### Packages & Dashboards

Packages and Dashboards are nested labels that help organize widgets, like folders, subfolders, and files. First create a package, then in that package create a dashboard. In the dashboard, select one or more widgets that were previously created.

### Data Warehouse

We will create a data warehouse to store the normalized data from all the data sources we will use. The widgets will be created based on the warehouse structure.

### Data Transformation

We need to normalize the data from each data source and data structure via a simple interface where we map the data source structure to the warehouse structure.

## Client Area

### Dashboard
### Packages

