# Dashboard Loading Implementation

This directory contains the essential loading components for the dashboard.

## Components

### DashboardTabs

Enhanced tab navigation with loading states:

- Shows loading spinner on active tab during navigation
- Disables other tabs while navigating
- Preloads routes on hover for better performance

### RouteLoadingIndicator

Simple top-of-page loading bar that appears during route transitions.

### LoadingSpinner

Background-agnostic loading spinner with customizable message.

### PageSkeleton

Reusable skeleton loading component using theme-aware colors.

### LazyPageWrapper

Simple wrapper for lazy loading content with Suspense.

## Usage

### In Pages

```tsx
// Use Next.js loading.tsx files (automatic)
// apps/web-dashboard/src/app/dashboard/loading.tsx

// Or wrap content with LazyPageWrapper
<LazyPageWrapper fallback={<LoadingSpinner message="Loading..." />}>
  <YourPageContent />
</LazyPageWrapper>
```

### Route Preloading

```tsx
import { useRoutePreloader } from "@/utils/preloadUtils";

const { preloadRoute } = useRoutePreloader();
preloadRoute("/dashboard"); // Preloads the route
```

## What's Included

- ✅ Enhanced tab loading states
- ✅ Route preloading on hover
- ✅ Next.js loading.tsx files for each route
- ✅ Background-agnostic loading spinners
- ✅ Simple route loading indicator

## Design Philosophy

- **Background-agnostic**: Uses theme colors (`bg-muted`, `text-muted-foreground`) that work with any background
- **Simple**: Clean loading spinners instead of complex skeletons
- **Consistent**: Same loading pattern across all routes
- **Minimal**: No global loading states, just route-specific loading

## What's Removed

- ❌ Global loading context (overkill)
- ❌ Progress indicators (not essential)
- ❌ Complex data preloading
- ❌ Custom navigation hooks
