# RefMD - Real-time Collaborative Markdown Editor

RefMD is a modern, real-time collaborative markdown editor with advanced features for document management, sharing, and team collaboration. Built with a Rust backend and Next.js frontend, it provides a robust platform for creating and editing markdown documents with live synchronization.

## Screenshots

### Document Editor

<div align="center">
  <img src="screenshots/editor-dark.png" alt="Document Editor Dark Theme" width="800"/>
  <p><em>Document Editor - Dark Theme with Split View</em></p>
</div>

<div align="center">
  <img src="screenshots/editor-light.png" alt="Document Editor Light Theme" width="800"/>
  <p><em>Document Editor - Light Theme with Live Preview</em></p>
</div>

### Collaboration Features

<div align="center">
  <img src="screenshots/split-view.png" alt="Split View Collaboration" width="800"/>
  <p><em>Split View - Edit Multiple Documents Simultaneously</em></p>
</div>

<div align="center">
  <img src="screenshots/collaboration-scrap.png" alt="Scrap Collaboration" width="800"/>
  <p><em>Scrap - Real-time Thread-based Discussions</em></p>
</div>

### Sharing & Publishing

<div align="center">
  <img src="screenshots/share-dialog.png" alt="Share Dialog" width="800"/>
  <p><em>Document Sharing - Permission Management</em></p>
</div>

<div align="center">
  <img src="screenshots/public-document.png" alt="Public Document View" width="800"/>
  <p><em>Public Document - Read-only Shared View</em></p>
</div>

## Features

### Core Features
- **Real-time Collaborative Editing**: Multiple users can edit documents simultaneously with instant synchronization
- **CRDT-based Conflict Resolution**: Uses Yjs/Yrs for robust conflict-free replicated data types ensuring consistency
- **User Authentication**: Secure JWT-based authentication with refresh tokens
- **Document Management**: Create, edit, delete, and organize documents with folder structure
- **Scrap Functionality**: Thread-based collaborative memo spaces for discussions and quick notes
- **File Attachments**: Upload and manage images and files within documents
- **Document Sharing**: Share documents with specific users or generate public share links
- **Live User Presence**: See who's online, their cursor positions, and active selections

### Editor Features
- **Rich Markdown Support**: Full GitHub-flavored markdown with extensions
- **Live Preview**: Side-by-side markdown editor and preview pane
- **Syntax Highlighting**: Code blocks with language-specific highlighting
- **Table of Contents**: Auto-generated, navigable table of contents
- **File Drag & Drop**: Drag files directly into the editor to upload
- **Mermaid Diagrams**: Render Mermaid diagrams directly in documents
- **PlantUML Support**: Create UML diagrams with PlantUML syntax
- **CSV Preview**: Render CSV files as formatted tables
- **Alert Blocks**: GitHub-style alert blocks (note, tip, important, warning, caution)

### Collaboration Features
- **Real-time Cursors**: See other users' cursor positions and selections
- **Connection Status**: Visual indicators for connection and sync status
- **Awareness Protocol**: Track user presence and activity
- **Persistent Sessions**: Rejoin documents with maintained state

### Scrap Features
- **Thread-based Discussions**: Create collaborative spaces for team discussions and brainstorming
- **Post Management**: Add, edit, delete, and pin posts with rich markdown support
- **Comment System**: Nested comments on individual posts for detailed discussions
- **Real-time Collaboration**: Multiple users can contribute simultaneously with live updates
- **User Presence**: See active participants and their contributions
- **Public Sharing**: Share scraps publicly via secure tokens
- **Metadata Support**: Pin important posts and track user contributions

## Technology Stack

### Backend (Rust)
- **Framework**: Axum web framework
- **Database**: PostgreSQL with SQLx
- **CRDT**: Yrs (Rust implementation of Yjs)
- **WebSockets**: Socket.IO via socketioxide
- **Authentication**: JWT with Argon2 password hashing
- **File Storage**: Local filesystem with configurable upload directory

### Frontend (TypeScript/React)
- **Framework**: Next.js 15 with React 19
- **Editor**: Monaco Editor (VS Code editor)
- **Markdown**: react-markdown with custom plugins
- **Styling**: Tailwind CSS with shadcn/ui components
- **Real-time**: Socket.IO client with Yjs provider
- **State Management**: React Context API
- **API Client**: Auto-generated TypeScript client from OpenAPI spec

### Infrastructure
- **Containerization**: Docker with multi-stage builds
- **Database Migrations**: SQLx migrate
- **API Documentation**: OpenAPI 3.0 specification

## Prerequisites

