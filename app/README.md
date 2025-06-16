# RefMD - Collaborative Markdown Editor

A real-time collaborative markdown editor built with Next.js, Monaco Editor, and PostgreSQL.

## Features

- **Real-time Collaborative Editing**: Multiple users can edit the same document simultaneously
- **Operational Transform**: Conflict resolution algorithm ensures consistency across all clients
- **User Presence**: See who's online and their cursor positions
- **Rich Markdown Support**: Full-featured markdown editor with live preview
- **Persistent Storage**: Documents are saved to PostgreSQL database
- **Responsive Design**: Works on desktop and mobile devices

## Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Editor**: Monaco Editor (VS Code editor)
- **Real-time**: Socket.IO for WebSocket connections
- **Database**: PostgreSQL with operational transform storage
- **Styling**: Tailwind CSS
- **Markdown**: react-markdown with extended features

## Prerequisites

- Node.js 18+ 
- Docker and Docker Compose (for PostgreSQL)
- pnpm (recommended) or npm

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd refmd
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

```bash
cp .env.example .env.local
```

### 4. Start PostgreSQL database

```bash
pnpm db:up
```

This will start a PostgreSQL container with the necessary database schema.

### 5. Start the development server

```bash
pnpm dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

Socket.IO server will automatically initialize via API routes when the first user connects.

## Available Scripts

- `pnpm dev` - Start Next.js development server with collaboration features
- `pnpm build` - Build the application for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm db:up` - Start PostgreSQL database
- `pnpm db:down` - Stop PostgreSQL database
- `pnpm db:logs` - View database logs

## Collaboration Features

### Real-time Editing

Multiple users can edit the same document simultaneously. Changes are synchronized in real-time using operational transform to ensure consistency.

### User Presence

- See who's currently editing the document
- View other users' cursor positions and selections
- User avatars with unique colors

### Conflict Resolution

The application uses operational transform algorithms to handle concurrent edits:

1. **Operations**: All edits are converted to operations (insert, delete, retain)
2. **Transform**: Conflicting operations are transformed to maintain consistency
3. **Apply**: Transformed operations are applied to maintain document state

### Persistence

- All operations are stored in PostgreSQL
- Documents can be recovered from operation history
- User sessions track presence and cursor positions

## Architecture

### Frontend Components

- `MarkdownEditor`: Main editor component with Monaco integration
- `UserPresence`: Shows active users and their status
- `CursorOverlay`: Displays other users' cursors
- `ConnectionStatus`: Shows collaboration connection state

### Backend Services

- `CollaborationServer`: WebSocket server for real-time communication
- `DatabaseManager`: PostgreSQL operations and schema management
- `OperationalTransform`: Conflict resolution algorithms

### Database Schema

- `documents`: Store document content and versions
- `document_operations`: Track all edit operations
- `user_sessions`: Manage user presence and cursor positions

## Development

### Adding New Features

1. Frontend components go in `components/`
2. Collaboration logic in `lib/collaboration/`
3. Database operations in `lib/database.ts`
4. Hooks in `lib/hooks/`

### Testing Collaboration

1. Open multiple browser tabs to the same document
2. Start editing in different tabs
3. Observe real-time synchronization
4. Test conflict resolution by editing the same text simultaneously

## Deployment

### Production Setup

1. Build the application:
   ```bash
   pnpm build
   ```

2. Set up production PostgreSQL database

3. Configure environment variables:
   ```bash
   DATABASE_URL=postgresql://user:password@host:port/database
   NEXT_PUBLIC_WS_URL=https://your-domain.com
   NODE_ENV=production
   ```

4. Start the production server:
   ```bash
   pnpm start
   ```

### Docker Deployment

A `docker-compose.yml` is included for easy deployment with PostgreSQL.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.