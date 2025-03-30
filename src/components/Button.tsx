import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, globalStyles } from '../styles/theme';

// Use a dynamic import to handle potential missing dependencies
let LinearGradient: any = null;
try {
  // Try to import LinearGradient, but don't fail if it's not available
  const ExpoLinearGradient = require('expo-linear-gradient');
  LinearGradient = ExpoLinearGradient.LinearGradient;
} catch (err) {
  // Linear gradient not available, we'll provide a fallback
  console.debug('LinearGradient not available, using fallback');
}

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  icon?: string;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  iconPosition = 'left',
  isLoading = false,
  disabled = false,
  style,
  textStyle,
  fullWidth = false,
  ...rest
}) => {
  // Determine button styling based on variant
  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      ...styles.button,
      opacity: disabled ? 0.6 : 1,
      ...(fullWidth && { width: '100%' }),
    };

    switch (size) {
      case 'small':
        baseStyle.height = 36;
        baseStyle.paddingHorizontal = theme.spacing.sm;
        break;
      case 'large':
        baseStyle.height = 56;
        baseStyle.paddingHorizontal = theme.spacing.xl;
        break;
      default: // medium
        baseStyle.height = 48;
        baseStyle.paddingHorizontal = theme.spacing.lg;
    }

    if (variant === 'outline') {
      return {
        ...baseStyle,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: theme.colors.primary,
      };
    } else if (variant === 'ghost') {
      return {
        ...baseStyle,
        backgroundColor: 'transparent',
      };
    } else if (variant === 'primary' && !LinearGradient) {
      // Fallback for primary without gradient
      return {
        ...baseStyle,
        backgroundColor: theme.colors.primary,
      };
    } else if (variant === 'secondary' && !LinearGradient) {
      // Fallback for secondary without gradient
      return {
        ...baseStyle,
        backgroundColor: theme.colors.secondary,
      };
    }

    return baseStyle;
  };

  // Determine text styling based on variant
  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      ...styles.buttonText,
      marginHorizontal: icon ? theme.spacing.xs : 0,
    };

    switch (size) {
      case 'small':
        baseStyle.fontSize = 14;
        break;
      case 'large':
        baseStyle.fontSize = 18;
        break;
      default: // medium
        baseStyle.fontSize = 16;
    }

    if (variant === 'outline' || variant === 'ghost') {
      return {
        ...baseStyle,
        color: theme.colors.primary,
      };
    }

    return baseStyle;
  };

  // Get icon color based on variant
  const getIconColor = () => {
    if (variant === 'outline' || variant === 'ghost') {
      return theme.colors.primary;
    }
    return '#FFFFFF';
  };

  // Get icon size based on button size
  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 16;
      case 'large':
        return 24;
      default:
        return 20;
    }
  };

  // Determine gradient colors based on variant
  const getGradientColors = () => {
    if (variant === 'secondary') {
      return theme.gradients?.secondary || ['#C026D3', '#E879F9', '#F5D0FE'];
    }
    return theme.gradients?.primary || ['#4F46E5', '#6366F1', '#818CF8'];
  };

  // Render button content based on loading state
  const renderContent = () => {
    if (isLoading) {
      return <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? theme.colors.primary : '#FFFFFF'} />;
    }

    return (
      <>
        {icon && iconPosition === 'left' && (
          <Ionicons
            name={icon as any}
            size={getIconSize()}
            color={getIconColor()}
            style={styles.leftIcon}
          />
        )}
        <Text style={[getTextStyle(), textStyle]}>{title}</Text>
        {icon && iconPosition === 'right' && (
          <Ionicons
            name={icon as any}
            size={getIconSize()}
            color={getIconColor()}
            style={styles.rightIcon}
          />
        )}
      </>
    );
  };

  // Main render
  if ((variant === 'primary' || variant === 'secondary') && LinearGradient) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || isLoading}
        style={[getButtonStyle(), style]}
        activeOpacity={0.8}
        {...rest}
      >
        <LinearGradient
          colors={getGradientColors()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          {renderContent()}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || isLoading}
      style={[getButtonStyle(), style]}
      activeOpacity={0.7}
      {...rest}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    ...theme.shadows.sm,
    overflow: 'hidden',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  leftIcon: {
    marginRight: theme.spacing.xs,
  },
  rightIcon: {
    marginLeft: theme.spacing.xs,
  },
});

export default Button; 