- Docker and Docker Compose (recommended)
- OR for native development:
  - Rust 1.75+
  - Node.js 18+
  - PostgreSQL 15+
  - pnpm (recommended) or npm

## Getting Started

### Using Docker Compose (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd refmd
```

2. Start the application:
```bash
docker-compose up -d
```

This will start:
- PostgreSQL database on port 5432
- Rust API server on port 8888
- Next.js frontend on port 3000

Access the application at http://localhost:3000

### Development Setup

#### 1. Database Setup

Start PostgreSQL:
```bash
docker-compose up -d postgres
```

Or use your local PostgreSQL installation.

#### 2. Backend Setup

```bash
cd api

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://refmd:refmd@localhost:5432/refmd
PORT=8888
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRY=3600
REFRESH_TOKEN_EXPIRY=604800
BCRYPT_COST=12
UPLOAD_MAX_SIZE=10485760
UPLOAD_DIR=../documents
EOF

# Run migrations
cargo install sqlx-cli
sqlx migrate run

# Start the backend
cargo run
```

#### 3. Frontend Setup

```bash
cd app

# Create .env.local file
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8888/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:8888
NEXT_PUBLIC_SITE_URL=http://localhost:3000
EOF

# Install dependencies
pnpm install

# Start the frontend
pnpm dev
```

## Usage

### Creating an Account
1. Navigate to http://localhost:3000
2. Click "Sign Up" and create an account
3. Sign in with your credentials

### Document Management
- **Create Document**: Click "New Document" in the dashboard
- **Edit Document**: Click on any document to open the editor
- **Delete Document**: Use the context menu on document cards
- **Organize**: Documents support parent-child relationships for folder structure

### Scrap Management
- **Create Scrap**: Click "New Scrap" to create a thread-based discussion space
- **Add Posts**: Click "Add Post" to contribute to the discussion
- **Pin Posts**: Use the pin icon to highlight important posts
- **Comment**: Add nested comments to individual posts for detailed discussions
- **Share Scraps**: Generate public share links for external collaboration
- **Real-time Updates**: See live updates as team members contribute

### Collaboration
1. Open a document
2. Click "Share" in the toolbar
3. Add collaborators by email or generate a public link
4. Collaborators see real-time changes and cursor positions

### File Uploads
- Drag and drop files into the editor
- Or use the upload button in the toolbar
- Supports images, CSVs, and other file types
- Files are stored securely and accessible only to authorized users

## Architecture

### Database Schema
- **users**: User accounts and authentication
- **documents**: Document metadata and content (includes scraps)
- **document_updates**: CRDT update history for synchronization
- **scrap_posts**: Individual posts within scrap threads
- **attachments**: File attachment metadata
- **shares**: Document sharing permissions
- **user_tokens**: Refresh token management

### API Endpoints
- `/api/auth/*`: Authentication endpoints
- `/api/documents/*`: Document CRUD operations
- `/api/scraps/*`: Scrap management and post operations
- `/api/files/*`: File upload and retrieval
- `/api/shares/*`: Sharing management
- `/socket.io/*`: WebSocket connections for real-time sync

### Security
- JWT-based authentication with refresh tokens
- Argon2 password hashing
- Permission-based access control
- Secure file uploads with type validation
- CORS protection

## Development

### Running Tests

Backend tests:
```bash
cd api
cargo test
```

Frontend tests:
```bash
cd app
pnpm test
```

### Building for Production

Using Docker:
```bash
docker-compose -f docker-compose.yml up -d
```

Manual build:
```bash
# Backend
cd api
cargo build --release

# Frontend
cd app
pnpm build
```

### Environment Variables

#### Backend (API)
- `DATABASE_URL`: PostgreSQL connection string
- `PORT`: API server port (default: 8888)
- `JWT_SECRET`: Secret key for JWT signing
- `JWT_EXPIRY`: Access token expiry in seconds
- `REFRESH_TOKEN_EXPIRY`: Refresh token expiry in seconds
- `BCRYPT_COST`: Argon2 hashing cost
- `UPLOAD_MAX_SIZE`: Maximum file upload size in bytes
- `UPLOAD_DIR`: Directory for file uploads

#### Frontend (App)
- `NEXT_PUBLIC_API_URL`: Backend API URL
- `NEXT_PUBLIC_SOCKET_URL`: Socket.IO server URL
- `NEXT_PUBLIC_SITE_URL`: Frontend application URL

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- Backend: Follow Rust standard formatting (`cargo fmt`)
- Frontend: ESLint and Prettier configuration included

## License

MIT License - see LICENSE file for details

## Acknowledgments

- [Yjs](https://yjs.dev/) - CRDT framework
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Code editor
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Socket.IO](https://socket.io/) - Real-time communication