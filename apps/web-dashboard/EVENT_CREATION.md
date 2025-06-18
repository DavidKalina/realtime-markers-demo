# Event Creation Feature

This document describes the event creation functionality implemented in the web dashboard.

## Overview

The event creation feature allows users to create both public and private events through a web interface. It's based on the React Native implementation but adapted for web use.

## Components

### CreateEventForm

- **Location**: `src/components/dashboard/CreateEventForm.tsx`
- **Purpose**: Main form component for creating events
- **Features**:
  - Toggle between public and private events
  - Form validation (required fields, future date validation)
  - Location search with Google Places API integration
  - Friend selection for private events
  - Real-time error handling

### LocationSearch

- **Location**: `src/components/dashboard/LocationSearch.tsx`
- **Purpose**: Search and select locations using Google Places API
- **Features**:
  - Debounced search with 500ms delay
  - Real-time place suggestions
  - Location details (rating, distance, place types)
  - Selected location display with clear option
  - Error handling and loading states

### API Service

- **Location**: `src/services/api.ts`
- **Purpose**: Handles all API communication with the backend
- **Features**:
  - Event creation (public and private)
  - Place search integration
  - Job status tracking
  - Friends list fetching
  - Error handling and response formatting

## Pages

### Create Event Page

- **Location**: `src/app/events/create/page.tsx`
- **Route**: `/events/create`
- **Purpose**: Page that hosts the event creation form

### Location Demo Page

- **Location**: `src/app/events/location-demo/page.tsx`
- **Route**: `/events/location-demo`
- **Purpose**: Demo page to test location search functionality

### Events List Page

- **Location**: `src/app/events/page.tsx`
- **Route**: `/events`
- **Purpose**: Lists all events with a link to create new events

## Features

### Public Events

- Immediately created and available
- No friend invitations required
- Standard event data (title, description, date, location)

### Private Events

- Processed asynchronously via job queue
- Require friend invitations
- Return job ID for status tracking
- Enhanced with AI processing (emoji generation, categorization)

### Location Search

- **Google Places API Integration**: Search for venues, restaurants, landmarks
- **Debounced Search**: 500ms delay to prevent excessive API calls
- **Location Context**: Uses user coordinates for better search results
- **Rich Results**: Displays ratings, distance, place types, and location notes
- **Smart Selection**: Auto-fills coordinates and address when location is selected

### Form Validation

- Required fields: title, date, time, location
- Minimum 15-minute future scheduling
- Friend selection required for private events
- Real-time error display

### Location Handling

- **Search-based Selection**: Users can search for places instead of manual coordinate entry
- **Auto-coordinates**: Automatically fills latitude/longitude from selected place
- **Address Auto-fill**: Populates address field from place data
- **Location Notes**: AI-generated context about the selected location
- **Additional Details**: Manual input for room numbers, floor details, etc.

## API Endpoints Used

- `POST /api/events` - Create public events
- `POST /api/events/private` - Create private events
- `POST /api/places/search` - Search for places using Google Places API
- `POST /api/places/search-city-state` - Search for cities and states
- `GET /api/friends` - Get user's friends list
- `GET /api/jobs/{jobId}` - Get job status (for private events)

## UI Components Used

- **Button**: Action buttons and form submission
- **Input**: Text and number inputs
- **Textarea**: Multi-line text input
- **Label**: Form field labels
- **Card**: Container for form sections and search results
- **Badge**: Status indicators and place types
- **Select**: Dropdown selections (if needed)

## Location Search Features

### Search Functionality

- **Debounced Input**: Prevents excessive API calls while typing
- **Real-time Results**: Shows search results as you type
- **Rich Place Data**: Displays name, address, rating, distance, and place types
- **Click Outside**: Closes search results when clicking outside
- **Clear Function**: Easy way to clear selected location

### Result Display

- **Place Name**: Primary identifier for the location
- **Full Address**: Complete formatted address
- **Rating Information**: Star rating and review count (when available)
- **Distance**: Shows distance from user's location
- **Place Types**: Categories like "restaurant", "park", "museum"
- **Location Notes**: AI-generated context about the place

### Selection Process

1. User types in search box
2. Results appear after 500ms delay
3. User clicks on desired location
4. Location details are auto-filled
5. Selected location is displayed with clear option

## Future Enhancements

1. **Authentication Integration**: Connect with existing auth system
2. **Real-time Updates**: WebSocket integration for job status
3. **Map Integration**: Visual location selection with map interface
4. **File Upload**: Event image upload capability
5. **Rich Text Editor**: Enhanced description editing
6. **Recurring Events**: Support for recurring event patterns
7. **Categories**: Event categorization system
8. **Timezone Support**: Proper timezone handling
9. **Geolocation**: Get user's current location automatically
10. **Recent Searches**: Save and display recent location searches

## Usage

1. Navigate to `/events/create`
2. Choose event type (public or private)
3. Fill in required fields
4. **Search for location**: Type venue name, address, or landmark
5. Select location from search results
6. For private events, select friends to invite
7. Submit the form
8. For private events, monitor job status via the returned job ID

## Testing Location Search

1. Navigate to `/events/location-demo`
2. Try searching for various places:
   - "Starbucks"
   - "Central Park"
   - "Times Square"
   - "Golden Gate Bridge"
   - Restaurant names
   - Venue names
3. Select different locations to see the data structure
4. Test the clear functionality

## Error Handling

- Network errors are caught and displayed to users
- Form validation errors are shown inline
- API errors are parsed and displayed as user-friendly messages
- Fallback to mock data when API calls fail
- Location search errors are handled gracefully

## Styling

The component uses Tailwind CSS classes and follows the existing design system:

- Consistent spacing and typography
- Responsive design
- Dark/light mode support
- Accessible form controls
- Hover states and transitions
- Loading indicators and animations
