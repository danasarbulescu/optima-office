# Project Description

We are a fractional accounting firm with 500 clients and we want to offer customized reporting to our clients. We want to create an application where we can manage the clients, their data sources, and create custom reports.

We will normalize the data from all the data sources into an internal warehouse, which will be the single source of truth for all our reporting. The clients will have multiple roles and each role can be authorized to see different reports.

The reports are based widgets (UI units). Widgets are organized in Dashboards, which in turn are organized in Packages. A client can have multiple packages, that can have multiple dashboards, that can have multiple widgets.

The application will have an admin area and a client area. The admin should be able to impersonate the client so they can see what the client sees, for debugging and support.

## Admin Area

### Data Sources Section

/data-sources
Date sources table, listing all data sources:
    id
    Created at
    Name
    Description
Clicking on a data sources row loads the data source details page.

/data-sources/id
A data source has:
- Name
- (Optional) Data source connection (URL/API). Data sources can have one ULR is being used all clients, or one URL per client which is defined.
- (Optional) token. Data sources can have one token is being used all clients, or one token per client.
Data sources can be deleted.

### Widgets Section

/widgets
Widgets table, listing all widgets:
    Id
    Created at
    Name
    Description
    Delete icon for each widget
    Column sorting
Clicking on a widget row loads the widget details page.

/widgets/id
Widgets are created via code, based on a formula, input, expected output and the data fields (from the data warehouse) that are being used. The only settings editable via UI is the name and description.
The widgets will use specific client data from the warehouse, when they are associated with a client via Dashboard & Packages. Until then, the widget will use sample data, during creation and testing.
Widgets can be deleted.

### Clients Section

/clients
Clients table, where all clients are listed:
    Id
    Created at
    Name
    Email
    Delete and Archive icons for each client
    Column sorting
Client can be deleted, which will delete all client dependencies: entities and their creds for the data sources, roles, packages, dashboards, client data from the warehouse.
Clients can be archived, which will hide the client from the clients list, and will exclude the client's data from any kind of aggregation across clients, like count.
Clicking on a client row loads the client details page.

/clients/id
Clients have first and last name, email, and status (Active, Archived).

#### Roles

After creating a client, user can create Roles, which act like clients sub-accounts, that are authorized to see certain Packages and Dashboards.
Roles are being managed in a dedicated section in the clients page, after creating a client.
The role has first and last name, email, and status (Active, Archived).
The role can be deleted.

#### Entities

After creating a client, user can create multiple Entities, which are the businesses they own and are managed by our company.
Entities are being managed in a dedicated section in the clients page (below Roles), after creating a client.
The entity has a display name.
The entity is being used to tell the application which data sources to use in order to pull the data specific to a client's business.
An entity can have attached multiple data sources, selected from the data sources created in /data-sources. Each entity data sources will have its own URL and token that will take precedence over the original data defined when we created the data source /data-sources.
The entity is also being used to segment the data of the client, by business.
Entities can be deleted, which will delete their data from the warehouse.
Entities can be arhived, which will hide the entity, and will exclude its data from any kind of aggregation.

#### Packages & Dashboards

Packages & Dashboards are being managed in a dedicated section in the clients page (below Entities), after creating a client.
Packages and Dashboards are nested labels that help organize widgets, like folders -> subfolders -> files. First create a package, then in that package create a dashboard. In the dashboard, select one or more widgets that were previously created in the widget section.
When the widget is mapped to a Dashboard, the widget will start using the specific client data from the warehouse.
Dashboards can be deleted.
Packages can be deleted, which will delete the nested Dashboards too.

### Data Warehouse

We will create a data warehouse to store the normalized data from all the data sources we will use. The normalization will be done at data ingestion, when the data source API is being called and data received. I don't have the data shape yet, so let's ignore for now.

### Data Transformation

We need to normalize the data from each data source via a simple interface where we map the data source structure to the warehouse structure. The design and exact funtionality is TBD. Let's abstract it for now.