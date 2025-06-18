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
  - Location input (coordinates and address)
  - Friend selection for private events
  - Real-time error handling

### API Service

- **Location**: `src/services/api.ts`
- **Purpose**: Handles all API communication with the backend
- **Features**:
  - Event creation (public and private)
  - Job status tracking
  - Friends list fetching
  - Error handling and response formatting

## Pages

### Create Event Page

- **Location**: `src/app/events/create/page.tsx`
- **Route**: `/events/create`
- **Purpose**: Page that hosts the event creation form

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

### Form Validation

- Required fields: title, date, time
- Minimum 15-minute future scheduling
- Friend selection required for private events
- Real-time error display

### Location Handling

- Coordinate input (latitude/longitude)
- Address field
- Location notes for additional details
- GeoJSON format for backend compatibility

## API Endpoints Used

- `POST /api/events` - Create public events
- `POST /api/events/private` - Create private events
- `GET /api/friends` - Get user's friends list
- `GET /api/jobs/{jobId}` - Get job status (for private events)

## UI Components Used

- **Button**: Action buttons and form submission
- **Input**: Text and number inputs
- **Textarea**: Multi-line text input
- **Label**: Form field labels
- **Card**: Container for form sections
- **Badge**: Status indicators
- **Select**: Dropdown selections (if needed)

## Future Enhancements

1. **Authentication Integration**: Connect with existing auth system
2. **Real-time Updates**: WebSocket integration for job status
3. **Map Integration**: Visual location selection
4. **File Upload**: Event image upload capability
5. **Rich Text Editor**: Enhanced description editing
6. **Recurring Events**: Support for recurring event patterns
7. **Categories**: Event categorization system
8. **Timezone Support**: Proper timezone handling

## Usage

1. Navigate to `/events/create`
2. Choose event type (public or private)
3. Fill in required fields
4. For private events, select friends to invite
5. Submit the form
6. For private events, monitor job status via the returned job ID

## Error Handling

- Network errors are caught and displayed to users
- Form validation errors are shown inline
- API errors are parsed and displayed as user-friendly messages
- Fallback to mock data when API calls fail

## Styling

The component uses Tailwind CSS classes and follows the existing design system:

- Consistent spacing and typography
- Responsive design
- Dark/light mode support
- Accessible form controls
