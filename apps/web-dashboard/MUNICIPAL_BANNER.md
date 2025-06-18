# Municipal Banner System

The municipal banner system provides a configurable header component that appears across all pages in the web dashboard. It's designed specifically for municipalities to showcase their branding and provide a consistent user experience.

## Features

- **Configurable Logo**: Upload and display your municipality's logo
- **Customizable Text**: Set title and subtitle for your municipality
- **Flexible Colors**: Choose from solid colors or gradients
- **Multiple Themes**: Pre-configured themes for cities, towns, and counties
- **Real-time Preview**: See changes immediately in the configuration panel
- **Responsive Design**: Works across all device sizes

## Quick Start

### 1. Access Banner Configuration

Navigate to `/banner-config` in your dashboard to access the configuration panel.

### 2. Choose a Theme

Start with one of the pre-configured themes:

- **Frederick Theme**: Professional gray gradient (inspired by Frederick, CO)
- **City Theme**: Professional blue gradient
- **Town Theme**: Community-focused green gradient
- **County Theme**: Government purple gradient

### 3. Customize Your Banner

- **Logo**: Upload your municipality logo via URL
- **Title**: Set your municipality name (e.g., "Town of Frederick")
- **Subtitle**: Add a descriptive tagline (e.g., "Colorado")
- **Colors**: Choose background colors and text colors
- **Gradients**: Configure gradient direction and color stops

## Configuration Options

### Logo Settings

```typescript
logo: {
  src: string;        // URL to your logo image
  alt: string;        // Alt text for accessibility
  width?: number;     // Logo width (default: 40)
  height?: number;    // Logo height (default: 40)
}
```

### Text Settings

```typescript
title: string;        // Main municipality name
subtitle?: string;    // Optional subtitle/tagline
```

### Color Settings

```typescript
colors: {
  background: string | {
    type: 'solid';
    color: string;
  } | {
    type: 'gradient';
    direction: 'to-r' | 'to-l' | 'to-t' | 'to-b' | 'to-tr' | 'to-tl' | 'to-br' | 'to-bl';
    stops: string[];
  };
  text: string;       // Text color
  accent?: string;    // Optional accent color
}
```

### Layout Settings

```typescript
height?: 'sm' | 'md' | 'lg';  // Banner height (default: 'md')
showDivider?: boolean;        // Show bottom divider (default: true)
```

## Usage in Components

### Basic Usage

```tsx
import { MunicipalBanner } from "@/components/MunicipalBanner";

<MunicipalBanner config={bannerConfig} />;
```

### With Layout Wrapper

```tsx
import { LayoutWrapper } from "@/components/LayoutWrapper";

<LayoutWrapper>
  <YourPageContent />
</LayoutWrapper>;
```

### Using Context

```tsx
import { useMunicipalConfig } from "@/contexts/MunicipalConfigContext";

const { bannerConfig, updateBannerConfig, resetToDefault } =
  useMunicipalConfig();
```

## Pre-configured Themes

### Frederick Theme

- **Colors**: Gray gradient (`#1f2937` → `#374151` → `#4b5563`)
- **Text**: White (`#ffffff`)
- **Accent**: Orange (`#f59e0b`)
- **Title**: "Town of Frederick"
- **Subtitle**: "Colorado"

### City Theme

- **Colors**: Blue gradient (`#1e40af` → `#3b82f6` → `#60a5fa`)
- **Text**: White (`#ffffff`)
- **Accent**: Yellow (`#fbbf24`)
- **Title**: "City of [Your City]"
- **Subtitle**: "Municipal Services Dashboard"

### Town Theme

- **Colors**: Green gradient (`#059669` → `#10b981` → `#34d399`)
- **Text**: White (`#ffffff`)
- **Accent**: Orange (`#f59e0b`)
- **Title**: "Town of [Your Town]"
- **Subtitle**: "Community Services Portal"

### County Theme

- **Colors**: Purple gradient (`#7c3aed` → `#8b5cf6` → `#a78bfa`)
- **Text**: White (`#ffffff`)
- **Accent**: Pink (`#ec4899`)
- **Title**: "[Your County] County"
- **Subtitle**: "County Government Services"

## Demo Page

Visit `/banner-demo` to see examples of different banner configurations and test how they look before applying them to your dashboard.

## Best Practices

1. **Logo Quality**: Use high-resolution logos (minimum 80x80px) for crisp display
2. **Color Contrast**: Ensure sufficient contrast between background and text colors
3. **Text Length**: Keep titles under 30 characters and subtitles under 50 characters
4. **Brand Consistency**: Match banner colors to your municipality's official branding
5. **Accessibility**: Provide meaningful alt text for logos

## Technical Implementation

The banner system consists of several components:

- `MunicipalBanner.tsx`: Main banner component
- `MunicipalConfigContext.tsx`: Context for managing configuration state
- `LayoutWrapper.tsx`: Layout component that includes the banner
- `BannerConfigPanel.tsx`: Configuration interface
- `BannerConfigPage.tsx`: Configuration page
- `BannerDemoPage.tsx`: Demo and preview page

## Future Enhancements

- Database persistence for banner configurations
- Multiple banner themes per municipality
- Seasonal/holiday banner variations
- Advanced logo positioning options
- Banner animation effects
- Multi-language support for titles and subtitles
