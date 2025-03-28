import { StyleSheet, Platform, Dimensions } from 'react-native';

export const theme = {
  colors: {
    // Modern metallic palette
    primary: '#4F46E5', // Deep indigo with metallic feel
    primaryDark: '#3730A3', // Darker variant
    primaryLight: '#818CF8', // Lighter variant for gradients
    secondary: '#E879F9', // Vibrant gradient-friendly pink
    secondaryDark: '#C026D3', // Darker variant
    secondaryLight: '#F5D0FE', // Lighter variant for gradients
    
    // Metallic neutrals
    background: '#FFFFFF',
    surfacePrimary: '#F8FAFF', // Cool white with slight blue tint
    surfaceSecondary: '#F3F4F6', // Light gray for secondary surfaces
    surfaceDark: '#1E293B', // Dark slate for dark surfaces
    
    // Text colors
    text: '#0F172A', // Almost black with blue undertone
    textSecondary: '#64748B', // Modern slate gray
    textLight: '#94A3B8', // Lighter text for captions
    
    // UI elements
    border: '#E2E8F0', // Subtle border
    borderLight: '#F1F5F9', // Very subtle border
    borderActive: '#CBD5E1', // More visible active border
    
    // Accent colors
    accent1: '#06B6D4', // Metallic cyan
    accent2: '#10B981', // Metallic emerald
    accent3: '#F59E0B', // Metallic amber
    accent4: '#EF4444', // Metallic red
    
    // Status colors
    success: '#059669', // Metallic green
    error: '#DC2626', // Metallic red
    warning: '#D97706', // Metallic amber
    info: '#0284C7', // Metallic blue
    
    // Card and modal surfaces
    card: '#FFFFFF',
    cardDark: '#1E293B',
    modal: 'rgba(255, 255, 255, 0.95)', // Slightly transparent for glass effect
    modalOverlay: 'rgba(15, 23, 42, 0.6)', // Dark overlay with transparency
    
    // Utility
    placeholder: '#94A3B8',
    disabled: '#E2E8F0',
    highlight: 'rgba(79, 70, 229, 0.1)', // Subtle highlight color
  },
  
  typography: {
    h1: {
      fontSize: 30,
      fontWeight: '700' as const,
      lineHeight: 38,
      color: '#0F172A',
      letterSpacing: -0.5,
    },
    h2: {
      fontSize: 24,
      fontWeight: '600' as const,
      lineHeight: 32,
      color: '#0F172A',
      letterSpacing: -0.3,
    },
    h3: {
      fontSize: 20,
      fontWeight: '600' as const,
      lineHeight: 28,
      color: '#0F172A',
      letterSpacing: -0.2,
    },
    body: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 24,
      color: '#0F172A',
    },
    bodySmall: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
      color: '#0F172A',
    },
    caption: {
      fontSize: 13,
      fontWeight: '400' as const,
      lineHeight: 18,
      color: '#64748B',
    },
    button: {
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 22,
      letterSpacing: 0.2,
    },
    tabLabel: {
      fontSize: 12,
      fontWeight: '500' as const,
      lineHeight: 16,
      letterSpacing: 0.2,
    }
  },
  
  spacing: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,
  },
  
  borderRadius: {
    xs: 2,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 24,
    full: 9999,
  },
  
  shadows: {
    // Modern metallic shadows
    sm: {
      shadowColor: '#1E293B',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.08,
      shadowRadius: 2.0,
      elevation: 1,
    },
    md: {
      shadowColor: '#1E293B',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.12,
      shadowRadius: 4.0,
      elevation: 3,
    },
    lg: {
      shadowColor: '#1E293B',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 8,
    },
    xl: {
      shadowColor: '#0F172A',
      shadowOffset: {
        width: 0,
        height: 8,
      },
      shadowOpacity: 0.20,
      shadowRadius: 16,
      elevation: 12,
    },
    float: {
      shadowColor: '#0F172A',
      shadowOffset: {
        width: 0,
        height: 10,
      },
      shadowOpacity: 0.10,
      shadowRadius: 30,
      elevation: 10,
    }
  },
  
  // Metallic gradients
  gradients: {
    primary: ['#4F46E5', '#6366F1', '#818CF8'],
    secondary: ['#C026D3', '#E879F9', '#F5D0FE'],
    success: ['#059669', '#10B981', '#34D399'],
    error: ['#DC2626', '#EF4444', '#F87171'],
    cool: ['#0369A1', '#06B6D4', '#22D3EE'],
    warm: ['#D97706', '#F59E0B', '#FBBF24'],
    gray: ['#334155', '#64748B', '#94A3B8'],
    dark: ['#020617', '#0F172A', '#1E293B'],
  },
};

export const globalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  
  // Modernized card with subtle shadows and borders
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginVertical: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    ...theme.shadows.md,
  },
  
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  
  // Metallic style input with refined border
  input: {
    height: 52,
    backgroundColor: theme.colors.surfacePrimary,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  
  // Modern primary button with slight shadow
  button: {
    height: 52,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  
  // Glass-like outline button
  buttonOutline: {
    height: 52,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    ...theme.shadows.sm,
  },
  
  buttonOutlineText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  
  // Modern header with subtle border
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    ...theme.shadows.sm,
  },
  
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.primary,
    letterSpacing: -0.2,
  },
  
  // Refined list item with subtle hover state
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  
  listItemActive: {
    backgroundColor: theme.colors.highlight,
  },
  
  // Modern pill-shaped tag
  tag: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
    backgroundColor: `${theme.colors.primary}15`,
    borderRadius: theme.borderRadius.full,
    marginRight: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
    borderWidth: 1,
    borderColor: `${theme.colors.primary}30`,
  },
  
  tagText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  
  // Glass-morphism inspired modal
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  
  modalContent: {
    backgroundColor: theme.colors.modal,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 48 : theme.spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...theme.shadows.lg,
  },
  
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: theme.colors.borderActive,
    borderRadius: theme.borderRadius.full,
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },
  
  // Glass panel for overlay cards
  glassPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
  
  // Icon button with subtle feedback
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  
  iconButtonActive: {
    backgroundColor: theme.colors.highlight,
  },
  
  // Tab bar specific styles
  tabBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderTopColor: theme.colors.borderLight,
    borderTopWidth: 1,
    height: 60,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    ...theme.shadows.md,
  },
  
  tabBarItem: {
    paddingTop: 8,
  },
  
  tabBarDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
    marginTop: 4,
  },
  
  // Badge style for notifications
  badge: {
    position: 'absolute',
    top: -2,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    ...theme.shadows.sm,
  },
  
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default theme; 