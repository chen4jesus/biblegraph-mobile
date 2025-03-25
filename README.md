# Bible Graph Mobile App

A React Native mobile application for visualizing and exploring Bible verses and their connections. Built with TypeScript, React Native, and Expo.

## Features

### 1. Interactive Graph Visualization

- Visualize Bible verses as nodes and connections as edges in an interactive graph
- Pan and zoom gestures for navigation
- Different edge colors for various connection types (cross-references, themes, parallels)
- Interactive nodes and edges with selection callbacks
- Force-directed layout algorithm for optimal visualization

### 2. Offline Support

- Complete offline access to previously synced data
- Persistent storage of verses, connections, notes, and user settings
- AsyncStorage-based data persistence
- Local data editing while offline

### 3. Data Synchronization

- Background synchronization when network is available
- Smart merge strategies for resolving conflicts (latest-wins based on timestamps)
- Synchronization status tracking and management
- Network connectivity detection

### 4. User Authentication

- Secure login and registration flows
- Token-based authentication
- Session management with auto-login
- User profile management

### 5. Settings and Preferences

- Customizable reading experience (font size, line height)
- Layout preferences for the graph visualization
- Theme and appearance options
- Show/hide verse numbers and cross-references

### 6. Internationalization (i18n)

- Multi-language support with English and Chinese translations
- Language detection based on device settings
- User-selectable language preference
- Persistence of language settings
- Full localization of UI elements, error messages, and content

## Technical Architecture

### Components

- **BibleGraph**: Interactive SVG-based graph visualization component
  - Uses `react-native-svg` for rendering nodes and edges
  - Implements pan and zoom using `react-native-gesture-handler`
  - Optimized rendering with callbacks for interactions

- **LanguageProvider**: Context provider for language management
  - Provides language switching capabilities throughout the app
  - Detects and sets initial language based on device settings
  - Persists language preference using AsyncStorage

### Hooks

- **useBibleGraph**: Custom hook for graph data management
  - Handles data fetching and merging from online/offline sources
  - Manages verse and connection selection state
  - Provides methods for refreshing graph data

- **useLanguage**: Custom hook for accessing language context
  - Provides current language code and switching function
  - Exposes available languages and RTL status
  - Simplifies i18n integration throughout components

### Services

- **Neo4jService**: Type-safe API client for backend communication
  - Handles authentication, verse retrieval, connections, and notes
  - Proper error handling and response parsing
  - Token management for secure API requests

- **StorageService**: Local persistence for offline support
  - Methods for saving and retrieving verses, connections, notes, and settings
  - Efficient data storage and retrieval using AsyncStorage
  - Sync status tracking

- **SyncService**: Synchronization between online and offline storage
  - Smart conflict resolution with timestamp-based merging
  - Network connectivity checks
  - Background synchronization support

### Types and Interfaces

Comprehensive TypeScript typing for all data structures:
- Verses, Connections, Notes
- User and authentication data
- Graph nodes and edges
- Configuration and settings
- Internationalization related types

## Implementation Details

### Offline-First Architecture

The app follows an offline-first approach:
1. Data is always retrieved from local storage first
2. API requests are made in parallel to update local data
3. Data is merged with priority given to the most recently modified version
4. Changes made offline are synchronized when connectivity is restored

### Synchronization Strategy

The synchronization process:
1. Checks for network connectivity
2. Retrieves both online and offline data
3. Merges data using timestamp-based conflict resolution
4. Updates both local storage and remote server with merged data
5. Tracks last sync time for efficient future syncs

### Graph Visualization

The graph visualization component:
1. Transforms verse and connection data into nodes and edges
2. Calculates initial positions using a basic layout algorithm
3. Renders using react-native-svg with custom styles
4. Handles user interactions like panning, zooming, and selection
5. Provides callbacks for application-specific actions

## Getting Started

### Prerequisites

- Node.js (v14+)
- npm or yarn
- Expo CLI

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/biblegraph-mobile.git

# Navigate to the project directory
cd biblegraph-mobile

# Install dependencies
npm install

# Start the development server
npm start
```

### Environment Setup

Create a `.env` file in the root directory with the following variables:

```
NEO4J_API_URL=your_api_url
```

## Future Enhancements

- Implement advanced graph layout algorithms
- Add search functionality within the graph
- Enhance offline editing capabilities
- Add support for multiple Bible translations
- Implement social sharing features

# Testing

This project includes a comprehensive test suite to ensure code quality and catch bugs before deployment.

## Running Tests

To run the tests, execute:

```bash
npm test
```

This will run the basic test and Neo4j service tests which have been configured to work properly.

## Test Configuration

The testing environment is set up with:

- Jest as the test runner
- Babel configuration for TypeScript support
- Mock implementations for:
  - AsyncStorage
  - UUID generation
  - Neo4j database services

## Current Test Status

The following tests are currently working:

- Basic environment test (`__tests__/basic.test.js`)
- Neo4j Service tests (`__tests__/services/neo4j.test.ts`)

Other tests are in progress and may require additional configuration:

- Neo4jDriver tests
- React component tests (NotesScreen, etc.)

## Writing New Tests

When writing new tests:

1. Use mock implementations for external dependencies
2. For React component tests, be cautious with `requireActual` as it can lead to module resolution issues
3. For services that depend on initialization, make sure to properly mock the initialization part 