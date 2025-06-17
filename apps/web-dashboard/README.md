# Web Dashboard

A modern web dashboard built with Next.js 14 and shadcn/ui components.

## Features

- ⚡ **Next.js 14** with App Router
- 🎨 **shadcn/ui** components
- 🔥 **Hot Reloading** for development
- 📱 **Responsive Design**
- 🎯 **TypeScript** support
- 🎨 **Tailwind CSS** for styling

## Development

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Docker (for containerized development)

### Running Locally

1. **Install dependencies:**

   ```bash
   # From the root directory
   pnpm install
   ```

2. **Start the development server:**

   ```bash
   # From the web-dashboard directory
   cd apps/web-dashboard
   pnpm dev
   ```

   Or from the root directory:

   ```bash
   pnpm --filter web-dashboard dev
   ```

3. **Open your browser:**
   Navigate to [http://localhost:3001](http://localhost:3001)

### Running with Docker

1. **Start all services:**

   ```bash
   docker-compose up -d
   ```

2. **Access the dashboard:**
   Navigate to [http://localhost:3001](http://localhost:3001)

### Hot Reloading

The development environment is configured with hot reloading enabled. This means:

- ✅ Changes to your code will automatically refresh the browser
- ✅ New packages installed with `pnpm add` will be available immediately
- ✅ CSS changes are applied instantly
- ✅ TypeScript errors are shown in real-time

### Adding New Packages

To add new packages to the web-dashboard:

```bash
# From the root directory
pnpm --filter web-dashboard add <package-name>

# For dev dependencies
pnpm --filter web-dashboard add -D <package-name>
```

### Adding shadcn/ui Components

To add new shadcn/ui components:

1. Install the component:

   ```bash
   pnpm --filter web-dashboard dlx shadcn@latest add <component-name>
   ```

2. The component will be available in `src/components/ui/`

### Project Structure

```
apps/web-dashboard/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── globals.css      # Global styles
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Home page
│   ├── components/          # React components
│   │   └── ui/             # shadcn/ui components
│   └── lib/                # Utility functions
├── public/                 # Static assets
├── package.json           # Dependencies
├── next.config.js         # Next.js configuration
├── tailwind.config.js     # Tailwind CSS configuration
├── tsconfig.json          # TypeScript configuration
└── Dockerfile.dev         # Development Dockerfile
```

## Building for Production

```bash
# Build the application
pnpm --filter web-dashboard build

# Start the production server
pnpm --filter web-dashboard start
```

## Docker Production Build

The production Dockerfile is located at `Dockerfile` and can be used for production deployments.

## Contributing

1. Make your changes
2. The hot reloading will automatically show your changes
3. Test your changes in the browser
4. Commit your changes

## Troubleshooting

### Hot Reloading Not Working

1. Ensure you're running in development mode (`NODE_ENV=development`)
2. Check that the source code is properly mounted as a volume in Docker
3. Verify that the Next.js dev server is running on port 3001

### Port Already in Use

If port 3001 is already in use, you can change it in:

- `docker-compose.yml` (for Docker)
- `package.json` scripts (for local development)

### TypeScript Errors

TypeScript errors will be shown in:

- The terminal where you're running the dev server
- The browser console
- Your IDE (if configured properly)
