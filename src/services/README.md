# Services API

This directory contains all service-related functionality for the BibleGraph application. The services are organized in a way that isolates them from UI components, improving security, maintainability, and testability.

## Architecture

The services architecture follows a layered approach:

```
UI Components
      ↓
  Services API (index.ts)
      ↓
Service Implementations
      ↓
 External Resources (Neo4j, AsyncStorage, etc.)
```

- **Services API**: A centralized access point that exposes only what UI components need
- **Service Implementations**: The actual implementation of services (not directly accessed by UI)
- **External Resources**: Databases, storage, network APIs, etc.

## How to Use the Services API

Always import from the Services API instead of directly accessing service implementations. This provides better isolation and security.

### ✅ Good Practice

```typescript
// Import from services API
import { DatabaseService, AuthService } from '../services';

// Use in your component
const MyComponent = () => {
  useEffect(() => {
    // Use the service
    DatabaseService.getVerses().then(verses => {
      // Do something with verses
    });
  }, []);
  
  return <View>...</View>;
};
```

### ❌ Bad Practice

```typescript
// AVOID direct imports from service implementations
import { neo4jDatabaseService } from '../services/neo4jDatabase';

// This bypasses the API layer and creates tight coupling
const MyComponent = () => {
  // ...
};
```

## Available Services

The following services are available through the API:

### DatabaseService

Database operations for verses, connections, notes, tags, etc.

```typescript
// Example usage
await DatabaseService.initialize();
const verses = await DatabaseService.getVerses();
const verse = await DatabaseService.getVerse('123');
```

### AuthService

Authentication and user management.

```typescript
// Example usage
const isLoggedIn = await AuthService.isAuthenticated();
const user = await AuthService.getCurrentUser();
await AuthService.login(email, password);
```

### StorageService

Local storage operations.

```typescript
// Example usage
const settings = await StorageService.getSettings();
await StorageService.saveSettings(newSettings);
```

### SyncService

Data synchronization between local storage and server.

```typescript
// Example usage
const syncSuccessful = await SyncService.syncData();
const syncStatus = SyncService.getSyncStatus();
```

### BibleDataService

Bible data loading and querying.

```typescript
// Example usage
const isLoaded = await BibleDataService.isBibleDataLoaded();
await BibleDataService.loadBibleData();
```

## Example Component

See `src/components/examples/ServiceDemoScreen.tsx` for a complete example of how to use the Services API in a React component.

## Benefits of This Approach

1. **Security**: UI components can't directly access sensitive service implementation details
2. **Maintainability**: Service implementations can change without affecting UI components
3. **Testability**: Services can be mocked more easily for testing
4. **Consistency**: All UI components access services in the same way
5. **Documentation**: Clear API boundaries make the code more understandable 