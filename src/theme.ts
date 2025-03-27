// src/theme.ts
const theme = {
  colors: {
    primary: '#1e88e5',    // Primary blue
    secondary: '#43a047',  // Secondary green
    accent: '#9c27b0',     // Accent purple
    background: '#f5f5f5', // Light background
    surface: '#ffffff',    // Surface white
    error: '#d32f2f',      // Error red
    text: '#212121',       // Primary text
    textSecondary: '#757575', // Secondary text
    disabled: '#bdbdbd',   // Disabled color
    
    // Connection types
    connection: '#9e9e9e',                // Default connection color
    crossReferenceConnection: '#1e88e5',  // Blue for cross references
    thematicConnection: '#43a047',        // Green for thematic connections
    prophecyConnection: '#ffb300',        // Amber for prophecy connections
    
    // Node types
    verseNode: '#1e88e5',   // Blue for verse nodes
    groupNode: '#43a047',   // Green for group nodes
    noteNode: '#ffb300',    // Amber for note nodes
    tagNode: '#e53935',     // Red for tag nodes
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  
  borderRadius: {
    small: 4,
    medium: 8,
    large: 12,
    circle: 9999,
  },
  
  typography: {
    fontFamily: {
      regular: 'System',
      medium: 'System-Medium',
      semibold: 'System-Semibold',
      bold: 'System-Bold',
    },
    fontSize: {
      tiny: 10,
      caption: 12,
      body: 14,
      subheading: 16,
      title: 18,
      heading: 20,
      display: 24,
      large: 30,
    },
  },
  
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.18,
      shadowRadius: 1.0,
      elevation: 1,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
      elevation: 3,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.30,
      shadowRadius: 4.65,
      elevation: 8,
    },
  },
};

export default theme;