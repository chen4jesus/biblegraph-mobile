import React, { ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { theme, globalStyles } from '../styles/theme';
import { Ionicons } from '@expo/vector-icons';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  onPress?: () => void;
  icon?: string;
  rightIcon?: string;
  onIconPress?: () => void;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  elevation?: 'sm' | 'md' | 'lg' | 'xl' | 'float';
  variant?: 'default' | 'glass' | 'outline' | 'filled';
}

const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  children,
  onPress,
  icon,
  rightIcon,
  onIconPress,
  style,
  titleStyle,
  subtitleStyle,
  elevation = 'md',
  variant = 'default',
}) => {
  // Get the appropriate shadow based on elevation
  const getShadow = () => {
    switch (elevation) {
      case 'sm':
        return theme.shadows.sm;
      case 'lg':
        return theme.shadows.lg;
      case 'xl':
        return theme.shadows.xl;
      case 'float':
        return theme.shadows.float;
      default:
        return theme.shadows.md;
    }
  };

  // Get styles based on variant
  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'glass':
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.5)',
        };
      case 'outline':
        return {
          backgroundColor: theme.colors.background,
          borderWidth: 1,
          borderColor: theme.colors.border,
        };
      case 'filled':
        return {
          backgroundColor: theme.colors.surfacePrimary,
        };
      default:
        return {
          backgroundColor: theme.colors.card,
        };
    }
  };

  const CardContent = () => (
    <View style={[styles.container, getVariantStyles(), getShadow(), style]}>
      {/* Card Header */}
      {(title || icon) && (
        <View style={styles.header}>
          {icon && (
            <TouchableOpacity
              style={styles.iconContainer}
              onPress={onIconPress}
              disabled={!onIconPress}
            >
              <Ionicons name={icon as any} size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
          <View style={styles.titleContainer}>
            {title && <Text style={[styles.title, titleStyle]}>{title}</Text>}
            {subtitle && <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text>}
          </View>
          {rightIcon && (
            <TouchableOpacity
              style={styles.rightIconContainer}
              onPress={onIconPress}
              disabled={!onIconPress}
            >
              <Ionicons name={rightIcon as any} size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Card Content */}
      <View style={styles.content}>{children}</View>
    </View>
  );

  // If onPress is provided, wrap in a TouchableOpacity
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        <CardContent />
      </TouchableOpacity>
    );
  }

  // Otherwise, just render the card
  return <CardContent />;
};

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    margin: theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  iconContainer: {
    marginRight: theme.spacing.sm,
  },
  rightIconContainer: {
    marginLeft: 'auto',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    ...theme.typography.h3,
    fontSize: 18,
    color: theme.colors.text,
  },
  subtitle: {
    ...theme.typography.caption,
    marginTop: theme.spacing.xxs,
  },
  content: {
    padding: theme.spacing.md,
  },
});

export default Card; 